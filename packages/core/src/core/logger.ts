import type { LoggerOptions, LogLevel, LogTransport } from "../types.js";
import { LOGGER_TOKEN } from "./tokens.js";
import { consoleTransport, levelIndex } from "./log-transport.js";

/**
 * Native logger with pluggable transports.
 * Drop-in replacement for tslog Logger — same method signatures.
 */
export class Logger {
  private readonly transports: LogTransport[];
  private readonly minIdx: number;
  private readonly name?: string;

  constructor(options: LoggerOptions = {}) {
    this.transports = options.transports ?? [consoleTransport()];
    this.minIdx = levelIndex(options.minLevel ?? "silly");
    this.name = options.name;
  }

  private dispatch(level: LogLevel, args: unknown[]): void {
    const idx = levelIndex(level);
    if (idx < this.minIdx) return;

    const message = args.length > 0 && typeof args[0] === "string" ? args[0] : "";
    const rest = typeof args[0] === "string" ? args.slice(1) : args;

    const entry = {
      level,
      message,
      args: rest,
      timestamp: new Date(),
      name: this.name,
    };

    for (const transport of this.transports) {
      try {
        transport.log(entry);
      } catch {
        // never let a broken transport crash the app
      }
    }
  }

  log(_logLevelId: number, logLevelName: string, ...args: unknown[]): void {
    const level = logLevelName.toLowerCase() as LogLevel;
    this.dispatch(level, args);
  }

  silly(...args: unknown[]): void {
    this.dispatch("silly", args);
  }

  trace(...args: unknown[]): void {
    this.dispatch("trace", args);
  }

  debug(...args: unknown[]): void {
    this.dispatch("debug", args);
  }

  info(...args: unknown[]): void {
    this.dispatch("info", args);
  }

  warn(...args: unknown[]): void {
    this.dispatch("warn", args);
  }

  error(...args: unknown[]): void {
    this.dispatch("error", args);
  }

  fatal(...args: unknown[]): void {
    this.dispatch("fatal", args);
  }
}

export type AppLogger = Logger;

export function createLogger(options?: LoggerOptions): AppLogger {
  return new Logger(options);
}

export { LOGGER_TOKEN } from "./tokens.js";
