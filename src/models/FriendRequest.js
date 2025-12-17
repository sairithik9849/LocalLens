// src/models/FriendRequest.js
import mongoose from 'mongoose';

const FriendRequestSchema = new mongoose.Schema({
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  respondedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate requests
FriendRequestSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

// Index for querying pending requests
FriendRequestSchema.index({ toUser: 1, status: 1 });

export default mongoose.models.FriendRequest || mongoose.model('FriendRequest', FriendRequestSchema);