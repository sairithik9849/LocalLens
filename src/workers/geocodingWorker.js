// src/workers/geocodingWorker.js
import { getRabbitMQChannel } from '../lib/rabbitmq.js';
import { storeGeocodingResult } from '../lib/geocodingQueue.js';
import { zipcodeToCoords, zipcodeToCoordsGoogle, pincodeToCityAuto, coordsToPincodeAuto, coordsToAddressAuto } from '../lib/geocoding.js';
import { getGoogleMapsApiKey } from '../lib/gistApiKey.js';

let isShuttingDown = false;

/**
 * Process geocoding job with retry logic
 * @param {Object} message - Job message
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<any>} Geocoding result
 */
async function processGeocodingJob(message, retryCount = 0) {
  const { jobId, type, pincode, lat, lng } = message;
  const maxRetries = 3;
  
  // Calculate identifier for cleanup on failure
  const identifier = (type === 'reverse' || type === 'reverse-address')
    ? `${Math.round(lat * 10000) / 10000}:${Math.round(lng * 10000) / 10000}`
    : pincode;

  try {
    if (type === 'reverse' || type === 'reverse-address') {
      console.log(`[Geocoding Worker] Processing job ${jobId} - Type: ${type}, Lat: ${lat}, Lng: ${lng}, Attempt: ${retryCount + 1}`);
    } else {
      console.log(`[Geocoding Worker] Processing job ${jobId} - Type: ${type}, Pincode: ${pincode}, Attempt: ${retryCount + 1}`);
    }

    let result = null;

    if (type === 'city') {
      // Geocode pincode to city
      result = await pincodeToCityAuto(pincode);
      if (!result) {
        throw new Error('City not found for pincode');
      }
      result = { city: result };
    } else if (type === 'coords') {
      // Geocode pincode to coordinates
      try {
        const apiKey = await getGoogleMapsApiKey();
        result = await zipcodeToCoordsGoogle(pincode, apiKey);
      } catch (error) {
        console.warn('[Geocoding Worker] Google geocoding failed, trying OpenStreetMap:', error.message);
        result = await zipcodeToCoords(pincode);
      }
      
      if (!result || typeof result.lat !== 'number' || typeof result.lng !== 'number') {
        throw new Error('Coordinates not found for pincode');
      }
      
      result = {
        lat: result.lat,
        lng: result.lng,
      };
    } else if (type === 'reverse') {
      // Reverse geocode coordinates to pincode
      result = await coordsToPincodeAuto(lat, lng);
      if (!result) {
        throw new Error('Pincode not found for coordinates');
      }
      // Result is a string (pincode)
      result = result;
    } else if (type === 'reverse-address') {
      // Reverse geocode coordinates to address
      result = await coordsToAddressAuto(lat, lng);
      if (!result) {
        throw new Error('Address not found for coordinates');
      }
      // Result is a string (formatted address)
      result = result;
    } else {
      throw new Error(`Unknown geocoding type: ${type}`);
    }

    console.log(`[Geocoding Worker] ✅ Job ${jobId} completed successfully`);

    return result;
  } catch (error) {
    console.error(`[Geocoding Worker] ❌ Job ${jobId} failed (attempt ${retryCount + 1}/${maxRetries}):`, error.message);

    // Retry logic with exponential backoff
    if (retryCount < maxRetries - 1) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`[Geocoding Worker] Retrying job ${jobId} in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return processGeocodingJob(message, retryCount + 1);
    } else {
      // Max retries reached, store failure with identifier for cleanup
      await storeGeocodingResult(jobId, 'failed', null, error.message, identifier, type, lat, lng);
      console.error(`[Geocoding Worker] ❌ Job ${jobId} failed after ${maxRetries} attempts`);
      throw error;
    }
  }
}

/**
 * Start geocoding worker
 */
async function startWorker() {
  console.log('[Geocoding Worker] Starting geocoding worker...');

  try {
    const channel = await getRabbitMQChannel();
    if (!channel) {
      console.error('[Geocoding Worker] ❌ Failed to connect to RabbitMQ');
      process.exit(1);
    }

    // Update status to processing when consuming
    channel.addSetup(async (ch) => {
      // Ensure queue exists before consuming
      await ch.assertQueue('geocoding.requests', {
        durable: true,
        arguments: {
          'x-message-ttl': 300000, // 5 minutes TTL
        },
      });

      // Ensure exchange exists
      await ch.assertExchange('geocoding', 'direct', {
        durable: true,
      });

      // Ensure queue is bound to exchange
      await ch.bindQueue('geocoding.requests', 'geocoding', 'geocoding.request');

      console.log('[Geocoding Worker] Queue setup complete, starting to consume...');

      // Consume messages from queue
      await ch.consume('geocoding.requests', async (msg) => {
        if (!msg) {
          return;
        }

        if (isShuttingDown) {
          ch.nack(msg, false, true); // Requeue message
          return;
        }

        try {
          const message = JSON.parse(msg.content.toString());
          console.log(`[Geocoding Worker] Received job ${message.jobId}`);

          // Update status to processing
          const identifier = (message.type === 'reverse' || message.type === 'reverse-address')
            ? `${Math.round(message.lat * 10000) / 10000}:${Math.round(message.lng * 10000) / 10000}`
            : message.pincode;
          await storeGeocodingResult(message.jobId, 'processing', null, null, identifier, message.type, message.lat, message.lng);

          // Process the job
          const result = await processGeocodingJob(message);

          // Store result with identifier and type for caching
          // For reverse geocoding, pass lat/lng for coordinate-based caching
          await storeGeocodingResult(
            message.jobId,
            'completed',
            result,
            null,
            identifier,
            message.type,
            message.lat,
            message.lng
          );

          // Acknowledge message
          ch.ack(msg);
        } catch (error) {
          console.error('[Geocoding Worker] Error processing message:', error);
          
          // After max retries, send to dead letter queue
          // For now, just nack and requeue (will be retried)
          // In production, you might want to send to DLQ after certain failures
          ch.nack(msg, false, true); // Requeue for retry
        }
      }, {
        noAck: false, // Manual acknowledgment
      });

      console.log('[Geocoding Worker] ✅ Waiting for geocoding jobs...');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[Geocoding Worker] SIGTERM received, shutting down gracefully...');
      isShuttingDown = true;
      setTimeout(() => {
        console.log('[Geocoding Worker] Shutdown complete');
        process.exit(0);
      }, 5000);
    });

    process.on('SIGINT', () => {
      console.log('[Geocoding Worker] SIGINT received, shutting down gracefully...');
      isShuttingDown = true;
      setTimeout(() => {
        console.log('[Geocoding Worker] Shutdown complete');
        process.exit(0);
      }, 5000);
    });

  } catch (error) {
    console.error('[Geocoding Worker] ❌ Failed to start worker:', error);
    process.exit(1);
  }
}

// Start worker if run directly
// Check if this file is being run directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || 
                     process.argv[1]?.includes('geocodingWorker');

if (isMainModule) {
  startWorker().catch((error) => {
    console.error('[Geocoding Worker] Fatal error:', error);
    process.exit(1);
  });
}

export { startWorker };

