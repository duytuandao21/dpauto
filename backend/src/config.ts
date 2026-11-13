import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url().refine((v) => /^postgres(ql)?:/.test(v)),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(4002),
  API_HOST: z.string().default("127.0.0.1"),
  APP_ORIGIN: z.url().refine((v) => new URL(v).origin === v),
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
  return {
    databaseUrl: e.DATABASE_URL,
    port: e.API_PORT,
    host: e.API_HOST,
    origin: e.APP_ORIGIN,
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
