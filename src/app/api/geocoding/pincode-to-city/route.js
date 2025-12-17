import { validatePincode } from '@/lib/pincodeValidation.js';
import { pincodeToCityAuto } from '@/lib/geocoding.js';
import { publishGeocodingJob } from '@/lib/geocodingQueue.js';
import { isRabbitMQAvailable } from '@/lib/rabbitmq.js';

/**
 * GET /api/geocoding/pincode-to-city
 * Gets city name from pincode (US ZIP code)
 * Uses RabbitMQ queue if available, otherwise falls back to direct geocoding
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pincode = searchParams.get('pincode');
    const useQueue = searchParams.get('queue') !== 'false'; // Default to true, can disable with ?queue=false

    if (!pincode) {
      return Response.json(
        { error: 'Pincode parameter is required' },
        { status: 400 }
      );
    }

    // Validate pincode format
    const validation = validatePincode(pincode);
    if (!validation.isValid) {
      return Response.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Try to use RabbitMQ queue if available and enabled
    if (useQueue) {
      try {
        const rabbitmqAvailable = await isRabbitMQAvailable();
        if (rabbitmqAvailable) {
          console.log(`[API] 🐰 Using RabbitMQ for geocoding city - Pincode: ${validation.formatted}`);
          const job = await publishGeocodingJob(validation.formatted, 'city');
          
          // Check if result was cached (no RabbitMQ job needed)
          if (job.cached) {
            console.log(`[API] ✅ Geocoding result found in cache - Pincode: ${validation.formatted} (no RabbitMQ job needed)`);
          } else {
            console.log(`[API] 📤 Geocoding job published to RabbitMQ - Job ID: ${job.jobId}, Pincode: ${validation.formatted}`);
          }
          
          return Response.json({
            success: true,
            jobId: job.jobId,
            status: 'queued',
            message: 'Geocoding job queued. Poll /api/geocoding/status/[jobId] for results.',
            pincode: validation.formatted
          }, { status: 202 }); // 202 Accepted
        }
      } catch (queueError) {
        // Queue unavailable, fall back to direct geocoding
        console.warn(`[API] ⚠️  RabbitMQ unavailable, falling back to direct geocoding - Pincode: ${validation.formatted}`, queueError.message);
      }
    }

    // Fallback: Direct geocoding (synchronous)
    console.log(`[API] 🔄 Using direct geocoding (no RabbitMQ) - Pincode: ${validation.formatted}`);
    const city = await pincodeToCityAuto(validation.formatted);

    if (!city) {
      return Response.json(
        { error: 'City not found for this pincode. Please enter manually.' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      city: city,
      pincode: validation.formatted
    });

  } catch (error) {
    console.error('Error getting city from pincode:', error);
    return Response.json(
      {
        error: 'Failed to get city from pincode',
        message: error.message
      },
      { status: 500 }
    );
  }
}

