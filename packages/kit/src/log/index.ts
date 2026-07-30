import type { LogEntry, LogLevel, LogTransport } from "@smounters/core/core";
import { currentRequestContext } from "../http/index.js";

// Re-export the core log types: an application that declares the return type of its transports should
// not need a second import from @smounters/core just for the name.
export type { LogEntry, LogLevel, LogTransport };

// Structured logging.
//
// Outside local development every entry is ONE single-line JSON object
//   {"ts","level","env","service","type", ...fields}
// so a log collector ingests container stdout and exposes the fields without regex parsing. Locally a
// coloured human line is rendered instead. Container stdout IS the log source — nothing is shipped over
// HTTP from here, and nothing is filtered beyond the minimum level.

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
};

export interface LogOptions {
  /** Deployment environment; also decides the format — `local` renders colour, everything else JSON. */
  env?: string;
  /** Which process this is. Surface the same name as the container/deployment so queries can group by it. */
  service?: string;
  /** Minimum level that reaches stdout. */
  minLevel?: LogLevel;
  /** Render colour even outside local (rarely wanted; a collector reads escape codes as noise). */
  colorize?: boolean;
}

interface Resolved {
  env: string;
  service: string;
  min: number;
  colorize: boolean;
}

function resolve(options: LogOptions): Resolved {
  const env = (options.env ?? process.env.ENVIRONMENT ?? "local").toLowerCase();
  return {
    env,
    service: (options.service ?? process.env.APP_MODE ?? "api").toLowerCase(),
    min: LEVEL_PRIORITY[options.minLevel ?? ((process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel)] ?? 3,
    colorize: options.colorize ?? env === "local",
  };
}

const PALETTE = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
};
const NO_COLOR = { reset: "", dim: "", red: "", yellow: "", green: "", cyan: "", gray: "", white: "" };
const LEVEL_COLOR: Record<string, keyof typeof PALETTE> = {
  debug: "gray",
  info: "green",
  warn: "yellow",
  error: "red",
  fatal: "red",
};

function toJson(cfg: Resolved, ts: string, level: string, type: string, rest: Record<string, unknown>): string {
  return JSON.stringify({ ts, level, env: cfg.env, service: cfg.service, type, ...rest });
}

function toColorized(cfg: Resolved, ts: string, level: string, type: string, rest: Record<string, unknown>): string {
  const C = cfg.colorize ? PALETTE : NO_COLOR;
  const lc = C[LEVEL_COLOR[level] ?? "white"];
  const parts: string[] = [];
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined || v === null) continue;
    if (k === "message") {
      parts.push(String(v));
      continue;
    }
    parts.push(`${C.dim}${k}=${C.reset}${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return `${C.dim}${ts}${C.reset} ${lc}${level.toUpperCase().padEnd(5)}${C.reset} ${C.cyan}${type.padEnd(7)}${C.reset} ${parts.join(" ")}`;
}

// The chain id is mixed into EVERY line automatically — calling code never passes it. An explicit field
// in the entry itself (rare) is not overwritten.
function withRequestFields(rest: Record<string, unknown>): Record<string, unknown> {
  const ctx = currentRequestContext();
  if (!ctx || rest.reqId !== undefined) return rest;
  return { ...rest, reqId: ctx.requestId, src: ctx.source };
}

function emit(level: string, line: string): void {
  if (level === "error" || level === "fatal") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function serialize(a: unknown): string {
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  if (typeof a === "object" && a !== null) {
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  }
  return String(a);
}

// Split args into a log `type` plus a flat field bag. A structured first argument ({type, ...}) is
// hoisted to top-level JSON fields (so a log query can filter on them); plain args collapse into
// `message`.
function shape(defaultType: string, args: unknown[]): { type: string; rest: Record<string, unknown> } {
  const first = args[0];
  const structured =
    typeof first === "object" &&
    first !== null &&
    !(first instanceof Error) &&
    "type" in (first as Record<string, unknown>);
  if (structured) {
    const obj = { ...(first as Record<string, unknown>) };
    const type = String(obj.type);
    delete obj.type;
    if (args.length > 1) obj.extra = args.slice(1).map(serialize).join(" ");
    return { type, rest: obj };
  }
  return { type: defaultType, rest: { message: args.map(serialize).join(" ") } };
}

function format(cfg: Resolved, ts: string, level: string, type: string, rest: Record<string, unknown>): string {
  const withCtx = withRequestFields(rest);
  return cfg.colorize ? toColorized(cfg, ts, level, type, withCtx) : toJson(cfg, ts, level, type, withCtx);
}

/**
 * Transports for `app.configureLogger()` — covers the injected logger service, the framework access log
 * and every structured call across the application.
 */
export function createTransports(options: LogOptions = {}): LogTransport[] {
  const cfg = resolve(options);
  return [
    {
      log(entry: LogEntry) {
        if ((LEVEL_PRIORITY[entry.level] ?? 0) < cfg.min) return;
        const ts = entry.timestamp.toISOString().slice(0, 23);
        const { type, rest } = shape("app", entry.message ? [entry.message, ...entry.args] : entry.args);
        emit(entry.level, format(cfg, ts, entry.level, type, rest));
      },
    },
  ];
}

export interface StandaloneLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/**
 * Emitter for code that runs OUTSIDE dependency injection — entrypoint startup and fatal lines, a script.
 * Same format as the transports, so both kinds of line sit in one stream.
 */
export function createLogger(options: LogOptions = {}): StandaloneLogger {
  const cfg = resolve(options);
  const log = (level: LogLevel, ...args: unknown[]): void => {
    if ((LEVEL_PRIORITY[level] ?? 0) < cfg.min) return;
    const ts = new Date().toISOString().slice(0, 23);
    const { type, rest } = shape("app", args);
    emit(level, format(cfg, ts, level, type, rest));
  };
  return {
    info: (...args) => log("info", ...args),
    warn: (...args) => log("warn", ...args),
    error: (...args) => log("error", ...args),
    debug: (...args) => log("debug", ...args),
  };
}
