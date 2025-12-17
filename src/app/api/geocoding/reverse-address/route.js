// src/app/api/geocoding/reverse-address/route.js
import { NextResponse } from 'next/server';
import { coordsToAddressAuto } from '@/lib/geocoding.js';
import { isRabbitMQAvailable } from '@/lib/rabbitmq.js';
import { publishGeocodingJob, getGeocodingResult } from '@/lib/geocodingQueue.js';

/**
 * GET /api/geocoding/reverse-address
 * Gets formatted address from coordinates (reverse geocoding)
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
        // Check if RabbitMQ is available first
        const rabbitmqAvailable = await isRabbitMQAvailable();
        
        if (rabbitmqAvailable) {
          // Try to publish job and check cache first
          const job = await publishGeocodingJob(null, 'reverse-address', {}, latNum, lngNum);
          
          // If cached, return immediately
          if (job.cached && job.status === 'completed') {
            const cachedResult = await getGeocodingResult(job.jobId);
            if (cachedResult && cachedResult.result) {
              return NextResponse.json({
                success: true,
                address: cachedResult.result,
                cached: true,
                lat: latNum,
                lng: lngNum
              });
            }
          }
          
          // If job is queued, check status quickly (1-2 second timeout for quick fallback)
          if (job.jobId && job.status === 'queued') {
            // Quick check: wait 1 second, then check if job is still queued/processing
            await new Promise(resolve => setTimeout(resolve, 1000));
            const statusResult = await getGeocodingResult(job.jobId);
            
            // If still queued or processing after 1 second, worker might be unavailable
            // Fall back to direct geocoding for faster response
            if (statusResult && (statusResult.status === 'queued' || statusResult.status === 'processing')) {
              console.warn(`[API] ⚠️  Worker appears unavailable (job still ${statusResult.status} after 1s), falling back to direct geocoding - Lat: ${latNum}, Lng: ${lngNum}`);
              // Fall through to direct geocoding
            } else if (statusResult && statusResult.status === 'completed' && statusResult.result) {
              // Job completed quickly, return result
              return NextResponse.json({
                success: true,
                address: statusResult.result,
                lat: latNum,
                lng: lngNum
              });
            } else if (statusResult && statusResult.status === 'failed') {
              // Job failed, fall back to direct geocoding
              console.warn(`[API] ⚠️  Worker job failed, falling back to direct geocoding - Lat: ${latNum}, Lng: ${lngNum}`);
              // Fall through to direct geocoding
            }
          } else if (job.jobId && job.status === 'completed') {
            // Job already completed (shouldn't happen, but handle it)
            const result = await getGeocodingResult(job.jobId);
            if (result && result.result) {
              return NextResponse.json({
                success: true,
                address: result.result,
                lat: latNum,
                lng: lngNum
              });
            }
          }
        }
        
        // If we get here, either RabbitMQ is unavailable or worker is slow
        // Fall through to direct geocoding
      } catch (queueError) {
        // Queue unavailable or failed, fall back to direct geocoding
        console.warn(`[API] ⚠️  RabbitMQ unavailable or failed, falling back to direct reverse geocoding - Lat: ${latNum}, Lng: ${lngNum}`, queueError.message);
      }
    }

    // Fallback: Direct reverse geocoding (synchronous)
    console.log(`[API] 🔄 Using direct reverse geocoding (no RabbitMQ) - Lat: ${latNum}, Lng: ${lngNum}`);
    const address = await coordsToAddressAuto(latNum, lngNum);

    if (!address) {
      return NextResponse.json(
        { error: 'Address not found for these coordinates' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      address: address,
      lat: latNum,
      lng: lngNum
    });

  } catch (error) {
    console.error('Error getting address from coordinates:', error);
    return NextResponse.json(
      {
        error: 'Failed to get address from coordinates',
        message: error.message
      },
      { status: 500 }
    );
  }
}
