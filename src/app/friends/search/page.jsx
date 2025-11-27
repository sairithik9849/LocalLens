// src/app/friends/search/page.jsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

// Static mock data
const MOCK_USERS = [
  { id: 1, name: 'John Doe', email: 'john@example.com', avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff', requestSent: false },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=6366f1&color=fff', requestSent: false },
  { id: 3, name: 'Mike Johnson', email: 'mike@example.com', avatar: 'https://ui-avatars.com/api/?name=Mike+Johnson&background=ec4899&color=fff', requestSent: false },
  { id: 4, name: 'Sarah Williams', email: 'sarah@example.com', avatar: 'https://ui-avatars.com/api/?name=Sarah+Williams&background=8b5cf6&color=fff', requestSent: false },
  { id: 5, name: 'David Brown', email: 'david@example.com', avatar: 'https://ui-avatars.com/api/?name=David+Brown&background=f59e0b&color=fff', requestSent: false },
  { id: 6, name: 'Emma Davis', email: 'emma@example.com', avatar: 'https://ui-avatars.com/api/?name=Emma+Davis&background=10b981&color=fff', requestSent: false },
];

const MOCK_REQUESTS = [
  { 
    id: 1, 
    sender: { 
      id: 7, 
      name: 'Alex Turner', 
      email: 'alex@example.com', 
      avatar: 'https://ui-avatars.com/api/?name=Alex+Turner&background=ef4444&color=fff' 
    },
    createdAt: '2024-11-25T10:30:00'
  },
  { 
    id: 2, 
    sender: { 
      id: 8, 
      name: 'Lisa Anderson', 
      email: 'lisa@example.com', 
      avatar: 'https://ui-avatars.com/api/?name=Lisa+Anderson&background=14b8a6&color=fff' 
    },
    createdAt: '2024-11-26T15:45:00'
  },
];

export default function FriendsSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState(MOCK_REQUESTS);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'requests'

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      const results = MOCK_USERS.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(results);
      setLoading(false);
    }, 500);
  };

  const sendFriendRequest = (userId) => {
    setSearchResults(searchResults.map(user => 
      user.id === userId ? { ...user, requestSent: true } : user
    ));
  };

  const acceptRequest = (requestId) => {
    setFriendRequests(friendRequests.filter(req => req.id !== requestId));
    alert('Friend request accepted!');
  };

  const declineRequest = (requestId) => {
    setFriendRequests(friendRequests.filter(req => req.id !== requestId));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold text-blue-600">
                FriendApp
              </Link>
              <div className="flex gap-4">
                <Link href="/friends/search" className="text-blue-600 font-medium">
                  Find Friends
                </Link>
                <Link href="/friends/chat" className="text-gray-600 hover:text-gray-900">
                  Messages
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Friends</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-3 px-4 font-medium transition ${
              activeTab === 'search'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Find Friends
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-3 px-4 font-medium transition relative ${
              activeTab === 'requests'
                ? 'border-b-2 border-blue-500 text-blue-600'
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
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold mb-4">Search Results ({searchResults.length})</h2>
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-white rounded-lg shadow hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-14 h-14 rounded-full"
                      />
                      <div>
                        <h3 className="font-semibold text-lg">{user.name}</h3>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => sendFriendRequest(user.id)}
                      disabled={user.requestSent}
                      className={`px-5 py-2 rounded-lg font-medium transition ${
                        user.requestSent
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {user.requestSent ? '✓ Request Sent' : '+ Add Friend'}
                    </button>
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
                    key={request.id}
                    className="flex items-center justify-between p-4 bg-white rounded-lg shadow hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={request.sender.avatar}
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
                        onClick={() => acceptRequest(request.id)}
                        className="px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => declineRequest(request.id)}
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
  );
}