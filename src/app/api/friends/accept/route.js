// src/app/api/friends/accept/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import FriendRequest from '@/models/FriendRequest';
import Conversation from '@/models/Conversation';

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
    friendRequest.status = 'accepted';
    friendRequest.respondedAt = new Date();
    await friendRequest.save();

    // Add each user to other's friends list
    await User.updateOne(
      { _id: friendRequest.fromUser },
      { $addToSet: { friends: friendRequest.toUser } }
    );
    
    await User.updateOne(
      { _id: friendRequest.toUser },
      { $addToSet: { friends: friendRequest.fromUser } }
    );

    // Create a conversation between the two users
    const existingConversation = await Conversation.findOne({
      participants: { $all: [friendRequest.fromUser, friendRequest.toUser] }
    });

    if (!existingConversation) {
      await Conversation.create({
        participants: [friendRequest.fromUser, friendRequest.toUser],
        messages: []
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return NextResponse.json(
      { error: 'Failed to accept friend request' },
      { status: 500 }
    );
  }
}