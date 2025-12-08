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
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={{ background: "transparent" }}
    >
      {/* Background matching homepage */}
      <div
        className="fixed inset-0 w-full h-full"
        style={{
          backgroundImage: `url('https://plus.unsplash.com/premium_photo-1714051660720-888e8454a021?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bmV3JTIweW9ya3xlbnwwfHwwfHx8MA%3D%3D')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
          zIndex: -2,
        }}
      />
      <div
        className="fixed inset-0 w-full h-full"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.3) 30%, rgba(0, 0, 0, 0.25) 60%, rgba(0, 0, 0, 0.2) 100%)",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />

      <div className="w-full max-w-md mx-auto px-4 z-10">
        <div
          className="card shadow-2xl backdrop-blur-lg border border-red-500/50"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.85)" }}
        >
          <div className="card-body p-6 text-center">
            {/* Error Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500/50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-red-400"
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
            <h1 className="text-3xl font-bold text-red-400 mb-2">
              Account Banned
            </h1>

            {/* Message */}
            <p className="text-white/80 mb-6">
              Your account has been banned and you no longer have access to LocalLens.
            </p>

            <p className="text-white/60 text-sm mb-6">
              If you believe this is an error, please contact support.
            </p>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="btn w-full text-white border-2 border-red-500/50 bg-red-500/20 hover:bg-red-500/30 hover:border-red-400 font-semibold"
            >
              Sign Out
            </button>

            {/* Back to Home */}
            <div className="mt-4">
              <Link
                href="/"
                className="btn btn-ghost btn-sm text-white/70 hover:text-white hover:bg-slate-700/50"
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

