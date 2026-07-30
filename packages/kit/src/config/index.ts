import { z } from "zod";

// Preprocessors for parsing the environment: every `process.env` value is a string, so a schema that
// expects a boolean or a number has to coerce first. Used with a single top-level schema so a malformed
// value fails at startup with a per-field report instead of turning into a silent default at runtime.

const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off"]);

/** Accepts true/1/yes/on and false/0/no/off (case-insensitive); anything else is a validation error. */
export const booleanSchema = () =>
  z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const n = v.toLowerCase().trim();
      if (TRUE_VALUES.has(n)) return true;
      if (FALSE_VALUES.has(n)) return false;
    }
    return v;
  }, z.boolean());

/** Parses a numeric string. An empty or non-numeric value passes through so zod reports it clearly. */
export const numberSchema = () =>
  z.preprocess((v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = v.trim();
      if (!n) return v;
      const num = Number(n);
      if (!Number.isNaN(num)) return num;
    }
    return v;
  }, z.number());

/** String enum with optional normalization (e.g. lower-casing `ENVIRONMENT` before matching). */
export const enumSchema = <const T extends readonly [string, ...string[]]>(
  values: T,
  normalize?: (v: string) => string,
) => z.preprocess((v) => (typeof v === "string" && normalize ? normalize(v) : v), z.enum(values));
