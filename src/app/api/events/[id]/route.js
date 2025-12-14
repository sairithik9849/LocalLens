// src/app/api/events/[id]/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Event from '@/models/Event';
import RSVP from '@/models/RSVP';
import { sanitizeText } from '@/lib/sanitizeInput';
import { verifyToken } from '@/firebase/verifyToken';
import { reverseGeocodeWithQueue } from '@/lib/reverseGeocodingHelper';

// GET - Get event details with RSVP count
export async function GET(request, { params }) {
  try {
    await connectDB();
    
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Verify authentication token
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Find user by firebaseUid
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has pincode set
    const userPincode = user.profile?.pincode;
    if (!userPincode) {
      return NextResponse.json(
        { error: 'Pincode is required. Please set your pincode in your profile.' },
        { status: 400 }
      );
    }

    // Normalize pincode
    const normalizedUserPincode = userPincode.replace(/-/g, '').slice(0, 5);

    // Find the event
    const event = await Event.findById(id).populate('createdBy', 'firebaseUid firstName lastName photoURL');
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Verify event pincode matches user's pincode
    const normalizedEventPincode = event.pincode.replace(/-/g, '').slice(0, 5);
    if (normalizedEventPincode !== normalizedUserPincode) {
      return NextResponse.json(
        { error: 'You can only view events in your pincode area' },
        { status: 403 }
      );
    }

    // Get RSVP counts
    const goingCount = await RSVP.countDocuments({ event: event._id, status: 'going' });
    const notGoingCount = await RSVP.countDocuments({ event: event._id, status: 'not_going' });

    // Get user's RSVP status
    const userRSVP = await RSVP.findOne({ event: event._id, user: user._id });

    return NextResponse.json({
      success: true,
      event: {
        _id: event._id,
        title: event.title,
        description: event.description,
        eventDate: event.eventDate,
        location: event.location,
        pincode: event.pincode,
        createdBy: {
          _id: event.createdBy._id,
          firebaseUid: event.createdBy.firebaseUid,
          name: `${event.createdBy.firstName} ${event.createdBy.lastName}`,
          photoURL: event.createdBy.photoURL
        },
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        rsvpCounts: {
          going: goingCount,
          notGoing: notGoingCount,
          total: goingCount + notGoingCount
        },
        userRSVP: userRSVP ? {
          status: userRSVP.status,
          createdAt: userRSVP.createdAt
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

// PATCH - Update an event (creator only)
export async function PATCH(request, { params }) {
  try {
    await connectDB();
    
    const { id } = await params;
    const body = await request.json();
    const { title, description, eventDate, location } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Find the event
    const event = await Event.findById(id).populate('createdBy', 'firebaseUid');
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Verify authentication token
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Get the MongoDB user
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (event.createdBy._id.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to edit this event' },
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

    // Check if user has pincode set
    const userPincode = user.profile?.pincode;
    if (!userPincode) {
      return NextResponse.json(
        { error: 'Pincode is required. Please set your pincode in your profile.' },
        { status: 400 }
      );
    }

    // Normalize pincode
    const normalizedUserPincode = userPincode.replace(/-/g, '').slice(0, 5);

    // Build update object with only provided fields
    const updateData = {};

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title is required' },
          { status: 400 }
        );
      }
      const sanitizedTitle = sanitizeText(title.trim());
      if (sanitizedTitle.length === 0) {
        return NextResponse.json(
          { error: 'Title cannot be empty after sanitization' },
          { status: 400 }
        );
      }
      if (sanitizedTitle.length < 3 || sanitizedTitle.length > 200) {
        return NextResponse.json(
          { error: 'Title must be between 3 and 200 characters' },
          { status: 400 }
        );
      }
      updateData.title = sanitizedTitle;
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
      if (sanitizedDescription.length < 10 || sanitizedDescription.length > 2000) {
        return NextResponse.json(
          { error: 'Description must be between 10 and 2000 characters' },
          { status: 400 }
        );
      }
      updateData.description = sanitizedDescription;
    }

    if (eventDate !== undefined) {
      const eventDateObj = new Date(eventDate);
      if (isNaN(eventDateObj.getTime())) {
        return NextResponse.json(
          { error: 'Invalid event date' },
          { status: 400 }
        );
      }
      if (eventDateObj <= new Date()) {
        return NextResponse.json(
          { error: 'Event date must be in the future' },
          { status: 400 }
        );
      }
      updateData.eventDate = eventDateObj;
    }

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

      // Reverse geocode location to verify pincode matches
      let locationPincode;
      try {
        locationPincode = await reverseGeocodeWithQueue(location.lat, location.lng, 30);
      } catch (error) {
        return NextResponse.json(
          { error: error.message || 'Could not determine pincode for selected location. Please select a valid location.' },
          { status: 400 }
        );
      }

      const normalizedLocationPincode = locationPincode.replace(/-/g, '').slice(0, 5);
      if (normalizedLocationPincode !== normalizedUserPincode) {
        return NextResponse.json(
          { error: `Selected location is not within your pincode (${userPincode}). You can only create events in your pincode area.` },
          { status: 400 }
        );
      }

      updateData.location = {
        lat: location.lat,
        lng: location.lng
      };
      updateData.pincode = normalizedUserPincode;
    }

    // Update the event
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firebaseUid firstName lastName photoURL');

    return NextResponse.json({
      success: true,
      event: {
        _id: updatedEvent._id,
        title: updatedEvent.title,
        description: updatedEvent.description,
        eventDate: updatedEvent.eventDate,
        location: updatedEvent.location,
        pincode: updatedEvent.pincode,
        createdBy: {
          _id: updatedEvent.createdBy._id,
          firebaseUid: updatedEvent.createdBy.firebaseUid,
          name: `${updatedEvent.createdBy.firstName} ${updatedEvent.createdBy.lastName}`,
          photoURL: updatedEvent.createdBy.photoURL
        },
        createdAt: updatedEvent.createdAt,
        updatedAt: updatedEvent.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an event (creator only)
export async function DELETE(request, { params }) {
  try {
    await connectDB();
    
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Find the event
    const event = await Event.findById(id).populate('createdBy', 'firebaseUid');
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Verify authentication token
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Get the MongoDB user
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (event.createdBy._id.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to delete this event' },
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

    // Delete all associated RSVPs
    await RSVP.deleteMany({ event: event._id });

    // Delete the event
    await Event.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
