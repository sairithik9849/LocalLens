// src/app/api/geocoding/status/[jobId]/route.js
import { NextResponse } from 'next/server';
import { getGeocodingResult } from '@/lib/geocodingQueue.js';

/**
 * GET /api/geocoding/status/[jobId]
 * Get the status and result of a geocoding job
 */
export async function GET(request, { params }) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const result = await getGeocodingResult(jobId);

    if (!result) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Log status check (only for non-cached jobs to avoid spam)
    if (result.status === 'processing' || result.status === 'queued') {
      console.log(`[API] 🔍 Status check - Job: ${jobId}, Status: ${result.status}`);
    }

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting geocoding status:', error);
    return NextResponse.json(
      { error: 'Failed to get geocoding status' },
      { status: 500 }
    );
  }
}

