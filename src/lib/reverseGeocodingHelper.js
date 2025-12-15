// src/lib/reverseGeocodingHelper.js
import { coordsToPincodeAuto, coordsToAddressAuto } from './geocoding';
import { publishGeocodingJob, getGeocodingResult } from './geocodingQueue';
import { isRabbitMQAvailable } from './rabbitmq';

/**
 * Reverse geocode coordinates to pincode using RabbitMQ queue if available
 * Falls back to direct geocoding if queue is unavailable
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} [maxWaitSeconds=30] - Maximum seconds to wait for queued job (default: 30)
 * @returns {Promise<string>} Pincode string
 * @throws {Error} If geocoding fails or timeout is reached
 */
export async function reverseGeocodeWithQueue(lat, lng, maxWaitSeconds = 30) {
  let locationPincode = null;
  
  try {
    // Try to use RabbitMQ queue if available
    const rabbitmqAvailable = await isRabbitMQAvailable();
    if (rabbitmqAvailable) {
      console.log(`[Reverse Geocoding] 🐰 Using RabbitMQ for reverse geocoding - Lat: ${lat}, Lng: ${lng}`);
      const job = await publishGeocodingJob(null, 'reverse', {}, lat, lng);
      
      // Check if result was cached (no RabbitMQ job needed)
      if (job.cached) {
        console.log(`[Reverse Geocoding] ✅ Reverse geocoding result found in cache - Lat: ${lat}, Lng: ${lng} (no RabbitMQ job needed)`);
        // Get the cached result from Redis
        const cachedResult = await getGeocodingResult(job.jobId);
        if (cachedResult && cachedResult.result) {
          return cachedResult.result;
        }
        // If cached result not found (race condition), fall through to polling
        console.warn(`[Reverse Geocoding] ⚠️  Cached result not found in Redis, falling back to polling`);
      }
      
      if (job.jobId) {
        // Job queued, poll for result
        console.log('[Reverse Geocoding] Reverse geocoding job queued, polling for result...');
        const jobId = job.jobId;
        let attempts = 0;
        const maxAttempts = maxWaitSeconds;
        let result = null;

        while (attempts < maxAttempts && !result) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          
          const statusResult = await getGeocodingResult(jobId);
          if (statusResult && statusResult.status === 'completed' && statusResult.result) {
            result = statusResult.result;
            locationPincode = result;
            break;
          } else if (statusResult && statusResult.status === 'failed') {
            throw new Error(statusResult.error || 'Reverse geocoding failed');
          }

          attempts++;
        }

        if (locationPincode) {
          return locationPincode;
        }
        
        // Timeout reached
        throw new Error('Reverse geocoding timeout - job did not complete in time');
      }
    } else {
      throw new Error('RabbitMQ unavailable');
    }
  } catch (queueError) {
    // Queue unavailable or failed, fallback to direct reverse geocoding
    console.warn('Queue reverse geocoding failed, using direct reverse geocoding:', queueError.message);
    try {
      locationPincode = await coordsToPincodeAuto(lat, lng);
      if (locationPincode) {
        return locationPincode;
      }
    } catch (error) {
      console.error('Direct reverse geocoding also failed:', error);
      throw new Error('Failed to determine pincode for selected location. Please select a valid location.');
    }
  }

  if (!locationPincode) {
    throw new Error('Could not determine pincode for selected location. Please select a valid location.');
  }
  
  return locationPincode;
}

/**
 * Reverse geocode coordinates to address using RabbitMQ queue if available
 * Falls back to direct geocoding if queue is unavailable
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} [maxWaitSeconds=30] - Maximum seconds to wait for queued job (default: 30)
 * @returns {Promise<string>} Formatted address string
 * @throws {Error} If geocoding fails or timeout is reached
 */
export async function reverseGeocodeAddressWithQueue(lat, lng, maxWaitSeconds = 30) {
  let locationAddress = null;
  
  try {
    // Try to use RabbitMQ queue if available
    const rabbitmqAvailable = await isRabbitMQAvailable();
    if (rabbitmqAvailable) {
      console.log(`[Reverse Geocoding Address] 🐰 Using RabbitMQ for reverse geocoding - Lat: ${lat}, Lng: ${lng}`);
      const job = await publishGeocodingJob(null, 'reverse-address', {}, lat, lng);
      
      // Check if result was cached (no RabbitMQ job needed)
      if (job.cached) {
        console.log(`[Reverse Geocoding Address] ✅ Reverse geocoding result found in cache - Lat: ${lat}, Lng: ${lng} (no RabbitMQ job needed)`);
        // Get the cached result from Redis
        const cachedResult = await getGeocodingResult(job.jobId);
        if (cachedResult && cachedResult.result) {
          return cachedResult.result;
        }
        // If cached result not found (race condition), fall through to polling
        console.warn(`[Reverse Geocoding Address] ⚠️  Cached result not found in Redis, falling back to polling`);
      }
      
      if (job.jobId) {
        // Job queued, poll for result
        console.log('[Reverse Geocoding Address] Reverse geocoding job queued, polling for result...');
        const jobId = job.jobId;
        let attempts = 0;
        const maxAttempts = maxWaitSeconds;
        let result = null;

        while (attempts < maxAttempts && !result) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          
          const statusResult = await getGeocodingResult(jobId);
          if (statusResult && statusResult.status === 'completed' && statusResult.result) {
            result = statusResult.result;
            locationAddress = result;
            break;
          } else if (statusResult && statusResult.status === 'failed') {
            throw new Error(statusResult.error || 'Reverse geocoding failed');
          }

          attempts++;
        }

        if (locationAddress) {
          return locationAddress;
        }
        
        // Timeout reached
        throw new Error('Reverse geocoding timeout - job did not complete in time');
      }
    } else {
      throw new Error('RabbitMQ unavailable');
    }
  } catch (queueError) {
    // Queue unavailable or failed, fallback to direct reverse geocoding
    console.warn('Queue reverse geocoding failed, using direct reverse geocoding:', queueError.message);
    try {
      locationAddress = await coordsToAddressAuto(lat, lng);
      if (locationAddress) {
        return locationAddress;
      }
    } catch (error) {
      console.error('Direct reverse geocoding also failed:', error);
      throw new Error('Failed to determine address for selected location. Please select a valid location.');
    }
  }

  if (!locationAddress) {
    throw new Error('Could not determine address for selected location. Please select a valid location.');
  }
  
  return locationAddress;
}
