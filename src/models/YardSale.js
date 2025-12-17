// src/models/YardSale.js
import mongoose from 'mongoose';

const YardSaleSchema = new mongoose.Schema({
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
  saleDate: {
    type: Date,
    required: true,
    index: true
  },
  saleTime: {
    type: String,
    trim: true
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
  address: {
    type: String,
    required: true,
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    index: true
  },
  contactInfo: {
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    }
  },
  priceRange: {
    type: String,
    trim: true
  },
  images: [{
    type: String  // Base64 encoded images
  }]
}, {
  timestamps: true
});

// Geospatial index for efficient map queries
YardSaleSchema.index({ 'location.lat': 1, 'location.lng': 1 });

// Compound index for querying yard sales by pincode and date
YardSaleSchema.index({ pincode: 1, saleDate: 1 });

// Index for querying by creator
YardSaleSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.models.YardSale || mongoose.model('YardSale', YardSaleSchema);

