// src/lib/rabbitmq.js
import amqp from 'amqplib';
import amqpConnectionManager from 'amqp-connection-manager';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.rabbitmq;

if (!cached) {
  cached = global.rabbitmq = { connection: null, channel: null, promise: null, isConnected: false };
}

/**
 * Get RabbitMQ channel connection
 * @returns {Promise<amqp.Channel | null>} RabbitMQ channel or null if connection fails
 */
export async function getRabbitMQChannel() {
  // If channel exists and is connected, return it
  if (cached.channel && cached.isConnected) {
    return cached.channel;
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
        const rabbitmqUrl = process.env.RABBITMQ_URL;
        const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost';
        const rabbitmqPort = parseInt(process.env.RABBITMQ_PORT || '5672', 10);
        const rabbitmqUser = process.env.RABBITMQ_USER || 'guest';
        const rabbitmqPassword = process.env.RABBITMQ_PASSWORD || 'guest';

        // Build connection URL
        const connectionUrl = rabbitmqUrl || `amqp://${rabbitmqUser}:${rabbitmqPassword}@${rabbitmqHost}:${rabbitmqPort}`;

        // Create connection manager with automatic reconnection
        const connection = amqpConnectionManager.connect([connectionUrl], {
          reconnectTimeInSeconds: 5,
          heartbeatIntervalInSeconds: 5,
        });

        // Handle connection events
        connection.on('connect', () => {
          console.log('[RabbitMQ] ✅ Connected successfully - Ready to process geocoding jobs');
          cached.isConnected = true;
        });

        connection.on('disconnect', (err) => {
          console.warn('[RabbitMQ] ⚠️  Disconnected:', err?.message);
          cached.isConnected = false;
        });

        connection.on('connectFailed', (err) => {
          console.error('[RabbitMQ] ❌ Connection failed:', err?.message);
          cached.isConnected = false;
        });

        // Create channel wrapper
        const channelWrapper = connection.createChannel({
          setup: async (channel) => {
            // Declare exchange
            await channel.assertExchange('geocoding', 'direct', {
              durable: true,
            });

            // Declare queue
            await channel.assertQueue('geocoding.requests', {
              durable: true,
              arguments: {
                'x-message-ttl': 300000, // 5 minutes TTL
              },
            });

            // Bind queue to exchange
            await channel.bindQueue('geocoding.requests', 'geocoding', 'geocoding.request');

            // Declare dead letter queue for failed jobs
            await channel.assertQueue('geocoding.failed', {
              durable: true,
            });

            console.log('[RabbitMQ] ✅ Channel setup complete - Exchange: geocoding, Queue: geocoding.requests');
            return channel;
          },
        });

        cached.connection = connection;
        cached.channel = channelWrapper;
        cached.isConnected = true;

        return channelWrapper;
      } catch (error) {
        cached.promise = null;
        cached.isConnected = false;
        console.warn('RabbitMQ connection failed:', error.message);
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
 * Check if RabbitMQ is available
 * @returns {Promise<boolean>} True if RabbitMQ is connected
 */
export async function isRabbitMQAvailable() {
  try {
    const channel = await getRabbitMQChannel();
    return channel !== null && cached.isConnected;
  } catch (error) {
    return false;
  }
}

