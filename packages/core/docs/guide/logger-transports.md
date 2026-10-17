# Logger Transports

Core supports pluggable logger transports: you provide custom transports for file logging, Sentry, OTLP, or any other destination.

## Built-in Console Transport

```ts
import { Application } from "@smounters/core/core";
import { consoleTransport } from "@smounters/core/core";

const app = new Application(AppModule, {
  loggerOptions: {
    name: "my-app",
    minLevel: "info",
    transports: [consoleTransport()],
  },
});
```

`consoleTransport()` writes to stdout (silly..info) and stderr (warn..fatal) with timestamps.

## Custom Transport

Implement the `LogTransport` interface:

```ts
import type { LogTransport, LogEntry } from "@smounters/core/core";

const jsonFileTransport: LogTransport = {
  log(entry: LogEntry) {
    const line = JSON.stringify({
      time: entry.timestamp.toISOString(),
      level: entry.level,
      msg: entry.message,
      name: entry.name,
      args: entry.args,
    });
    appendFileSync("app.log", line + "\n");
  },
};
```

### LogEntry structure

```ts
interface LogEntry {
  level: "silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  args: unknown[];
  timestamp: Date;
  name?: string;
}
```

## Multiple Transports

```ts
const app = new Application(AppModule, {
  loggerOptions: {
    name: "backend",
    minLevel: "debug",
    transports: [
      consoleTransport({ minLevel: "info" }),  // console: info+
      jsonFileTransport,                        // file: all levels
      sentryTransport,                          // sentry: errors only
    ],
  },
});
```

Each transport can apply its own filtering in the `log()` method.

## Ready-made Structured Transports

For production-shaped output (single-line JSON outside local, coloured human line locally, with the
request id mixed into every line) use the batteries in `@smounters/core/log`:

```ts
import { createTransports } from "@smounters/core/log";

const app = new Application(AppModule, {
  loggerOptions: {
    transports: createTransports({ env: "local", service: "api" }),
  },
});
```

Register `requestContextHook` from `@smounters/core/http` and every line automatically carries
`reqId`/`src` — calling code never passes them.

## Global Error Reporting

Use `onError` in server options to catch errors from all sources — HTTP, RPC, WebSocket, cron jobs, and event handlers:

```ts
const app = new Application(AppModule, {
  onError: (error, context) => {
    // context.type: "http" | "rpc" | "ws" | "cron" | "events"
    // context.handler: method name
    // context.controller: class name
    Sentry.captureException(error, {
      tags: { type: context.type, handler: context.handler },
    });
  },
});
```

Errors are still logged through the normal logger — `onError` is an additional reporting hook, not a replacement.
