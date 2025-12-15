// src/app/api/map/preferences/route.js
import { NextResponse } from 'next/server';
import { verifyToken } from '@/firebase/verifyToken';
import { getRedisClient } from '@/lib/redis';

const PREFERENCES_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getPreferencesKey(uid) {
  return `map:filters:${uid}`;
}

// GET - fetch saved map filter preferences for current user
export async function GET(request) {
  try {
    let decodedToken = null;
    try {
      decodedToken = await verifyToken(request);
    } catch (authError) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    const uid = decodedToken?.uid;
    if (!uid) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing user ID' },
        { status: 401 }
      );
    }

    const client = await getRedisClient();
    if (!client) {
      // Redis unavailable, just return no preferences
      return NextResponse.json({ success: true, filters: null });
    }

    const key = getPreferencesKey(uid);
    const cached = await client.get(key);

    if (!cached) {
      return NextResponse.json({ success: true, filters: null });
    }

    const parsed = JSON.parse(cached);
    const filters = parsed.filters || null;

    return NextResponse.json({ success: true, filters });
  } catch (error) {
    console.error('[Map Preferences] Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch map preferences', message: error.message },
      { status: 500 }
    );
  }
}

// POST - save map filter preferences for current user
export async function POST(request) {
  try {
    let decodedToken = null;
    try {
      decodedToken = await verifyToken(request);
    } catch (authError) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    const uid = decodedToken?.uid;
    if (!uid) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing user ID' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const filters = body.filters;

    if (!filters || typeof filters !== 'object') {
      return NextResponse.json(
        { error: 'Invalid filters payload' },
        { status: 400 }
      );
    }

    const client = await getRedisClient();
    if (!client) {
      // Redis unavailable, but don't fail the request
      return NextResponse.json({ success: false, warning: 'Redis unavailable, preferences not persisted' });
    }

    const key = getPreferencesKey(uid);
    const value = JSON.stringify({
      filters,
      cachedAt: Math.floor(Date.now() / 1000),
    });

    await client.setEx(key, PREFERENCES_TTL_SECONDS, value);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Map Preferences] Error saving preferences:', error);
    return NextResponse.json(
      { error: 'Failed to save map preferences', message: error.message },
      { status: 500 }
    );
  }
}


