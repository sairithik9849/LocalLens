// src/models/Conversation.js
import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [MessageSchema],
  lastMessage: {
    type: String,
    default: null
  },
  lastMessageTime: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for finding conversations by participants
ConversationSchema.index({ participants: 1 });

// Index for sorting by recent activity
ConversationSchema.index({ lastMessageTime: -1 });

export default mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);