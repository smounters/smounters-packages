import type { z } from "zod";
import type { PipeTransform } from "../types.js";

export class ZodPipe<TSchema extends z.ZodType> implements PipeTransform<unknown, z.infer<TSchema>> {
  constructor(private schema: TSchema) {}

  transform(value: unknown): z.infer<TSchema> {
    return this.schema.parse(value);
  }
}
