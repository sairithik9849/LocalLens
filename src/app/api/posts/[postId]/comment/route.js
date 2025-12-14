// src/app/api/posts/[postId]/comment/route.js
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

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Comment content required' },
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

    post.comments.push({
      user: currentUser._id,
      content: content.trim(),
      likes: [],
      replies: []
    });

    await post.save();
    await post.populate('comments.user', 'firstName lastName photoURL');

    const newComment = post.comments[post.comments.length - 1];

    return NextResponse.json({
      comment: {
        _id: newComment._id,
        user: {
          _id: newComment.user._id,
          name: `${newComment.user.firstName} ${newComment.user.lastName}`,
          photoURL: newComment.user.photoURL
        },
        content: newComment.content,
        likes: [],
        likesCount: 0,
        isLiked: false,
        replies: [],
        createdAt: newComment.createdAt
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}