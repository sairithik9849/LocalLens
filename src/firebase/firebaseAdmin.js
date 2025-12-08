import admin from 'firebase-admin';

let adminApp = null;
let adminInitialized = false;
let adminInitError = null;

/**
 * Fetches environment variable from Gist (server-side compatible)
 */
async function getProjectIdFromGist() {
  try {
    const GIST_URL = "https://gist.githubusercontent.com/anikdoshi2003/39a8b7d85728126f27289840d825de5d/raw";
    const response = await fetch(GIST_URL);
    if (!response.ok) return null;
    
    const content = await response.text();
    const lines = content.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("NEXT_PUBLIC_FIREBASE_PROJECT_ID=")) {
        const match = trimmed.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/);
        if (match) {
          return match[1].trim();
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Initialize Firebase Admin SDK
 * Uses project config from environment or Gist
 */
export async function initializeFirebaseAdmin() {
  if (adminApp) {
    return adminApp;
  }

  // If we've already tried and failed, don't try again
  if (adminInitialized && adminInitError) {
    throw adminInitError;
  }

  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      adminApp = admin.apps[0];
      adminInitialized = true;
      return adminApp;
    }

    // Get Firebase project ID from process.env first, then try Gist
    let projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      // Try to fetch from Gist (server-side)
      projectId = await getProjectIdFromGist();
    }
    
    if (!projectId) {
      const error = new Error('Firebase Project ID not found. Please set NEXT_PUBLIC_FIREBASE_PROJECT_ID in environment variables or Gist.');
      adminInitError = error;
      adminInitialized = true;
      throw error;
    }

    // Try to initialize with project ID
    // Note: Firebase Admin needs credentials to verify tokens
    // For production, use a service account JSON file via GOOGLE_APPLICATION_CREDENTIALS
    // For development with emulator, this might work without credentials
    try {
      adminApp = admin.initializeApp({
        projectId: projectId,
      });
      adminInitialized = true;
      return adminApp;
    } catch (initError) {
      // If initialization fails, store the error
      adminInitError = initError;
      adminInitialized = true;
      
      // Provide detailed error information based on error type
      const errorInfo = {
        message: initError.message,
        code: initError.code,
      };
      
      if (initError.message?.includes('credential') || initError.code === 'app/invalid-credential') {
        errorInfo.hint = 'Firebase Admin requires credentials to verify ID tokens.';
        errorInfo.solution = [
          'For production: Set up a service account JSON file and set GOOGLE_APPLICATION_CREDENTIALS environment variable.',
          'For development: Configure Application Default Credentials or use Firebase Emulator Suite.',
          'Alternative: Store service account JSON content in Gist and load it programmatically.'
        ];
        console.error('Firebase Admin Credential Error:', errorInfo);
      } else if (initError.code === 'app/duplicate-app') {
        errorInfo.hint = 'Firebase Admin app already exists. This is usually not an error.';
        console.warn('Firebase Admin Duplicate App Warning:', errorInfo);
      } else {
        errorInfo.hint = 'Firebase Admin initialization failed. Check project ID and configuration.';
        console.error('Firebase Admin Initialization Error:', errorInfo);
      }
      
      throw initError;
    }
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'unknown';
    console.error('Error initializing Firebase Admin:', {
      message: errorMessage,
      code: errorCode,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get Firebase Admin instance
 */
export function getAdminApp() {
  if (!adminApp) {
    throw new Error('Firebase Admin not initialized. Call initializeFirebaseAdmin() first.');
  }
  return adminApp;
}

/**
 * Get Firebase Admin Auth instance
 */
export async function getAdminAuth() {
  const app = await initializeFirebaseAdmin();
  return admin.auth(app);
}

