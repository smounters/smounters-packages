import "reflect-metadata";
import { describe, it, expect, afterEach } from "vitest";
import { Get, HttpController, Injectable, Module } from "../src/decorators";
import type { OnModuleInit, OnModuleDestroy } from "../src/types";
import { createTestApp, type TestApp } from "./helpers";

const events: string[] = [];

@Injectable()
class TrackedService implements OnModuleInit, OnModuleDestroy {
  onModuleInit() {
    events.push("init");
  }

  onModuleDestroy() {
    events.push("destroy");
  }

  status() {
    return { events: [...events] };
  }
}

@HttpController("/lifecycle")
class LifecycleController {
  constructor(private readonly tracked: TrackedService) {}

  @Get("/status")
  status() {
    return this.tracked.status();
  }
}

@Module({
  providers: [TrackedService],
  httpControllers: [LifecycleController],
})
class LifecycleModule {}

describe("Lifecycle hooks", () => {
  let app: TestApp;

  afterEach(async () => {
    events.length = 0;
    await app?.close();
  });

  it("onModuleInit fires before server is ready", async () => {
    app = await createTestApp(LifecycleModule);
    expect(events).toContain("init");

    const res = await fetch(`${app.address}/lifecycle/status`);
    const body = await res.json();
    expect(body.events).toContain("init");
  });

  it("onModuleDestroy fires on close", async () => {
    app = await createTestApp(LifecycleModule);
    await app.close();
    expect(events).toContain("destroy");
    app = undefined!;
  });
});
