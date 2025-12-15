// src/app/api/map/incidents/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Incident from '@/models/Incident';
import User from '@/models/User'; 
import { verifyToken } from '@/firebase/verifyToken';
import { generateCacheKey, getCachedIncidents, setCachedIncidents, invalidateIncidentCache } from '@/lib/incidentCache';
import { getRedisClient } from '@/lib/redis';

/**
 * GET /api/map/incidents
 * Fetches incidents within a 1 mile radius of the provided coordinates
 * Query params:
 * - lat: Latitude of center point
 * - lng: Longitude of center point
 * - zipcode: ZIP code (optional, for logging)
 * - refresh: Set to 'true' to bypass cache and refresh data
 * - invalidate: Set to 'true' to invalidate cache for this query
 */
export async function GET(request) {
  try {

    let decodedToken = null;
    try {
      decodedToken = await verifyToken(request);
    } catch (authError) {
      console.warn('[Map Incidents] Authentication failed, using public data:', authError.message);
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const zipcode = searchParams.get('zipcode');
    const refresh = searchParams.get('refresh') === 'true';
    const invalidate = searchParams.get('invalidate') === 'true';

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

    const radiusInMiles = 1;
    const radiusInDegrees = radiusInMiles / 69;
    
    const latRad = (lat * Math.PI) / 180;
    const lngRadiusInDegrees = radiusInDegrees / Math.cos(latRad);

    const minLat = lat - radiusInDegrees;
    const maxLat = lat + radiusInDegrees;
    const minLng = lng - lngRadiusInDegrees;
    const maxLng = lng + lngRadiusInDegrees;

    const cacheKey = generateCacheKey({
      minLat: minLat.toString(),
      maxLat: maxLat.toString(),
      minLng: minLng.toString(),
      maxLng: maxLng.toString(),
      limit: '100'
    });

    if (invalidate) {
      try {
        await invalidateIncidentCache();
      } catch (error) {
        console.warn('[Map Incidents] Error invalidating cache:', error.message);
      }
    }

    if (!refresh) {
      try {
        const client = await getRedisClient();
        if (client) {
          const cachedData = await client.get(cacheKey);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            const cachedAt = parsed.cachedAt || 0;
            const now = Math.floor(Date.now() / 1000);
            const cacheAge = now - cachedAt;
            const twoMinutesInSeconds = 2 * 60;
            
            if (cacheAge > twoMinutesInSeconds) {
              await client.del(cacheKey);
            } else {
              const incidents = parsed.incidents || null;
              if (incidents) {
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
        console.warn('[Map Incidents] Cache read failed, querying MongoDB:', cacheError.message);
      }
    } 
    await connectDB();

    const query = {
      visibility: 'public',
      'location.lat': { $gte: minLat, $lte: maxLat },
      'location.lng': { $gte: minLng, $lte: maxLng }
    };

    const incidents = await Incident.find(query)
      .populate('reportedBy', 'firebaseUid firstName lastName photoURL')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const now = new Date();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    const tenDaysInMs = 10 * 24 * 60 * 60 * 1000;

    const formattedIncidents = incidents
      .filter(incident => {
        const reportedAt = new Date(incident.reportedAt);
        const ageInMs = now - reportedAt;
        return ageInMs <= tenDaysInMs;
      })
      .map(incident => {
        const reportedAt = new Date(incident.reportedAt);
        const timeToOld = new Date(reportedAt.getTime() + threeDaysInMs);
        
        return {
          _id: incident._id.toString(),
          location: {
            lat: incident.location.lat,
            lng: incident.location.lng
          },
          incidentType: incident.incidentType,
          description: incident.description,
          reportedAt: incident.reportedAt,
          timeToOld: timeToOld.toISOString(),
          reportedBy: incident.reportedBy ? {
            firebaseUid: incident.reportedBy.firebaseUid,
            firstName: incident.reportedBy.firstName,
            lastName: incident.reportedBy.lastName,
            photoURL: incident.reportedBy.photoURL
          } : null
        };
      });

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
    console.error('[Map Incidents] Error fetching incidents:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch incidents',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

