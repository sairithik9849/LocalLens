"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase/AuthContext";
import { isProfileComplete } from "@/lib/userProfileCheck.js";
import Navigation from "@/app/components/Navigation";

export default function DashboardPage() {
  const { user, userProfile, loading, logout } = useAuth();
  const router = useRouter();
  const [checkingProfile, setCheckingProfile] = useState(true);
  // Use userProfile from AuthContext directly - it's reactive and updates automatically

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    // Check profile completeness once user is loaded
    // Always fetch fresh profile data to avoid stale state
    if (user && !loading) {
      const checkProfile = async () => {
        try {
          // Get Firebase ID token for authentication
          const { auth } = await import('@/firebase/config');
          const { getAuth } = await import('firebase/auth');
          const currentAuth = auth || getAuth();
          const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

          const headers = {};
          if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
          }

          const response = await fetch(`/api/users/profile?uid=${encodeURIComponent(user.uid)}`, {
            headers: headers
          });
          
          if (response.ok) {
            let data = {};
            try {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                data = await response.json();
              } else {
                throw new Error('Invalid response format');
              }
            } catch (parseError) {
              console.error('Error parsing profile response:', parseError);
              router.replace("/setup");
              return;
            }
            
            // Check if user is banned
            if (data.user?.moderation?.banned === true) {
              // Redirect to a banned page or show error
              router.replace("/banned");
              return;
            }
            
            const { isComplete, missingFields } = isProfileComplete(data.user);
            
            if (!isComplete) {
              router.replace("/setup");
              return;
            }
          } else {
            let errorData = {};
            try {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                errorData = await response.json();
              } else {
                errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
              }
            } catch (parseError) {
              console.error('Error parsing error response:', parseError);
              errorData = { error: `HTTP ${response.status}: Failed to fetch profile` };
            }
            console.error('Dashboard: Profile fetch failed:', errorData);
            // If profile fetch fails, redirect to setup
            router.replace("/setup");
            return;
          }
        } catch (error) {
          console.error('Dashboard: Error checking profile:', error);
          // On error, redirect to setup to be safe
          router.replace("/setup");
          return;
        } finally {
          setCheckingProfile(false);
        }
      };
      checkProfile();
    }
  }, [user, loading, router]); // Removed userProfile from dependencies to avoid infinite loops


  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-base-200 animate-page-transition">
      <Navigation />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Card */}
          <div className="card shadow-xl bg-base-100 border border-base-300 mb-8">
            <div className="card-body">
              <div className="flex items-center gap-4 mb-4">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt="Profile"
                    className="w-16 h-16 rounded-full border-2 border-primary shadow-lg object-cover"
                  />
                ) : (
                  <div className="bg-primary text-primary-content rounded-full w-16 h-16 shadow-lg border-2 border-primary flex items-center justify-center">
                    <span className="text-2xl font-bold">
                      {userProfile?.firstName?.[0]?.toUpperCase() || userProfile?.lastName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-base-content">
                    Welcome to LocalLens
                  </h1>
                  <p className="text-base-content/70 mt-1">
                    Your neighborhood intelligence dashboard
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User Info Card */}
          <div className="card shadow-xl bg-base-100 border border-base-300 mb-8">
            <div className="card-body">
              <h2 className="card-title text-base-content mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Account Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-base-content/60 text-sm">Email</p>
                  <p className="text-base-content font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-base-content/60 text-sm">User ID</p>
                  <p className="text-base-content font-mono text-xs break-all">
                    {user.uid}
                  </p>
                </div>
                <div>
                  <p className="text-base-content/60 text-sm">Account Created</p>
                  <p className="text-base-content font-medium">
                    {user.metadata.creationTime
                      ? new Date(
                          user.metadata.creationTime
                        ).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow">
              <div className="card-body">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <h3 className="card-title text-base-content text-lg">
                  Interactive Maps
                </h3>
                <p className="text-base-content/70 text-sm">
                  Explore neighborhoods with dynamic heatmaps
                </p>
              </div>
            </div>

            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow">
              <div className="card-body">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="card-title text-base-content text-lg">
                  Data Analytics
                </h3>
                <p className="text-base-content/70 text-sm">
                  Track trends and analyze historical data
                </p>
              </div>
            </div>

            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow">
              <div className="card-body">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="card-title text-base-content text-lg">Community</h3>
                <p className="text-base-content/70 text-sm">
                  Connect with your neighborhood
                </p>
              </div>
            </div>

            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow">
              <div className="card-body">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="card-title text-base-content text-lg">
                  Real-Time Updates
                </h3>
                <p className="text-base-content/70 text-sm">
                  Stay informed with instant notifications
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
