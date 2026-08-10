import "dotenv/config";
import { z } from "zod";

/**
 * Every environment variable the app needs, validated at boot.
 * If anything is missing or malformed, the process exits immediately
 * with a readable error instead of failing mysteriously at runtime.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .refine(
      (origins) => origins.every((o) => z.string().url().safeParse(o).success),
      { message: "WEB_ORIGIN must be a comma-separated list of valid URLs" },
    ),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // ---- Auth ----
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // ---- Email (Resend) ----
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // ---- Cloudinary ----
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // ---- TURN (Metered.ca) — optional; without it calls are STUN-only ----
  METERED_DOMAIN: z.string().optional(),
  METERED_SECRET: z.string().optional(),

  // ---- Web Push (VAPID) — optional; push silently disabled without ----
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:hello@daymate.app"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
