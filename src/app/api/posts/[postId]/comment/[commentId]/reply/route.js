// src/app/api/posts/[postId]/comment/[commentId]/reply/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Post from '@/models/Post';

export async function POST(request, { params }) {
  try {
    await connectDB();
    
    const userId = request.headers.get('user-id');
    const { postId, commentId } = await params; // ← AWAIT params
    const { content } = await request.json();

    if (!userId || !content?.trim()) {
      return NextResponse.json(
        { error: 'User ID and content required' },
        { status: 400 }
      );
    }

    const currentUser = await User.findOne({ firebaseUid: userId });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    comment.replies.push({
      user: currentUser._id,
      content: content.trim(),
      likes: []
    });

    await post.save();
    await post.populate('comments.replies.user', 'firstName lastName photoURL');

    const newReply = comment.replies[comment.replies.length - 1];

    return NextResponse.json({
      reply: {
        _id: newReply._id,
        user: {
          _id: newReply.user._id,
          name: `${newReply.user.firstName} ${newReply.user.lastName}`,
          photoURL: newReply.user.photoURL
        },
        content: newReply.content,
        likes: [],
        likesCount: 0,
        isLiked: false,
        createdAt: newReply.createdAt
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding reply:', error);
    return NextResponse.json({ error: 'Failed to add reply' }, { status: 500 });
  }
}