// src/app/feed/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/firebase/AuthContext';
import Navigation from '@/app/components/Navigation';

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

  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user]);

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

  const createPost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    setIsPosting(true);
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({
          content: newPostContent
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPosts([data.post, ...posts]);
        setNewPostContent('');
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
        headers: {
          'user-id': user.uid
        }
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

  const deletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'user-id': user.uid
        }
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
        await fetchPosts(); // Refresh to show the shared post
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
        <div className="max-w-2xl mx-auto p-6">
          {/* Create Post */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <form onSubmit={createPost}>
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                rows="3"
              />
              <div className="flex justify-end mt-3">
                <button
                  type="submit"
                  disabled={isPosting || !newPostContent.trim()}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
                >
                  {isPosting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>

          {/* Posts Feed */}
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
                {/* Post Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={post.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user.name)}&background=f39c12&color=fff`}
                      alt={post.user.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <h3 className="font-semibold">{post.user.name}</h3>
                      <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
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

                {/* Post Content */}
                <div className="px-4 pb-3">
                  <p className="whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Post Actions */}
                <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-6">
                  <button
                    onClick={() => toggleLike(post._id)}
                    className="flex items-center gap-2 text-gray-600 hover:text-green-600 transition"
                  >
                    <svg
                      className={`w-5 h-5 ${post.isLiked ? 'fill-green-600 text-green-600' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span>{post.likesCount}</span>
                  </button>
                  <button
                    onClick={() => setShowComments({ ...showComments, [post._id]: !showComments[post._id] })}
                    className="flex items-center gap-2 text-gray-600 hover:text-green-600 transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>{post.commentsCount}</span>
                  </button>
                  <button
                    onClick={() => sharePost(post._id)}
                    className="flex items-center gap-2 text-gray-600 hover:text-green-600 transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span>{post.sharesCount}</span>
                  </button>
                </div>

                {/* Comments Section */}
                {showComments[post._id] && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {/* Add Comment */}
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

                    {/* Comments List */}
                    <div className="mt-4 space-y-3">
                      {post.comments.map((comment) => (
                        <div key={comment._id} className="pl-2">
                          <div className="flex gap-2">
                            <img
                              src={comment.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.name)}&background=f39c12&color=fff`}
                              alt={comment.user.name}
                              className="w-8 h-8 rounded-full flex-shrink-0"
                            />
                            <div className="flex-1">
                              <div className="bg-gray-100 rounded-lg px-3 py-2">
                                <p className="font-semibold text-sm">{comment.user.name}</p>
                                <p className="text-sm">{comment.content}</p>
                              </div>
                              <div className="flex items-center gap-4 mt-1 px-2">
                                <button className="text-xs text-gray-500 hover:text-green-600">
                                  Like ({comment.likesCount})
                                </button>
                                <button
                                  onClick={() => setShowReplies({ ...showReplies, [comment._id]: !showReplies[comment._id] })}
                                  className="text-xs text-gray-500 hover:text-green-600"
                                >
                                  Reply ({comment.replies.length})
                                </button>
                                <span className="text-xs text-gray-400">{formatTime(comment.createdAt)}</span>
                              </div>

                              {/* Replies */}
                              {showReplies[comment._id] && (
                                <div className="mt-2 ml-4 space-y-2">
                                  {comment.replies.map((reply) => (
                                    <div key={reply._id} className="flex gap-2">
                                      <img
                                        src={reply.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.user.name)}&background=f39c12&color=fff`}
                                        alt={reply.user.name}
                                        className="w-6 h-6 rounded-full flex-shrink-0"
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

                                  {/* Add Reply */}
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
      </div>
    </>
  );
}