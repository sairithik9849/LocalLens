// src/app/api/events/upcoming/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(request) {
  try {
    await connectDB();
    
    const userId = request.headers.get('user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Find current user
    const currentUser = await User.findOne({ firebaseUid: userId });
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentPincode = currentUser.profile?.pincode;

    // Import Event model dynamically to avoid circular dependencies
    const mongoose = require('mongoose');
    const Event = mongoose.models.Event || mongoose.model('Event', new mongoose.Schema({
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      title: String,
      description: String,
      eventDate: Date,
      location: {
        lat: Number,
        lng: Number
      },
      pincode: String,
      createdAt: Date,
      updatedAt: Date
    }));

    // Find upcoming events in same pincode
    const now = new Date();
    const events = await Event.find({
      eventDate: { $gte: now },
      pincode: currentPincode
    })
      .sort({ eventDate: 1 })
      .limit(10)
      .populate('createdBy', 'firstName lastName photoURL');

    // Format events
    const formattedEvents = events.map(event => ({
      _id: event._id,
      title: event.title,
      description: event.description,
      eventDate: event.eventDate,
      location: event.location,
      pincode: event.pincode,
      createdBy: event.createdBy ? {
        _id: event.createdBy._id,
        name: `${event.createdBy.firstName} ${event.createdBy.lastName}`,
        photoURL: event.createdBy.photoURL
      } : null,
      createdAt: event.createdAt
    }));

    return NextResponse.json({ events: formattedEvents });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}