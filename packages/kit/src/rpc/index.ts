import type { DescMessage, Message } from "@bufbuild/protobuf";
import { createValidator, type Validator } from "@bufbuild/protovalidate";
import { Code, ConnectError } from "@connectrpc/connect";
import type { BaseContext, Interceptor, NextFn } from "@smounters/core/core";
import { Injectable } from "@smounters/core/decorators";

/**
 * Global protovalidate enforcement: every RPC request is checked against the `buf.validate` rules
 * declared in its own proto BEFORE the handler runs; a violation becomes `InvalidArgument`.
 *
 * Register once as a global interceptor. The point is that validation rules live in the contract and are
 * enforced by the transport — a handler cannot forget to check, and a rule added to the proto starts
 * being enforced without touching any service. The Connect handler context carries the method
 * descriptor, so the input schema is available generically, with no per-service wiring. Compiled rules
 * are cached inside the validator, which is created once.
 */
@Injectable()
export class ProtoValidateInterceptor implements Interceptor {
  private readonly validator: Validator = createValidator();

  async intercept(ctx: BaseContext, next: NextFn): Promise<unknown> {
    if (ctx.getType() === "rpc") {
      const rpc = ctx.switchToRpc();
      const message = rpc.getData<Message>();
      const handlerCtx = rpc.getContext<{ method?: { input?: DescMessage } }>();
      const schema = handlerCtx?.method?.input;
      if (schema && message) {
        const result = this.validator.validate(schema, message);
        if (result.kind === "invalid") {
          throw new ConnectError(
            `Validation failed: ${result.violations.map((v) => v.message).join("; ")}`,
            Code.InvalidArgument,
          );
        }
        if (result.kind === "error") {
          // A rule failed to compile or evaluate: a server-side contract problem, not the caller's fault.
          throw new ConnectError(`Validation rule error: ${result.error.message}`, Code.Internal);
        }
      }
    }
    return next();
  }
}
