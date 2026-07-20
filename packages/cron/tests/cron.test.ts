import "reflect-metadata";
import { describe, it, expect, afterEach, vi } from "vitest";
import { Injectable, Module } from "@smounters/core/decorators";
import { Application } from "@smounters/core/core";

import { Cron, CronModule, CronService } from "../src";

// --- Test provider ---

@Injectable()
class TestWorker {
  calls: string[] = [];

  @Cron("* * * * * *", { name: "tick" }) // every second
  tick() {
    this.calls.push("tick");
  }

  @Cron("0 0 1 1 *", { name: "yearly" }) // yearly, won't fire in tests
  yearly() {
    this.calls.push("yearly");
  }
}

@Injectable()
class NoJobsService {
  doWork() {
    return "ok";
  }
}

// --- Module ---

function createTestModule() {
  @Module({
    imports: [CronModule.register({ providers: [TestWorker, NoJobsService] })],
  })
  class TestModule {}
  return TestModule;
}

describe("CronModule", () => {
  let app: Application;

  afterEach(async () => {
    await app?.close();
  });

  it("registers cron jobs from @Cron decorated methods", async () => {
    const TestModule = createTestModule();
    app = new Application(TestModule, { host: "127.0.0.1" });
    await app.start({ port: 49100, health: true });

    const cronService = app.resolve(CronService);
    const jobs = cronService.getJobs();

    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.name)).toContain("tick");
    expect(jobs.map((j) => j.name)).toContain("yearly");
  });

  it("does not register providers without @Cron", async () => {
    const TestModule = createTestModule();
    app = new Application(TestModule, { host: "127.0.0.1" });
    await app.start({ port: 49101, health: true });

    const cronService = app.resolve(CronService);
    const jobs = cronService.getJobs();

    // NoJobsService has no @Cron — should not appear
    const names = jobs.map((j) => j.name);
    expect(names.every((n) => !n.includes("NoJobsService"))).toBe(true);
  });

  it("executes cron job on schedule", async () => {
    const TestModule = createTestModule();
    app = new Application(TestModule, { host: "127.0.0.1" });
    await app.start({ port: 49102, health: true });

    // Wait for at least one tick (runs every second)
    await new Promise((r) => setTimeout(r, 1500));

    const cronService = app.resolve(CronService);
    const jobs = cronService.getJobs();
    const tickJob = jobs.find((j) => j.name === "tick");
    expect(tickJob).toBeDefined();
    expect(tickJob!.running).toBe(true);
  });

  it("stops all jobs on application shutdown", async () => {
    const TestModule = createTestModule();
    app = new Application(TestModule, { host: "127.0.0.1" });
    await app.start({ port: 49103, health: true });

    const cronService = app.resolve(CronService);
    expect(cronService.getJobs().some((j) => j.running)).toBe(true);

    await app.close();
    expect(cronService.getJobs().every((j) => !j.running)).toBe(true);
    app = undefined!;
  });
});

describe("CronService.hasCronJobs", () => {
  it("returns true for decorated class", () => {
    expect(CronService.hasCronJobs(TestWorker)).toBe(true);
  });

  it("returns false for non-decorated class", () => {
    expect(CronService.hasCronJobs(NoJobsService)).toBe(false);
  });
});
