# HTTP

## Controller and Routes

```ts
import { Body, Get, HttpController, Module, Param, Post, Query } from "@smounters/core/decorators";

@HttpController("/users")
class UsersHttpController {
  @Get("/")
  findAll(@Query("email") email?: string) {
    return { email };
  }

  @Get("/:id")
  findById(@Param("id") id: string) {
    return { id };
  }

  @Post("/")
  create(@Body() payload: { email: string }) {
    return payload;
  }
}

@Module({
  httpControllers: [UsersHttpController],
})
class UsersModule {}
```

## Parameter Decorators

- `@Body(key?)`
- `@Query(key?)`
- `@Param(key?)`
- `@Header(key)`
- `@Req()`
- `@Res()`

## Prefixes

`ServerOptions` supports three levels:

- `prefix` (global)
- `httpPrefix`
- `rpcPrefix`

Final HTTP path = `prefix + httpPrefix + routePath`

## CORS

```ts
await app.start({
  cors: {
    enabled: true,
    origin: ["https://app.example.com"],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["content-type", "authorization"],
  },
});
```

## Health Endpoint

```ts
await app.start({
  health: {
    enabled: true,
    path: "/health",
    check: async () => ({ ok: true, details: { db: "up" } }),
  },
});
```
