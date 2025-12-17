/**
 * Helper functions for making authenticated API requests
 */

/**
 * Gets the current Firebase ID token
 * @returns {Promise<string|null>} Firebase ID token or null if not available
 */
export async function getFirebaseToken() {
  try {
    // This will be called from client-side only
    if (typeof window === 'undefined') {
      return null;
    }

    // Import Firebase auth dynamically to avoid SSR issues
    const { auth } = await import('@/firebase/config');
    const { getAuth } = await import('firebase/auth');
    
    const currentAuth = auth || getAuth();
    if (!currentAuth || !currentAuth.currentUser) {
      return null;
    }

    const token = await currentAuth.currentUser.getIdToken();
    return token;
  } catch (error) {
    console.error('Error getting Firebase token:', error);
    return null;
  }
}

/**
 * Makes an authenticated fetch request with Firebase token
 * @param {string} url - API endpoint URL
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
  const token = await getFirebaseToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

