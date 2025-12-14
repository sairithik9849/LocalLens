// src/lib/mongodb.js
import mongoose from 'mongoose';
import {mongoConfig, initializeMongoConfig} from '@/mongoConfig/settings';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, configInitialized: false };
}

async function connectDB() {
  // Initialize mongoConfig from Gist if not already done
  if (!cached.configInitialized) {
    await initializeMongoConfig();
    cached.configInitialized = true;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    let uri = mongoConfig.serverUrl;
    if (!uri) {
      throw new Error('MongoDB URI is not configured. Failed to fetch from Gist. Please ensure Gist is accessible.');
    }

    const dbName = mongoConfig.database || 'locallens-data';

    // Remove any database name from the URI to prevent Mongoose from using it
    // This ensures we always use the dbName option instead of defaulting to "test"
    // Pattern: mongodb://host:port/dbname or mongodb+srv://host/dbname
    // Remove the database name (everything after the last / before ? or end of string)
    const protocolMatch = uri.match(/^(mongodb\+?srv?:\/\/[^\/]+)/);
    if (protocolMatch) {
      const baseUri = protocolMatch[1];
      const queryString = uri.includes('?') ? uri.substring(uri.indexOf('?')) : '';
      uri = baseUri + '/' + queryString;
    }

    const opts = {
      bufferCommands: false,
      dbName: dbName, // Explicitly set database name - this prevents defaulting to "test"
    };

    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      console.log(`✅ MongoDB connected successfully to database: ${dbName}`);
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
