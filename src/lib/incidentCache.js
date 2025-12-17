// src/lib/incidentCache.js
import { getRedisClient } from './redis';

/**
 * Normalize coordinate to 2 decimal places for cache key grouping
 * @param {number} coord - Coordinate value
 * @returns {number} Normalized coordinate
 */
function normalizeCoord(coord) {
  return Math.round(parseFloat(coord) * 100) / 100;
}

/**
 * Generate cache key from query parameters
 * @param {Object} params - Query parameters
 * @param {string} [params.minLat] - Minimum latitude
 * @param {string} [params.maxLat] - Maximum latitude
 * @param {string} [params.minLng] - Minimum longitude
 * @param {string} [params.maxLng] - Maximum longitude
 * @param {string|number} [params.limit] - Result limit
 * @returns {string} Cache key
 */
export function generateCacheKey(params) {
  const { minLat, maxLat, minLng, maxLng, limit } = params;
  const limitValue = limit || '100';

  // If bounds are provided, normalize and create key
  if (minLat && maxLat && minLng && maxLng) {
    const normalizedMinLat = normalizeCoord(minLat);
    const normalizedMaxLat = normalizeCoord(maxLat);
    const normalizedMinLng = normalizeCoord(minLng);
    const normalizedMaxLng = normalizeCoord(maxLng);

    return `incidents:query:${normalizedMinLat}_${normalizedMaxLat}_${normalizedMinLng}_${normalizedMaxLng}_${limitValue}`;
  }

  // No bounds - use "all" key
  return `incidents:query:all_${limitValue}`;
}

/**
 * Retrieve cached incident data
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Array|null>} Cached incidents array or null
 */
export async function getCachedIncidents(cacheKey) {
  try {
    const client = await getRedisClient();
    if (!client) {
      // Redis unavailable, return null to fallback to MongoDB
      console.log('[Incidents Cache] Redis unavailable, falling back to MongoDB');
      return null;
    }

    const cachedData = await client.get(cacheKey);
    
    if (!cachedData) {
      console.log(`[Incidents Cache] MISS - Key: ${cacheKey}`);
      return null;
    }

    const parsed = JSON.parse(cachedData);
    const incidents = parsed.incidents || null;
    
    if (incidents) {
      console.log(`[Incidents Cache] HIT - Key: ${cacheKey}, Count: ${incidents.length}`);
    }
    
    return incidents;
  } catch (error) {
    // Log warning but don't throw - allow fallback to MongoDB query
    console.warn('[Incidents Cache] Error reading from cache:', error.message);
    return null;
  }
}

/**
 * Cache incident data with TTL
 * @param {string} cacheKey - Cache key
 * @param {Array} incidents - Incidents array to cache
 * @param {number} [ttl] - Time to live in seconds (default: 900 = 15 minutes)
 * @returns {Promise<boolean>} True if cached successfully
 */
export async function setCachedIncidents(cacheKey, incidents, ttl = 900) {
  try {
    const client = await getRedisClient();
    if (!client) {
      // Redis unavailable, return false but don't throw
      console.log('[Incidents Cache] Redis unavailable, skipping cache write');
      return false;
    }

    const cacheValue = JSON.stringify({
      incidents: incidents,
      cachedAt: Math.floor(Date.now() / 1000),
    });

    // Use setEx to set with TTL (15 minutes = 900 seconds)
    await client.setEx(cacheKey, ttl, cacheValue);
    
    console.log(`[Incidents Cache] SET - Key: ${cacheKey}, Count: ${incidents.length}, TTL: ${ttl}s`);
    
    return true;
  } catch (error) {
    // Log warning but don't throw - caching failure shouldn't break the request
    console.warn('[Incidents Cache] Error writing to cache:', error.message);
    return false;
  }
}

/**
 * Invalidate all incident caches
 * This should be called after creating, updating, or deleting incidents
 * @returns {Promise<boolean>} True if invalidation was successful
 */
export async function invalidateIncidentCache() {
  try {
    const client = await getRedisClient();
    if (!client) {
      console.log('[Incidents Cache] Redis unavailable, skipping cache invalidation');
      return false;
    }

    // Get all keys matching the pattern
    const keys = await client.keys('incidents:query:*');
    
    if (keys && keys.length > 0) {
      // Delete all matching keys
      await client.del(keys);
      console.log(`[Incidents Cache] INVALIDATED - Deleted ${keys.length} cache key(s)`);
    } else {
      console.log('[Incidents Cache] INVALIDATED - No cache keys found');
    }
    
    return true;
  } catch (error) {
    console.warn('[Incidents Cache] Error invalidating cache:', error.message);
    return false;
  }
}

/**
 * Retrieve cached event data
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Array|null>} Cached events array or null
 */
export async function getCachedEvents(cacheKey) {
  try {
    const client = await getRedisClient();
    if (!client) {
      // Redis unavailable, return null to fallback to MongoDB
      console.log('[Events Cache] Redis unavailable, falling back to MongoDB');
      return null;
    }

    const cachedData = await client.get(cacheKey);
    
    if (!cachedData) {
      console.log(`[Events Cache] MISS - Key: ${cacheKey}`);
      return null;
    }

    const parsed = JSON.parse(cachedData);
    const events = parsed.events || null;
    
    if (events) {
      console.log(`[Events Cache] HIT - Key: ${cacheKey}, Count: ${events.length}`);
    }
    
    return events;
  } catch (error) {
    // Log warning but don't throw - allow fallback to MongoDB query
    console.warn('[Events Cache] Error reading from cache:', error.message);
    return null;
  }
}

/**
 * Cache event data with TTL
 * @param {string} cacheKey - Cache key
 * @param {Array} events - Events array to cache
 * @param {number} [ttl] - Time to live in seconds (default: 900 = 15 minutes)
 * @returns {Promise<boolean>} True if cached successfully
 */
export async function setCachedEvents(cacheKey, events, ttl = 900) {
  try {
    const client = await getRedisClient();
    if (!client) {
      // Redis unavailable, return false but don't throw
      console.log('[Events Cache] Redis unavailable, skipping cache write');
      return false;
    }

    const cacheValue = JSON.stringify({
      events: events,
      cachedAt: Math.floor(Date.now() / 1000),
    });

    // Use setEx to set with TTL (15 minutes = 900 seconds)
    await client.setEx(cacheKey, ttl, cacheValue);
    
    console.log(`[Events Cache] SET - Key: ${cacheKey}, Count: ${events.length}, TTL: ${ttl}s`);
    
    return true;
  } catch (error) {
    // Log warning but don't throw - caching failure shouldn't break the request
    console.warn('[Events Cache] Error writing to cache:', error.message);
    return false;
  }
}

/**
 * Invalidate all event caches
 * This should be called after creating, updating, or deleting events
 * @returns {Promise<boolean>} True if invalidation was successful
 */
export async function invalidateEventCache() {
  try {
    const client = await getRedisClient();
    if (!client) {
      console.log('[Events Cache] Redis unavailable, skipping cache invalidation');
      return false;
    }

    // Get all keys matching the pattern
    const keys = await client.keys('events:query:*');
    
    if (keys && keys.length > 0) {
      // Delete all matching keys
      await client.del(keys);
      console.log(`[Events Cache] INVALIDATED - Deleted ${keys.length} cache key(s)`);
    } else {
      console.log('[Events Cache] INVALIDATED - No cache keys found');
    }
    
    return true;
  } catch (error) {
    console.warn('[Events Cache] Error invalidating cache:', error.message);
    return false;
  }
}

