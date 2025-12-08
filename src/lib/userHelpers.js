/**
 * Helper functions for user data management
 */

/**
 * Extracts auth provider IDs from Firebase providerData array
 * @param {Array} providerData - Firebase user providerData array
 * @returns {Array<string>} Array of provider IDs (e.g., ["google.com", "password"])
 */
export function getAuthProvidersFromFirebase(providerData) {
  if (!providerData || !Array.isArray(providerData)) {
    return [];
  }
  
  return providerData.map(provider => provider.providerId).filter(Boolean);
}

/**
 * Extracts firstName and lastName from displayName
 * @param {string|null} displayName - Full display name (e.g., "John Doe" or "Jane Smith")
 * @returns {Object} Object with firstName and lastName
 */
export function extractNameFromDisplayName(displayName) {
  if (!displayName || typeof displayName !== 'string') {
    return { firstName: null, lastName: null };
  }

  const trimmed = displayName.trim();
  if (!trimmed) {
    return { firstName: null, lastName: null };
  }

  const parts = trimmed.split(/\s+/);
  
  if (parts.length === 1) {
    // Only one name provided, treat as firstName
    return { firstName: parts[0], lastName: null };
  } else if (parts.length >= 2) {
    // First part is firstName, rest is lastName (handles middle names)
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return { firstName, lastName };
  }

  return { firstName: null, lastName: null };
}

/**
 * Creates a new user document for MongoDB
 * @param {Object} firebaseUser - Firebase user object
 * @param {string} signupMethod - "google" or "password"
 * @param {string|null} signupIp - Client IP address
 * @param {string} signupSource - "web", "android", or "ios"
 * @returns {Object} User document ready for MongoDB insertion
 */
export function createUserDocument(firebaseUser, signupMethod, signupIp, signupSource) {
  const now = new Date();
  const providerData = firebaseUser.providerData || [];
  const authProviders = getAuthProvidersFromFirebase(providerData);
  
  // Use Firebase metadata timestamps if available, otherwise use current time
  const createdAt = firebaseUser.metadata?.creationTime 
    ? new Date(firebaseUser.metadata.creationTime)
    : now;
  const lastLogin = firebaseUser.metadata?.lastSignInTime
    ? new Date(firebaseUser.metadata.lastSignInTime)
    : now;

  // Extract firstName and lastName from displayName if available
  const { firstName, lastName } = extractNameFromDisplayName(firebaseUser.displayName);

  return {
    firebaseUid: firebaseUser.uid,
    email: firebaseUser.email || null,
    firstName: firstName,
    lastName: lastName,
    photoURL: firebaseUser.photoURL || null,
    authProviders: authProviders.length > 0 ? authProviders : [signupMethod === "google" ? "google.com" : "password"],
    role: "user",
    permissions: ["create:event", "flag:content"],
    profile: {
      bio: null,
      pincode: null,
      city: null,
      favoriteQuote: null,
      private: {
        email: false,
        profileVisibility: "public"
      }
    },
    moderation: {
      banned: false,
      banReason: null,
      notes: [],
      flags: []
    },
    metadata: {
      signUpMethod: signupMethod,
      signupIp: signupIp || null,
      signupSource: signupSource || "web"
    },
    createdAt: createdAt,
    lastLogin: lastLogin,
    updatedAt: now,
    softDeleted: false,
    deletedAt: null
  };
}

/**
 * Updates an existing user document
 * @param {Object} existingUser - Existing user document from MongoDB
 * @param {Object} firebaseUser - Firebase user object
 * @param {string} signupMethod - "google" or "password"
 * @returns {Object} Update object for MongoDB
 */
export function updateUserDocument(existingUser, firebaseUser, signupMethod) {
  const now = new Date();
  const providerData = firebaseUser.providerData || [];
  const newAuthProviders = getAuthProvidersFromFirebase(providerData);
  
  // Merge auth providers - add new ones if not present
  const existingProviders = existingUser.authProviders || [];
  const mergedProviders = [...new Set([...existingProviders, ...newAuthProviders])];
  
  // Get lastLogin from Firebase metadata
  const lastLogin = firebaseUser.metadata?.lastSignInTime
    ? new Date(firebaseUser.metadata.lastSignInTime)
    : now;

  // Build update object - only update fields that might have changed
  const update = {
    $set: {
      lastLogin: lastLogin,
      updatedAt: now,
      authProviders: mergedProviders
    }
  };

  // Update email if changed
  if (firebaseUser.email !== existingUser.email) {
    update.$set.email = firebaseUser.email || null;
  }

  // Extract firstName and lastName from displayName if available
  // Only update if they're currently null (don't overwrite user-set values)
  if (firebaseUser.displayName && (existingUser.firstName === null || existingUser.lastName === null)) {
    const { firstName, lastName } = extractNameFromDisplayName(firebaseUser.displayName);
    // Only update if existing values are null (preserve user-set values)
    if (existingUser.firstName === null && firstName !== null) {
      update.$set.firstName = firstName;
    }
    if (existingUser.lastName === null && lastName !== null) {
      update.$set.lastName = lastName;
    }
  }

  // Update photoURL if changed
  if (firebaseUser.photoURL !== existingUser.photoURL) {
    update.$set.photoURL = firebaseUser.photoURL || null;
  }

  return update;
}

