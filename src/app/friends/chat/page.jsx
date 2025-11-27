// Chat Page (/friends/chat)
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// Static mock data
const MOCK_FRIENDS = [
  { 
    id: 1, 
    name: 'John Doe', 
    avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff', 
    online: true, 
    lastMessage: 'Hey! How are you doing?',
    lastMessageTime: '2024-11-27T10:30:00'
  },
  { 
    id: 2, 
    name: 'Jane Smith', 
    avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=6366f1&color=fff', 
    online: false, 
    lastMessage: 'See you later!',
    lastMessageTime: '2024-11-26T18:45:00'
  },
  { 
    id: 3, 
    name: 'Mike Johnson', 
    avatar: 'https://ui-avatars.com/api/?name=Mike+Johnson&background=ec4899&color=fff', 
    online: true, 
    lastMessage: 'Thanks for your help!',
    lastMessageTime: '2024-11-27T09:15:00'
  },
  { 
    id: 4, 
    name: 'Sarah Williams', 
    avatar: 'https://ui-avatars.com/api/?name=Sarah+Williams&background=8b5cf6&color=fff', 
    online: false, 
    lastMessage: 'Good night! 😊',
    lastMessageTime: '2024-11-25T22:30:00'
  },
  { 
    id: 5, 
    name: 'David Brown', 
    avatar: 'https://ui-avatars.com/api/?name=David+Brown&background=f59e0b&color=fff', 
    online: true, 
    lastMessage: 'Did you see the game?',
    lastMessageTime: '2024-11-27T08:00:00'
  },
];

const MOCK_MESSAGES = {
  1: [
    { id: 1, senderId: 1, content: 'Hey! How are you doing?', createdAt: '2024-11-27T10:25:00', isSent: false },
    { id: 2, senderId: 'currentUser', content: 'Hi John! I\'m doing great, thanks!', createdAt: '2024-11-27T10:26:00', isSent: true },
    { id: 3, senderId: 1, content: 'That\'s awesome! Want to grab lunch later?', createdAt: '2024-11-27T10:27:00', isSent: false },
    { id: 4, senderId: 'currentUser', content: 'Sure! What time works for you?', createdAt: '2024-11-27T10:28:00', isSent: true },
    { id: 5, senderId: 1, content: 'How about 12:30 PM?', createdAt: '2024-11-27T10:30:00', isSent: false },
  ],
  2: [
    { id: 1, senderId: 'currentUser', content: 'Hey Jane, thanks for the notes!', createdAt: '2024-11-26T18:30:00', isSent: true },
    { id: 2, senderId: 2, content: 'No problem! Happy to help 😊', createdAt: '2024-11-26T18:35:00', isSent: false },
    { id: 3, senderId: 'currentUser', content: 'Did you finish the project?', createdAt: '2024-11-26T18:40:00', isSent: true },
    { id: 4, senderId: 2, content: 'Yes! Just submitted it. See you later!', createdAt: '2024-11-26T18:45:00', isSent: false },
  ],
  3: [
    { id: 1, senderId: 3, content: 'Can you help me with the code?', createdAt: '2024-11-27T09:00:00', isSent: false },
    { id: 2, senderId: 'currentUser', content: 'Of course! What do you need?', createdAt: '2024-11-27T09:05:00', isSent: true },
    { id: 3, senderId: 3, content: 'I\'m stuck on the authentication part', createdAt: '2024-11-27T09:07:00', isSent: false },
    { id: 4, senderId: 'currentUser', content: 'Let me take a look and get back to you', createdAt: '2024-11-27T09:10:00', isSent: true },
    { id: 5, senderId: 3, content: 'Thanks for your help!', createdAt: '2024-11-27T09:15:00', isSent: false },
  ],
  4: [
    { id: 1, senderId: 'currentUser', content: 'How was your day?', createdAt: '2024-11-25T21:00:00', isSent: true },
    { id: 2, senderId: 4, content: 'It was great! Very productive', createdAt: '2024-11-25T21:30:00', isSent: false },
    { id: 3, senderId: 4, content: 'How about yours?', createdAt: '2024-11-25T21:31:00', isSent: false },
    { id: 4, senderId: 'currentUser', content: 'Pretty good! Just relaxing now', createdAt: '2024-11-25T22:00:00', isSent: true },
    { id: 5, senderId: 4, content: 'Good night! 😊', createdAt: '2024-11-25T22:30:00', isSent: false },
  ],
  5: [
    { id: 1, senderId: 5, content: 'Did you see the game?', createdAt: '2024-11-27T08:00:00', isSent: false },
    { id: 2, senderId: 'currentUser', content: 'Yes! What an amazing finish!', createdAt: '2024-11-27T08:05:00', isSent: true },
    { id: 3, senderId: 5, content: 'I know right! That last minute goal was incredible', createdAt: '2024-11-27T08:06:00', isSent: false },
  ],
};

export default function ChatPage() {
  const [friends] = useState(MOCK_FRIENDS);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Load messages when friend is selected
  useEffect(() => {
    if (selectedFriend) {
      setMessages(MOCK_MESSAGES[selectedFriend.id] || []);
    }
  }, [selectedFriend]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend) return;

    const message = {
      id: messages.length + 1,
      senderId: 'currentUser',
      content: newMessage,
      createdAt: new Date().toISOString(),
      isSent: true,
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatLastMessageTime = (dateString) => {
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold text-blue-600">
                FriendApp
              </Link>
              <div className="flex gap-4">
                <Link href="/friends/search" className="text-gray-600 hover:text-gray-900">
                  Find Friends
                </Link>
                <Link href="/friends/chat" className="text-blue-600 font-medium">
                  Messages
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Chat Container */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Friends List Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold">Messages</h2>
            <p className="text-sm text-gray-600 mt-1">{friends.length} conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition border-b border-gray-100 ${
                  selectedFriend?.id === friend.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={friend.avatar}
                    alt={friend.name}
                    className="w-12 h-12 rounded-full"
                  />
                  {friend.online && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-semibold truncate">{friend.name}</h3>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {formatLastMessageTime(friend.lastMessageTime)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{friend.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedFriend ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b border-gray-200 flex items-center gap-3 shadow-sm">
                <div className="relative">
                  <img
                    src={selectedFriend.avatar}
                    alt={selectedFriend.name}
                    className="w-12 h-12 rounded-full"
                  />
                  {selectedFriend.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedFriend.name}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedFriend.online ? (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Active now
                      </span>
                    ) : (
                      'Offline'
                    )}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                {messages.map((message, index) => {
                  const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
                  return (
                    <div
                      key={message.id}
                      className={`mb-4 flex ${
                        message.isSent ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div className={`flex gap-2 max-w-md ${message.isSent ? 'flex-row-reverse' : ''}`}>
                        {!message.isSent && showAvatar && (
                          <img
                            src={selectedFriend.avatar}
                            alt={selectedFriend.name}
                            className="w-8 h-8 rounded-full flex-shrink-0"
                          />
                        )}
                        {!message.isSent && !showAvatar && (
                          <div className="w-8 flex-shrink-0"></div>
                        )}
                        <div>
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              message.isSent
                                ? 'bg-blue-500 text-white rounded-br-md'
                                : 'bg-white text-gray-800 shadow-sm rounded-bl-md'
                            }`}
                          >
                            <p className="break-words">{message.content}</p>
                          </div>
                          <p className={`text-xs mt-1 px-2 ${
                            message.isSent ? 'text-right text-gray-500' : 'text-gray-500'
                          }`}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={sendMessage} className="p-4 bg-white border-t border-gray-200">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="px-6 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <svg
                  className="mx-auto h-20 w-20 text-gray-400"
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
                <h3 className="mt-4 text-lg font-medium text-gray-900">No chat selected</h3>
                <p className="mt-2 text-sm text-gray-500">
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