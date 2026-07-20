import type { FastifyReply, FastifyRequest, FastifyServerOptions } from "fastify";
import type { ISettingsParam } from "tslog";
import type { DependencyContainer, RegistrationOptions, InjectionToken as TsyringeInjectionToken } from "tsyringe";
import type { ZodType } from "zod";

export type Constructor<T = unknown> = new (...args: any[]) => T;
export type ContextType = "http" | "rpc" | "ws";
export type InjectionToken<T = unknown> = TsyringeInjectionToken<T>;
export type MetadataKey = string | symbol;
export type ShutdownSignal = "SIGINT" | "SIGTERM";

// --- Logger ---

export type LogLevel = "silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  level: LogLevel;
  message: string;
  args: unknown[];
  timestamp: Date;
  name?: string;
}

export interface LogTransport {
  log(entry: LogEntry): void;
}

/** Native imperium logger options (transport-based) */
export interface ImperiumLoggerOptions {
  name?: string;
  minLevel?: LogLevel;
  transports?: LogTransport[];
}

/** Legacy tslog options — still supported */
export type TslogOptions = ISettingsParam<Record<string, unknown>>;

/** Accepts either native imperium options or tslog settings */
export type LoggerOptions = ImperiumLoggerOptions | TslogOptions;

// --- Error Reporting ---

export type ErrorContextType = "http" | "rpc" | "ws" | "cron" | "events";

export interface ErrorContext {
  type: ErrorContextType;
  handler?: string;
  controller?: string;
  [key: string]: unknown;
}

export type OnErrorCallback = (error: unknown, context: ErrorContext) => void | Promise<void>;

export interface ClassProvider<T = unknown> {
  provide: InjectionToken<T>;
  useClass: Constructor<T>;
  multi?: boolean;
  options?: RegistrationOptions;
}

export interface ValueProvider<T = unknown> {
  provide: InjectionToken<T>;
  useValue: T;
  multi?: boolean;
}

export interface FactoryProvider<T = unknown> {
  provide: InjectionToken<T>;
  useFactory: (container: DependencyContainer) => T;
  multi?: boolean;
}

export interface ExistingProvider<T = unknown> {
  provide: InjectionToken<T>;
  useExisting: InjectionToken<T>;
  multi?: boolean;
  options?: RegistrationOptions;
}

export type Provider<T = unknown> =
  | Constructor<T>
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;

interface BaseModuleMeta {
  providers?: Provider[];
  controllers?: Constructor[];
  httpControllers?: Constructor[];
  imports?: ModuleImport[];
  exports?: InjectionToken[];
  global?: boolean;
}

export type ModuleMeta = BaseModuleMeta;

export interface DynamicModule extends BaseModuleMeta {
  module: Constructor;
  id?: string;
}

export type ModuleImport = Constructor | DynamicModule;

export interface OnModuleInit {
  onModuleInit(): void | Promise<void>;
}

export interface OnApplicationBootstrap {
  onApplicationBootstrap(): void | Promise<void>;
}

export interface OnModuleDestroy {
  onModuleDestroy(): void | Promise<void>;
}

export interface BeforeApplicationShutdown {
  beforeApplicationShutdown(signal?: string): void | Promise<void>;
}

export interface OnApplicationShutdown {
  onApplicationShutdown(signal?: string): void | Promise<void>;
}

export interface HttpArgumentsHost {
  getRequest(): FastifyRequest | undefined;
  getResponse(): FastifyReply | undefined;
}

export interface RpcArgumentsHost {
  getData<T = unknown>(): T | undefined;
  getContext<T = unknown>(): T | undefined;
}

export interface WsArgumentsHost {
  getSocket(): unknown;
  getRequest(): FastifyRequest | undefined;
  getMessage(): unknown;
}

export interface BaseContext {
  type: ContextType;
  method: string;
  request?: Request;
  headers?: Headers;
  fastify?: {
    req: FastifyRequest;
    reply: FastifyReply;
  };
  rpc?: {
    data: unknown;
    context: unknown;
  };
  ws?: {
    socket: unknown;
    request: FastifyRequest;
    message?: unknown;
  };
  controller: Constructor;
  handler: Function;
  getType(): ContextType;
  getClass(): Constructor;
  getHandler(): Function;
  switchToHttp(): HttpArgumentsHost;
  switchToRpc(): RpcArgumentsHost;
  switchToWs(): WsArgumentsHost;
}

export interface Guard {
  canActivate(ctx: BaseContext): Promise<boolean> | boolean;
}

export type GuardLike = Constructor<Guard> | Guard;

export type NextFn = () => Promise<unknown>;

export interface Interceptor {
  intercept(ctx: BaseContext, next: NextFn): Promise<unknown>;
}

export type InterceptorLike = Constructor<Interceptor> | Interceptor;

export interface PipeTransform<TIn = unknown, TOut = unknown> {
  transform(value: TIn, ctx: BaseContext): Promise<TOut> | TOut;
}

export type PipeLike = Constructor<PipeTransform> | PipeTransform;

export interface ExceptionFilter<T = unknown> {
  catch(exception: T, ctx: BaseContext): unknown;
}

export type ExceptionFilterLike = Constructor<ExceptionFilter> | ExceptionFilter;

export interface ConfigServiceOptions<TSchema extends ZodType = ZodType> {
  schema: TSchema;
  source?: unknown;
}

export interface CorsOptions {
  enabled?: boolean;
  origin?: string | boolean | RegExp | (string | boolean | RegExp)[];
  credentials?: boolean;
  exposedHeaders?: string | string[];
  allowedHeaders?: string | string[];
  methods?: string | string[];
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
  strictPreflight?: boolean;
}

export type HealthCheckResult = boolean | { ok: boolean; details?: unknown };
export type HealthCheck = () => HealthCheckResult | Promise<HealthCheckResult>;

export interface HealthOptions {
  enabled?: boolean;
  path?: string;
  check?: HealthCheck;
}

export interface GracefulShutdownOptions {
  enabled?: boolean;
  signals?: ShutdownSignal[];
  timeoutMs?: number;
  forceExitOnFailure?: boolean;
}

export interface ServerOptions {
  port?: number;
  host?: string;
  prefix?: string;
  httpPrefix?: string;
  rpcPrefix?: string;
  trustProxy?: FastifyServerOptions["trustProxy"];
  requestTimeout?: FastifyServerOptions["requestTimeout"];
  connectionTimeout?: FastifyServerOptions["connectionTimeout"];
  keepAliveTimeout?: FastifyServerOptions["keepAliveTimeout"];
  bodyLimit?: FastifyServerOptions["bodyLimit"];
  routerOptions?: FastifyServerOptions["routerOptions"];
  /**
   * @deprecated Use `routerOptions.maxParamLength` instead.
   */
  maxParamLength?: FastifyServerOptions["maxParamLength"];
  pluginTimeout?: FastifyServerOptions["pluginTimeout"];
  accessLogs?: boolean;
  exposeInternalErrors?: boolean;
  cors?: boolean | CorsOptions;
  health?: boolean | HealthOptions;
  gracefulShutdown?: boolean | GracefulShutdownOptions;
  loggerOptions?: LoggerOptions;
  onError?: OnErrorCallback;
  config?: ConfigServiceOptions;
}
