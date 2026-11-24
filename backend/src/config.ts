import { z } from "zod";

const originSchema = z
  .url({ protocol: /^https?$/ })
  .refine(
    (v) => URL.canParse(v) && !v.includes("*") && new URL(v).origin === v,
  );

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
  MEDIA_DRIVER: z.enum(["local", "r2"]).default("local"),
  MEDIA_LOCAL_DIR: z.string().min(1).default("storage/media"),
  // Absolute URL in production; the local driver defaults to the backend route proxied by Next.
  MEDIA_PUBLIC_URL: z
    .string()
    .regex(/^(https?:\/\/[^\s]+|\/[^\s]*)$/)
    .transform((v) => v.replace(/\/+$/, ""))
    .optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_PUBLIC: z.string().optional(),
  R2_BUCKET_ORIGINALS: z.string().optional(),
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
  if (e.MEDIA_DRIVER === "r2") {
    const missing = (
      [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_PUBLIC",
        "R2_BUCKET_ORIGINALS",
        "MEDIA_PUBLIC_URL",
      ] as const
    ).filter((k) => !e[k]?.trim());
    if (missing.length)
      throw new Error("MEDIA_DRIVER=r2 requires: " + missing.join(", "));
    if (!/^https?:\/\//.test(e.MEDIA_PUBLIC_URL!))
      throw new Error("MEDIA_DRIVER=r2 requires an absolute MEDIA_PUBLIC_URL");
  }
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
    media: {
      driver: e.MEDIA_DRIVER,
      localDir: e.MEDIA_LOCAL_DIR,
      publicUrl: e.MEDIA_PUBLIC_URL || "/api/v1/public/media",
      r2: {
        accountId: e.R2_ACCOUNT_ID?.trim() || "",
        accessKeyId: e.R2_ACCESS_KEY_ID?.trim() || "",
        secretAccessKey: e.R2_SECRET_ACCESS_KEY?.trim() || "",
        publicBucket: e.R2_BUCKET_PUBLIC?.trim() || "",
        originalsBucket: e.R2_BUCKET_ORIGINALS?.trim() || "",
      },
    },
    now: () => new Date(),
  };
}
