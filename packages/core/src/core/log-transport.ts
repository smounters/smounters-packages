import type { ImperiumLoggerOptions, LogEntry, LogLevel, LogTransport, TslogOptions } from "../types.js";

export const LOG_LEVELS: LogLevel[] = ["silly", "trace", "debug", "info", "warn", "error", "fatal"];

export function levelIndex(level: LogLevel): number {
  return LOG_LEVELS.indexOf(level);
}

export function isImperiumLoggerOptions(options: unknown): options is ImperiumLoggerOptions {
  if (!options || typeof options !== "object") {
    return false;
  }

  const obj = options as Record<string, unknown>;

  // ImperiumLoggerOptions has 'transports' or 'minLevel' as LogLevel string
  if (Array.isArray(obj.transports)) {
    return true;
  }

  if (typeof obj.minLevel === "string" && LOG_LEVELS.includes(obj.minLevel as LogLevel)) {
    // Could be tslog too (it also has minLevel as number), but string minLevel is ours
    if (typeof obj.type !== "string") {
      return true;
    }
  }

  return false;
}

export function isTslogOptions(options: unknown): options is TslogOptions {
  return !isImperiumLoggerOptions(options);
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
