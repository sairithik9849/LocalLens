import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// Get Firebase config - prefers .env.local, falls back to fetching from Gist
function getFirebaseConfig() {
  // First, try process.env (from .env.local)
  if (
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ) {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }

  // If on client-side and env vars are missing, we'll fetch from Gist
  // For now, return undefined to trigger async fetch
  return undefined;
}

// Initialize Firebase
const firebaseConfig = getFirebaseConfig();
let app;
let auth;

if (firebaseConfig) {
  // Standard initialization with .env.local
  const apps = getApps();
  if (apps.length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = apps[0];
  }
  auth = getAuth(app);
} else if (typeof window !== "undefined") {
  // Client-side: Need to fetch from Gist
  // We'll initialize Firebase asynchronously in a client component
  // For now, export null - will be initialized in AuthContext
  app = null;
  auth = null;
} else {
  // Server-side without env vars - set to null
  // Client-side will handle the actual initialization from Gist
  // This prevents server-side errors during SSR
  app = null;
  auth = null;
}

export { auth, app };
