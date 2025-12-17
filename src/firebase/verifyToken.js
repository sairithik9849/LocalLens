import { getAdminAuth } from "./firebaseAdmin";
import { getCachedToken, setCachedToken } from "@/lib/tokenCache";

/**
 * Verifies Firebase ID token from Authorization header
 * Uses Redis cache to reduce Firebase Admin API calls
 * @param {Request} request - Next.js request object
 * @returns {Promise<{uid: string, email?: string} | null>} Decoded token or null if invalid
 */
export async function verifyToken(request) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      return null;
    }

    // Check Redis cache first
    try {
      const cachedToken = await getCachedToken(token);
      if (cachedToken) {
        console.log('[Auth] Redis cache');
        // Return cached result immediately
        return {
          uid: cachedToken.uid,
          email: cachedToken.email,
        };
      }
    } catch (cacheError) {
      // Cache read failed, continue with Firebase verification
      console.warn('Redis cache read error, falling back to Firebase:', cacheError.message);
    }

    // Token not in cache or cache unavailable, verify with Firebase Admin
    try {
      const auth = await getAdminAuth();
      const decodedToken = await auth.verifyIdToken(token);

      const tokenData = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        expiresAt: decodedToken.exp, // Firebase token expiration (seconds since epoch)
      };

      console.log('[Auth] Firebase');

      // Cache the successfully verified token
      // Don't await - cache write failure shouldn't block the response
      setCachedToken(token, tokenData, 3300).catch(() => {
        // Ignore cache write errors - already logged in setCachedToken
      });

      return {
        uid: tokenData.uid,
        email: tokenData.email,
      };
    } catch (verifyError) {
      // Log detailed error for debugging
      const errorDetails = {
        message: verifyError.message,
        code: verifyError.code,
      };
      
      // Provide helpful hints based on error type
      if (verifyError.message?.includes('credential') || verifyError.code === 'app/invalid-credential') {
        errorDetails.hint = 'Firebase Admin needs proper credentials. Set up a service account JSON file via GOOGLE_APPLICATION_CREDENTIALS or configure Application Default Credentials.';
        errorDetails.severity = 'critical';
      } else if (verifyError.code === 'auth/argument-error') {
        errorDetails.hint = 'Invalid token format. Ensure the Authorization header is properly formatted as "Bearer <token>".';
        errorDetails.severity = 'warning';
      } else if (verifyError.code === 'auth/id-token-expired') {
        errorDetails.hint = 'Token has expired. Client should refresh the token.';
        errorDetails.severity = 'warning';
      } else {
        errorDetails.hint = 'Token verification failed. Check Firebase Admin configuration and ensure the project ID is correct.';
        errorDetails.severity = 'error';
      }
      
      console.error('Error verifying token with Firebase Admin:', errorDetails);
      
      // Don't cache failed verifications for security
      // Return null to reject the request for security
      return null;
    }
  } catch (error) {
    console.error('Error in verifyToken:', error);
    return null;
  }
}

/**
 * Middleware helper to verify authentication and authorization
 * @param {Request} request - Next.js request object
 * @param {string} requestedUid - UID from request (query param or body)
 * @returns {Promise<{authorized: boolean, uid?: string, error?: string, status?: number}>}
 */
export async function verifyAuthAndAuthorization(request, requestedUid) {
  // Verify token
  const decodedToken = await verifyToken(request);
  
  if (!decodedToken) {
    return {
      authorized: false,
      error: 'Unauthorized: Invalid or missing authentication token',
      status: 401
    };
  }

  // Check authorization - user can only access their own data
  if (decodedToken.uid !== requestedUid) {
    return {
      authorized: false,
      error: 'Forbidden: You can only access your own data',
      status: 403
    };
  }

  return {
    authorized: true,
    uid: decodedToken.uid
  };
}

