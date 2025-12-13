"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/AuthContext";

export default function BannedPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user logs out or is not authenticated, redirect to login
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

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

