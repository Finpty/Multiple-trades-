import { z } from "zod";

/**
 * Runtime configuration. Parsed once, lazily. Every value has a safe default so
 * the platform boots with nothing but DATABASE_URL and PLATFORM_SECRET.
 * There is deliberately no AI vendor key here: AI providers are configured in
 * the database from Super Admin and are optional.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  PLATFORM_SECRET: z
    .string()
    .min(32, "PLATFORM_SECRET must be at least 32 characters (openssl rand -hex 32)"),
  PLATFORM_HOSTS: z.string().default("localhost,127.0.0.1"),
  PLATFORM_URL: z.string().default("http://localhost:3000"),
  MEDIA_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  MEDIA_STORAGE_PATH: z.string().default("./storage/media"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  MAIL_DRIVER: z.enum(["log", "smtp"]).default("log"),
  MAIL_FROM: z.string().default("TRADE ONE <no-reply@localhost>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SEED_OWNER_EMAIL: z.string().default("owner@tradeone.local"),
  SEED_OWNER_PASSWORD: z.string().default("tradeone-owner"),
  SEED_OWNER_NAME: z.string().default("Platform Owner"),
  SEED_DEMO_BUSINESSES: z.string().default("true"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Platform hostnames (lower-case, without port). Safe to call from the edge runtime. */
export function platformHosts(): string[] {
  return (process.env.PLATFORM_HOSTS ?? "localhost,127.0.0.1")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}
