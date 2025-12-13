// src/app/friends/chat/page.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/firebase/AuthContext';
import Navigation from '@/app/components/Navigation';

export default function ChatPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearedUnreadFor, setClearedUnreadFor] = useState(null);
  const messagesEndRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const friendsPollingRef = useRef(null);

  // Fetch friends list on mount
  useEffect(() => {
    if (user) {
      fetchFriends();
      
      // Always poll friends list every 2 seconds to show new messages
      friendsPollingRef.current = setInterval(() => {
        fetchFriends();
      }, 2000);
    }

    return () => {
      if (friendsPollingRef.current) {
        clearInterval(friendsPollingRef.current);
      }
    };
  }, [user]);

  // Poll for messages when friend is selected
  useEffect(() => {
    if (selectedFriend && user) {
      // Mark this friend as having cleared unread
      setClearedUnreadFor(selectedFriend._id);

      // Immediately clear unread count for this friend
      setFriends(prevFriends => 
        prevFriends.map(f => 
          f._id === selectedFriend._id 
            ? { ...f, unreadCount: 0 } 
            : f
        )
      );

      // Fetch messages (this will mark them as read in DB)
      fetchMessages(selectedFriend._id);
      
      // Set up polling for messages every 2 seconds
      pollingIntervalRef.current = setInterval(() => {
        fetchMessages(selectedFriend._id);
      }, 2000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [selectedFriend, user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchFriends = async () => {
    try {
      const response = await fetch('/api/friends', {
        headers: {
          'user-id': user.uid
        }
      });
      const data = await response.json();
      
      // Apply the cleared unread status if we have one
      const updatedFriends = data.friends.map(f => {
        // If this is the currently selected friend, keep unread count at 0
        if (clearedUnreadFor && f._id === clearedUnreadFor) {
          return { ...f, unreadCount: 0 };
        }
        return f;
      });
      
      setFriends(updatedFriends || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching friends:', error);
      setLoading(false);
    }
  };

  const fetchMessages = async (friendId) => {
    try {
      const response = await fetch(`/api/messages?friendId=${friendId}`, {
        headers: {
          'user-id': user.uid
        }
      });
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend) return;

    const tempMessage = {
      id: Date.now(),
      senderId: user.uid,
      recipientId: selectedFriend._id,
      content: newMessage,
      createdAt: new Date().toISOString(),
      isSent: true
    };

    // Optimistically add message to UI
    setMessages([...messages, tempMessage]);
    const messageContent = newMessage;
    setNewMessage('');

    // Optimistically update friends list
    setFriends(prevFriends =>
      prevFriends.map(f =>
        f._id === selectedFriend._id
          ? { ...f, lastMessage: messageContent, lastMessageTime: new Date().toISOString() }
          : f
      )
    );

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({
          recipientId: selectedFriend._id,
          content: messageContent
        })
      });

      if (!response.ok) {
        console.error('Failed to send message');
        // Remove optimistic message on failure
        setMessages(messages.filter(m => m.id !== tempMessage.id));
      } else {
        // Refresh messages and friends list
        await fetchMessages(selectedFriend._id);
        await fetchFriends();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(messages.filter(m => m.id !== tempMessage.id));
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatLastMessageTime = (dateString) => {
    if (!dateString) return '';
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

  const handleSelectFriend = (friend) => {
    setSelectedFriend(friend);
    // Reset cleared status when switching friends
    if (clearedUnreadFor !== friend._id) {
      setClearedUnreadFor(null);
    }
  };

  if (!user) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Please log in to view messages.</p>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Navigation />
      
      {/* Chat Container */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Friends List Sidebar */}
        <div className="w-80 bg-base-100 border-r border-base-300 flex flex-col">
          <div className="p-4 border-b border-base-300 bg-base-200">
            <h2 className="text-xl font-bold text-base-content">Messages</h2>
            <p className="text-sm text-base-content/70 mt-1">
              {loading ? 'Loading...' : `${friends.length} conversation${friends.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : friends.length === 0 ? (
              <div className="p-6 text-center text-base-content/70">
                <p>No friends yet</p>
                <Link href="/friends/search" className="link link-primary text-sm mt-2 block">
                  Find friends to chat with
                </Link>
              </div>
            ) : (
              friends.map((friend) => (
                <button
                  key={friend._id}
                  onClick={() => handleSelectFriend(friend)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-base-200 transition border-b border-base-300 ${
                    selectedFriend?._id === friend._id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={friend.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.name)}&background=f39c12&color=fff`}
                      alt={friend.name}
                      className="w-12 h-12 rounded-full"
                    />
                    {/* Unread count badge */}
                    {friend.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 badge badge-error badge-sm">
                        {friend.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className={`font-semibold truncate ${friend.unreadCount > 0 ? 'text-primary' : 'text-base-content'}`}>
                        {friend.name}
                      </h3>
                      {friend.lastMessageTime && (
                        <span className="text-xs text-base-content/60 ml-2 flex-shrink-0">
                          {formatLastMessageTime(friend.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm truncate ${friend.unreadCount > 0 ? 'font-semibold text-base-content' : 'text-base-content/70'}`}>
                      {friend.lastMessage || 'No messages yet'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedFriend ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-base-100 border-b border-base-300 flex items-center gap-3 shadow-sm">
                <div className="relative">
                  <img
                    src={selectedFriend.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedFriend.name)}&background=f39c12&color=fff`}
                    alt={selectedFriend.name}
                    className="w-12 h-12 rounded-full"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-base-content">{selectedFriend.name}</h3>
                  <p className="text-sm text-base-content/70">{selectedFriend.email}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 bg-base-200">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-base-content/70">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isSent = message.senderId === user.uid;
                    const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
                    
                    return (
                      <div
                        key={message.id || index}
                        className={`mb-4 flex ${isSent ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-2 max-w-md ${isSent ? 'flex-row-reverse' : ''}`}>
                          {!isSent && showAvatar && (
                            <img
                              src={selectedFriend.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedFriend.name)}&background=f39c12&color=fff`}
                              alt={selectedFriend.name}
                              className="w-8 h-8 rounded-full flex-shrink-0"
                            />
                          )}
                          {!isSent && !showAvatar && (
                            <div className="w-8 flex-shrink-0"></div>
                          )}
                          <div>
                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                isSent
                                  ? 'bg-primary text-primary-content rounded-br-md'
                                  : 'bg-base-100 text-base-content shadow-sm rounded-bl-md'
                              }`}
                            >
                              <p className="break-words">{message.content}</p>
                            </div>
                            <p className={`text-xs mt-1 px-2 text-base-content/60 ${
                              isSent ? 'text-right' : ''
                            }`}>
                              {formatTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={sendMessage} className="p-4 bg-base-100 border-t border-base-300">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="input input-bordered flex-1 rounded-full"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="btn btn-primary rounded-full disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-base-200">
              <div className="text-center">
                <svg
                  className="mx-auto h-20 w-20 text-base-content/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-base-content">No chat selected</h3>
                <p className="mt-2 text-sm text-base-content/70">
                  Choose a friend from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
