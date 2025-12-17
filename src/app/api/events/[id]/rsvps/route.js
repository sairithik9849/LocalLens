// src/app/api/events/[id]/rsvps/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Event from '@/models/Event';
import RSVP from '@/models/RSVP';
import { verifyToken } from '@/firebase/verifyToken';

// GET - Get RSVPs for an event
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
    const event = await Event.findById(id);
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
        { error: 'You can only view RSVPs for events in your pincode area' },
        { status: 403 }
      );
    }

    // Get RSVPs for the event
    const rsvps = await RSVP.find({ event: event._id })
      .populate('user', 'firebaseUid firstName lastName photoURL')
      .sort({ createdAt: -1 })
      .lean();

    // Group RSVPs by status
    const going = rsvps.filter(rsvp => rsvp.status === 'going').map(rsvp => ({
      _id: rsvp._id,
      user: {
        _id: rsvp.user._id,
        firebaseUid: rsvp.user.firebaseUid,
        name: `${rsvp.user.firstName} ${rsvp.user.lastName}`,
        photoURL: rsvp.user.photoURL
      },
      status: rsvp.status,
      createdAt: rsvp.createdAt
    }));

    const notGoing = rsvps.filter(rsvp => rsvp.status === 'not_going').map(rsvp => ({
      _id: rsvp._id,
      user: {
        _id: rsvp.user._id,
        firebaseUid: rsvp.user.firebaseUid,
        name: `${rsvp.user.firstName} ${rsvp.user.lastName}`,
        photoURL: rsvp.user.photoURL
      },
      status: rsvp.status,
      createdAt: rsvp.createdAt
    }));

    return NextResponse.json({
      success: true,
      rsvps: {
        going: going,
        notGoing: notGoing,
        total: rsvps.length
      }
    });
  } catch (error) {
    console.error('Error fetching RSVPs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSVPs' },
      { status: 500 }
    );
  }
}
