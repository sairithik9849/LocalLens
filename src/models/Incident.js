// src/models/Incident.js
import mongoose from 'mongoose';

const IncidentSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  incidentType: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  reportedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  visibility: {
    type: String,
    enum: ['public', 'friends'],
    default: 'public'
  }
}, {
  timestamps: true
});

// Geospatial index for efficient map queries
IncidentSchema.index({ 'location.lat': 1, 'location.lng': 1 });

// Index for querying by reporter
IncidentSchema.index({ reportedBy: 1, createdAt: -1 });

// Index for querying by visibility
IncidentSchema.index({ visibility: 1, createdAt: -1 });

export default mongoose.models.Incident || mongoose.model('Incident', IncidentSchema);

