// SERVER ONLY — never import this module from client components.
// It reads server-only env vars (service-account key) via ./env.
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import { getServerEnv } from "./env";

let app: App | null = null;
let database: Database | null = null;

/** Admin SDK — server only (API routes / server components). Never import from client code. */
export function getAdminApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }
  const env = getServerEnv();
  app = initializeApp({
    credential: cert({
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
  return app;
}

export function getAdminDatabase(): Database {
  if (!database) database = getDatabase(getAdminApp());
  return database;
}
