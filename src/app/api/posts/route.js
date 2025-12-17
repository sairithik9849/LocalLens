// src/app/api/posts/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Post from '@/models/Post';

// GET - Fetch posts (feed)
export async function GET(request) {
  try {
    console.log('📥 GET /api/posts - Starting...');
    await connectDB();
    console.log('✓ Database connected');
    
    const userId = request.headers.get('user-id');
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 20;
    const skip = parseInt(searchParams.get('skip')) || 0;

    console.log('User ID:', userId);

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Find current user
    const currentUser = await User.findOne({ firebaseUid: userId });
    console.log('Current user found:', currentUser ? 'Yes' : 'No');
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch posts from user and their friends
    const friendIds = currentUser.friends || [];
    const userIds = [currentUser._id, ...friendIds];
    console.log('Fetching posts for user IDs:', userIds.length);

    const posts = await Post.find({
      user: { $in: userIds }
    })
      .populate('user', 'firstName lastName photoURL email')
      .populate('comments.user', 'firstName lastName photoURL')
      .populate('comments.replies.user', 'firstName lastName photoURL')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    console.log('✓ Posts fetched:', posts.length);

    // Format posts for frontend
    const formattedPosts = posts.map(post => ({
      _id: post._id,
      user: {
        _id: post.user._id,
        name: `${post.user.firstName} ${post.user.lastName}`,
        photoURL: post.user.photoURL,
        email: post.user.email
      },
      content: post.content,
      images: post.images || [],
      likes: post.likes.map(id => id.toString()),
      likesCount: post.likes.length,
      isLiked: post.likes.some(id => id.toString() === currentUser._id.toString()),
      comments: post.comments.map(comment => ({
        _id: comment._id,
        user: {
          _id: comment.user._id,
          name: `${comment.user.firstName} ${comment.user.lastName}`,
          photoURL: comment.user.photoURL
        },
        content: comment.content,
        likes: comment.likes.map(id => id.toString()),
        likesCount: comment.likes.length,
        isLiked: comment.likes.some(id => id.toString() === currentUser._id.toString()),
        replies: comment.replies.map(reply => ({
          _id: reply._id,
          user: {
            _id: reply.user._id,
            name: `${reply.user.firstName} ${reply.user.lastName}`,
            photoURL: reply.user.photoURL
          },
          content: reply.content,
          likes: reply.likes.map(id => id.toString()),
          likesCount: reply.likes.length,
          isLiked: reply.likes.some(id => id.toString() === currentUser._id.toString()),
          createdAt: reply.createdAt
        })),
        createdAt: comment.createdAt
      })),
      commentsCount: post.comments.length,
      shares: post.shares || [],
      sharesCount: post.shares.length,
      location: post.location,
      createdAt: post.createdAt,
      isOwner: post.user._id.toString() === currentUser._id.toString()
    }));

    return NextResponse.json({ posts: formattedPosts });
  } catch (error) {
    console.error('❌ Error fetching posts:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new post
export async function POST(request) {
  try {
    console.log('📝 POST /api/posts - Starting...');
    await connectDB();
    console.log('✓ Database connected');
    
    const userId = request.headers.get('user-id');
    console.log('User ID:', userId);

    let body;
    try {
      body = await request.json();
      console.log('Request body:', body);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { content, images, location, visibility } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Content required' },
        { status: 400 }
      );
    }

    // Find current user
    console.log('Finding user with firebaseUid:', userId);
    const currentUser = await User.findOne({ firebaseUid: userId });
    console.log('Current user found:', currentUser ? 'Yes' : 'No');
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create new post
    console.log('Creating post...');
    const post = await Post.create({
      user: currentUser._id,
      content: content.trim(),
      images: images || [],
      location: location || null,
      visibility: visibility || 'public',
      likes: [],
      comments: [],
      shares: []
    });

    console.log('✓ Post created:', post._id);

    // Populate user data
    await post.populate('user', 'firstName lastName photoURL email');

    // Format for response
    const formattedPost = {
      _id: post._id,
      user: {
        _id: post.user._id,
        name: `${post.user.firstName} ${post.user.lastName}`,
        photoURL: post.user.photoURL,
        email: post.user.email
      },
      content: post.content,
      images: post.images,
      likes: [],
      likesCount: 0,
      isLiked: false,
      comments: [],
      commentsCount: 0,
      shares: [],
      sharesCount: 0,
      location: post.location,
      createdAt: post.createdAt,
      isOwner: true
    };

    console.log('✓ Post created successfully');
    return NextResponse.json({ post: formattedPost }, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating post:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to create post', details: error.message },
      { status: 500 }
    );
  }
}