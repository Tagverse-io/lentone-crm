import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseFirestore: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let firebaseDatabase: Database | null = null;

function getAppInstance(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  if (getApps().length > 0) {
    firebaseApp = getApp();
  } else {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    firebaseApp = initializeApp(config);
  }

  return firebaseApp;
}

export function getAuthInstance(): Auth {
  if (!firebaseAuth) {
    firebaseAuth = getAuth(getAppInstance());
  }
  return firebaseAuth;
}

export function getFirestoreInstance(): Firestore {
  if (!firebaseFirestore) {
    firebaseFirestore = getFirestore(getAppInstance());
  }
  return firebaseFirestore;
}

export function getStorageInstance(): FirebaseStorage {
  if (!firebaseStorage) {
    firebaseStorage = getStorage(getAppInstance());
  }
  return firebaseStorage;
}

export function getDatabaseInstance(): Database {
  if (!firebaseDatabase) {
    firebaseDatabase = getDatabase(getAppInstance());
  }
  return firebaseDatabase;
}

// Backward-compatible getters — these look like constants but initialize lazily
export const auth: Auth = new Proxy({} as Auth, {
  get: (_, prop) => (getAuthInstance() as any)[prop],
});
export const firestore: Firestore = new Proxy({} as Firestore, {
  get: (_, prop) => (getFirestoreInstance() as any)[prop],
});
export const storage: FirebaseStorage = new Proxy({} as FirebaseStorage, {
  get: (_, prop) => (getStorageInstance() as any)[prop],
});
export const database: Database = new Proxy({} as Database, {
  get: (_, prop) => (getDatabaseInstance() as any)[prop],
});
export { getAppInstance as app };
