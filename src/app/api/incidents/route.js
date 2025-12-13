// src/app/api/incidents/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Incident from '@/models/Incident';
import { sanitizeText } from '@/lib/sanitizeInput';
import { verifyToken } from '@/firebase/verifyToken';
import { generateCacheKey, getCachedIncidents, setCachedIncidents, invalidateIncidentCache } from '@/lib/incidentCache';

// POST - Create a new incident report
export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { location, incidentType, description, reportedAt, uid } = body;

    // Verify authentication token
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    const userId = uid || decodedToken.uid;

    // Verify that the user is accessing their own data (if uid is provided)
    if (uid && decodedToken.uid !== uid) {
      return NextResponse.json(
        { error: 'Forbidden: You can only create incidents for your own account' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return NextResponse.json(
        { error: 'Valid location with lat and lng is required' },
        { status: 400 }
      );
    }

    if (!incidentType || typeof incidentType !== 'string' || incidentType.trim().length === 0) {
      return NextResponse.json(
        { error: 'Incident type is required' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Validate location coordinates
    if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
      return NextResponse.json(
        { error: 'Invalid location coordinates' },
        { status: 400 }
      );
    }

    // Find user by firebaseUid
    const user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is banned
    if (user.moderation?.banned === true) {
      return NextResponse.json(
        { error: 'Account is banned' },
        { status: 403 }
      );
    }

    // Sanitize input
    const sanitizedIncidentType = sanitizeText(incidentType.trim());
    const sanitizedDescription = sanitizeText(description.trim());

    // Validate sanitized fields are not empty
    if (sanitizedIncidentType.length === 0 || sanitizedDescription.length === 0) {
      return NextResponse.json(
        { error: 'Incident type and description cannot be empty after sanitization' },
        { status: 400 }
      );
    }

    // Validate length limits
    if (sanitizedIncidentType.length > 200) {
      return NextResponse.json(
        { error: 'Incident type must be 200 characters or less' },
        { status: 400 }
      );
    }

    if (sanitizedDescription.length > 2000) {
      return NextResponse.json(
        { error: 'Description must be 2000 characters or less' },
        { status: 400 }
      );
    }

    // Parse reportedAt if provided, otherwise use current time
    let reportedAtDate = new Date();
    if (reportedAt) {
      reportedAtDate = new Date(reportedAt);
      if (isNaN(reportedAtDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid reportedAt date' },
          { status: 400 }
        );
      }
    }

    // Create incident
    const incident = await Incident.create({
      reportedBy: user._id,
      location: {
        lat: location.lat,
        lng: location.lng
      },
      incidentType: sanitizedIncidentType,
      description: sanitizedDescription,
      reportedAt: reportedAtDate,
      visibility: 'public'
    });

    // Populate reporter info
    await incident.populate('reportedBy', 'firebaseUid firstName lastName photoURL');

    // Invalidate incident cache after successful creation
    invalidateIncidentCache().catch(() => {
      // Ignore cache invalidation errors - already logged
    });

    return NextResponse.json({
      success: true,
      incident: {
        _id: incident._id,
        location: incident.location,
        incidentType: incident.incidentType,
        description: incident.description,
        reportedAt: incident.reportedAt,
        reportedBy: {
          _id: incident.reportedBy._id,
          firebaseUid: incident.reportedBy.firebaseUid,
          name: incident.reportedBy.name,
          photoURL: incident.reportedBy.photoURL
        },
        createdAt: incident.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json(
      { error: 'Failed to create incident' },
      { status: 500 }
    );
  }
}

// GET - Fetch incidents for map display
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const minLat = searchParams.get('minLat');
    const maxLat = searchParams.get('maxLat');
    const minLng = searchParams.get('minLng');
    const maxLng = searchParams.get('maxLng');
    const limit = searchParams.get('limit') || '100';

    // Generate cache key
    const cacheKey = generateCacheKey({ minLat, maxLat, minLng, maxLng, limit });

    // Check Redis cache first
    try {
      const cachedIncidents = await getCachedIncidents(cacheKey);
      if (cachedIncidents) {
        return NextResponse.json({
          success: true,
          incidents: cachedIncidents,
          count: cachedIncidents.length
        });
      }
    } catch (cacheError) {
      // Cache read failed, continue with MongoDB query
      // Error already logged in getCachedIncidents
    }

    // Cache miss or unavailable - query MongoDB
    console.log('[Incidents] MongoDB query');
    await connectDB();
    
    const limitNum = parseInt(limit);

    // Build query
    const query = {
      visibility: 'public'
    };

    // Add bounds filter if provided
    if (minLat && maxLat && minLng && maxLng) {
      const minLatNum = parseFloat(minLat);
      const maxLatNum = parseFloat(maxLat);
      const minLngNum = parseFloat(minLng);
      const maxLngNum = parseFloat(maxLng);

      if (!isNaN(minLatNum) && !isNaN(maxLatNum) && !isNaN(minLngNum) && !isNaN(maxLngNum)) {
        query['location.lat'] = { $gte: minLatNum, $lte: maxLatNum };
        query['location.lng'] = { $gte: minLngNum, $lte: maxLngNum };
      }
    }

    // Fetch incidents
    const incidents = await Incident.find(query)
      .populate('reportedBy', 'firebaseUid firstName lastName photoURL')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    // Format incidents
    const formattedIncidents = incidents.map(incident => ({
      _id: incident._id,
      location: incident.location,
      incidentType: incident.incidentType,
      description: incident.description,
      reportedAt: incident.reportedAt,
      reportedBy: {
        _id: incident.reportedBy._id,
        firebaseUid: incident.reportedBy.firebaseUid,
        name: `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`,
        photoURL: incident.reportedBy.photoURL
      },
      createdAt: incident.createdAt
    }));

    // Cache the results (don't await - non-blocking)
    setCachedIncidents(cacheKey, formattedIncidents, 900).catch(() => {
      // Ignore cache write errors - already logged in setCachedIncidents
    });

    return NextResponse.json({
      success: true,
      incidents: formattedIncidents,
      count: formattedIncidents.length
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incidents', incidents: [] },
      { status: 500 }
    );
  }
}

