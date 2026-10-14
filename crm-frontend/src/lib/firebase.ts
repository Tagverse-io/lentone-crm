"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getEnv } from "./env";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

function init(): { app: FirebaseApp; auth: Auth; db: Database } {
  if (app && auth && db) return { app, auth, db };
  const env = getEnv();
  app =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({
          apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
          projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
        });
  auth = getAuth(app);
  db = getDatabase(app);
  return { app, auth, db };
}

export function firebase(): { app: FirebaseApp; auth: Auth; db: Database } {
  return init();
}

export function firebaseAuth(): Auth {
  return init().auth;
}

export function firebaseDb(): Database {
  return init().db;
}
