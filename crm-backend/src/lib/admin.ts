import admin from "firebase-admin";
import { getEnv } from "./env";

let initialized = false;

/** firebase-admin singleton (serverless-safe: initializes once per instance). */
export function db(): admin.database.Database {
  const env = getEnv();
  if (!initialized) {
    const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
        databaseURL: env.FIREBASE_DATABASE_URL,
      });
    }
    initialized = true;
  }
  return admin.database();
}

export function auth(): admin.auth.Auth {
  db(); // ensure init
  return admin.auth();
}
