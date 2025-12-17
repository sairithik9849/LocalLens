/**
 * Gets MongoDB URI from Gist
 * All secrets are stored in the Gist and fetched at runtime
 */
const GIST_URL = 'https://gist.githubusercontent.com/anikdoshi2003/39a8b7d85728126f27289840d825de5d/raw';

let cachedUri = null;
let fetchPromise = null;

async function getMongoUri() {
  // Return cached URI if available
  if (cachedUri) {
    return cachedUri;
  }

  // If already fetching, return the same promise
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const response = await fetch(GIST_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch Gist: ${response.statusText}`);
      }

      const content = await response.text();
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        if (trimmed.startsWith('NEXT_MONGODB_URI=')) {
          // Handle case where value might contain '=' characters
          const match = trimmed.match(/^NEXT_MONGODB_URI=(.+)$/);
          if (match && match[1]) {
            cachedUri = match[1].trim();
            fetchPromise = null;
            return cachedUri;
          }
        }
      }
      
      throw new Error('NEXT_MONGODB_URI not found in Gist');
    } catch (error) {
      fetchPromise = null;
      console.error('Error fetching MongoDB URI from Gist:', error);
      throw error;
    }
  })();

  return fetchPromise;
}

// Config object (serverUrl will be set async)
export const mongoConfig = {
  serverUrl: null, // Will be set by initializeMongoConfig
  database: 'locallens-data'
};

// Async function to initialize config from Gist
export async function initializeMongoConfig() {
  const uri = await getMongoUri();
  if (uri) {
    mongoConfig.serverUrl = uri;
  } else {
    throw new Error('Failed to get MongoDB URI from Gist');
  }
  return mongoConfig;
}
