# Logger Transports

Imperium supports pluggable logger transports. Instead of being locked into tslog, you can provide custom transports for file logging, Sentry, OTLP, or any other destination.

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

## Backwards Compatibility

The old tslog-based configuration still works:

```ts
// This continues to work — tslog options detected automatically
const app = new Application(AppModule, {
  loggerOptions: {
    name: "app",
    type: "pretty",
    minLevel: 3,
  },
});
```

If the options object contains a `transports` array, the native `ImperiumLogger` is used. Otherwise, tslog is used.

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
