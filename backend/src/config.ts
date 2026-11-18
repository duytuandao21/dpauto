import { z } from "zod";

const originSchema = z
  .url({ protocol: /^https?$/ })
  .refine((v) => URL.canParse(v) && !v.includes("*") && new URL(v).origin === v);

const envSchema = z.object({
  DATABASE_URL: z.url().refine((v) => /^postgres(ql)?:/.test(v)),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(4002),
  API_HOST: z.string().default("127.0.0.1"),
  APP_ORIGIN: originSchema,
  APP_ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((v) =>
      v.trim() ? v.split(",").map((origin) => origin.trim()) : [],
    )
    .pipe(z.array(originSchema)),
  API_SECRET: z.string().min(48),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  STATION_CODE: z
    .string()
    .regex(/^[A-Z0-9_-]{3,50}$/)
    .default("TOAN_TRUNG"),
});
export type Config = ReturnType<typeof loadConfig>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(env);
  if (!result.success)
    throw new Error(
      "Invalid environment: " +
        result.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  const e = result.data;
  if (e.NODE_ENV === "production" && !e.APP_ORIGIN.startsWith("https://"))
    throw new Error("Production requires HTTPS APP_ORIGIN");
  if (
    e.NODE_ENV === "production" &&
    e.APP_ALLOWED_ORIGINS.some((origin) => !origin.startsWith("https://"))
  )
    throw new Error("Production requires HTTPS APP_ALLOWED_ORIGINS");
  return {
    databaseUrl: e.DATABASE_URL,
    port: e.API_PORT,
    host: e.API_HOST,
    origin: e.APP_ORIGIN,
    allowedOrigins: [...new Set([e.APP_ORIGIN, ...e.APP_ALLOWED_ORIGINS])],
    secret: e.API_SECRET,
    production: e.NODE_ENV === "production",
    stationCode: e.STATION_CODE,
    cookie:
      e.NODE_ENV === "production"
        ? "__Host-dpauto-session"
        : "dpauto-dev-session",
    now: () => new Date(),
  };
}
