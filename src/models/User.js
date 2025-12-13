// src/models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  photoURL: {
    type: String,
    default: null
  },
  authProviders: [{
    type: String
  }],
  role: {
    type: String,
    default: 'user'
  },
  permissions: [{
    type: String
  }],
  profile: {
    bio: String,
    pincode: String,
    city: String,
    favoriteQuote: String,
    private: {
      email: { type: Boolean, default: false },
      profileVisibility: { type: String, default: 'public' }
    }
  },
  moderation: {
    banned: { type: Boolean, default: false },
    banReason: String,
    notes: [String],
    flags: [String]
  },
  metadata: {
    signUpMethod: String,
    signupIp: String,
    signupSource: String
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastLogin: {
    type: Date,
    default: Date.now
  },
  softDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'users' // Explicitly set collection name to match native MongoDB driver
});

// Text index for search on firstName, lastName, and email
UserSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

// Virtual for full name
UserSchema.virtual('name').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included in JSON
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);