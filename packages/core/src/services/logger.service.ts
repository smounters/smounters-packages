import { type AppLogger, LOGGER_TOKEN } from "../core/logger.js";
import { Inject, Injectable } from "../decorators/index.js";

@Injectable()
export class LoggerService {
  constructor(@Inject(LOGGER_TOKEN) private readonly logger: AppLogger) {}

  getRawLogger(): AppLogger {
    return this.logger;
  }

  log(logLevelId: number, logLevelName: string, ...args: unknown[]) {
    return this.logger.log(logLevelId, logLevelName, ...args);
  }

  silly(...args: unknown[]) {
    return this.logger.silly(...args);
  }

  trace(...args: unknown[]) {
    return this.logger.trace(...args);
  }

  debug(...args: unknown[]) {
    return this.logger.debug(...args);
  }

  info(...args: unknown[]) {
    return this.logger.info(...args);
  }

  warn(...args: unknown[]) {
    return this.logger.warn(...args);
  }

  error(...args: unknown[]) {
    return this.logger.error(...args);
  }

  fatal(...args: unknown[]) {
    return this.logger.fatal(...args);
  }
}
