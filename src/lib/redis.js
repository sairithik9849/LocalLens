// src/lib/redis.js
import { createClient } from 'redis';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.redis;

if (!cached) {
  cached = global.redis = { client: null, promise: null, isConnected: false };
}

/**
 * Get Redis client connection
 * @returns {Promise<import('redis').RedisClientType | null>} Connected Redis client or null if connection fails
 */
export async function getRedisClient() {
  // If client exists and is connected, return it
  if (cached.client && cached.isConnected) {
    return cached.client;
  }

  // If connection is in progress, wait for it
  if (cached.promise) {
    try {
      return await cached.promise;
    } catch (error) {
      cached.promise = null;
      throw error;
    }
  }

  // Create new connection
  if (!cached.promise) {
    cached.promise = (async () => {
      try {
        // Get connection configuration from environment variables
        const redisUrl = process.env.REDIS_URL;
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
        const redisPassword = process.env.REDIS_PASSWORD;

        // Create Redis client
        const client = createClient({
          url: redisUrl || `redis://${redisHost}:${redisPort}`,
          password: redisPassword || undefined,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                console.error('Redis: Max reconnection attempts reached');
                return new Error('Max reconnection attempts reached');
              }
              // Exponential backoff: 50ms, 100ms, 200ms, etc.
              return Math.min(retries * 50, 3000);
            },
          },
        });

        // Handle connection errors
        client.on('error', (err) => {
          console.warn('Redis client error:', err.message);
          cached.isConnected = false;
        });

        client.on('connect', () => {
          console.log('Redis: Connecting...');
        });

        client.on('ready', () => {
          console.log('✅ Redis connected successfully');
          cached.isConnected = true;
        });

        client.on('reconnecting', () => {
          console.log('Redis: Reconnecting...');
          cached.isConnected = false;
        });

        client.on('end', () => {
          console.log('Redis: Connection ended');
          cached.isConnected = false;
        });

        // Connect to Redis
        await client.connect();
        cached.client = client;
        cached.isConnected = true;

        return client;
      } catch (error) {
        cached.promise = null;
        cached.isConnected = false;
        console.warn('Redis connection failed:', error.message);
        // Don't throw - allow graceful fallback
        throw error;
      }
    })();
  }

  try {
    return await cached.promise;
  } catch (error) {
    cached.promise = null;
    // Return null to allow graceful fallback in calling code
    return null;
  }
}

/**
 * Check if Redis is available
 * @returns {Promise<boolean>} True if Redis is connected
 */
export async function isRedisAvailable() {
  try {
    const client = await getRedisClient();
    if (!client) return false;
    
    // Ping Redis to check if it's responsive
    await client.ping();
    return true;
  } catch (error) {
    return false;
  }
}

