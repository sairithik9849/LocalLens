// src/app/api/incidents/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Incident from '@/models/Incident';
import { sanitizeText } from '@/lib/sanitizeInput';

// POST - Create a new incident report
export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { location, incidentType, description, reportedAt } = body;
    const userId = request.headers.get('user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 401 }
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
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const minLat = searchParams.get('minLat');
    const maxLat = searchParams.get('maxLat');
    const minLng = searchParams.get('minLng');
    const maxLng = searchParams.get('maxLng');
    const limit = parseInt(searchParams.get('limit') || '100');

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
      .limit(limit)
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

