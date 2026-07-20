import type { FastifyInstance } from "fastify";
import type { output, ZodType } from "zod";
import type {
  GracefulShutdownOptions,
  InjectionToken,
  LoggerOptions,
  ModuleImport,
  ServerOptions,
  ShutdownSignal,
} from "../types.js";
import { AppContainer } from "./container.js";
import { type HookEntry, startServer } from "./server.js";

interface ResolvedGracefulShutdownOptions {
  enabled: boolean;
  signals: ShutdownSignal[];
  timeoutMs: number;
  forceExitOnFailure: boolean;
}

export class Application {
  private static readonly DEFAULT_SHUTDOWN_SIGNALS: ShutdownSignal[] = ["SIGINT", "SIGTERM"];
  private static readonly DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

  private readonly moduleImport: ModuleImport;
  private readonly di: AppContainer;
  private options: ServerOptions;
  private readonly signalHandlers = new Map<ShutdownSignal, () => void>();
  private readonly hooks: HookEntry[] = [];
  private moduleLoaded = false;
  private loggerConfiguredExplicitly = false;

  private server: FastifyInstance | null = null;
  private startPromise: Promise<FastifyInstance> | null = null;
  private shutdownInProgress = false;

  constructor(moduleClass: ModuleImport, options: ServerOptions = {}) {
    this.moduleImport = moduleClass;
    this.di = new AppContainer();
    this.options = options;
  }

  getContainer(): AppContainer {
    return this.di;
  }

  resolve<T>(token: InjectionToken<T>): T {
    try {
      return this.di.resolve(token);
    } catch (initialError) {
      if (!this.moduleLoaded) {
        this.ensureModuleLoaded();
        return this.di.resolve(token);
      }

      throw initialError;
    }
  }

  resolveAll<T>(token: InjectionToken<T>): T[] {
    try {
      return this.di.resolveAll(token);
    } catch (initialError) {
      if (!this.moduleLoaded) {
        this.ensureModuleLoaded();
        return this.di.resolveAll(token);
      }

      throw initialError;
    }
  }

  getServerOptions(): Readonly<ServerOptions> {
    return { ...this.options };
  }

  setServerOptions(options: ServerOptions): this {
    this.assertConfigurable("set server options");
    this.options = {
      ...this.options,
      ...options,
    };
    return this;
  }

  addHook(name: string, handler: (...args: any[]) => unknown): this {
    this.assertConfigurable("add hook");
    this.hooks.push([name, handler]);
    return this;
  }

  configureLogger(options?: LoggerOptions): this {
    this.assertConfigurable("configure logger");
    this.di.configureLogger(options);
    this.loggerConfiguredExplicitly = true;
    return this;
  }

  configureConfig<TSchema extends ZodType>(schema: TSchema, source: unknown = process.env): output<TSchema> {
    this.assertConfigurable("configure config");
    return this.di.configureConfig(schema, source);
  }

  getServer(): FastifyInstance {
    if (!this.server) {
      throw new Error("Application is not started");
    }

    return this.server;
  }

  async start(options: ServerOptions = {}): Promise<FastifyInstance> {
    if (this.server) {
      return this.server;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    const resolvedOptions: ServerOptions = {
      ...this.options,
      ...options,
    };
    this.options = resolvedOptions;
    const startOptions =
      this.loggerConfiguredExplicitly && resolvedOptions.loggerOptions !== undefined
        ? {
            ...resolvedOptions,
            loggerOptions: undefined,
          }
        : resolvedOptions;

    this.startPromise = (async () => {
      this.ensureModuleLoaded();
      const server = await startServer(this.di, startOptions, this.hooks);
      this.server = server;
      this.installSignalHandlers(startOptions);
      return server;
    })();

    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async close(signal = "application.close"): Promise<void> {
    if (this.startPromise && !this.server) {
      try {
        await this.startPromise;
      } catch {
        // Ignore startup failures here: startServer() already performs cleanup.
      }
    }

    if (this.server) {
      const server = this.server;

      try {
        await server.close();
        this.server = null;
        this.removeSignalHandlers();
        return;
      } catch (error) {
        this.server = server;
        throw error;
      }
    }

    await this.di.close(signal);
    this.removeSignalHandlers();
  }

  private resolveGracefulShutdownOptions(serverOptions: ServerOptions): ResolvedGracefulShutdownOptions {
    const raw = serverOptions.gracefulShutdown;

    if (raw === false) {
      return {
        enabled: false,
        signals: Application.DEFAULT_SHUTDOWN_SIGNALS,
        timeoutMs: Application.DEFAULT_SHUTDOWN_TIMEOUT_MS,
        forceExitOnFailure: false,
      };
    }

    if (raw === undefined || raw === true) {
      return {
        enabled: true,
        signals: Application.DEFAULT_SHUTDOWN_SIGNALS,
        timeoutMs: Application.DEFAULT_SHUTDOWN_TIMEOUT_MS,
        forceExitOnFailure: false,
      };
    }

    const options: GracefulShutdownOptions = raw;
    const timeoutMs =
      typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
        ? options.timeoutMs
        : Application.DEFAULT_SHUTDOWN_TIMEOUT_MS;

    return {
      enabled: options.enabled ?? true,
      signals: options.signals?.length ? options.signals : Application.DEFAULT_SHUTDOWN_SIGNALS,
      timeoutMs,
      forceExitOnFailure: options.forceExitOnFailure ?? false,
    };
  }

  private installSignalHandlers(serverOptions: ServerOptions): void {
    if (this.signalHandlers.size > 0) {
      return;
    }

    const shutdown = this.resolveGracefulShutdownOptions(serverOptions);

    if (!shutdown.enabled) {
      return;
    }

    for (const signal of shutdown.signals) {
      const handler = () => {
        void this.handleShutdownSignal(signal, shutdown.timeoutMs, shutdown.forceExitOnFailure);
      };

      process.on(signal, handler);
      this.signalHandlers.set(signal, handler);
    }
  }

  private removeSignalHandlers(): void {
    if (this.signalHandlers.size === 0) {
      return;
    }

    for (const [signal, handler] of this.signalHandlers) {
      if (typeof process.off === "function") {
        process.off(signal, handler);
      } else {
        process.removeListener(signal, handler);
      }
    }

    this.signalHandlers.clear();
  }

  private async handleShutdownSignal(
    signal: ShutdownSignal,
    timeoutMs: number,
    forceExitOnFailure: boolean,
  ): Promise<void> {
    if (this.shutdownInProgress) {
      return;
    }

    this.shutdownInProgress = true;
    const logger = this.di.getLogger();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let shutdownFailed = false;

    logger.info({
      type: "shutdown",
      stage: "received",
      signal,
      timeoutMs,
      forceExitOnFailure,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Graceful shutdown timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      if (typeof timeoutId.unref === "function") {
        timeoutId.unref();
      }
    });

    try {
      await Promise.race([this.close(`signal:${signal}`), timeoutPromise]);
      logger.info({
        type: "shutdown",
        stage: "completed",
        signal,
      });
    } catch (error) {
      shutdownFailed = true;

      logger.error(
        {
          type: "shutdown",
          stage: "failed",
          signal,
          forceExitOnFailure,
        },
        error,
      );
      process.exitCode = 1;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (shutdownFailed) {
        if (forceExitOnFailure) {
          process.exit(1);
        }

        this.shutdownInProgress = false;
      }
    }
  }

  private assertConfigurable(action: string): void {
    if (this.server || this.startPromise) {
      throw new Error(`Cannot ${action} after application start`);
    }
  }

  private ensureModuleLoaded(): void {
    if (this.moduleLoaded) {
      return;
    }

    this.di.loadModule(this.moduleImport);
    this.moduleLoaded = true;
  }
}
