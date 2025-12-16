"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/AuthContext";

export default function BannedPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [banReason, setBanReason] = useState(null);
  const [loadingReason, setLoadingReason] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    // If user logs out or is not authenticated, redirect to login
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }

    // Continuously check if user is still banned and prevent navigation away
    if (user && !authLoading) {
      const checkBanStatus = async () => {
        try {
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

          // Check if user is banned
          if (response.status === 403) {
            // User is banned - fetch ban reason
            setIsBanned(true);
            try {
              const errorData = await response.json();
              if (errorData.banReason) {
                setBanReason(errorData.banReason);
              }
            } catch (e) {
              // Can't parse error, that's okay
            }
            setLoadingReason(false);
            return;
          }

          if (response.ok) {
            const data = await response.json();
            
            // If user is NOT banned, redirect them away from this page
            if (data.user?.moderation?.banned !== true) {
              setIsBanned(false);
              setLoadingReason(false);
              
              // Check if user is admin and redirect accordingly
              try {
                const adminResponse = await fetch('/api/admin', {
                  headers: { Authorization: `Bearer ${idToken}` },
                });
                if (adminResponse.ok) {
                  const adminData = await adminResponse.json();
                  if (adminData === true) {
                    router.replace("/admin");
                    return;
                  }
                }
              } catch (adminError) {
                console.error('Error checking admin status:', adminError);
              }
              
              // Regular user - redirect to feed
              router.replace("/feed");
              return;
            }
            
            // User is banned - set ban reason
            setIsBanned(true);
            if (data.user?.moderation?.banReason) {
              setBanReason(data.user.moderation.banReason);
            }
            setLoadingReason(false);
            return;
          }

          // If response is not ok and not 403, assume not banned and redirect
          setIsBanned(false);
          setLoadingReason(false);
          router.replace("/feed");
        } catch (error) {
          // If check fails, assume not banned and redirect
          console.error('Error checking ban status:', error);
          setIsBanned(false);
          setLoadingReason(false);
          router.replace("/feed");
        }
      };

      // Check immediately
      checkBanStatus();

      // Set up interval to check every 2 seconds to catch navigation attempts
      // Only continue checking if user is actually banned
      const interval = setInterval(() => {
        // Re-check ban status periodically
        checkBanStatus();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [user, authLoading, router, pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Don't render the banned page if user is not banned (will be redirected)
  if (!authLoading && user && !isBanned && !loadingReason) {
    return null; // Will redirect via useEffect
  }

  // Show loading state while checking ban status
  if (authLoading || loadingReason) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="w-full max-w-md mx-auto px-4">
          <div className="card shadow-2xl bg-base-100 border border-base-300">
            <div className="card-body p-6 text-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="mt-4 text-base-content/70">Checking account status...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="w-full max-w-md mx-auto px-4">
        <div className="card shadow-2xl bg-base-100 border border-error">
          <div className="card-body p-6 text-center">
            {/* Error Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-error/20 flex items-center justify-center border-2 border-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-error"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-error mb-2">
              Account Banned
            </h1>

            {/* Message */}
            <p className="text-base-content/70 mb-6">
              Your account has been banned and you no longer have access to LocalLens.
            </p>

            <p className="text-base-content/60 text-sm mb-6">
              If you believe this is an error, please contact support.
            </p>

            {/* Ban Reason Display */}
            {!loadingReason && banReason && (
              <div className="mb-6 p-4 bg-base-200 rounded-lg">
                <p className="text-base-content/60 text-xs mb-2 font-medium">Ban Reason:</p>
                <p className="text-base-content/80 text-sm">{banReason}</p>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="btn btn-error w-full font-semibold"
            >
              Sign Out
            </button>

            {/* Back to Home */}
            <div className="mt-4">
              <Link
                href="/"
                className="btn btn-ghost btn-sm"
              >
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

