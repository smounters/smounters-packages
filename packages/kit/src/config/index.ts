import { z } from "zod";

// Re-export the shared boolean/number preprocessors from @smounters/core so kit does not duplicate them.
// Applications can import from either entry point; the implementation lives in core only.
export { booleanSchema, numberSchema, stringArraySchema, nativeEnumSchema, enumArraySchema } from "@smounters/core/validation";

/** String enum with optional normalization (e.g. lower-casing `ENVIRONMENT` before matching). */
export const enumSchema = <const T extends readonly [string, ...string[]]>(
  values: T,
  normalize?: (v: string) => string,
) => z.preprocess((v) => (typeof v === "string" && normalize ? normalize(v) : v), z.enum(values));
