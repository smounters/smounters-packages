import "reflect-metadata";
import { describe, it, expect, afterEach } from "vitest";
import { Get, HttpController, Injectable, Module, UseGuards, UsePipes } from "../src/decorators";
import { APP_GUARD, APP_PIPE } from "../src/core/app-tokens";
import type { BaseContext, Guard, PipeTransform } from "../src/types";
import { createTestApp, type TestApp } from "./helpers";

// --- Guard that checks for x-api-key header ---

@Injectable()
class ApiKeyGuard implements Guard {
  canActivate(ctx: BaseContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    return req?.headers["x-api-key"] === "secret";
  }
}

// --- Pipe that uppercases string values ---

@Injectable()
class UpperCasePipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown, _ctx: BaseContext): unknown {
    if (typeof value === "string") return value.toUpperCase();
    return value;
  }
}

// --- Controller ---

@HttpController("/guarded")
@UseGuards(ApiKeyGuard)
class GuardedController {
  @Get("/hello")
  hello() {
    return { message: "ok" };
  }
}

@HttpController("/open")
class OpenController {
  @Get("/hello")
  hello() {
    return { message: "open" };
  }
}

@Module({
  providers: [GuardedController, OpenController],
  httpControllers: [GuardedController, OpenController],
})
class GuardTestModule {}

@Module({
  providers: [
    OpenController,
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
  httpControllers: [OpenController],
})
class GlobalGuardTestModule {}

describe("Guards", () => {
  let app: TestApp;

  afterEach(async () => {
    await app?.close();
  });

  it("blocks request without api key", async () => {
    app = await createTestApp(GuardTestModule);
    const res = await fetch(`${app.address}/guarded/hello`);
    expect(res.status).toBe(403);
  });

  it("allows request with correct api key", async () => {
    app = await createTestApp(GuardTestModule);
    const res = await fetch(`${app.address}/guarded/hello`, {
      headers: { "x-api-key": "secret" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: "ok" });
  });

  it("unguarded controller is accessible", async () => {
    app = await createTestApp(GuardTestModule);
    const res = await fetch(`${app.address}/open/hello`);
    expect(res.status).toBe(200);
  });

  it("global guard applies to all controllers", async () => {
    app = await createTestApp(GlobalGuardTestModule);
    const res = await fetch(`${app.address}/open/hello`);
    expect(res.status).toBe(403);
  });
});
