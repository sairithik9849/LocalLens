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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
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
              throw new Error('Firebase configuration is incomplete. Please check your Gist or .env.local file.');
            }

            // Initialize Firebase
            const app = initializeApp(config);
            currentAuth = getAuth(app);
          }
        }

        if (!currentAuth) {
          throw new Error('Failed to initialize Firebase auth. Please check your Gist or .env.local file.');
        }

        setAuthInstance(currentAuth);

        // Set up auth state listener
        const unsubscribe = onAuthStateChanged(currentAuth, (user) => {
          setUser(user);
          setLoading(false);
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
    await signInWithEmailAndPassword(currentAuth, email, password);
  };

  const signup = async (email, password) => {
    const currentAuth = getAuthInstance();
    await createUserWithEmailAndPassword(currentAuth, email, password);
  };

  const logout = async () => {
    const currentAuth = getAuthInstance();
    await signOut(currentAuth);
  };

  const signInWithGoogle = async () => {
    const currentAuth = getAuthInstance();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(currentAuth, provider);
  };

  const resetPassword = async (email) => {
    const currentAuth = getAuthInstance();
    // Configure where users should be redirected after resetting password
    const actionCodeSettings = {
      url: typeof window !== 'undefined' 
        ? `${window.location.origin}/reset-password`
        : 'http://localhost:3000/reset-password',
      handleCodeInApp: true, // Set to true to handle in our custom page
    };
    await sendPasswordResetEmail(currentAuth, email, actionCodeSettings);
  };

  const confirmPasswordResetWithCode = async (oobCode, newPassword) => {
    const currentAuth = getAuthInstance();
    await confirmPasswordReset(currentAuth, oobCode, newPassword);
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    signInWithGoogle,
    resetPassword,
    confirmPasswordResetWithCode,
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

