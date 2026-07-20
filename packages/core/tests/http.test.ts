import "reflect-metadata";
import { describe, it, expect, afterEach } from "vitest";
import { Body, Get, HttpController, Injectable, Module, Param, Post, Query } from "../src/decorators";
import { createTestApp, type TestApp } from "./helpers";

@Injectable()
class UsersService {
  getAll() {
    return [{ id: "1", name: "Alice" }];
  }

  getById(id: string) {
    return { id, name: "Alice" };
  }

  create(name: string) {
    return { id: "2", name };
  }
}

@HttpController("/users")
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("/")
  findAll(@Query("name") name?: string) {
    const all = this.users.getAll();
    if (name) return all.filter((u) => u.name === name);
    return all;
  }

  @Get("/:id")
  findById(@Param("id") id: string) {
    return this.users.getById(id);
  }

  @Post("/")
  create(@Body("name") name: string) {
    return this.users.create(name);
  }
}

@Module({
  providers: [UsersService],
  httpControllers: [UsersController],
})
class TestModule {}

describe("HTTP Controller", () => {
  let app: TestApp;

  afterEach(async () => {
    await app?.close();
  });

  it("GET returns JSON array", async () => {
    app = await createTestApp(TestModule);
    const res = await fetch(`${app.address}/users`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: "1", name: "Alice" }]);
  });

  it("GET with query param filters", async () => {
    app = await createTestApp(TestModule);
    const res = await fetch(`${app.address}/users?name=Bob`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("GET with path param", async () => {
    app = await createTestApp(TestModule);
    const res = await fetch(`${app.address}/users/42`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "42", name: "Alice" });
  });

  it("POST with body", async () => {
    app = await createTestApp(TestModule);
    const res = await fetch(`${app.address}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bob" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "2", name: "Bob" });
  });

  it("POST with form-urlencoded body", async () => {
    app = await createTestApp(TestModule);
    const res = await fetch(`${app.address}/users`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: "Carol" }).toString(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "2", name: "Carol" });
  });

  it("respects httpPrefix option", async () => {
    app = await createTestApp(TestModule, { httpPrefix: "/api" });
    const res = await fetch(`${app.address}/api/users`);
    expect(res.status).toBe(200);
  });
});
