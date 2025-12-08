"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  confirmPasswordReset,
} from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { auth } from "@/firebase/config";
import { getFirebaseEnv } from "@/firebase/fetchEnvFromGist";

const AuthContext = createContext(undefined);

// Track sync operations to prevent duplicates
const syncInProgress = new Set();
const recentSyncs = new Map(); // Track recent syncs to prevent rapid duplicates

/**
 * Syncs Firebase user data to MongoDB
 * @param {Object} firebaseUser - Firebase user object
 * @param {string} signupMethod - "google" or "password"
 * @param {boolean} skipIfRecent - Skip sync if it happened recently (for onAuthStateChanged)
 */
async function syncUserToMongoDB(firebaseUser, signupMethod, skipIfRecent = false) {
  if (!firebaseUser || !firebaseUser.uid) return;

  const userId = firebaseUser.uid;
  const syncKey = `${userId}-${signupMethod}`;

  // Check if sync is already in progress for this user
  if (syncInProgress.has(syncKey)) {
    return;
  }

  // Check if we synced recently (within last 2 seconds) - prevents duplicate from onAuthStateChanged
  if (skipIfRecent) {
    const lastSync = recentSyncs.get(userId);
    if (lastSync && Date.now() - lastSync < 2000) {
      return;
    }
  }

  syncInProgress.add(syncKey);

  try {
    // Extract Firebase user data
    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      photoURL: firebaseUser.photoURL,
      displayName: firebaseUser.displayName, // Used only for extracting firstName/lastName, not stored
      metadata: {
        creationTime: firebaseUser.metadata?.creationTime,
        lastSignInTime: firebaseUser.metadata?.lastSignInTime,
      },
      providerData: firebaseUser.providerData || [],
    };

    // Get Firebase ID token for authentication
    let idToken = null;
    try {
      idToken = await firebaseUser.getIdToken();
    } catch (tokenError) {
      console.error('Error getting ID token:', tokenError);
    }

    // Call sync API
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch('/api/users/sync', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        firebaseUser: userData,
        signupMethod: signupMethod,
        signupSource: 'web',
      }),
    });

    if (response.ok) {
      // Mark this sync as recent
      recentSyncs.set(userId, Date.now());
      
      // Clean up old entries after 5 seconds
      setTimeout(() => {
        recentSyncs.delete(userId);
      }, 5000);
    } else {
      const error = await response.json();
      console.error('Failed to sync user to MongoDB:', error);
    }
  } catch (error) {
    // Don't block auth flow if sync fails
    console.error('Error syncing user to MongoDB:', error);
  } finally {
    syncInProgress.delete(syncKey);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authInstance, setAuthInstance] = useState(null);

  useEffect(() => {
    // Initialize Firebase and get auth instance
    const initialize = async () => {
      try {
        let currentAuth = auth;

        // If auth is not available (no .env.local), fetch from Gist and initialize
        if (!currentAuth) {
          // Check if Firebase is already initialized
          const apps = getApps();
          if (apps.length > 0) {
            currentAuth = getAuth(apps[0]);
          } else {
            // Fetch config from Gist
            const config = await getFirebaseEnv();

            // Validate config
            if (!config.apiKey || !config.authDomain || !config.projectId) {
              throw new Error(
                "Firebase configuration is incomplete. Please check your Gist or .env.local file."
              );
            }

            // Initialize Firebase
            const app = initializeApp(config);
            currentAuth = getAuth(app);
          }
        }

        if (!currentAuth) {
          throw new Error(
            "Failed to initialize Firebase auth. Please check your Gist or .env.local file."
          );
        }

        setAuthInstance(currentAuth);

        // Set up auth state listener
        const unsubscribe = onAuthStateChanged(currentAuth, async (user) => {
          setUser(user);
          setLoading(false);
          
          // Sync user to MongoDB when auth state changes (handles page refreshes)
          // Skip if recent to avoid duplicate syncs from signup/login methods
          if (user) {
            // Determine signup method from provider data
            const providerData = user.providerData || [];
            const hasGoogle = providerData.some(p => p.providerId === 'google.com');
            const signupMethod = hasGoogle ? 'google' : 'password';
            
            await syncUserToMongoDB(user, signupMethod, true); // skipIfRecent = true
          }
        });

        return () => unsubscribe();
      } catch (error) {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const getAuthInstance = () => {
    return authInstance || auth;
  };

  const login = async (email, password) => {
    const currentAuth = getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(currentAuth, email, password);
    
    // Sync user to MongoDB after successful login
    if (userCredential?.user) {
      await syncUserToMongoDB(userCredential.user, 'password');
    }
  };

  const signup = async (email, password) => {
    const currentAuth = getAuthInstance();
    const userCredential = await createUserWithEmailAndPassword(currentAuth, email, password);
    
    // Sync user to MongoDB after successful signup
    if (userCredential?.user) {
      await syncUserToMongoDB(userCredential.user, 'password');
    }
  };

  const logout = async () => {
    const currentAuth = getAuthInstance();
    await signOut(currentAuth);
  };

  const signInWithGoogle = async () => {
    const currentAuth = getAuthInstance();
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(currentAuth, provider);
    
    // Sync user to MongoDB after successful Google sign-in
    if (userCredential?.user) {
      await syncUserToMongoDB(userCredential.user, 'google');
    }
  };

  const resetPassword = async (email) => {
    const currentAuth = getAuthInstance();
    // Configure where users should be redirected after resetting password
    const actionCodeSettings = {
      url:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : "http://localhost:3000/reset-password",
      handleCodeInApp: true, // Set to true to handle in our custom page
    };
    await sendPasswordResetEmail(currentAuth, email, actionCodeSettings);
  };

  const confirmPasswordResetWithCode = async (oobCode, newPassword) => {
    const currentAuth = getAuthInstance();
    await confirmPasswordReset(currentAuth, oobCode, newPassword);
  };

  const getUserProfile = async (firebaseUid) => {
    if (!firebaseUid) return null;

    try {
      // Get Firebase ID token for authentication
      const currentAuth = getAuthInstance();
      let idToken = null;
      if (currentAuth?.currentUser) {
        idToken = await currentAuth.currentUser.getIdToken();
      }

      const headers = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/users/profile?uid=${encodeURIComponent(firebaseUid)}`, {
        headers: headers
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.user || null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Fetch user profile when user changes
  useEffect(() => {
    if (user?.uid) {
      getUserProfile(user.uid).then(profile => {
        setUserProfile(profile);
      });
    } else {
      setUserProfile(null);
    }
  }, [user]);

  /**
   * Refreshes the user profile from MongoDB
   */
  const refreshUserProfile = async () => {
    if (user?.uid) {
      const profile = await getUserProfile(user.uid);
      setUserProfile(profile);
      return profile;
    }
    return null;
  };

  const value = {
    user,
    userProfile,
    loading,
    login,
    signup,
    logout,
    signInWithGoogle,
    resetPassword,
    confirmPasswordResetWithCode,
    getUserProfile,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
