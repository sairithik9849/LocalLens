// src/app/api/geocoding/coords/route.js
import { NextResponse } from 'next/server';
import { validatePincode } from '@/lib/pincodeValidation.js';
import { zipcodeToCoords, zipcodeToCoordsGoogle } from '@/lib/geocoding.js';
import { getGoogleMapsApiKey } from '@/lib/gistApiKey.js';
import { publishGeocodingJob, getGeocodingResult } from '@/lib/geocodingQueue.js';
import { isRabbitMQAvailable } from '@/lib/rabbitmq.js';

/**
 * GET /api/geocoding/coords
 * Gets coordinates from pincode (US ZIP code)
 * Uses RabbitMQ queue if available, otherwise falls back to direct geocoding
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pincode = searchParams.get('pincode');
    const useQueue = searchParams.get('queue') !== 'false'; // Default to true

    if (!pincode) {
      return NextResponse.json(
        { error: 'Pincode parameter is required' },
        { status: 400 }
      );
    }

    // Validate pincode format
    const validation = validatePincode(pincode);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Try to use RabbitMQ queue if available and enabled
    if (useQueue) {
      try {
        console.log(`[API] 🔍 Checking RabbitMQ availability for pincode: ${validation.formatted}`);
        const rabbitmqAvailable = await isRabbitMQAvailable();
        console.log(`[API] 🔍 RabbitMQ available check result: ${rabbitmqAvailable}`);
        
        if (rabbitmqAvailable) {
          console.log(`[API] 🐰 Using RabbitMQ for geocoding coords - Pincode: ${validation.formatted}`);
          const job = await publishGeocodingJob(validation.formatted, 'coords');
          
          // Check if result was cached (no RabbitMQ job needed)
          if (job.cached && job.status === 'completed') {
            console.log(`[API] ✅ Geocoding result found in cache - Pincode: ${validation.formatted} (no RabbitMQ job needed)`);
            // Get the cached result from Redis
            const cachedResult = await getGeocodingResult(job.jobId);
            if (cachedResult && cachedResult.result) {
              return NextResponse.json({
                success: true,
                lat: cachedResult.result.lat,
                lng: cachedResult.result.lng,
                pincode: validation.formatted,
                cached: true
              });
            }
            // If cached result not found, fall through to queued response
            console.warn(`[API] ⚠️  Cached result not found in Redis for job ${job.jobId}, returning job ID for polling`);
          } else {
            console.log(`[API] 📤 Geocoding job published to RabbitMQ - Job ID: ${job.jobId}, Pincode: ${validation.formatted}`);
          }
          
          return NextResponse.json({
            success: true,
            jobId: job.jobId,
            status: 'queued',
            message: 'Geocoding job queued. Poll /api/geocoding/status/[jobId] for results.',
            pincode: validation.formatted
          }, { status: 202 }); // 202 Accepted
        } else {
          console.log(`[API] ⚠️  RabbitMQ not available (isRabbitMQAvailable returned false) - Pincode: ${validation.formatted}`);
        }
      } catch (queueError) {
        // Queue unavailable, fall back to direct geocoding
        console.warn(`[API] ⚠️  RabbitMQ unavailable, falling back to direct geocoding - Pincode: ${validation.formatted}`, queueError.message);
        console.warn(`[API] ⚠️  Queue error details:`, queueError);
      }
    } else {
      console.log(`[API] 🔄 Queue disabled (useQueue=false) - Pincode: ${validation.formatted}`);
    }

    // Fallback: Direct geocoding (synchronous)
    console.log(`[API] 🔄 Using direct geocoding (no RabbitMQ) - Pincode: ${validation.formatted}`);
    let coords;
    try {
      const apiKey = await getGoogleMapsApiKey();
      coords = await zipcodeToCoordsGoogle(validation.formatted, apiKey);
    } catch (error) {
      console.warn('Google geocoding failed, trying OpenStreetMap:', error);
      coords = await zipcodeToCoords(validation.formatted);
    }

    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
      return NextResponse.json(
        { error: 'Coordinates not found for this pincode' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      lat: coords.lat,
      lng: coords.lng,
      pincode: validation.formatted
    });

  } catch (error) {
    console.error('Error getting coordinates from pincode:', error);
    return NextResponse.json(
      {
        error: 'Failed to get coordinates from pincode',
        message: error.message
      },
      { status: 500 }
    );
  }
}

