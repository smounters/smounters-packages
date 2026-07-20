import { z } from "zod";

type NativeEnumLike = Record<string, string | number>;

const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off"]);

export const booleanSchema = () =>
  z.preprocess((v) => {
    if (typeof v === "boolean") {
      return v;
    }
    if (typeof v === "string") {
      const normalized = v.toLowerCase().trim();
      if (TRUE_VALUES.has(normalized)) return true;
      if (FALSE_VALUES.has(normalized)) return false;
    }
    return v;
  }, z.boolean());

export const numberSchema = () =>
  z.preprocess((v) => {
    if (typeof v === "number") {
      return Number.isNaN(v) ? v : v;
    }
    if (typeof v === "string") {
      const normalized = v.trim();
      if (!normalized) return v;
      const n = Number(normalized);
      if (!Number.isNaN(n)) return n;
    }
    return v;
  }, z.number());

export const nativeEnumSchema = <T extends NativeEnumLike>(enumType: T, normalize?: (value: string) => string) =>
  z.preprocess((v) => (typeof v === "string" ? (normalize ? normalize(v) : v) : v), z.nativeEnum(enumType));

export const stringArraySchema = <T extends z.ZodType>(itemSchema: T) =>
  z.preprocess((v) => {
    if (Array.isArray(v)) {
      return v;
    }

    if (typeof v !== "string") {
      return v;
    }

    const value = v.trim();
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Ignore JSON parse errors and fallback to CSV parsing.
    }

    return value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }, z.array(itemSchema));

export const enumArraySchema = <T extends NativeEnumLike>(enumType: T, normalize?: (value: string) => string) =>
  stringArraySchema(nativeEnumSchema(enumType, normalize));
