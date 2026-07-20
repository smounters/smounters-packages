import { z } from "zod";
import { booleanSchema, numberSchema, stringArraySchema } from "./common.js";

const LOG_LEVELS = ["silly", "trace", "debug", "info", "warn", "error", "fatal"] as const;
const LOG_TYPES = ["pretty", "json"] as const;

export const appConfigSchema = z.object({
  APP_HOST: z.string().default("0.0.0.0"),
  APP_PORT: numberSchema()
    .refine((value) => Number.isInteger(value) && value >= 1 && value <= 65535, {
      message: "APP_PORT must be an integer in range 1..65535",
    })
    .default(8000),
  APP_GLOBAL_PREFIX: z.string().default(""),
  APP_HTTP_PREFIX: z.string().default(""),
  APP_RPC_PREFIX: z.string().default(""),
  APP_ACCESS_LOGS: booleanSchema().default(false),
  APP_EXPOSE_INTERNAL_ERRORS: booleanSchema().default(false),

  MIDDLEWARE_CORS: booleanSchema().default(false),
  CORS_ALLOWED_ORIGINS: stringArraySchema(z.string()).default(["*"]),
  CORS_ALLOWED_METHODS: stringArraySchema(z.string()).default(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]),
  CORS_ALLOWED_HEADERS: stringArraySchema(z.string()).default(["*"]),
  CORS_EXPOSE_HEADERS: stringArraySchema(z.string()).default([]),

  LOG_NAME: z.string().default("app"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  LOG_TYPE: z.enum(LOG_TYPES).default("pretty"),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
