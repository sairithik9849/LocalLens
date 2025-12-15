// src/app/feed/page.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/firebase/AuthContext';
import Navigation from '@/app/components/Navigation';
import Link from 'next/link';

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showComments, setShowComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [showReplies, setShowReplies] = useState({});
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [suggestedFriends, setSuggestedFriends] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchUserProfile();
      fetchSuggestedFriends();
      fetchUpcomingEvents();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`/api/users/profile?uid=${user.uid}`);
      const data = await response.json();
      setUserProfile(data.user);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchSuggestedFriends = async () => {
    try {
      const response = await fetch('/api/friends/suggested', {
        headers: {
          'user-id': user.uid
        }
      });
      const data = await response.json();
      setSuggestedFriends(data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggested friends:', error);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const response = await fetch('/api/events/upcoming', {
        headers: {
          'user-id': user.uid
        }
      });
      const data = await response.json();
      setUpcomingEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/posts', {
        headers: {
          'user-id': user.uid
        }
      });
      const data = await response.json();
      setPosts(data.posts || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedImages.length > 4) {
      alert('Maximum 4 images allowed per post');
      return;
    }

    setSelectedImages([...selectedImages, ...files]);
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setImagePreviewUrls([...imagePreviewUrls, ...newPreviewUrls]);
  };

  const removeImage = (index) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviewUrls.filter((_, i) => i !== index);
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setSelectedImages(newImages);
    setImagePreviewUrls(newPreviews);
  };

  const convertImagesToBase64 = async (files) => {
    const promises = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(promises);
  };

  const createPost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() && selectedImages.length === 0) return;

    setIsPosting(true);
    try {
      let imageBase64Array = [];
      if (selectedImages.length > 0) {
        imageBase64Array = await convertImagesToBase64(selectedImages);
      }

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({
          content: newPostContent || 'Shared photos',
          images: imageBase64Array
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPosts([data.post, ...posts]);
        setNewPostContent('');
        setSelectedImages([]);
        setImagePreviewUrls([]);
        imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const toggleLike = async (postId) => {
    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'user-id': user.uid }
      });
      if (response.ok) {
        const data = await response.json();
        setPosts(posts.map(post => 
          post._id === postId 
            ? { ...post, isLiked: data.liked, likesCount: data.likesCount }
            : post
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const addComment = async (postId) => {
    const content = commentInputs[postId];
    if (!content?.trim()) return;

    try {
      const response = await fetch(`/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(posts.map(post => 
          post._id === postId 
            ? { 
                ...post, 
                comments: [...post.comments, data.comment],
                commentsCount: post.commentsCount + 1
              }
            : post
        ));
        setCommentInputs({ ...commentInputs, [postId]: '' });
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const addReply = async (postId, commentId) => {
    const content = replyInputs[commentId];
    if (!content?.trim()) return;

    try {
      const response = await fetch(`/api/posts/${postId}/comment/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(posts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              comments: post.comments.map(comment =>
                comment._id === commentId
                  ? { ...comment, replies: [...comment.replies, data.reply] }
                  : comment
              )
            };
          }
          return post;
        }));
        setReplyInputs({ ...replyInputs, [commentId]: '' });
      }
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  const toggleCommentLike = async (postId, commentId) => {
    try {
      const response = await fetch(`/api/posts/${postId}/comment/${commentId}/like`, {
        method: 'POST',
        headers: { 'user-id': user.uid }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(posts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              comments: post.comments.map(comment =>
                comment._id === commentId
                  ? { ...comment, isLiked: data.liked, likesCount: data.likesCount }
                  : comment
              )
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const deletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'user-id': user.uid }
      });

      if (response.ok) {
        setPosts(posts.filter(post => post._id !== postId));
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const sharePost = async (postId) => {
    try {
      const response = await fetch(`/api/posts/${postId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({ content: '' })
      });

      if (response.ok) {
        await fetchPosts();
      }
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatEventDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (!user) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Please log in to view the feed.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 p-4 lg:p-6">
          {/* Left Sidebar - Profile (Hidden on mobile/tablet, shown on lg+) */}
          <div className="hidden lg:block w-80 shrink-0">
            <div className="bg-white rounded-lg shadow p-6 sticky top-24">
              <div className="text-center">
                <img
                  src={userProfile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=f39c12&color=fff`}
                  alt="Profile"
                  className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-green-100"
                />
                <h2 className="text-2xl font-bold text-gray-900">
                  {userProfile?.firstName && userProfile?.lastName 
                    ? `${userProfile.firstName} ${userProfile.lastName}`
                    : user.displayName || 'User'}
                </h2>
                <p className="text-base text-gray-600 mt-2">{userProfile?.email || user.email}</p>
                
                {userProfile?.profile?.city && (
                  <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-base text-green-700 font-medium">
                      {userProfile.profile.city}
                      {userProfile.profile.pincode && `, ${userProfile.profile.pincode}`}
                    </span>
                  </div>
                )}

                {userProfile?.profile?.bio && (
                  <p className="text-sm text-gray-600 mt-3 italic">
                    "{userProfile.profile.bio}"
                  </p>
                )}

                {userProfile?.profile?.favoriteQuote && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
                    <p className="text-xs text-gray-500 mb-1">Favorite Quote</p>
                    <p className="text-sm text-gray-700 italic">"{userProfile.profile.favoriteQuote}"</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Posts
                    </span>
                    <span className="font-semibold text-green-600">
                      {posts.filter(p => p.isOwner).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Friends
                    </span>
                    <span className="font-semibold text-green-600">
                      {userProfile?.friends?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Member since
                    </span>
                    <span className="text-xs text-gray-500">
                      {userProfile?.createdAt 
                        ? new Date(userProfile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {userProfile?.role && (
                <div className="mt-4">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                    userProfile.role === 'admin' 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
                  </span>
                </div>
              )}

              <div className="mt-6 space-y-2">
                <a
                  href="/profile"
                  className="block w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-center font-medium"
                >
                  View Profile
                </a>
                <a
                  href="/friends/search"
                  className="block w-full py-2 px-4 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition text-center font-medium"
                >
                  Find Friends
                </a>
              </div>
            </div>
          </div>

          {/* Center - Feed */}
          <div className="flex-1 w-full md:max-w-3xl">
            {/* Create Post Box - keeping the same as before */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <form onSubmit={createPost}>
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                  rows="3"
                />
                
                {imagePreviewUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={index} className="relative">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center mt-3">
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={selectedImages.length >= 4}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Photo ({selectedImages.length}/4)
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isPosting || (!newPostContent.trim() && selectedImages.length === 0)}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
                  >
                    {isPosting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </form>
            </div>

            {/* Posts Feed - Same as before, keeping all post display logic */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">No posts yet. Be the first to post!</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post._id} className="bg-white rounded-lg shadow mb-4">
                  {/* Post content here - keeping same as before */}
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user.name)}&background=f39c12&color=fff`}
                        alt={post.user.name}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <h3 className="font-semibold text-base">{post.user.name}</h3>
                        <p className="text-sm text-gray-500">{formatTime(post.createdAt)}</p>
                      </div>
                    </div>
                    {post.isOwner && (
                      <button
                        onClick={() => deletePost(post._id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="px-6 pb-4">
                    <p className="whitespace-pre-wrap text-base leading-relaxed">{post.content}</p>
                  </div>

                  {post.images && post.images.length > 0 && (
                    <div className={`${
                      post.images.length === 1 ? '' : 
                      post.images.length === 2 ? 'grid grid-cols-2' :
                      post.images.length === 3 ? 'grid grid-cols-3' :
                      'grid grid-cols-2'
                    } gap-1`}>
                      {post.images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image}
                            alt={`Post image ${index + 1}`}
                            className="w-full h-64 object-cover cursor-pointer hover:opacity-90 transition"
                            onClick={() => window.open(image, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-8">
                    <button
                      onClick={() => toggleLike(post._id)}
                      className="flex items-center gap-2 text-gray-600 hover:text-green-600 transition"
                    >
                      <svg
                        className={`w-6 h-6 ${post.isLiked ? 'fill-green-600 text-green-600' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span className="text-base font-medium">{post.likesCount}</span>
                    </button>
                    <button
                      onClick={() => setShowComments({ ...showComments, [post._id]: !showComments[post._id] })}
                      className="flex items-center gap-2 text-gray-600 hover:text-green-600 transition"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span className="text-base font-medium">{post.commentsCount}</span>
                    </button>
                    <button
                      onClick={() => sharePost(post._id)}
                      className="flex items-center gap-2 text-gray-600 hover:text-green-600 transition"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <span className="text-base font-medium">{post.sharesCount}</span>
                    </button>
                  </div>

                  {showComments[post._id] && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={commentInputs[post._id] || ''}
                          onChange={(e) => setCommentInputs({ ...commentInputs, [post._id]: e.target.value })}
                          placeholder="Write a comment..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                          onKeyPress={(e) => e.key === 'Enter' && addComment(post._id)}
                        />
                        <button
                          onClick={() => addComment(post._id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 font-medium"
                        >
                          Post
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {post.comments.map((comment) => (
                          <div key={comment._id} className="pl-2">
                            <div className="flex gap-2">
                              <img
                                src={comment.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.name)}&background=f39c12&color=fff`}
                                alt={comment.user.name}
                                className="w-10 h-10 rounded-full shrink-0"
                              />
                              <div className="flex-1">
                                <div className="bg-gray-100 rounded-lg px-4 py-3">
                                  <p className="font-semibold text-base">{comment.user.name}</p>
                                  <p className="text-base mt-1">{comment.content}</p>
                                </div>
                                <div className="flex items-center gap-4 mt-1 px-2">
                                  <button 
                                    onClick={() => toggleCommentLike(post._id, comment._id)}
                                    className={`text-xs hover:text-green-600 ${comment.isLiked ? 'text-green-600 font-semibold' : 'text-gray-500'}`}
                                  >
                                    {comment.isLiked ? '❤️' : '🤍'} Like ({comment.likesCount})
                                  </button>
                                  <button
                                    onClick={() => setShowReplies({ ...showReplies, [comment._id]: !showReplies[comment._id] })}
                                    className="text-xs text-gray-500 hover:text-green-600"
                                  >
                                    Reply ({comment.replies.length})
                                  </button>
                                  <span className="text-xs text-gray-400">{formatTime(comment.createdAt)}</span>
                                </div>

                                {showReplies[comment._id] && (
                                  <div className="mt-2 ml-4 space-y-2">
                                    {comment.replies.map((reply) => (
                                      <div key={reply._id} className="flex gap-2">
                                        <img
                                          src={reply.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.user.name)}&background=f39c12&color=fff`}
                                          alt={reply.user.name}
                                          className="w-6 h-6 rounded-full shrink-0"
                                        />
                                        <div className="flex-1">
                                          <div className="bg-gray-100 rounded-lg px-3 py-2">
                                            <p className="font-semibold text-xs">{reply.user.name}</p>
                                            <p className="text-sm">{reply.content}</p>
                                          </div>
                                          <span className="text-xs text-gray-400 px-2">{formatTime(reply.createdAt)}</span>
                                        </div>
                                      </div>
                                    ))}

                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={replyInputs[comment._id] || ''}
                                        onChange={(e) => setReplyInputs({ ...replyInputs, [comment._id]: e.target.value })}
                                        placeholder="Write a reply..."
                                        className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                        onKeyPress={(e) => e.key === 'Enter' && addReply(post._id, comment._id)}
                                      />
                                      <button
                                        onClick={() => addReply(post._id, comment._id)}
                                        className="px-3 py-1 text-sm bg-green-600 text-white rounded-full hover:bg-green-700"
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Right Sidebar - Suggestions & Events (Hidden on mobile, shown on tablet+) */}
          <div className="hidden md:block w-80 shrink-0">
            <div className="space-y-6 sticky top-24">
              {/* Suggested Friends */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Suggested Friends</h3>
                  <Link href="/friends/search" className="text-xs text-green-600 hover:underline">
                    See all
                  </Link>
                </div>
                {suggestedFriends.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No suggestions yet</p>
                ) : (
                  <div className="space-y-3">
                    {suggestedFriends.slice(0, 5).map((friend) => (
                      <div key={friend._id} className="flex items-center gap-3">
                        <img
                          src={friend.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.name)}&background=f39c12&color=fff`}
                          alt={friend.name}
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{friend.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {friend.mutualFriends > 0 
                              ? `${friend.mutualFriends} mutual friend${friend.mutualFriends > 1 ? 's' : ''}`
                              : friend.city || 'Nearby'}
                          </p>
                        </div>
                        <Link
                          href="/friends/search"
                          className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                          Add
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Events */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Upcoming Events</h3>
                  <Link href="/events" className="text-xs text-green-600 hover:underline">
                    See all
                  </Link>
                </div>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No upcoming events</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingEvents.slice(0, 4).map((event) => (
                      <Link
                        key={event._id}
                        href={`/events/${event._id}`}
                        className="block p-3 rounded-lg hover:bg-gray-50 transition border border-gray-100"
                      >
                        <div className="flex gap-3">
                          <div className="shrink-0 w-12 h-12 bg-green-100 rounded-lg flex flex-col items-center justify-center">
                            <span className="text-xs text-green-700 font-bold">
                              {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                            </span>
                            <span className="text-lg font-bold text-green-600">
                              {new Date(event.eventDate).getDate()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">{event.title}</h4>
                            <p className="text-xs text-gray-500 truncate">{event.description}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{event.pincode}</span>
                              <span className="mx-1">•</span>
                              <span>{formatEventDate(event.eventDate)}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}