// src/app/api/map/events/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Event from '@/models/Event';
import User from '@/models/User';
import { verifyToken } from '@/firebase/verifyToken';
import { generateCacheKey, getCachedEvents, setCachedEvents, invalidateEventCache } from '@/lib/eventCache';
import { getRedisClient } from '@/lib/redis';

/**
 * GET /api/map/events
 * Fetches events within a 1 mile radius of the provided coordinates
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
      console.warn('[Map Events] Authentication failed, using public data:', authError.message);
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
        await invalidateEventCache();
      } catch (error) {
        console.warn('[Map Events] Error invalidating cache:', error.message);
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
              const events = parsed.events || null;
              if (events) {
                return NextResponse.json({
                  success: true,
                  events: events,
                  count: events.length,
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
        console.warn('[Map Events] Cache read failed, querying MongoDB:', cacheError.message);
      }
    }

    await connectDB();

    const zip5 = zipcode ? zipcode.replace(/-/g, '').slice(0, 5) : null;

    let query = {};
    if (zip5) {
      query = { pincode: zip5 };
    } else {
      query = {
        'location.lat': { $gte: minLat, $lte: maxLat },
        'location.lng': { $gte: minLng, $lte: maxLng },
      };
    }

    const events = await Event.find(query)
      .populate('createdBy', 'firebaseUid firstName lastName photoURL')
      .sort({ eventDate: 1 })
      .limit(100)
      .lean();

    const now = new Date();

    const formattedEvents = events
      .filter(event => {
        const eventDate = new Date(event.eventDate);
        return eventDate >= now;
      })
      .map(event => ({
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        pincode: event.pincode,
        location: {
          lat: event.location.lat,
          lng: event.location.lng,
        },
        eventDate: event.eventDate,
        createdBy: event.createdBy
          ? {
              firebaseUid: event.createdBy.firebaseUid,
              firstName: event.createdBy.firstName,
              lastName: event.createdBy.lastName,
              photoURL: event.createdBy.photoURL,
            }
          : null,
      }));

    setCachedEvents(cacheKey, formattedEvents, 120).catch((error) => {
      console.warn('[Map Events] Error caching results:', error.message);
    });

    return NextResponse.json({
      success: true,
      events: formattedEvents,
      count: formattedEvents.length,
      center: { lat, lng },
      radius: radiusInMiles,
      zipcode: zipcode || null,
      cached: false
    });

  } catch (error) {
    console.error('Error fetching map events:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch events',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

