import "reflect-metadata";
import { AsyncLocalStorage } from "node:async_hooks";
import { container, type DependencyContainer, Lifecycle } from "tsyringe";
import type { output, ZodType } from "zod";
import { MODULE_KEY } from "../decorators/di.decorators.js";
import { WS_GATEWAY_KEY } from "../decorators/ws.decorators.js";
import { ConfigService, LoggerService } from "../services/index.js";
import type {
  BeforeApplicationShutdown,
  Constructor,
  DynamicModule,
  ErrorContext,
  ExceptionFilterLike,
  GuardLike,
  InjectionToken,
  InterceptorLike,
  LoggerOptions,
  ModuleImport,
  ModuleMeta,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  OnErrorCallback,
  OnModuleDestroy,
  OnModuleInit,
  PipeLike,
  Provider,
} from "../types.js";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "./app-tokens.js";
import { CONFIG_TOKEN } from "./config.js";
import { type AppLogger, createLogger, LOGGER_TOKEN } from "./logger.js";
import { Reflector } from "./reflector.js";

type ModuleLoadKey = Constructor | string;

type DynamicModuleMeta = Omit<DynamicModule, "module" | "id">;

interface ResolvedModuleMeta {
  providers: Provider[];
  controllers: Constructor[];
  httpControllers: Constructor[];
  imports: ModuleImport[];
  exports: InjectionToken[];
  global: boolean;
}

interface ModuleRef {
  key: ModuleLoadKey;
  moduleClass: Constructor;
  container: DependencyContainer;
  meta: ResolvedModuleMeta;
  providers: Set<InjectionToken>;
  exportedTokens: Set<InjectionToken>;
  imports: ModuleRef[];
}

interface LifecycleTargetRef {
  container: DependencyContainer;
  target: Constructor;
}

interface RequestResolutionContext {
  originScope: DependencyContainer;
  originModuleRef?: ModuleRef;
  scopesByModule: Map<ModuleRef, DependencyContainer>;
}

function isDynamicModule(value: ModuleImport): value is DynamicModule {
  return typeof value === "object" && value !== null && "module" in value && typeof value.module === "function";
}

function getProviderToken(provider: Provider): InjectionToken {
  if (typeof provider === "function") {
    return provider;
  }

  return provider.provide;
}

function tokenToString(token: InjectionToken): string {
  if (typeof token === "string") {
    return token;
  }

  if (typeof token === "symbol") {
    return token.toString();
  }

  if (typeof token === "function") {
    return token.name || "<anonymous constructor>";
  }

  return String(token);
}

function enhancerKey(value: unknown): unknown {
  if (typeof value === "function") {
    return value;
  }

  if (value && typeof value === "object") {
    const maybeCtor = (value as { constructor?: unknown }).constructor;
    if (maybeCtor && maybeCtor !== Object) {
      return maybeCtor;
    }
  }

  return value;
}

function pushUniqueEnhancer<T>(values: T[], value: T): T[] {
  const key = enhancerKey(value);

  if (values.some((current) => enhancerKey(current) === key)) {
    return values;
  }

  return [...values, value];
}

function isAppEnhancerToken(token: InjectionToken): boolean {
  return token === APP_GUARD || token === APP_INTERCEPTOR || token === APP_PIPE || token === APP_FILTER;
}

function normalizeLifecycleError(error: unknown, phase: string): Error {
  if (error instanceof Error) {
    return new Error(`[${phase}] ${error.message}`, { cause: error });
  }

  return new Error(`[${phase}] ${String(error)}`);
}

function hasLifecycleHooks(target: Constructor): boolean {
  const prototype = target.prototype as Partial<
    OnModuleInit & OnApplicationBootstrap & OnModuleDestroy & BeforeApplicationShutdown & OnApplicationShutdown
  >;

  return (
    typeof prototype.onModuleInit === "function" ||
    typeof prototype.onApplicationBootstrap === "function" ||
    typeof prototype.onModuleDestroy === "function" ||
    typeof prototype.beforeApplicationShutdown === "function" ||
    typeof prototype.onApplicationShutdown === "function"
  );
}

function normalizeSignatureValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const valueType = typeof value;

  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return value;
  }

  if (valueType === "bigint") {
    return `[bigint:${value.toString()}]`;
  }

  if (valueType === "symbol") {
    return `[symbol:${(value as symbol).toString()}]`;
  }

  if (valueType === "function") {
    const fn = value as Function;
    return `[fn:${fn.name || "<anonymous>"}]`;
  }

  if (value instanceof Date) {
    return `[date:${value.toISOString()}]`;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return "[circular]";
    }

    seen.add(value);
    const normalized = value.map((item) => normalizeSignatureValue(item, seen));
    seen.delete(value);
    return normalized;
  }

  if (valueType === "object") {
    const objectValue = value as Record<string, unknown>;

    if (seen.has(objectValue)) {
      return "[circular]";
    }

    seen.add(objectValue);

    const normalized: Record<string, unknown> = {};
    const entries = Object.entries(objectValue).sort(([left], [right]) => left.localeCompare(right));

    for (const [key, currentValue] of entries) {
      normalized[key] = normalizeSignatureValue(currentValue, seen);
    }

    seen.delete(objectValue);
    return normalized;
  }

  return String(value);
}

function createDynamicModuleSignature(meta: DynamicModuleMeta): string {
  return JSON.stringify(normalizeSignatureValue(meta));
}

export class AppContainer {
  private readonly root: DependencyContainer;
  private readonly loadedModules = new Map<ModuleLoadKey, ModuleRef>();
  private readonly dynamicModuleSignatures = new Map<string, string>();
  private readonly globalExportOwners = new Map<InjectionToken, string>();
  private readonly loadingModules = new Set<ModuleLoadKey>();
  private readonly rpcControllerSet = new Set<Constructor>();
  private readonly httpControllerSet = new Set<Constructor>();
  private readonly wsGatewaySet = new Set<Constructor>();
  private readonly rpcControllerModules = new Map<Constructor, ModuleRef>();
  private readonly httpControllerModules = new Map<Constructor, ModuleRef>();
  private readonly wsGatewayModules = new Map<Constructor, ModuleRef>();
  private readonly lifecycleTargets: LifecycleTargetRef[] = [];
  private readonly requestScopeOwners = new WeakMap<DependencyContainer, ModuleRef | undefined>();
  private readonly requestScopeLinkedScopes = new WeakMap<DependencyContainer, Set<DependencyContainer>>();
  private readonly requestContextStorage = new AsyncLocalStorage<RequestResolutionContext>();

  private rootModuleRef: ModuleRef | null = null;
  private controllers: Constructor[] = [];
  private httpControllers: Constructor[] = [];
  private wsGateways: Constructor[] = [];
  private lifecycleInstances: unknown[] | null = null;
  private initialized = false;
  private closed = false;
  private exposeInternalErrors = false;
  private onErrorCallback: OnErrorCallback | undefined;

  private globalGuards: GuardLike[] = [];
  private globalInterceptors: InterceptorLike[] = [];
  private globalPipes: PipeLike[] = [];
  private globalFilters: ExceptionFilterLike[] = [];

  constructor() {
    this.root = container.createChildContainer();
    this.setConfig(process.env);
    this.setLogger(createLogger());
    this.root.registerSingleton(ConfigService, ConfigService);
    this.root.registerSingleton(LoggerService, LoggerService);
    this.root.registerSingleton(Reflector, Reflector);
  }

  private addLifecycleTarget(containerRef: DependencyContainer, target: Constructor): void {
    if (!hasLifecycleHooks(target)) {
      return;
    }

    const exists = this.lifecycleTargets.some((item) => item.container === containerRef && item.target === target);

    if (exists) {
      return;
    }

    this.lifecycleTargets.push({ container: containerRef, target });
    this.lifecycleInstances = null;
  }

  private getLifecycleInstances(): unknown[] {
    if (this.lifecycleInstances) {
      return this.lifecycleInstances;
    }

    const instances = this.lifecycleTargets.map(({ container, target }) => container.resolve(target));
    this.lifecycleInstances = instances;

    return instances;
  }

  private normalizeModuleImport(moduleImport: ModuleImport): {
    key: ModuleLoadKey;
    moduleClass: Constructor;
    dynamicMeta?: DynamicModuleMeta;
    dynamicSignature?: string;
    dynamicId?: string;
  } {
    if (isDynamicModule(moduleImport)) {
      const { module, id, ...dynamicMeta } = moduleImport;
      const normalizedId = typeof id === "string" && id.trim().length > 0 ? id.trim() : "__default__";

      return {
        key: `dynamic:${module.name || "<anonymous module>"}:${normalizedId}`,
        moduleClass: module,
        dynamicMeta,
        dynamicSignature: createDynamicModuleSignature(dynamicMeta),
        dynamicId: normalizedId,
      };
    }

    return {
      key: moduleImport,
      moduleClass: moduleImport,
    };
  }

  private readModuleMetadata(moduleClass: Constructor): ModuleMeta {
    const meta = Reflect.getMetadata(MODULE_KEY, moduleClass) as ModuleMeta | undefined;

    if (!meta) {
      throw new Error(`Invalid module: ${moduleClass.name || "<anonymous module>"} has no @Module() metadata`);
    }

    return meta;
  }

  private mergeModuleMetadata(staticMeta: ModuleMeta, dynamicMeta?: DynamicModuleMeta): ResolvedModuleMeta {
    return {
      providers: [...(staticMeta.providers ?? []), ...(dynamicMeta?.providers ?? [])],
      controllers: [...(staticMeta.controllers ?? []), ...(dynamicMeta?.controllers ?? [])],
      httpControllers: [...(staticMeta.httpControllers ?? []), ...(dynamicMeta?.httpControllers ?? [])],
      imports: [...(staticMeta.imports ?? []), ...(dynamicMeta?.imports ?? [])],
      exports: [...(staticMeta.exports ?? []), ...(dynamicMeta?.exports ?? [])],
      global: dynamicMeta?.global ?? staticMeta.global ?? false,
    };
  }

  private collectProviderTokens(providers: Provider[]): Set<InjectionToken> {
    const tokens = new Set<InjectionToken>();

    for (const provider of providers) {
      tokens.add(getProviderToken(provider));
    }

    return tokens;
  }

  private linkImportedExports(moduleRef: ModuleRef): void {
    for (const importedRef of moduleRef.imports) {
      for (const token of importedRef.exportedTokens) {
        if (moduleRef.providers.has(token)) {
          continue;
        }

        if (moduleRef.container.isRegistered(token, false)) {
          continue;
        }

        moduleRef.container.register(token, {
          useFactory: () => this.resolveTokenFromModuleScope(importedRef, token),
        });
      }
    }
  }

  private resolveAppEnhancerInstance<T>(moduleRef: ModuleRef, provider: Exclude<Provider, Constructor>): T {
    if ("useValue" in provider) {
      return provider.useValue as T;
    }

    if ("useFactory" in provider) {
      return provider.useFactory(moduleRef.container) as T;
    }

    if ("useExisting" in provider) {
      return moduleRef.container.resolve(provider.useExisting) as T;
    }

    if (!moduleRef.container.isRegistered(provider.useClass, false)) {
      moduleRef.container.register(provider.useClass, { useClass: provider.useClass }, provider.options);
      this.addLifecycleTarget(moduleRef.container, provider.useClass);
    }

    return moduleRef.container.resolve(provider.useClass as InjectionToken<T>);
  }

  private registerAppEnhancerProvider(moduleRef: ModuleRef, provider: Provider): boolean {
    if (typeof provider === "function") {
      return false;
    }

    if (provider.provide === APP_GUARD) {
      const guard = this.resolveAppEnhancerInstance<GuardLike>(moduleRef, provider);
      this.globalGuards = pushUniqueEnhancer(this.globalGuards, guard);
      return true;
    }

    if (provider.provide === APP_INTERCEPTOR) {
      const interceptor = this.resolveAppEnhancerInstance<InterceptorLike>(moduleRef, provider);
      this.globalInterceptors = pushUniqueEnhancer(this.globalInterceptors, interceptor);
      return true;
    }

    if (provider.provide === APP_PIPE) {
      const pipe = this.resolveAppEnhancerInstance<PipeLike>(moduleRef, provider);
      this.globalPipes = pushUniqueEnhancer(this.globalPipes, pipe);
      return true;
    }

    if (provider.provide === APP_FILTER) {
      const filter = this.resolveAppEnhancerInstance<ExceptionFilterLike>(moduleRef, provider);
      this.globalFilters = pushUniqueEnhancer(this.globalFilters, filter);
      return true;
    }

    return false;
  }

  private registerProvider(moduleRef: ModuleRef, provider: Provider): void {
    if (this.registerAppEnhancerProvider(moduleRef, provider)) {
      return;
    }

    if (typeof provider === "function") {
      moduleRef.container.registerSingleton(provider, provider);
      this.addLifecycleTarget(moduleRef.container, provider);
      return;
    }

    if ("useValue" in provider) {
      moduleRef.container.registerInstance(provider.provide, provider.useValue);
      return;
    }

    if ("useFactory" in provider) {
      moduleRef.container.register(provider.provide, {
        useFactory: (dc) => provider.useFactory(dc),
      });
      return;
    }

    if ("useExisting" in provider) {
      moduleRef.container.register(provider.provide, { useToken: provider.useExisting }, provider.options);
      return;
    }

    moduleRef.container.register(provider.provide, { useClass: provider.useClass }, provider.options);
    this.addLifecycleTarget(moduleRef.container, provider.useClass);
  }

  private resolveModuleExports(moduleRef: ModuleRef): Set<InjectionToken> {
    const exportedTokens = new Set<InjectionToken>();

    for (const token of moduleRef.meta.exports) {
      const exportedBySelf = moduleRef.providers.has(token);
      const exportedByImport = moduleRef.imports.some((imported) => imported.exportedTokens.has(token));

      if (!exportedBySelf && !exportedByImport) {
        const moduleName = moduleRef.moduleClass.name || "<anonymous module>";
        throw new Error(`Module ${moduleName} exports unknown token: ${String(token)}`);
      }

      exportedTokens.add(token);
    }

    return exportedTokens;
  }

  private registerGlobalExports(moduleRef: ModuleRef): void {
    const moduleOwner =
      typeof moduleRef.key === "string" ? moduleRef.key : moduleRef.moduleClass.name || "<anonymous module>";

    for (const token of moduleRef.exportedTokens) {
      if (isAppEnhancerToken(token)) {
        continue;
      }

      const existingOwner = this.globalExportOwners.get(token);
      if (existingOwner && existingOwner !== moduleOwner) {
        throw new Error(
          `Global provider token collision: "${tokenToString(token)}" is exported by both ` +
            `${existingOwner} and ${moduleOwner}.`,
        );
      }

      if (!existingOwner) {
        this.globalExportOwners.set(token, moduleOwner);
      }

      if (this.root.isRegistered(token, false)) {
        continue;
      }

      this.root.register(token, {
        useFactory: () => this.resolveTokenFromModuleScope(moduleRef, token),
      });
    }
  }

  private resolveControllerModule(controller: Constructor): ModuleRef | undefined {
    return (
      this.httpControllerModules.get(controller) ??
      this.rpcControllerModules.get(controller) ??
      this.wsGatewayModules.get(controller)
    );
  }

  private getOrCreateLinkedScopes(originScope: DependencyContainer): Set<DependencyContainer> {
    const existing = this.requestScopeLinkedScopes.get(originScope);

    if (existing) {
      return existing;
    }

    const created = new Set<DependencyContainer>();
    this.requestScopeLinkedScopes.set(originScope, created);
    return created;
  }

  private getModuleScopeForRequest(context: RequestResolutionContext, moduleRef: ModuleRef): DependencyContainer {
    const existing = context.scopesByModule.get(moduleRef);
    if (existing) {
      return existing;
    }

    const scopedContainer = moduleRef.container.createChildContainer();
    context.scopesByModule.set(moduleRef, scopedContainer);
    this.getOrCreateLinkedScopes(context.originScope).add(scopedContainer);

    return scopedContainer;
  }

  private resolveTokenFromModuleScope<T>(moduleRef: ModuleRef, token: InjectionToken<T>): T {
    const context = this.requestContextStorage.getStore();

    if (!context) {
      return moduleRef.container.resolve(token);
    }

    const scope = this.getModuleScopeForRequest(context, moduleRef);
    return scope.resolve(token);
  }

  private assertRuntimeConfigMutable(settingName: "logger" | "config"): void {
    if (this.closed) {
      throw new Error(`Cannot configure ${settingName}: container is already closed`);
    }

    if (this.initialized) {
      throw new Error(`Cannot configure ${settingName} after container initialization`);
    }
  }

  private loadModuleRef(moduleImport: ModuleImport): ModuleRef {
    const normalized = this.normalizeModuleImport(moduleImport);
    const dynamicKey = typeof normalized.key === "string" ? normalized.key : undefined;
    let signatureInserted = false;

    if (dynamicKey && normalized.dynamicSignature) {
      const existingSignature = this.dynamicModuleSignatures.get(dynamicKey);

      if (existingSignature && existingSignature !== normalized.dynamicSignature) {
        const moduleName = normalized.moduleClass.name || "<anonymous module>";
        const dynamicId = normalized.dynamicId ?? "__default__";
        throw new Error(
          `Dynamic module collision for ${moduleName} with id "${dynamicId}". ` +
            "Use unique DynamicModule.id values for different module configurations.",
        );
      }

      if (!existingSignature) {
        this.dynamicModuleSignatures.set(dynamicKey, normalized.dynamicSignature);
        signatureInserted = true;
      }
    }

    const existing = this.loadedModules.get(normalized.key);
    if (existing) {
      return existing;
    }

    if (this.loadingModules.has(normalized.key)) {
      const moduleName = normalized.moduleClass.name || "<anonymous module>";
      throw new Error(`Circular module import detected: ${moduleName}`);
    }

    this.loadingModules.add(normalized.key);

    const staticMeta = this.readModuleMetadata(normalized.moduleClass);
    const meta = this.mergeModuleMetadata(staticMeta, normalized.dynamicMeta);

    const moduleRef: ModuleRef = {
      key: normalized.key,
      moduleClass: normalized.moduleClass,
      container: this.root.createChildContainer(),
      meta,
      providers: this.collectProviderTokens(meta.providers),
      exportedTokens: new Set<InjectionToken>(),
      imports: [],
    };

    this.loadedModules.set(normalized.key, moduleRef);

    try {
      moduleRef.imports = meta.imports.map((imported) => this.loadModuleRef(imported));
      this.linkImportedExports(moduleRef);

      const appEnhancerProviders: Provider[] = [];

      for (const provider of meta.providers) {
        if (typeof provider !== "function" && isAppEnhancerToken(provider.provide)) {
          appEnhancerProviders.push(provider);
          continue;
        }

        this.registerProvider(moduleRef, provider);
      }

      for (const provider of appEnhancerProviders) {
        this.registerProvider(moduleRef, provider);
      }

      for (const ctrl of meta.controllers) {
        if (this.rpcControllerSet.has(ctrl)) {
          continue;
        }

        moduleRef.container.register(ctrl, { useClass: ctrl }, { lifecycle: Lifecycle.ContainerScoped });
        this.addLifecycleTarget(moduleRef.container, ctrl);
        this.rpcControllerSet.add(ctrl);
        this.rpcControllerModules.set(ctrl, moduleRef);
        this.controllers.push(ctrl);
      }

      for (const ctrl of meta.httpControllers) {
        if (this.httpControllerSet.has(ctrl)) {
          continue;
        }

        moduleRef.container.register(ctrl, { useClass: ctrl }, { lifecycle: Lifecycle.ContainerScoped });
        this.addLifecycleTarget(moduleRef.container, ctrl);
        this.httpControllerSet.add(ctrl);
        this.httpControllerModules.set(ctrl, moduleRef);
        this.httpControllers.push(ctrl);
      }

      // Detect WS gateways among providers
      for (const provider of meta.providers) {
        const providerClass = typeof provider === "function" ? provider : undefined;

        if (providerClass && Reflect.hasMetadata(WS_GATEWAY_KEY, providerClass)) {
          if (!this.wsGatewaySet.has(providerClass)) {
            this.wsGatewaySet.add(providerClass);
            this.wsGatewayModules.set(providerClass, moduleRef);
            this.wsGateways.push(providerClass);
          }
        }
      }

      moduleRef.exportedTokens = this.resolveModuleExports(moduleRef);

      if (moduleRef.meta.global) {
        this.registerGlobalExports(moduleRef);
      }

      return moduleRef;
    } catch (error) {
      this.loadedModules.delete(normalized.key);

      if (signatureInserted && dynamicKey) {
        this.dynamicModuleSignatures.delete(dynamicKey);
      }

      throw error;
    } finally {
      this.loadingModules.delete(normalized.key);
    }
  }

  loadModule(moduleImport: ModuleImport): void {
    const moduleRef = this.loadModuleRef(moduleImport);

    this.rootModuleRef ??= moduleRef;
  }

  resolve<T>(token: InjectionToken<T>): T {
    if (this.root.isRegistered(token, false)) {
      return this.root.resolve(token);
    }

    if (this.rootModuleRef?.container.isRegistered(token, true)) {
      return this.rootModuleRef.container.resolve(token);
    }

    throw new Error(
      `Token "${tokenToString(token)}" is not available in the root module scope. ` +
        "Export it from an imported module or register it as global.",
    );
  }

  resolveAll<T>(token: InjectionToken<T>): T[] {
    if (this.root.isRegistered(token, false)) {
      return this.root.resolveAll(token);
    }

    if (this.rootModuleRef?.container.isRegistered(token, true)) {
      return this.rootModuleRef.container.resolveAll(token);
    }

    throw new Error(
      `Token "${tokenToString(token)}" is not available in the root module scope. ` +
        "Export it from an imported module or register it as global.",
    );
  }

  setLogger(logger: AppLogger): void {
    this.assertRuntimeConfigMutable("logger");
    this.root.registerInstance(LOGGER_TOKEN, logger);
  }

  configureLogger(options?: LoggerOptions): AppLogger {
    const logger = createLogger(options);
    this.setLogger(logger);
    return logger;
  }

  getLogger(): AppLogger {
    return this.resolve(LOGGER_TOKEN);
  }

  setExposeInternalErrors(value: boolean): void {
    this.exposeInternalErrors = value;
  }

  shouldExposeInternalErrors(): boolean {
    return this.exposeInternalErrors;
  }

  setOnError(callback: OnErrorCallback): void {
    this.onErrorCallback = callback;
  }

  getOnError(): OnErrorCallback | undefined {
    return this.onErrorCallback;
  }

  reportError(error: unknown, context: ErrorContext): void {
    if (!this.onErrorCallback) return;
    try {
      void this.onErrorCallback(error, context);
    } catch {
      // never let error reporter break the app
    }
  }

  setConfig<TConfig extends Record<string, unknown>>(config: TConfig): void {
    this.assertRuntimeConfigMutable("config");
    this.root.registerInstance(CONFIG_TOKEN, config);
  }

  configureConfig<TSchema extends ZodType>(schema: TSchema, source: unknown = process.env): output<TSchema> {
    const parsed = schema.safeParse(source);

    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("; ");

      throw new Error(`Invalid configuration: ${details}`);
    }

    const data = parsed.data;

    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error("Config schema must produce an object");
    }

    this.setConfig(data as Record<string, unknown>);

    return data;
  }

  getConfig<TConfig extends Record<string, unknown> = Record<string, unknown>>(): Readonly<TConfig> {
    return this.resolve(CONFIG_TOKEN);
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.closed) {
      throw new Error("Container is already closed");
    }

    const instances = this.getLifecycleInstances();

    for (const instance of instances) {
      const hook = (instance as Partial<OnModuleInit>).onModuleInit;
      if (typeof hook === "function") {
        await hook.call(instance);
      }
    }

    for (const instance of instances) {
      const hook = (instance as Partial<OnApplicationBootstrap>).onApplicationBootstrap;
      if (typeof hook === "function") {
        await hook.call(instance);
      }
    }

    this.initialized = true;
  }

  async close(signal?: string): Promise<void> {
    if (this.closed) {
      return;
    }

    const instances = this.getLifecycleInstances();
    const shutdownInstances = [...instances].reverse();
    const shutdownErrors: Error[] = [];

    for (const instance of shutdownInstances) {
      const hook = (instance as Partial<BeforeApplicationShutdown>).beforeApplicationShutdown;
      if (typeof hook === "function") {
        try {
          await hook.call(instance, signal);
        } catch (error) {
          shutdownErrors.push(normalizeLifecycleError(error, "beforeApplicationShutdown"));
        }
      }
    }

    for (const instance of shutdownInstances) {
      const hook = (instance as Partial<OnModuleDestroy>).onModuleDestroy;
      if (typeof hook === "function") {
        try {
          await hook.call(instance);
        } catch (error) {
          shutdownErrors.push(normalizeLifecycleError(error, "onModuleDestroy"));
        }
      }
    }

    for (const instance of shutdownInstances) {
      const hook = (instance as Partial<OnApplicationShutdown>).onApplicationShutdown;
      if (typeof hook === "function") {
        try {
          await hook.call(instance, signal);
        } catch (error) {
          shutdownErrors.push(normalizeLifecycleError(error, "onApplicationShutdown"));
        }
      }
    }

    const disposed = new Set<DependencyContainer>();

    for (const moduleRef of this.loadedModules.values()) {
      if (disposed.has(moduleRef.container)) {
        continue;
      }

      disposed.add(moduleRef.container);
      try {
        await moduleRef.container.dispose();
      } catch (error) {
        shutdownErrors.push(normalizeLifecycleError(error, "moduleContainer.dispose"));
      }
    }

    try {
      await this.root.dispose();
    } catch (error) {
      shutdownErrors.push(normalizeLifecycleError(error, "rootContainer.dispose"));
    }

    this.closed = true;

    if (shutdownErrors.length > 0) {
      throw new AggregateError(shutdownErrors, `Application shutdown completed with ${shutdownErrors.length} error(s)`);
    }
  }

  async runInRequestScope<T>(scope: DependencyContainer, execute: () => Promise<T> | T): Promise<T> {
    const originModuleRef = this.requestScopeOwners.get(scope);
    const context: RequestResolutionContext = {
      originScope: scope,
      originModuleRef,
      scopesByModule: new Map<ModuleRef, DependencyContainer>(),
    };

    if (originModuleRef) {
      context.scopesByModule.set(originModuleRef, scope);
    }

    return this.requestContextStorage.run(context, async () => execute());
  }

  async disposeRequestScope(scope: DependencyContainer): Promise<void> {
    const linkedScopes = this.requestScopeLinkedScopes.get(scope);
    const errors: Error[] = [];

    if (linkedScopes && linkedScopes.size > 0) {
      for (const linkedScope of linkedScopes) {
        try {
          await linkedScope.dispose();
        } catch (error) {
          errors.push(normalizeLifecycleError(error, "requestScope.linked.dispose"));
        }
      }
    }

    this.requestScopeLinkedScopes.delete(scope);

    try {
      await scope.dispose();
    } catch (error) {
      errors.push(normalizeLifecycleError(error, "requestScope.dispose"));
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, `Request scope dispose completed with ${errors.length} error(s)`);
    }
  }

  createRequestScope(controller?: Constructor): DependencyContainer {
    if (!controller) {
      const scope = this.root.createChildContainer();
      this.requestScopeOwners.set(scope, undefined);
      return scope;
    }

    const moduleRef = this.resolveControllerModule(controller);

    if (!moduleRef) {
      const scope = this.root.createChildContainer();
      this.requestScopeOwners.set(scope, undefined);
      return scope;
    }

    const scope = moduleRef.container.createChildContainer();
    this.requestScopeOwners.set(scope, moduleRef);
    return scope;
  }

  getControllers(): Constructor[] {
    return [...this.controllers];
  }

  getHttpControllers(): Constructor[] {
    return [...this.httpControllers];
  }

  getWsGateways(): Constructor[] {
    return [...this.wsGateways];
  }

  setGlobalGuards(guards: GuardLike[]): void {
    this.globalGuards = [...guards];
  }

  getGlobalGuards(): GuardLike[] {
    return [...this.globalGuards];
  }

  setGlobalInterceptors(inters: InterceptorLike[]): void {
    this.globalInterceptors = [...inters];
  }

  getGlobalInterceptors(): InterceptorLike[] {
    return [...this.globalInterceptors];
  }

  setGlobalPipes(pipes: PipeLike[]): void {
    this.globalPipes = [...pipes];
  }

  getGlobalPipes(): PipeLike[] {
    return [...this.globalPipes];
  }

  setGlobalFilters(filters: ExceptionFilterLike[]): void {
    this.globalFilters = [...filters];
  }

  getGlobalFilters(): ExceptionFilterLike[] {
    return [...this.globalFilters];
  }
}
