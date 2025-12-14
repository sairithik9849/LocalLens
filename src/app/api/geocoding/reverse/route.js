// src/app/api/geocoding/reverse/route.js
import { NextResponse } from 'next/server';
import { coordsToPincodeAuto } from '@/lib/geocoding.js';
import { publishGeocodingJob, getGeocodingResult } from '@/lib/geocodingQueue.js';
import { isRabbitMQAvailable } from '@/lib/rabbitmq.js';

/**
 * GET /api/geocoding/reverse
 * Gets pincode (ZIP code) from coordinates (reverse geocoding)
 * Uses RabbitMQ queue if available, otherwise falls back to direct geocoding
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const useQueue = searchParams.get('queue') !== 'false'; // Default to true

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude parameters are required' },
        { status: 400 }
      );
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    // Validate coordinate ranges
    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json(
        { error: 'Invalid latitude or longitude format' },
        { status: 400 }
      );
    }

    if (latNum < -90 || latNum > 90) {
      return NextResponse.json(
        { error: 'Latitude must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (lngNum < -180 || lngNum > 180) {
      return NextResponse.json(
        { error: 'Longitude must be between -180 and 180' },
        { status: 400 }
      );
    }

    // Try to use RabbitMQ queue if available and enabled
    if (useQueue) {
      try {
        const rabbitmqAvailable = await isRabbitMQAvailable();
        if (rabbitmqAvailable) {
          console.log(`[API] 🐰 Using RabbitMQ for reverse geocoding - Lat: ${latNum}, Lng: ${lngNum}`);
          const job = await publishGeocodingJob(null, 'reverse', {}, latNum, lngNum);
          
          // Check if result was cached or already completed (no RabbitMQ job needed)
          if (job.cached || job.status === 'completed') {
            console.log(`[API] ✅ Reverse geocoding result found in cache - Lat: ${latNum}, Lng: ${lngNum} (no RabbitMQ job needed)`);
            // Get the cached result from Redis
            const cachedResult = await getGeocodingResult(job.jobId);
            if (cachedResult && cachedResult.result) {
              return NextResponse.json({
                success: true,
                pincode: cachedResult.result,
                cached: true,
                lat: latNum,
                lng: lngNum
              });
            }
            // If cached result not found (race condition), fall through to queued response
            // Client can poll for the result
            console.warn(`[API] ⚠️  Cached result not found in Redis for job ${job.jobId}, returning job ID for polling`);
          }
          
          // Job is queued or in progress
          console.log(`[API] 📤 Reverse geocoding job published to RabbitMQ - Job ID: ${job.jobId}, Lat: ${latNum}, Lng: ${lngNum}`);
          return NextResponse.json({
            success: true,
            jobId: job.jobId,
            status: job.status || 'queued',
            message: 'Reverse geocoding job queued. Poll /api/geocoding/status/[jobId] for results.',
            lat: latNum,
            lng: lngNum
          }, { status: 202 }); // 202 Accepted
        }
      } catch (queueError) {
        // Queue unavailable, fall back to direct geocoding
        console.warn(`[API] ⚠️  RabbitMQ unavailable, falling back to direct reverse geocoding - Lat: ${latNum}, Lng: ${lngNum}`, queueError.message);
      }
    }

    // Fallback: Direct reverse geocoding (synchronous)
    console.log(`[API] 🔄 Using direct reverse geocoding (no RabbitMQ) - Lat: ${latNum}, Lng: ${lngNum}`);
    const pincode = await coordsToPincodeAuto(latNum, lngNum);

    if (!pincode) {
      return NextResponse.json(
        { error: 'Pincode not found for these coordinates' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pincode: pincode,
      lat: latNum,
      lng: lngNum
    });

  } catch (error) {
    console.error('Error getting pincode from coordinates:', error);
    return NextResponse.json(
      {
        error: 'Failed to get pincode from coordinates',
        message: error.message
      },
      { status: 500 }
    );
  }
}
