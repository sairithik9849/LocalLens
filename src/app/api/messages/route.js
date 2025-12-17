// src/app/api/messages/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Conversation from '@/models/Conversation';
import mongoose from 'mongoose';

// GET - Fetch messages with a friend (and mark them as read)
export async function GET(request) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const friendId = searchParams.get('friendId');
    const userId = request.headers.get('user-id');

    if (!userId || !friendId) {
      return NextResponse.json(
        { error: 'User ID and friend ID required' },
        { status: 400 }
      );
    }

    // Find current user by firebaseUid
    const currentUser = await User.findOne({ firebaseUid: userId });
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Current user not found' },
        { status: 404 }
      );
    }

    // Find friend - try both _id and firebaseUid
    let friend = null;
    if (mongoose.Types.ObjectId.isValid(friendId)) {
      friend = await User.findById(friendId);
    }
    if (!friend) {
      friend = await User.findOne({ firebaseUid: friendId });
    }

    if (!friend) {
      return NextResponse.json(
        { error: 'Friend not found' },
        { status: 404 }
      );
    }

    // Find conversation
    const conversation = await Conversation.findOne({
      participants: { $all: [currentUser._id, friend._id] }
    });

    if (!conversation) {
      return NextResponse.json({ messages: [] });
    }

    // Mark all messages from friend as read
    let hasUnread = false;
    for (let i = 0; i < conversation.messages.length; i++) {
      const msg = conversation.messages[i];
      if (msg.sender.toString() === friend._id.toString() && !msg.read) {
        conversation.messages[i].read = true;
        hasUnread = true;
      }
    }

    // Save if there were unread messages
    if (hasUnread) {
      await conversation.save();
      console.log(`✓ Marked ${conversation.messages.length} messages as read for ${friend.firstName}`);
    }

    // Format messages for frontend
    const messages = conversation.messages.map((msg, index) => ({
      id: msg._id || `msg-${index}`,
      senderId: msg.sender.toString() === currentUser._id.toString() ? userId : friend.firebaseUid,
      recipientId: msg.sender.toString() === currentUser._id.toString() ? friend.firebaseUid : userId,
      content: msg.content,
      createdAt: msg.createdAt,
      read: msg.read
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', messages: [] },
      { status: 500 }
    );
  }
}

// POST - Send a message
export async function POST(request) {
  try {
    await connectDB();
    
    const { recipientId, content } = await request.json();
    const userId = request.headers.get('user-id');

    if (!userId || !recipientId || !content) {
      return NextResponse.json(
        { error: 'User ID, recipient ID, and content required' },
        { status: 400 }
      );
    }

    // Find current user by firebaseUid
    const currentUser = await User.findOne({ firebaseUid: userId });
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Current user not found' },
        { status: 404 }
      );
    }

    // Find recipient - try both _id and firebaseUid
    let recipient = null;
    if (mongoose.Types.ObjectId.isValid(recipientId)) {
      recipient = await User.findById(recipientId);
    }
    if (!recipient) {
      recipient = await User.findOne({ firebaseUid: recipientId });
    }

    if (!recipient) {
      console.error('Recipient not found:', recipientId);
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      );
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUser._id, recipient._id] }
    });

    if (!conversation) {
      console.log('Creating new conversation between:', currentUser._id, recipient._id);
      conversation = await Conversation.create({
        participants: [currentUser._id, recipient._id],
        messages: [],
        lastMessage: null,
        lastMessageTime: null
      });
    }

    // Add message to conversation (messages start as unread)
    const newMessage = {
      sender: currentUser._id,
      content: content.trim(),
      read: false,  // New messages are unread
      createdAt: new Date()
    };

    conversation.messages.push(newMessage);
    conversation.lastMessage = content.trim();
    conversation.lastMessageTime = new Date();
    
    await conversation.save();

    console.log('✓ Message saved successfully');

    return NextResponse.json({
      success: true,
      message: {
        id: newMessage._id || Date.now(),
        senderId: userId,
        recipientId: recipient.firebaseUid,
        content: newMessage.content,
        createdAt: newMessage.createdAt,
        read: false
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to send message', details: error.message },
      { status: 500 }
    );
  }
}