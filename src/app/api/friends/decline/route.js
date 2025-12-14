// src/app/api/friends/decline/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import FriendRequest from '@/models/FriendRequest';

export async function POST(request) {
  try {
    await connectDB();
    
    const { requestId } = await request.json();
    const userId = request.headers.get('user-id');

    if (!userId || !requestId) {
      return NextResponse.json(
        { error: 'User ID and request ID required' },
        { status: 400 }
      );
    }

    // Find the friend request
    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    // Find current user
    const user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify this request is for the current user
    if (friendRequest.toUser.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update request status
    friendRequest.status = 'declined';
    friendRequest.respondedAt = new Date();
    await friendRequest.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error declining friend request:', error);
    return NextResponse.json(
      { error: 'Failed to decline friend request' },
      { status: 500 }
    );
  }
}