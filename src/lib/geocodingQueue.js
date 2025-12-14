// src/lib/geocodingQueue.js
import { randomUUID } from 'crypto';
import { getRabbitMQChannel } from './rabbitmq.js';
import { getRedisClient } from './redis.js';

/**
 * Round coordinates to 4 decimal places (≈11m precision) for caching
 * @param {number} coord - Coordinate (lat or lng)
 * @returns {number} Rounded coordinate
 */
function roundCoordinate(coord) {
  return Math.round(coord * 10000) / 10000;
}

/**
 * Get cached geocoding result by pincode and type
 * @param {string} pincode - ZIP code
 * @param {string} type - Type of geocoding: 'city' or 'coords'
 * @returns {Promise<{status: string, result?: any} | null>} Cached result or null
 */
async function getCachedGeocodingByPincode(pincode, type) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return null;
    }

    const cacheKey = `geocoding:cache:${type}:${pincode}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (!cachedData) {
      return null;
    }

    const parsed = JSON.parse(cachedData);
    return {
      status: 'completed',
      result: parsed.result,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get cached geocoding result by coordinates (for reverse geocoding)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<{status: string, result?: any} | null>} Cached result or null
 */
async function getCachedGeocodingByCoords(lat, lng) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return null;
    }

    // Round coordinates to 4 decimal places for cache key
    const roundedLat = roundCoordinate(lat);
    const roundedLng = roundCoordinate(lng);
    const cacheKey = `geocoding:cache:reverse:${roundedLat}:${roundedLng}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (!cachedData) {
      return null;
    }

    const parsed = JSON.parse(cachedData);
    return {
      status: 'completed',
      result: parsed.result,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Store geocoding result in pincode-based cache
 * @param {string} pincode - ZIP code
 * @param {string} type - Type of geocoding: 'city' or 'coords'
 * @param {any} result - Result data
 */
async function cacheGeocodingByPincode(pincode, type, result) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return;
    }

    const cacheKey = `geocoding:cache:${type}:${pincode}`;
    await redisClient.setEx(
      cacheKey,
      86400, // 24 hours TTL (pincode results don't change)
      JSON.stringify({ result, cachedAt: Math.floor(Date.now() / 1000) })
    );
  } catch (error) {
    // Silently fail - caching is optional
  }
}

/**
 * Store geocoding result in coordinate-based cache (for reverse geocoding)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {any} result - Result data (pincode string)
 */
async function cacheGeocodingByCoords(lat, lng, result) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return;
    }

    // Round coordinates to 4 decimal places for cache key
    const roundedLat = roundCoordinate(lat);
    const roundedLng = roundCoordinate(lng);
    const cacheKey = `geocoding:cache:reverse:${roundedLat}:${roundedLng}`;
    await redisClient.setEx(
      cacheKey,
      86400, // 24 hours TTL (pincode for a location doesn't change frequently)
      JSON.stringify({ result, cachedAt: Math.floor(Date.now() / 1000) })
    );
  } catch (error) {
    // Silently fail - caching is optional
  }
}

/**
 * Get or create an in-progress job ID for a pincode+type or coordinates
 * Returns existing job ID if one is already in progress, otherwise creates a new one
 * @param {string|number} identifier - ZIP code (string) or rounded coordinate key (string) for reverse
 * @param {string} type - Type of geocoding: 'city', 'coords', or 'reverse'
 * @returns {Promise<{jobId: string, isNew: boolean} | null>} Job ID and whether it's new
 */
async function getOrCreateInProgressJob(identifier, type) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return null;
    }

    const inProgressKey = `geocoding:inprogress:${type}:${identifier}`;
    
    // Try to get existing in-progress job
    const existingJobData = await redisClient.get(inProgressKey);
    if (existingJobData) {
      const parsed = JSON.parse(existingJobData);
      // Check if job is still valid (not expired)
      const now = Math.floor(Date.now() / 1000);
      if (now - parsed.timestamp < 300) { // 5 minutes max
        console.log(`[Queue] 🔄 Reusing existing job - Job: ${parsed.jobId}, Identifier: ${identifier}, Type: ${type}`);
        return { jobId: parsed.jobId, isNew: false };
      }
      // Job expired, remove it
      await redisClient.del(inProgressKey);
    }

    // Create new job ID
    const jobId = randomUUID();
    await redisClient.setEx(
      inProgressKey,
      300, // 5 minutes TTL (should complete much faster)
      JSON.stringify({
        jobId,
        identifier,
        type,
        timestamp: Math.floor(Date.now() / 1000),
      })
    );

    return { jobId, isNew: true };
  } catch (error) {
    console.warn('[Queue] Error checking in-progress job:', error.message);
    return null;
  }
}

/**
 * Remove in-progress job tracking
 * @param {string|number} identifier - ZIP code (string) or rounded coordinate key (string) for reverse
 * @param {string} type - Type of geocoding: 'city', 'coords', or 'reverse'
 */
async function removeInProgressJob(identifier, type) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return;
    }

    const inProgressKey = `geocoding:inprogress:${type}:${identifier}`;
    await redisClient.del(inProgressKey);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Publish geocoding job to RabbitMQ queue
 * @param {string|number} identifier - ZIP code (string) for forward geocoding, or lat/lng (numbers) for reverse
 * @param {string} type - Type of geocoding: 'city', 'coords', or 'reverse'
 * @param {Object} [metadata] - Optional metadata (userId, requestId, etc.)
 * @param {number} [lat] - Latitude (required for reverse geocoding)
 * @param {number} [lng] - Longitude (required for reverse geocoding)
 * @returns {Promise<{jobId: string, status: string, cached?: boolean}>} Job ID and status
 */
export async function publishGeocodingJob(identifier, type, metadata = {}, lat = null, lng = null) {
  try {
    let cached = null;
    let cacheIdentifier = null;

    // Check cache based on type
    if (type === 'reverse' && lat !== null && lng !== null) {
      // Reverse geocoding: check coordinate-based cache
      cached = await getCachedGeocodingByCoords(lat, lng);
      const roundedLat = roundCoordinate(lat);
      const roundedLng = roundCoordinate(lng);
      cacheIdentifier = `${roundedLat}:${roundedLng}`;
    } else {
      // Forward geocoding: check pincode-based cache
      cached = await getCachedGeocodingByPincode(identifier, type);
      cacheIdentifier = identifier;
    }

    if (cached && cached.status === 'completed') {
      // Return a job ID that points to the cached result
      const jobId = randomUUID();
      const redisClient = await getRedisClient();
      if (redisClient) {
        await redisClient.setEx(
          `geocoding:result:${jobId}`,
          900, // 15 minutes TTL (job results are temporary)
          JSON.stringify({
            status: 'completed',
            jobId,
            result: cached.result,
            cached: true,
            completedAt: Math.floor(Date.now() / 1000),
          })
        );
      }
      console.log(`[Queue] 💾 Cache hit - Identifier: ${cacheIdentifier}, Type: ${type} (skipping RabbitMQ)`);
      return {
        jobId,
        status: 'completed',
        cached: true,
        result: cached.result, // Include result for immediate use
      };
    }

    // Check if there's already a job in progress
    const inProgress = await getOrCreateInProgressJob(cacheIdentifier, type);
    
    if (inProgress && !inProgress.isNew) {
      // Job already in progress, check if it's completed
      const existingResult = await getGeocodingResult(inProgress.jobId);
      if (existingResult && existingResult.status === 'completed') {
        console.log(`[Queue] ✅ Reused job already completed - Job: ${inProgress.jobId}, Identifier: ${cacheIdentifier}, Type: ${type}`);
        return {
          jobId: inProgress.jobId,
          status: 'completed',
        };
      }
      // Job still in progress, return existing job ID
      console.log(`[Queue] ♻️  Reusing in-progress job - Job: ${inProgress.jobId}, Identifier: ${cacheIdentifier}, Type: ${type}`);
      return {
        jobId: inProgress.jobId,
        status: existingResult?.status || 'queued',
      };
    }

    const channel = await getRabbitMQChannel();
    if (!channel) {
      // RabbitMQ unavailable, throw error to allow fallback
      throw new Error('RabbitMQ unavailable');
    }

    // Use job ID from in-progress tracking or generate new one
    const jobId = inProgress ? inProgress.jobId : randomUUID();

    // Create message
    const message = {
      jobId,
      type, // 'city', 'coords', or 'reverse'
      metadata,
      timestamp: Math.floor(Date.now() / 1000),
    };

    // Add type-specific fields
    if (type === 'reverse') {
      message.lat = lat;
      message.lng = lng;
    } else {
      message.pincode = identifier;
    }

    // Publish to queue
    await channel.publish(
      'geocoding',
      'geocoding.request',
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        messageId: jobId,
      }
    );

    // Store initial status in Redis
    const redisClient = await getRedisClient();
    if (redisClient) {
      await redisClient.setEx(
        `geocoding:result:${jobId}`,
        900, // 15 minutes TTL (job results are temporary)
        JSON.stringify({
          status: 'queued',
          jobId,
          queuedAt: Math.floor(Date.now() / 1000),
        })
      );
    }

    if (inProgress && inProgress.isNew) {
      console.log(`[Queue] 📨 Published NEW job to RabbitMQ - Job: ${jobId}, Type: ${type}, Identifier: ${cacheIdentifier} (one job per identifier)`);
    } else {
      console.log(`[Queue] 📨 Published to RabbitMQ - Job: ${jobId}, Type: ${type}, Identifier: ${cacheIdentifier}`);
    }

    return {
      jobId,
      status: 'queued',
    };
  } catch (error) {
    console.warn(`[Queue] ❌ Error publishing to RabbitMQ - Identifier: ${identifier}, Type: ${type}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get geocoding result from Redis
 * @param {string} jobId - Job ID
 * @returns {Promise<{status: string, result?: any, error?: string} | null>} Result or null if not found
 */
export async function getGeocodingResult(jobId) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return null;
    }

    const resultData = await redisClient.get(`geocoding:result:${jobId}`);
    
    if (!resultData) {
      return null;
    }

    return JSON.parse(resultData);
  } catch (error) {
    console.warn('[Geocoding Queue] Error getting result:', error.message);
    return null;
  }
}

/**
 * Store geocoding result in Redis
 * @param {string} jobId - Job ID
 * @param {string} status - Status: 'completed' or 'failed'
 * @param {any} result - Result data (city string, {lat, lng} object, or pincode string)
 * @param {string} [error] - Error message if failed
 * @param {string|number} [identifier] - Pincode (string) or rounded coordinate key (string) for caching (optional)
 * @param {string} [type] - Type for caching: 'city', 'coords', or 'reverse' (optional)
 * @param {number} [lat] - Latitude (required for reverse geocoding caching)
 * @param {number} [lng] - Longitude (required for reverse geocoding caching)
 */
export async function storeGeocodingResult(jobId, status, result = null, error = null, identifier = null, type = null, lat = null, lng = null) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      console.warn('[Geocoding Queue] Redis unavailable, cannot store result');
      return false;
    }

    const resultData = {
      status,
      jobId,
      result,
      error,
      completedAt: Math.floor(Date.now() / 1000),
    };

    await redisClient.setEx(
      `geocoding:result:${jobId}`,
      900, // 15 minutes TTL (job results are temporary, pincode cache is permanent)
      JSON.stringify(resultData)
    );

    // Also cache by identifier+type for future lookups (only if successful)
    if (status === 'completed' && result && identifier && type) {
      if (type === 'reverse' && lat !== null && lng !== null) {
        // Cache by coordinates for reverse geocoding
        await cacheGeocodingByCoords(lat, lng, result);
      } else if (type === 'city' || type === 'coords') {
        // Cache by pincode for forward geocoding
        await cacheGeocodingByPincode(identifier, type, result);
      }
    }

    // Remove in-progress tracking when job completes or fails
    if ((status === 'completed' || status === 'failed') && identifier && type) {
      await removeInProgressJob(identifier, type);
    }

    console.log(`[Geocoding Queue] Stored result for job ${jobId} - Status: ${status}`);
    return true;
  } catch (error) {
    console.warn('[Geocoding Queue] Error storing result:', error.message);
    return false;
  }
}

/**
 * Invalidate geocoding cache for a specific pincode and type
 * Useful for forcing a refresh if geocoding data is suspected to be incorrect
 * @param {string} pincode - ZIP code
 * @param {string} type - Type of geocoding: 'city' or 'coords'
 * @returns {Promise<boolean>} True if invalidation was successful
 */
export async function invalidateGeocodingCache(pincode, type) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      console.log('[Geocoding Cache] Redis unavailable, skipping cache invalidation');
      return false;
    }

    // Delete pincode-based cache
    const cacheKey = `geocoding:cache:${type}:${pincode}`;
    await redisClient.del(cacheKey);

    // Delete in-progress tracking
    const inProgressKey = `geocoding:inprogress:${type}:${pincode}`;
    await redisClient.del(inProgressKey);

    console.log(`[Geocoding Cache] INVALIDATED - Pincode: ${pincode}, Type: ${type}`);
    return true;
  } catch (error) {
    console.warn('[Geocoding Cache] Error invalidating cache:', error.message);
    return false;
  }
}

/**
 * Clean up old geocoding job results
 * Removes job result entries older than specified TTL (default: 15 minutes)
 * This is useful for maintenance/cleanup operations
 * @param {number} [maxAge] - Maximum age in seconds (default: 900 = 15 minutes)
 * @returns {Promise<number>} Number of keys deleted
 */
export async function cleanupOldGeocodingResults(maxAge = 900) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      console.log('[Geocoding Cache] Redis unavailable, skipping cleanup');
      return 0;
    }

    // Get all job result keys
    const keys = await redisClient.keys('geocoding:result:*');
    
    if (!keys || keys.length === 0) {
      return 0;
    }

    let deletedCount = 0;
    const now = Math.floor(Date.now() / 1000);

    // Check each key's TTL and delete if expired or too old
    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      // If TTL is -1 (no expiration) or -2 (key doesn't exist), skip
      // If TTL is less than (maxAge - 60), it's old enough to clean up
      if (ttl > 0 && ttl < (maxAge - 60)) {
        await redisClient.del(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[Geocoding Cache] CLEANUP - Deleted ${deletedCount} old job result key(s)`);
    }

    return deletedCount;
  } catch (error) {
    console.warn('[Geocoding Cache] Error cleaning up old results:', error.message);
    return 0;
  }
}

