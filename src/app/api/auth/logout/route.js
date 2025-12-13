// src/app/api/auth/logout/route.js
import { NextResponse } from 'next/server';
import { verifyToken } from '@/firebase/verifyToken';
import { deleteCachedToken } from '@/lib/tokenCache';

/**
 * POST /api/auth/logout
 * Invalidates the authentication token cache in Redis
 * Requires valid authentication token in Authorization header
 */
export async function POST(request) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }

    // Try to verify the token (may fail if expired, but that's okay for logout)
    // We still want to invalidate the cache even if the token is expired
    const decodedToken = await verifyToken(request);
    
    // Delete the token from Redis cache regardless of verification status
    // This ensures expired tokens are also removed from cache
    const deleted = await deleteCachedToken(token);
    
    // Return success - logout should always succeed even if token is expired
    // The important thing is that we attempted to invalidate the cache
    return NextResponse.json({
      success: true,
      message: 'Token cache invalidated',
      invalidated: deleted,
      tokenValid: decodedToken !== null
    });
  } catch (error) {
    console.error('Error invalidating token cache:', error);
    // Don't fail logout if cache invalidation fails
    // Return success to allow logout to proceed
    return NextResponse.json({
      success: true,
      message: 'Logout processed (cache invalidation may have failed)',
      error: error.message
    });
  }
}

