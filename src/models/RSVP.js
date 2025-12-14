// src/models/RSVP.js
import mongoose from 'mongoose';

const RSVPSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['going', 'not_going'],
    required: true,
    default: 'going'
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate RSVPs
RSVPSchema.index({ event: 1, user: 1 }, { unique: true });

// Index for querying RSVPs by event
RSVPSchema.index({ event: 1, status: 1 });

// Index for querying user's RSVPs
RSVPSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.RSVP || mongoose.model('RSVP', RSVPSchema);
