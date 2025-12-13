// src/lib/geocodingQueue.js
import { randomUUID } from 'crypto';
import { getRabbitMQChannel } from './rabbitmq.js';
import { getRedisClient } from './redis.js';

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
 * Get or create an in-progress job ID for a pincode+type
 * Returns existing job ID if one is already in progress, otherwise creates a new one
 * @param {string} pincode - ZIP code
 * @param {string} type - Type of geocoding: 'city' or 'coords'
 * @returns {Promise<{jobId: string, isNew: boolean} | null>} Job ID and whether it's new
 */
async function getOrCreateInProgressJob(pincode, type) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return null;
    }

    const inProgressKey = `geocoding:inprogress:${type}:${pincode}`;
    
    // Try to get existing in-progress job
    const existingJobData = await redisClient.get(inProgressKey);
    if (existingJobData) {
      const parsed = JSON.parse(existingJobData);
      // Check if job is still valid (not expired)
      const now = Math.floor(Date.now() / 1000);
      if (now - parsed.timestamp < 300) { // 5 minutes max
        console.log(`[Queue] 🔄 Reusing existing job - Job: ${parsed.jobId}, Pincode: ${pincode}, Type: ${type}`);
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
        pincode,
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
 * @param {string} pincode - ZIP code
 * @param {string} type - Type of geocoding: 'city' or 'coords'
 */
async function removeInProgressJob(pincode, type) {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return;
    }

    const inProgressKey = `geocoding:inprogress:${type}:${pincode}`;
    await redisClient.del(inProgressKey);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Publish geocoding job to RabbitMQ queue
 * @param {string} pincode - ZIP code to geocode
 * @param {string} type - Type of geocoding: 'city' or 'coords'
 * @param {Object} [metadata] - Optional metadata (userId, requestId, etc.)
 * @returns {Promise<{jobId: string, status: string, cached?: boolean}>} Job ID and status
 */
export async function publishGeocodingJob(pincode, type, metadata = {}) {
  try {
    // Check if we already have a cached result for this pincode
    const cached = await getCachedGeocodingByPincode(pincode, type);
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
      console.log(`[Queue] 💾 Cache hit - Pincode: ${pincode}, Type: ${type} (skipping RabbitMQ)`);
      return {
        jobId,
        status: 'completed',
        cached: true,
      };
    }

    // Check if there's already a job in progress for this pincode+type
    const inProgress = await getOrCreateInProgressJob(pincode, type);
    
    if (inProgress && !inProgress.isNew) {
      // Job already in progress, check if it's completed
      const existingResult = await getGeocodingResult(inProgress.jobId);
      if (existingResult && existingResult.status === 'completed') {
        console.log(`[Queue] ✅ Reused job already completed - Job: ${inProgress.jobId}, Pincode: ${pincode}, Type: ${type}`);
        return {
          jobId: inProgress.jobId,
          status: 'completed',
        };
      }
      // Job still in progress, return existing job ID
      console.log(`[Queue] ♻️  Reusing in-progress job - Job: ${inProgress.jobId}, Pincode: ${pincode}, Type: ${type}`);
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
      type, // 'city' or 'coords'
      pincode,
      metadata,
      timestamp: Math.floor(Date.now() / 1000),
    };

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
      console.log(`[Queue] 📨 Published NEW job to RabbitMQ - Job: ${jobId}, Type: ${type}, Pincode: ${pincode} (one job per pincode)`);
    } else {
      console.log(`[Queue] 📨 Published to RabbitMQ - Job: ${jobId}, Type: ${type}, Pincode: ${pincode}`);
    }

    return {
      jobId,
      status: 'queued',
    };
  } catch (error) {
    console.warn(`[Queue] ❌ Error publishing to RabbitMQ - Pincode: ${pincode}, Error: ${error.message}`);
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
 * @param {any} result - Result data (city string or {lat, lng} object)
 * @param {string} [error] - Error message if failed
 * @param {string} [pincode] - Pincode for caching (optional)
 * @param {string} [type] - Type for caching (optional)
 */
export async function storeGeocodingResult(jobId, status, result = null, error = null, pincode = null, type = null) {
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

    // Also cache by pincode+type for future lookups (only if successful)
    if (status === 'completed' && result && pincode && type) {
      await cacheGeocodingByPincode(pincode, type, result);
    }

    // Remove in-progress tracking when job completes or fails
    if ((status === 'completed' || status === 'failed') && pincode && type) {
      await removeInProgressJob(pincode, type);
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

