/**
 * Fetches environment variables from a GitHub Gist
 * Falls back to process.env if Gist is unavailable or in production
 */

// Gist URL for fetching environment variables
const GIST_URL =
  "https://gist.githubusercontent.com/anikdoshi2003/39a8b7d85728126f27289840d825de5d/raw";
const CACHE_KEY = "firebase_env_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let cachedEnv = null;
let fetchPromise = null;

/**
 * Parses environment variables from Gist content
 */
function parseEnvContent(content) {
  const envVars = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envVars[key] = value;
    }
  }

  return envVars;
}

/**
 * Fetches environment variables from GitHub Gist
 */
async function fetchEnvFromGist() {
  // Check cache first
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  }

  // If already fetching, return the same promise
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      if (!GIST_URL) {
        throw new Error("Gist URL not configured");
      }

      const response = await fetch(GIST_URL);
      if (!response.ok) throw new Error("Failed to fetch Gist");

      const content = await response.text();
      const envVars = parseEnvContent(content);

      // Cache the result
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              data: envVars,
              timestamp: Date.now(),
            })
          );
        } catch (e) {
          // Ignore localStorage errors
        }
      }

      return envVars;
    } catch (error) {
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Gets environment variable value, checking Gist first, then process.env
 * Works both client-side and server-side
 */
export async function getEnvVar(key) {
  // In production or if .env.local exists, prefer process.env
  if (process.env[key]) {
    return process.env[key];
  }

  // Try to fetch from Gist (works on both client and server)
  try {
    const gistEnv = await fetchEnvFromGist();
    if (gistEnv && gistEnv[key]) {
      return gistEnv[key];
    }
  } catch (error) {
    // Silently fail and fall back to process.env
  }

  // Fallback to process.env
  return process.env[key];
}

/**
 * Gets all Firebase environment variables
 */
export async function getFirebaseEnv() {
  // If all env vars exist in process.env, use them
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

  // Try to fetch from Gist (client-side only)
  if (typeof window !== "undefined") {
    try {
      const gistEnv = await fetchEnvFromGist();
      if (gistEnv) {
        return {
          apiKey:
            gistEnv.NEXT_PUBLIC_FIREBASE_API_KEY ||
            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain:
            gistEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
            process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId:
            gistEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket:
            gistEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId:
            gistEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
            process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId:
            gistEnv.NEXT_PUBLIC_FIREBASE_APP_ID ||
            process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };
      }
    } catch (error) {
      // Silently fail
    }
  }

  // Fallback to process.env
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/**
 * Gets Firebase Admin SDK environment variables (server-side)
 * Fetches from Gist if not in process.env
 */
export async function getFirebaseAdminEnv() {
  // If all env vars exist in process.env, use them
  if (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_PRIVATE_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL
  ) {
    return {
      project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      private_key: process.env.NEXT_PUBLIC_PRIVATE_KEY,
      client_email: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
    };
  }

  // Try to fetch from Gist (works on both client and server)
  try {
    const gistEnv = await fetchEnvFromGist();
    if (gistEnv) {
      return {
        project_id:
          gistEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        private_key:
          gistEnv.NEXT_PUBLIC_PRIVATE_KEY ||
          process.env.NEXT_PUBLIC_PRIVATE_KEY,
        client_email:
          gistEnv.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL ||
          process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
      };
    }
  } catch (error) {
    // Silently fail
  }

  // Fallback to process.env
  return {
    project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    private_key: process.env.NEXT_PUBLIC_PRIVATE_KEY,
    client_email: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
  };
}
