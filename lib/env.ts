import { z } from "zod";

// Every Firebase / app secret is read from environment variables only.
// No Firebase value, key or URL may appear in source code.
// Missing variables throw an error naming the exact variable.

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, "NEXT_PUBLIC_FIREBASE_API_KEY is missing"),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is missing"),
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: z.string().url("NEXT_PUBLIC_FIREBASE_DATABASE_URL is missing or not a URL"),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, "NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing"),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing"),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is missing"),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, "NEXT_PUBLIC_FIREBASE_APP_ID is missing"),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().min(1, "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID is missing"),
});

const ServerEnvSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1, "FIREBASE_ADMIN_PROJECT_ID is missing"),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().min(1, "FIREBASE_ADMIN_CLIENT_EMAIL is missing"),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1, "FIREBASE_ADMIN_PRIVATE_KEY is missing"),
  APP_API_KEY: z.string().min(1, "APP_API_KEY is missing"),
});

export type ClientEnv = z.infer<typeof ClientEnvSchema>;
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let clientCache: ClientEnv | null = null;
let serverCache: ServerEnv | null = null;

function formatIssues(prefix: string, issues: z.ZodIssue[]): string {
  return `${prefix}: ${issues.map((i) => i.message).join("; ")}`;
}

/** Validated public (NEXT_PUBLIC_*) env. Safe to call in the browser. */
export function getClientEnv(): ClientEnv {
  if (clientCache) return clientCache;
  const parsed = ClientEnvSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });
  if (!parsed.success) {
    throw new Error(formatIssues("Invalid client env", parsed.error.issues));
  }
  clientCache = parsed.data;
  return clientCache;
}

/** Validated server-only env. NEVER import this from client components. */
export function getServerEnv(): ServerEnv {
  if (serverCache) return serverCache;
  const parsed = ServerEnvSchema.safeParse({
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    APP_API_KEY: process.env.APP_API_KEY,
  });
  if (!parsed.success) {
    throw new Error(formatIssues("Invalid server env", parsed.error.issues));
  }
  serverCache = parsed.data;
  return serverCache;
}

/** Backwards-compatible: public env accessor used by client code. */
export function getEnv(): ClientEnv {
  return getClientEnv();
}
