// src/lib/tokenCache.js
import { createHash } from 'crypto';
import { getRedisClient } from './redis';

/**
 * Hash token for use as cache key
 * @param {string} token - Firebase ID token
 * @returns {string} SHA-256 hash of the token
 */
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Get cache key for a token
 * @param {string} tokenHash - Hashed token
 * @returns {string} Redis cache key
 */
function getCacheKey(tokenHash) {
  return `auth:token:${tokenHash}`;
}

/**
 * Retrieve cached token data
 * @param {string} token - Firebase ID token
 * @returns {Promise<{uid: string, email?: string, expiresAt?: number} | null>} Cached token data or null
 */
export async function getCachedToken(token) {
  try {
    const client = await getRedisClient();
    if (!client) {
      // Redis unavailable, return null to fallback to Firebase
      return null;
    }

    const tokenHash = hashToken(token);
    const cacheKey = getCacheKey(tokenHash);
    
    const cachedData = await client.get(cacheKey);
    
    if (!cachedData) {
      return null;
    }

    const parsed = JSON.parse(cachedData);
    
    // Check if token has expired (using expiresAt from Firebase)
    if (parsed.expiresAt && parsed.expiresAt < Date.now() / 1000) {
      // Token expired, delete from cache
      await deleteCachedToken(token).catch(() => {
        // Ignore deletion errors
      });
      return null;
    }

    return {
      uid: parsed.uid,
      email: parsed.email,
      expiresAt: parsed.expiresAt,
    };
  } catch (error) {
    // Log warning but don't throw - allow fallback to Firebase verification
    console.warn('Error reading from token cache:', error.message);
    return null;
  }
}

/**
 * Cache token data with TTL
 * @param {string} token - Firebase ID token
 * @param {Object} tokenData - Token data to cache
 * @param {string} tokenData.uid - User ID
 * @param {string} [tokenData.email] - User email
 * @param {number} [tokenData.expiresAt] - Token expiration timestamp (seconds since epoch)
 * @param {number} [ttl] - Time to live in seconds (default: 3300 = 55 minutes)
 * @returns {Promise<boolean>} True if cached successfully
 */
export async function setCachedToken(token, tokenData, ttl = 3300) {
  try {
    const client = await getRedisClient();
    if (!client) {
      // Redis unavailable, return false but don't throw
      return false;
    }

    const tokenHash = hashToken(token);
    const cacheKey = getCacheKey(tokenHash);
    
    const cacheValue = JSON.stringify({
      uid: tokenData.uid,
      email: tokenData.email,
      expiresAt: tokenData.expiresAt,
      cachedAt: Math.floor(Date.now() / 1000),
    });

    // Use setEx to set with TTL (55 minutes = 3300 seconds)
    await client.setEx(cacheKey, ttl, cacheValue);
    
    return true;
  } catch (error) {
    // Log warning but don't throw - caching failure shouldn't break authentication
    console.warn('Error writing to token cache:', error.message);
    return false;
  }
}

/**
 * Delete cached token
 * @param {string} token - Firebase ID token
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteCachedToken(token) {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    const tokenHash = hashToken(token);
    const cacheKey = getCacheKey(tokenHash);
    
    await client.del(cacheKey);
    return true;
  } catch (error) {
    console.warn('Error deleting from token cache:', error.message);
    return false;
  }
}

