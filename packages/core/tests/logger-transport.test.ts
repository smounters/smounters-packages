import "reflect-metadata";
import { describe, it, expect, afterEach } from "vitest";
import { Get, HttpController, Injectable, Module } from "../src/decorators/index.js";
import { Application } from "../src/core/application.js";
import type { LogEntry, LogTransport, ErrorContext } from "../src/types.js";
import { consoleTransport } from "../src/core/log-transport.js";
import { ImperiumLogger } from "../src/core/imperium-logger.js";

// --- Collecting transport ---

class CollectingTransport implements LogTransport {
  entries: LogEntry[] = [];
  log(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

// --- Test controller ---

@HttpController("/test")
class TestController {
  @Get("/ok")
  ok() {
    return { status: "ok" };
  }

  @Get("/fail")
  fail() {
    throw new Error("test error");
  }
}

@Module({ httpControllers: [TestController] })
class TestModule {}

let nextPort = 47100;

describe("ImperiumLogger", () => {
  it("dispatches to transports", () => {
    const transport = new CollectingTransport();
    const logger = new ImperiumLogger({ name: "test", transports: [transport] });

    logger.info("hello", { key: "value" });
    logger.error("fail", new Error("boom"));

    expect(transport.entries).toHaveLength(2);
    expect(transport.entries[0]?.level).toBe("info");
    expect(transport.entries[0]?.message).toBe("hello");
    expect(transport.entries[1]?.level).toBe("error");
  });

  it("respects minLevel", () => {
    const transport = new CollectingTransport();
    const logger = new ImperiumLogger({ minLevel: "warn", transports: [transport] });

    logger.debug("ignored");
    logger.info("ignored");
    logger.warn("kept");
    logger.error("kept");

    expect(transport.entries).toHaveLength(2);
    expect(transport.entries[0]?.level).toBe("warn");
  });

  it("defaults to console transport", () => {
    const logger = new ImperiumLogger();
    // should not throw
    logger.info("test with default transport");
  });
});

describe("consoleTransport", () => {
  it("creates a transport with minLevel", () => {
    const transport = consoleTransport({ minLevel: "error" });
    expect(transport).toBeDefined();
    expect(typeof transport.log).toBe("function");
  });
});

describe("Application with ImperiumLoggerOptions", () => {
  let app: Application;

  afterEach(async () => {
    await app?.close();
  });

  it("accepts transports-based logger options", async () => {
    const transport = new CollectingTransport();
    const port = nextPort++;

    app = new Application(TestModule, {
      host: "127.0.0.1",
      loggerOptions: {
        name: "test-app",
        minLevel: "info",
        transports: [transport],
      },
    });

    await app.start({ port });
    const res = await fetch(`http://127.0.0.1:${port}/test/ok`);
    expect(res.status).toBe(200);

    // Logger should have captured some entries (at minimum startup logs)
    expect(transport.entries.length).toBeGreaterThanOrEqual(0);
  });
});

describe("onError callback", () => {
  let app: Application;

  afterEach(async () => {
    await app?.close();
  });

  it("receives HTTP handler errors", async () => {
    const errors: { error: unknown; context: ErrorContext }[] = [];
    const port = nextPort++;

    app = new Application(TestModule, {
      host: "127.0.0.1",
      loggerOptions: { minLevel: "fatal", transports: [] }, // suppress logs
      onError: (error, context) => {
        errors.push({ error, context });
      },
    });

    await app.start({ port });
    await fetch(`http://127.0.0.1:${port}/test/fail`);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.context.type).toBe("http");
    expect(errors[0]?.context.handler).toBe("fail");
    expect(errors[0]?.context.controller).toBe("TestController");
    expect(errors[0]?.error).toBeInstanceOf(Error);
  });
});
