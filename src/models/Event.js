// src/models/Event.js
import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  eventDate: {
    type: Date,
    required: true,
    index: true
  },
  location: {
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    }
  },
  pincode: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Geospatial index for efficient map queries
EventSchema.index({ 'location.lat': 1, 'location.lng': 1 });

// Compound index for querying events by pincode and date
EventSchema.index({ pincode: 1, eventDate: 1 });

// Index for querying by creator
EventSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.models.Event || mongoose.model('Event', EventSchema);
