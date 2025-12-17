// src/app/api/friends/request/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import FriendRequest from '@/models/FriendRequest';
import mongoose from 'mongoose';

// POST - Send a friend request
export async function POST(request) {
  try {
    await connectDB();
    
    const { recipientId } = await request.json();
    const senderId = request.headers.get('user-id');

    if (!senderId || !recipientId) {
      return NextResponse.json(
        { error: 'Sender and recipient required' },
        { status: 400 }
      );
    }

    // Find sender by firebaseUid
    const sender = await User.findOne({ firebaseUid: senderId });
    if (!sender) {
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 404 }
      );
    }

    // Find recipient - try both _id and firebaseUid
    let recipient = null;
    
    // If recipientId looks like MongoDB ObjectId, search by _id
    if (mongoose.Types.ObjectId.isValid(recipientId)) {
      recipient = await User.findById(recipientId);
    }
    
    // If not found, try firebaseUid
    if (!recipient) {
      recipient = await User.findOne({ firebaseUid: recipientId });
    }

    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      );
    }

    // Check if trying to add self
    if (sender._id.toString() === recipient._id.toString()) {
      return NextResponse.json(
        { error: 'Cannot send friend request to yourself' },
        { status: 400 }
      );
    }

    // Check if already friends
    if (sender.friends.includes(recipient._id)) {
      return NextResponse.json(
        { error: 'Already friends' },
        { status: 400 }
      );
    }

    // Check if request already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { fromUser: sender._id, toUser: recipient._id },
        { fromUser: recipient._id, toUser: sender._id }
      ],
      status: 'pending'
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'Friend request already exists' },
        { status: 400 }
      );
    }

    // Create friend request
    const friendRequest = await FriendRequest.create({
      fromUser: sender._id,
      toUser: recipient._id,
      status: 'pending'
    });

    return NextResponse.json({
      success: true,
      request: {
        id: friendRequest._id,
        senderId: senderId,
        recipientId: recipient.firebaseUid,
        status: 'pending',
        createdAt: friendRequest.createdAt
      }
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    return NextResponse.json(
      { error: 'Failed to send friend request' },
      { status: 500 }
    );
  }
}

// GET - Get pending friend requests for current user
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
    const user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return NextResponse.json({ requests: [] });
    }

    // Get pending requests sent TO this user
    const requests = await FriendRequest.find({
      toUser: user._id,
      status: 'pending'
    })
    .populate('fromUser', 'firebaseUid name email photoURL')
    .sort({ createdAt: -1 })
    .lean();

    // Format requests
    const formattedRequests = requests.map(req => ({
      _id: req._id,
      sender: {
        _id: req.fromUser._id,
        id: req.fromUser.firebaseUid,
        name: req.fromUser.name,
        email: req.fromUser.email,
        photoURL: req.fromUser.photoURL
      },
      createdAt: req.createdAt
    }));

    return NextResponse.json({ requests: formattedRequests });
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests', requests: [] },
      { status: 500 }
    );
  }
}