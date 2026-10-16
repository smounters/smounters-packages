import type { LoggerOptions, LogEntry, LogLevel, LogTransport } from "../types.js";

export const LOG_LEVELS: LogLevel[] = ["silly", "trace", "debug", "info", "warn", "error", "fatal"];

export function levelIndex(level: LogLevel): number {
  return LOG_LEVELS.indexOf(level);
}

export function isLoggerOptions(options: unknown): options is LoggerOptions {
  if (!options || typeof options !== "object") {
    return false;
  }

  const obj = options as Record<string, unknown>;

  if (Array.isArray(obj.transports)) {
    return true;
  }

  if (typeof obj.minLevel === "string" && LOG_LEVELS.includes(obj.minLevel as LogLevel)) {
    if (typeof obj.type !== "string") {
      return true;
    }
  }

  return false;
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

function formatLevel(level: LogLevel): string {
  return level.toUpperCase().padEnd(5);
}

/**
 * Built-in console transport. Writes to stdout (silly..info) and stderr (warn..fatal).
 */
export function consoleTransport(options?: { minLevel?: LogLevel }): LogTransport {
  const minIdx = levelIndex(options?.minLevel ?? "silly");

  return {
    log(entry: LogEntry): void {
      const idx = levelIndex(entry.level);
      if (idx < minIdx) return;

      const prefix = `${formatTimestamp(entry.timestamp)} | ${formatLevel(entry.level)} |${entry.name ? ` ${entry.name} |` : ""}`;
      const parts = [prefix, entry.message, ...entry.args];

      if (idx >= levelIndex("warn")) {
        console.error(...parts);
      } else {
        console.log(...parts);
      }
    },
  };
}
