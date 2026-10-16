import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getClientEnv } from "./env";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;

function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApp();
    return app;
  }
  const env = getClientEnv();
  app = initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function getFirebaseDatabase(): Database {
  if (!database) database = getDatabase(getFirebaseApp());
  return database;
}

export { getFirebaseApp };
