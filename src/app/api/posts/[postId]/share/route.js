// src/app/api/posts/[postId]/share/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Post from '@/models/Post';

export async function POST(request, { params }) {
  try {
    await connectDB();
    
    const userId = request.headers.get('user-id');
    const { postId } = await params; // ← AWAIT params
    const { content } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const currentUser = await User.findOne({ firebaseUid: userId });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const originalPost = await Post.findById(postId);
    if (!originalPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const sharePost = await Post.create({
      user: currentUser._id,
      content: content || `Shared a post`,
      originalPost: originalPost._id,
      likes: [],
      comments: [],
      shares: []
    });

    originalPost.shares.push({
      user: currentUser._id
    });
    await originalPost.save();

    await sharePost.populate('user', 'firstName lastName photoURL email');
    await sharePost.populate('originalPost');

    return NextResponse.json({
      share: {
        _id: sharePost._id,
        sharesCount: originalPost.shares.length
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error sharing post:', error);
    return NextResponse.json({ error: 'Failed to share post' }, { status: 500 });
  }
}