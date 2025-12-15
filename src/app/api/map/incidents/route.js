// src/app/api/map/incidents/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Incident from '@/models/Incident';
import User from '@/models/User'; // Import User model to register it for populate
import { verifyToken } from '@/firebase/verifyToken';
import { generateCacheKey, getCachedIncidents, setCachedIncidents, invalidateIncidentCache } from '@/lib/incidentCache';

/**
 * GET /api/map/incidents
 * Fetches incidents within a 1.5 mile radius of the provided coordinates
 * Query params:
 * - lat: Latitude of center point
 * - lng: Longitude of center point
 * - zipcode: ZIP code (optional, for logging)
 * - refresh: Set to 'true' to bypass cache and refresh data
 * - invalidate: Set to 'true' to invalidate cache for this query
 */
export async function GET(request) {
  try {
    // Try to verify authentication, but don't fail if token is missing
    // This allows the API to work for public map views
    let decodedToken = null;
    try {
      decodedToken = await verifyToken(request);
    } catch (authError) {
      // Authentication failed, but we'll continue with public data
      console.log('[Map Incidents] Authentication failed, using public data:', authError.message);
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const zipcode = searchParams.get('zipcode');
    const refresh = searchParams.get('refresh') === 'true';
    const invalidate = searchParams.get('invalidate') === 'true';

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Valid lat and lng parameters are required' },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Calculate bounds for 1.5 mile radius
    // 1 degree latitude ≈ 69 miles
    // 1.5 miles ≈ 1.5/69 ≈ 0.0217 degrees
    const radiusInMiles = 1;
    const radiusInDegrees = radiusInMiles / 69;
    
    // Calculate longitude adjustment based on latitude
    const latRad = (lat * Math.PI) / 180;
    const lngRadiusInDegrees = radiusInDegrees / Math.cos(latRad);

    // Calculate bounding box
    const minLat = lat - radiusInDegrees;
    const maxLat = lat + radiusInDegrees;
    const minLng = lng - lngRadiusInDegrees;
    const maxLng = lng + lngRadiusInDegrees;

    // Generate cache key
    const cacheKey = generateCacheKey({
      minLat: minLat.toString(),
      maxLat: maxLat.toString(),
      minLng: minLng.toString(),
      maxLng: maxLng.toString(),
      limit: '100'
    });

    // Handle cache invalidation
    if (invalidate) {
      try {
        await invalidateIncidentCache();
        console.log('[Map Incidents] Cache invalidated');
      } catch (error) {
        console.warn('[Map Incidents] Error invalidating cache:', error.message);
      }
    }

    // Check Redis cache first (unless refresh is requested)
    if (!refresh) {
      try {
        const client = await import('@/lib/redis').then(m => m.getRedisClient());
        if (client) {
          const cachedData = await client.get(cacheKey);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            const cachedAt = parsed.cachedAt || 0; // Unix timestamp in seconds
            const now = Math.floor(Date.now() / 1000);
            const cacheAge = now - cachedAt;
            const twoMinutesInSeconds = 2 * 60; // 2 minutes
            
            // If cache is older than 2 minutes, invalidate and fetch fresh
            if (cacheAge > twoMinutesInSeconds) {
              console.log('[Map Incidents] Cache expired (older than 2 minutes), invalidating and fetching fresh');
              await client.del(cacheKey);
              // Continue to MongoDB query below
            } else {
              // Cache is still fresh, return it
              const incidents = parsed.incidents || null;
              if (incidents) {
                console.log('[Map Incidents] Cache HIT - returning cached data (age:', cacheAge, 'seconds)');
                return NextResponse.json({
                  success: true,
                  incidents: incidents,
                  count: incidents.length,
                  center: { lat, lng },
                  radius: radiusInMiles,
                  zipcode: zipcode || null,
                  cached: true
                });
              }
            }
          }
        }
      } catch (cacheError) {
        // Cache read failed, continue with MongoDB query
        console.log('[Map Incidents] Cache read failed, querying MongoDB:', cacheError.message);
      }
    } else {
      console.log('[Map Incidents] Refresh requested, bypassing cache');
    }

    // Cache miss or refresh requested - query MongoDB
    console.log('[Map Incidents] MongoDB query');
    await connectDB();

    // Query incidents within bounds
    const query = {
      visibility: 'public',
      'location.lat': { $gte: minLat, $lte: maxLat },
      'location.lng': { $gte: minLng, $lte: maxLng }
    };

    // Fetch incidents
    const incidents = await Incident.find(query)
      .populate('reportedBy', 'firebaseUid firstName lastName photoURL')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Current time for age calculations
    const now = new Date();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
    const tenDaysInMs = 10 * 24 * 60 * 60 * 1000; // 10 days in milliseconds

    // Format incidents for map display and filter out incidents older than 10 days
    const formattedIncidents = incidents
      .filter(incident => {
        // Filter out incidents older than 10 days
        const reportedAt = new Date(incident.reportedAt);
        const ageInMs = now - reportedAt;
        return ageInMs <= tenDaysInMs;
      })
      .map(incident => {
        const reportedAt = new Date(incident.reportedAt);
        const timeToOld = new Date(reportedAt.getTime() + threeDaysInMs); // 3 days from reportedAt
        
        return {
          _id: incident._id.toString(),
          location: {
            lat: incident.location.lat,
            lng: incident.location.lng
          },
          incidentType: incident.incidentType,
          description: incident.description,
          reportedAt: incident.reportedAt,
          timeToOld: timeToOld.toISOString(), // Timestamp when incident becomes old (3 days)
          reportedBy: incident.reportedBy ? {
            firebaseUid: incident.reportedBy.firebaseUid,
            firstName: incident.reportedBy.firstName,
            lastName: incident.reportedBy.lastName,
            photoURL: incident.reportedBy.photoURL
          } : null
        };
      });

    // Cache the results (non-blocking) - 2 minutes TTL
    setCachedIncidents(cacheKey, formattedIncidents, 120).catch((error) => {
      console.warn('[Map Incidents] Error caching results:', error.message);
    });

    return NextResponse.json({
      success: true,
      incidents: formattedIncidents,
      count: formattedIncidents.length,
      center: { lat, lng },
      radius: radiusInMiles,
      zipcode: zipcode || null,
      cached: false
    });

  } catch (error) {
    console.error('Error fetching map incidents:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch incidents',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

