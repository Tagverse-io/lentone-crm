import { z } from "zod";

// Validates backend env at startup. Fails fast with a clear message.
// NOTE: FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY are required at runtime
// for firebase-admin, but seed/cron docs allow placeholders — validate lazily per use.
const EnvSchema = z.object({
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a URL"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is missing"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is missing"),
  GOOGLE_REDIRECT_URI: z.string().url("GOOGLE_REDIRECT_URI must be a URL"),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is missing"),
  FIREBASE_DATABASE_URL: z.string().url("FIREBASE_DATABASE_URL must be a URL"),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, "FIREBASE_CLIENT_EMAIL is missing"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is missing"),
  GMAIL_USER: z.string().min(1, "GMAIL_USER is missing"),
  GMAIL_APP_PASSWORD: z.string().min(1, "GMAIL_APP_PASSWORD is missing"),
  MAIL_FROM_NAME: z.string().min(1).default("Your CRM"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 chars"),
  TOKEN_ENCRYPTION_KEY: z.string().length(32, "TOKEN_ENCRYPTION_KEY must be exactly 32 chars"),
});

export type BackendEnv = z.infer<typeof EnvSchema>;

let cached: BackendEnv | null = null;

export function getEnv(): BackendEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid backend env: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  cached = parsed.data;
  return cached;
}
