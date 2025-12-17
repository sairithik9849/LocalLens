// src/app/friends/search/page.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/firebase/AuthContext';
import { useCheckBanned } from '@/hooks/useCheckBanned';
import Navigation from '@/app/components/Navigation';

export default function FriendsSearchPage() {
  const { user } = useAuth();
  const { checkingBanned } = useCheckBanned();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const [notification, setNotification] = useState({ type: '', message: '' });

  // Fetch friend requests on mount
  useEffect(() => {
    if (checkingBanned) {
      return;
    }

    if (user) {
      fetchFriendRequests();
    }
  }, [user, checkingBanned]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: '', message: '' }), 5000);
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await fetch('/api/friends/request', {
        headers: {
          'user-id': user.uid
        }
      });
      const data = await response.json();
      setFriendRequests(data.requests || []);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'user-id': user.uid
        }
      });
      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (recipientId) => {
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({ recipientId })
      });

      if (response.ok) {
        // Update UI to show request sent
        setSearchResults(searchResults.map(u => 
          u._id === recipientId ? { ...u, requestSent: true } : u
        ));
        showNotification('success', 'Friend request sent!');
      } else {
        const error = await response.json();
        showNotification('error', error.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      showNotification('error', 'Failed to send friend request');
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      const response = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({ requestId })
      });

      if (response.ok) {
        setFriendRequests(friendRequests.filter(req => req._id !== requestId));
        showNotification('success', 'Friend request accepted!');
      } else {
        showNotification('error', 'Failed to accept friend request');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      showNotification('error', 'Failed to accept friend request');
    }
  };

  const declineRequest = async (requestId) => {
    try {
      const response = await fetch('/api/friends/decline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({ requestId })
      });

      if (response.ok) {
        setFriendRequests(friendRequests.filter(req => req._id !== requestId));
        showNotification('success', 'Friend request declined');
      } else {
        showNotification('error', 'Failed to decline friend request');
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      showNotification('error', 'Failed to decline friend request');
    }
  };

  if (!user) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Please log in to search for friends.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50">
        {/* Notification Toast */}
        {notification.message && (
          <div className="fixed top-20 right-6 z-50 animate-fade-in">
            <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
              notification.type === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
            }`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {notification.type === 'success' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <span className="font-medium">{notification.message}</span>
              <button
                onClick={() => setNotification({ type: '', message: '' })}
                className="ml-2 hover:opacity-80"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">Friends</h1>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('search')}
              className={`pb-3 px-4 font-medium transition ${
                activeTab === 'search'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Find Friends
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`pb-3 px-4 font-medium transition relative ${
                activeTab === 'requests'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Requests
              {friendRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {friendRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Tab */}
          {activeTab === 'search' && (
            <>
              {/* Search Form */}
              <form onSubmit={handleSearch} className="mb-8">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold mb-4">Search Results ({searchResults.length})</h2>
                  {searchResults.map((foundUser) => (
                    <div
                      key={foundUser._id}
                      className="flex items-center justify-between p-4 bg-white rounded-lg shadow hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={foundUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(foundUser.name)}&background=f39c12&color=fff`}
                          alt={foundUser.name}
                          className="w-14 h-14 rounded-full"
                        />
                        <div>
                          <h3 className="font-semibold text-lg">{foundUser.name}</h3>
                          <p className="text-sm text-gray-600">{foundUser.email}</p>
                        </div>
                      </div>
                      {foundUser.isAlreadyFriend ? (
                        <span className="px-5 py-2 bg-gray-200 text-gray-600 rounded-lg font-medium">
                          ✓ Friends
                        </span>
                      ) : foundUser.requestSent ? (
                        <span className="px-5 py-2 bg-gray-300 text-gray-600 rounded-lg font-medium">
                          ✓ Request Sent
                        </span>
                      ) : (
                        <button
                          onClick={() => sendFriendRequest(foundUser._id)}
                          className="btn-primary px-5 py-2 rounded-lg"
                        >
                          + Add Friend
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !loading && (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="mt-4 text-gray-600">No users found matching "{searchQuery}"</p>
                </div>
              )}

              {!searchQuery && searchResults.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg">
                  <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="mt-4 text-gray-600 font-medium">Search for friends by name or email</p>
                  <p className="mt-2 text-sm text-gray-500">Start typing to find people you know</p>
                </div>
              )}
            </>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Pending Friend Requests</h2>
              {friendRequests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg">
                  <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="mt-4 text-gray-600 font-medium">No pending friend requests</p>
                  <p className="mt-2 text-sm text-gray-500">When someone sends you a friend request, it will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friendRequests.map((request) => (
                    <div
                      key={request._id}
                      className="flex items-center justify-between p-4 bg-white rounded-lg shadow hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={request.sender.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.sender.name)}&background=f39c12&color=fff`}
                          alt={request.sender.name}
                          className="w-14 h-14 rounded-full"
                        />
                        <div>
                          <h3 className="font-semibold text-lg">{request.sender.name}</h3>
                          <p className="text-sm text-gray-600">{request.sender.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => acceptRequest(request._id)}
                          className="btn-primary px-5 py-2 rounded-lg"
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => declineRequest(request._id)}
                          className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}