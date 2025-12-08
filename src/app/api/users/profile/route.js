import { users } from '@/mongoConfig/mongoCollections.js';
import { validatePincode } from '@/lib/pincodeValidation.js';
import { validateNameField, validateCity } from '@/lib/userProfileCheck.js';
import { verifyAuthAndAuthorization } from '@/firebase/verifyToken.js';
import { sanitizeBio, sanitizeQuote } from '@/lib/sanitizeInput.js';

/**
 * GET /api/users/profile
 * Gets user profile by Firebase UID
 * Requires authentication and authorization
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return Response.json(
        { error: 'User ID (uid) is required' },
        { status: 400 }
      );
    }

    // Verify authentication and authorization
    let authResult;
    try {
      authResult = await verifyAuthAndAuthorization(request, uid);
    } catch (authError) {
      console.error('Auth verification error:', authError);
      return Response.json(
        { 
          error: 'Authentication service error. Please check Firebase Admin configuration.',
          details: authError.message 
        },
        { status: 500 }
      );
    }
    
    if (!authResult.authorized) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const usersCollection = await users();
    const user = await usersCollection.findOne({ firebaseUid: uid, softDeleted: false });

    if (!user) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is banned (early check)
    if (user.moderation?.banned === true) {
      return Response.json(
        { error: 'Account is banned' },
        { status: 403 }
      );
    }

    // Remove sensitive fields before returning
    const { _id, ...userData } = user;
    return Response.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return Response.json(
      {
        error: 'Failed to fetch user profile',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/profile
 * Updates user profile fields
 * Requires authentication and authorization
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { uid, firstName, lastName, pincode, city, bio, favoriteQuote } = body;

    if (!uid) {
      return Response.json(
        { error: 'User ID (uid) is required' },
        { status: 400 }
      );
    }

    // Verify authentication and authorization
    let authResult;
    try {
      authResult = await verifyAuthAndAuthorization(request, uid);
    } catch (authError) {
      console.error('Auth verification error:', authError);
      return Response.json(
        { 
          error: 'Authentication service error. Please check Firebase Admin configuration.',
          details: authError.message 
        },
        { status: 500 }
      );
    }
    
    if (!authResult.authorized) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const usersCollection = await users();
    
    // Check if user exists and is not soft-deleted
    const existingUser = await usersCollection.findOne({ firebaseUid: uid, softDeleted: false });
    if (!existingUser) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is banned
    if (existingUser.moderation?.banned === true) {
      return Response.json(
        { error: 'Account is banned' },
        { status: 403 }
      );
    }

    // Build update object
    const update = {
      $set: {
        updatedAt: new Date()
      }
    };

    // Track if any fields are being updated (besides updatedAt)
    let hasUpdates = false;

    // Update firstName if provided
    if (firstName !== undefined) {
      const validation = validateNameField(firstName, 'First name');
      if (!validation.isValid) {
        return Response.json(
          { error: validation.error },
          { status: 400 }
        );
      }
      update.$set.firstName = validation.value;
      hasUpdates = true;
    }

    // Update lastName if provided
    if (lastName !== undefined) {
      const validation = validateNameField(lastName, 'Last name');
      if (!validation.isValid) {
        return Response.json(
          { error: validation.error },
          { status: 400 }
        );
      }
      update.$set.lastName = validation.value;
      hasUpdates = true;
    }

    // Update pincode if provided
    if (pincode !== undefined) {
      const validation = validatePincode(pincode);
      if (!validation.isValid) {
        return Response.json(
          { error: validation.error },
          { status: 400 }
        );
      }
      
      // Use dot notation to update nested profile.pincode
      // Store as string to preserve leading zeros (e.g., "07307")
      const zip5 = validation.formatted.replace(/-/g, '').slice(0, 5);
      update.$set['profile.pincode'] = zip5; // Store as string to preserve leading zeros
      hasUpdates = true;
    }

    // Update city if provided
    if (city !== undefined) {
      // Clean trailing commas before validation
      const cleanedCity = city.replace(/,$/, '').trim();
      const validation = validateCity(cleanedCity);
      if (!validation.isValid) {
        return Response.json(
          { error: validation.error },
          { status: 400 }
        );
      }
      
      // Use dot notation to update nested profile.city
      update.$set['profile.city'] = validation.value;
      hasUpdates = true;
    }

    // Update bio if provided
    if (bio !== undefined) {
      // Bio is optional, but if provided, sanitize and validate length
      if (bio !== null && bio !== '') {
        const sanitizedBio = sanitizeBio(bio);
        if (sanitizedBio.length > 500) {
          return Response.json(
            { error: 'Bio cannot exceed 500 characters' },
            { status: 400 }
          );
        }
        update.$set['profile.bio'] = sanitizedBio || null;
        hasUpdates = true;
      } else {
        update.$set['profile.bio'] = null;
        hasUpdates = true;
      }
    }

    // Update favoriteQuote if provided
    if (favoriteQuote !== undefined) {
      // Favorite quote is optional, but if provided, sanitize and validate length
      if (favoriteQuote !== null && favoriteQuote !== '') {
        const sanitizedQuote = sanitizeQuote(favoriteQuote);
        if (sanitizedQuote.length > 200) {
          return Response.json(
            { error: 'Favorite quote cannot exceed 200 characters' },
            { status: 400 }
          );
        }
        update.$set['profile.favoriteQuote'] = sanitizedQuote || null;
        hasUpdates = true;
      } else {
        update.$set['profile.favoriteQuote'] = null;
        hasUpdates = true;
      }
    }

    // Prevent empty updates (only updatedAt)
    if (!hasUpdates) {
      return Response.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update user document
    await usersCollection.updateOne(
      { firebaseUid: uid },
      update
    );

    // Fetch updated user (exclude soft-deleted)
    const updatedUser = await usersCollection.findOne({ firebaseUid: uid, softDeleted: false });
    if (!updatedUser) {
      return Response.json(
        { error: 'User not found after update' },
        { status: 404 }
      );
    }
    const { _id, ...userData } = updatedUser;

    return Response.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return Response.json(
      {
        error: 'Failed to update user profile',
        message: error.message
      },
      { status: 500 }
    );
  }
}

