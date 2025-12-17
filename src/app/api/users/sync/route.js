import { users } from '@/mongoConfig/mongoCollections.js';
import { createUserDocument, updateUserDocument } from '@/lib/userHelpers.js';
import { verifyToken } from '@/firebase/verifyToken.js';

function getClientIp(request) {
  // Check x-forwarded-for header (for proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0] || null;
  }

  // Check x-real-ip header (alternative proxy header)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // In Next.js, we can't directly access connection.remoteAddress
  // Return null if we can't determine IP
  return null;
}

/**
 * POST /api/users/sync
 * Syncs Firebase user data with MongoDB
 * Requires authentication - user can only sync their own data
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { firebaseUser, signupMethod, signupSource } = body;

    if (!firebaseUser || !firebaseUser.uid) {
      return Response.json(
        { error: 'Firebase user data is required' },
        { status: 400 }
      );
    }

    if (!signupMethod || !['google', 'password'].includes(signupMethod)) {
      return Response.json(
        { error: 'Valid signupMethod is required (google or password)' },
        { status: 400 }
      );
    }

    // Verify authentication - user can only sync their own data
    let decodedToken;
    try {
      decodedToken = await verifyToken(request);
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      return Response.json(
        { 
          error: 'Authentication service error. Please check Firebase Admin configuration.',
          details: verifyError.message 
        },
        { status: 500 }
      );
    }
    
    if (!decodedToken) {
      return Response.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Verify authorization - token UID must match firebaseUser UID
    if (decodedToken.uid !== firebaseUser.uid) {
      return Response.json(
        { error: 'Forbidden: You can only sync your own data' },
        { status: 403 }
      );
    }

    // Extract client IP
    const signupIp = getClientIp(request);

    // Get users collection
    const usersCollection = await users();

    // Check if user already exists (exclude soft-deleted)
    const existingUser = await usersCollection.findOne({
      firebaseUid: firebaseUser.uid,
      softDeleted: false
    });

    if (existingUser) {
      // Check if user is banned - don't allow sync for banned users
      if (existingUser.moderation?.banned === true) {
        return Response.json(
          { error: 'Account is banned' },
          { status: 403 }
        );
      }

      // Update existing user
      const updateDoc = updateUserDocument(existingUser, firebaseUser, signupMethod);
      await usersCollection.updateOne(
        { firebaseUid: firebaseUser.uid },
        updateDoc
      );

      return Response.json({
        success: true,
        action: 'updated',
        firebaseUid: firebaseUser.uid
      });
    } else {
      // Create new user
      // Use try-catch to handle race conditions where another request might have created the user
      const userDoc = createUserDocument(
        firebaseUser,
        signupMethod,
        signupIp,
        signupSource || 'web'
      );

      try {
        await usersCollection.insertOne(userDoc);
        
        return Response.json({
          success: true,
          action: 'created',
          firebaseUid: firebaseUser.uid
        });
      } catch (insertError) {
        // If duplicate key error (E11000) - user was created by another concurrent request
        // MongoDB error code 11000 is for duplicate key
        if (insertError.code === 11000 || insertError.message?.includes('duplicate') || insertError.message?.includes('E11000')) {
          // User was created by another request, fetch it and update instead
          const newlyCreatedUser = await usersCollection.findOne({
            firebaseUid: firebaseUser.uid
          });
          
          if (newlyCreatedUser) {
            const updateDoc = updateUserDocument(newlyCreatedUser, firebaseUser, signupMethod);
            await usersCollection.updateOne(
              { firebaseUid: firebaseUser.uid },
              updateDoc
            );
          }
          
          return Response.json({
            success: true,
            action: 'updated',
            firebaseUid: firebaseUser.uid
          });
        }
        throw insertError; // Re-throw if it's a different error
      }
    }
  } catch (error) {
    console.error('Error syncing user to MongoDB:', error);
    
    // Don't throw errors that would break auth flow
    // Return error response but don't fail the request
    return Response.json(
      {
        error: 'Failed to sync user data',
        message: error.message
      },
      { status: 500 }
    );
  }
}

