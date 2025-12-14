// src/app/api/incidents/[id]/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Incident from '@/models/Incident';
import { sanitizeText } from '@/lib/sanitizeInput';
import { verifyAuthAndAuthorization } from '@/firebase/verifyToken';
import { invalidateIncidentCache } from '@/lib/incidentCache';

// PATCH - Update an incident
export async function PATCH(request, { params }) {
  try {
    await connectDB();
    
    const { id } = await params;
    const body = await request.json();
    const { location, incidentType, description, reportedAt } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    // Find the incident
    const incident = await Incident.findById(id).populate('reportedBy', 'firebaseUid');
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // Verify authentication and get user
    const firebaseUid = incident.reportedBy.firebaseUid;
    let authResult;
    try {
      authResult = await verifyAuthAndAuthorization(request, firebaseUid);
    } catch (authError) {
      console.error('Auth verification error:', authError);
      return NextResponse.json(
        { 
          error: 'Authentication service error. Please check Firebase Admin configuration.',
          details: authError.message 
        },
        { status: 500 }
      );
    }
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Get the MongoDB user to check if they are the creator
    const user = await User.findOne({ firebaseUid: firebaseUid });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (incident.reportedBy._id.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to edit this incident' },
        { status: 403 }
      );
    }

    // Check if user is banned
    if (user.moderation?.banned === true) {
      return NextResponse.json(
        { error: 'Account is banned' },
        { status: 403 }
      );
    }

    // Build update object with only provided fields
    const updateData = {};

    if (location !== undefined) {
      if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        return NextResponse.json(
          { error: 'Valid location with lat and lng is required' },
          { status: 400 }
        );
      }
      if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
        return NextResponse.json(
          { error: 'Invalid location coordinates' },
          { status: 400 }
        );
      }
      updateData.location = {
        lat: location.lat,
        lng: location.lng
      };
    }

    if (incidentType !== undefined) {
      if (!incidentType || typeof incidentType !== 'string' || incidentType.trim().length === 0) {
        return NextResponse.json(
          { error: 'Incident type is required' },
          { status: 400 }
        );
      }
      const sanitizedIncidentType = sanitizeText(incidentType.trim());
      if (sanitizedIncidentType.length === 0) {
        return NextResponse.json(
          { error: 'Incident type cannot be empty after sanitization' },
          { status: 400 }
        );
      }
      if (sanitizedIncidentType.length > 200) {
        return NextResponse.json(
          { error: 'Incident type must be 200 characters or less' },
          { status: 400 }
        );
      }
      updateData.incidentType = sanitizedIncidentType;
    }

    if (description !== undefined) {
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return NextResponse.json(
          { error: 'Description is required' },
          { status: 400 }
        );
      }
      const sanitizedDescription = sanitizeText(description.trim());
      if (sanitizedDescription.length === 0) {
        return NextResponse.json(
          { error: 'Description cannot be empty after sanitization' },
          { status: 400 }
        );
      }
      if (sanitizedDescription.length > 2000) {
        return NextResponse.json(
          { error: 'Description must be 2000 characters or less' },
          { status: 400 }
        );
      }
      updateData.description = sanitizedDescription;
    }

    if (reportedAt !== undefined) {
      const reportedAtDate = new Date(reportedAt);
      if (isNaN(reportedAtDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid reportedAt date' },
          { status: 400 }
        );
      }
      updateData.reportedAt = reportedAtDate;
    }

    // Update the incident
    const updatedIncident = await Incident.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('reportedBy', 'firebaseUid firstName lastName photoURL');

    // Invalidate incident cache after successful update
    invalidateIncidentCache().catch(() => {
      // Ignore cache invalidation errors - already logged
    });

    return NextResponse.json({
      success: true,
      incident: {
        _id: updatedIncident._id,
        location: updatedIncident.location,
        incidentType: updatedIncident.incidentType,
        description: updatedIncident.description,
        reportedAt: updatedIncident.reportedAt,
        reportedBy: {
          _id: updatedIncident.reportedBy._id,
          firebaseUid: updatedIncident.reportedBy.firebaseUid,
          name: `${updatedIncident.reportedBy.firstName} ${updatedIncident.reportedBy.lastName}`,
          photoURL: updatedIncident.reportedBy.photoURL
        },
        createdAt: updatedIncident.createdAt,
        updatedAt: updatedIncident.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { error: 'Failed to update incident' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an incident
export async function DELETE(request, { params }) {
  try {
    await connectDB();
    
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    // Find the incident
    const incident = await Incident.findById(id).populate('reportedBy', 'firebaseUid');
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // Verify authentication and get user
    const firebaseUid = incident.reportedBy.firebaseUid;
    let authResult;
    try {
      authResult = await verifyAuthAndAuthorization(request, firebaseUid);
    } catch (authError) {
      console.error('Auth verification error:', authError);
      return NextResponse.json(
        { 
          error: 'Authentication service error. Please check Firebase Admin configuration.',
          details: authError.message 
        },
        { status: 500 }
      );
    }
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Get the MongoDB user to check if they are the creator
    const user = await User.findOne({ firebaseUid: firebaseUid });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (incident.reportedBy._id.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to delete this incident' },
        { status: 403 }
      );
    }

    // Check if user is banned
    if (user.moderation?.banned === true) {
      return NextResponse.json(
        { error: 'Account is banned' },
        { status: 403 }
      );
    }

    // Delete the incident
    await Incident.findByIdAndDelete(id);

    // Invalidate incident cache after successful deletion
    invalidateIncidentCache().catch(() => {
      // Ignore cache invalidation errors - already logged
    });

    return NextResponse.json({
      success: true,
      message: 'Incident deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting incident:', error);
    return NextResponse.json(
      { error: 'Failed to delete incident' },
      { status: 500 }
    );
  }
}

