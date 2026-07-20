import { Logger } from "tslog";
import type { LoggerOptions } from "../types.js";
import { ImperiumLogger } from "./imperium-logger.js";
import { isImperiumLoggerOptions } from "./log-transport.js";

type LoggerPayload = Record<string, unknown>;

export type AppLogger = Logger<LoggerPayload> | ImperiumLogger;

export const LOGGER_TOKEN = Symbol.for("imperium:app:logger");

const DEFAULT_TSLOG_OPTIONS = {
  name: "app",
  type: "pretty" as const,
};

export function createLogger(options?: LoggerOptions): AppLogger {
  if (options && isImperiumLoggerOptions(options)) {
    return new ImperiumLogger(options);
  }

  return new Logger({
    ...DEFAULT_TSLOG_OPTIONS,
    ...(options ?? {}),
  });
}
