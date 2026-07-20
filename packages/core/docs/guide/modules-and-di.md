# Modules and DI

## Module Shape

```ts
import { Module } from "@smounters/core/decorators";

@Module({
  imports: [],
  providers: [],
  controllers: [],
  httpControllers: [],
  exports: [],
  global: false,
})
class AppModule {}
```

## Provider Types

- Class provider: `providers: [UsersService]`
- `useClass`
- `useValue`
- `useFactory`
- `useExisting`

```ts
const TOKENS = {
  Config: Symbol("Config"),
  Clock: Symbol("Clock"),
};

@Module({
  providers: [
    UsersService,
    { provide: TOKENS.Config, useValue: { env: "prod" } },
    { provide: TOKENS.Clock, useFactory: () => Date.now() },
    { provide: "UsersServiceAlias", useExisting: UsersService },
  ],
  exports: [UsersService, TOKENS.Config],
})
class UsersModule {}
```

## Injection Decorators

```ts
import { Inject, InjectAll, Injectable, Optional } from "@smounters/core/decorators";

@Injectable()
class BillingService {
  constructor(
    @Inject("UsersServiceAlias") private readonly users: UsersService,
    @Optional(Symbol.for("Cache")) private readonly cache?: unknown,
  ) {}
}
```

## Multi Providers

`multi` is supported for explicit intent in provider metadata.

```ts
const AML_RULES = Symbol("AML_RULES");

@Module({
  providers: [
    { provide: AML_RULES, multi: true, useClass: SanctionsRule },
    { provide: AML_RULES, multi: true, useClass: MixerRule },
    { provide: AML_RULES, multi: true, useClass: FreshAddressRule },
  ],
  exports: [AML_RULES],
})
class AmlModule {}

@Injectable()
class AmlEngine {
  constructor(@InjectAll(AML_RULES) private readonly rules: AmlRule[]) {}
}
```

You can also resolve multi providers manually:

```ts
const rules = app.resolveAll<AmlRule>(AML_RULES);
```

## Global Enhancers

Use app-level enhancer tokens from `@smounters/core/core`:

- `APP_GUARD`
- `APP_PIPE`
- `APP_INTERCEPTOR`
- `APP_FILTER`

```ts
import { APP_FILTER } from "@smounters/core/core";

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
class AppModule {}
```
