import * as admin from "firebase-admin";
import { getFirebaseAdminEnv } from "./fetchEnvFromGist.js";

let initPromise = null;

/**
 * Initialize Firebase Admin SDK with credentials from Gist or process.env
 */
async function initializeAdmin() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const env = await getFirebaseAdminEnv();

      if (!env.project_id || !env.private_key || !env.client_email) {
        throw new Error(
          "Missing Firebase Admin credentials. Please set NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_PRIVATE_KEY, and NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL in environment variables or Gist."
        );
      }

      // Handle private key - replace escaped newlines
      const privateKey = env.private_key.replace(/\\n/g, "\n");

      admin.initializeApp({
        credential: admin.credential.cert({
          project_id: env.project_id,
          private_key: privateKey,
          client_email: env.client_email,
        }),
      });

      return admin.apps[0];
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

// Don't initialize on module load - only initialize when explicitly called
// This prevents errors when credentials aren't available during import

export default admin;

// Export initialization function for explicit initialization if needed
export { initializeAdmin };