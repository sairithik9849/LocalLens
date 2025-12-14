// src/app/api/posts/[postId]/like/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Post from '@/models/Post';

export async function POST(request, { params }) {
  try {
    await connectDB();
    
    const userId = request.headers.get('user-id');
    const { postId } = await params; // ← AWAIT params

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const currentUser = await User.findOne({ firebaseUid: userId });
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const post = await Post.findById(postId);
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const likeIndex = post.likes.findIndex(
      id => id.toString() === currentUser._id.toString()
    );

    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(currentUser._id);
    }

    await post.save();

    return NextResponse.json({
      liked: likeIndex === -1,
      likesCount: post.likes.length
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}