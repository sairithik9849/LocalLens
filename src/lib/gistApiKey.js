/**
 * Fetches API keys from a GitHub Gist raw URL
 * 
 * Setup:
 * 1. Create a GitHub Gist with your API keys in this format:
 *    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
 *    OPENWEATHER_API_KEY=your_openweather_key
 * 2. Get the raw URL (click "Raw" button on the Gist)
 * 3. Update the GIST_RAW_URL constant below with your Gist raw URL
 */

// Update this with your GitHub Gist raw URL
const GIST_RAW_URL = 'https://gist.githubusercontent.com/anikdoshi2003/39a8b7d85728126f27289840d825de5d/raw/87312461c8bf2c63a3f8d32e30442e2627c3009a/local_lens_env_vars';

let cachedKeys = null;
let fetchPromise = null;

async function fetchKeysFromGist() {
  // If already cached, return it
  if (cachedKeys) {
    return cachedKeys;
  }

  // If a fetch is already in progress, return that promise
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = fetch(GIST_RAW_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch API keys: ${response.statusText}`);
      }
      const content = (await response.text()).trim();
      
      const keys = {};
      
      // Parse Google Maps API key
      const googleMatch = content.match(/NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=(.+)/);
      if (googleMatch && googleMatch[1]) {
        keys.googleMaps = googleMatch[1].trim();
      }
      
      cachedKeys = keys;
      fetchPromise = null;
      return keys;
    })
    .catch((error) => {
      fetchPromise = null;
      console.error('Error fetching API keys from Gist:', error);
      throw error;
    });

  return fetchPromise;
}

export async function getGoogleMapsApiKey() {
  const keys = await fetchKeysFromGist();
  if (!keys.googleMaps) {
    throw new Error('Google Maps API key not found in Gist');
  }
  return keys.googleMaps;
}

