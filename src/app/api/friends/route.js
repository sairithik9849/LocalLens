// src/app/api/friends/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Conversation from '@/models/Conversation';

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

    // Find current user with populated friends
    const user = await User.findOne({ firebaseUid: userId })
      .populate('friends', 'firebaseUid firstName lastName email photoURL')
      .lean();

    if (!user) {
      return NextResponse.json({ friends: [] });
    }

    // Get conversations for each friend
    const friendsWithConversations = await Promise.all(
      user.friends.map(async (friend) => {
        // Find conversation between current user and this friend
        const conversation = await Conversation.findOne({
          participants: { $all: [user._id, friend._id] }
        }).lean();

        // Count unread messages (messages sent by friend that current user hasn't read)
        let unreadCount = 0;
        if (conversation) {
          unreadCount = conversation.messages.filter(
            msg => msg.sender.toString() === friend._id.toString() && !msg.read
          ).length;
        }

        return {
          _id: friend._id,
          id: friend.firebaseUid,
          name: `${friend.firstName} ${friend.lastName}`,
          email: friend.email,
          photoURL: friend.photoURL,
          lastMessage: conversation?.lastMessage || null,
          lastMessageTime: conversation?.lastMessageTime || null,
          unreadCount: unreadCount
        };
      })
    );

    // Sort by most recent message
    friendsWithConversations.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    return NextResponse.json({ friends: friendsWithConversations });
  } catch (error) {
    console.error('Error fetching friends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friends', friends: [] },
      { status: 500 }
    );
  }
}