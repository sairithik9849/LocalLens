"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/AuthContext";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-cyan-400"></span>
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div
      className="min-h-screen relative animate-page-transition"
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

      {/* Navigation */}
      <nav
        className="navbar backdrop-blur-lg shadow-xl sticky top-0 z-50 border-b"
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.7)",
          borderColor: "rgba(34, 211, 238, 0.3)",
        }}
      >
        <div className="container mx-auto px-4 lg:px-8 w-full flex items-center justify-between">
          <div className="flex-1 flex items-center">
            <Link
              href="/"
              className="btn btn-ghost text-xl font-bold hover:scale-105 transition-all duration-300 group"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-7 w-7 mr-2 text-cyan-400 group-hover:text-cyan-300 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </div>
              <span className="bg-linear-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                LocalLens
              </span>
            </Link>
          </div>
          <div className="flex-none flex items-center gap-3 ml-auto">
            <button
              onClick={handleLogout}
              className="btn btn-sm md:btn-md transition-all duration-300 font-medium border-2 border-cyan-400/50 hover:border-cyan-400 hover:bg-cyan-400/10 hover:scale-105 hover:shadow-lg hover:shadow-cyan-400/20 bg-transparent text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Card */}
          <div
            className="card shadow-2xl backdrop-blur-lg border-2 mb-8"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              borderColor: "rgba(34, 211, 238, 0.3)",
            }}
          >
            <div className="card-body">
              <div className="flex items-center gap-4 mb-4">
                <div className="avatar placeholder">
                  <div
                    className="bg-linear-to-br from-cyan-500 via-blue-500 to-purple-600 text-white rounded-full w-16 h-16 shadow-lg border-2"
                    style={{ borderColor: "rgba(34, 211, 238, 0.6)" }}
                  >
                    <span className="text-2xl">
                      {user.email ? user.email.charAt(0).toUpperCase() : "U"}
                    </span>
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-linear-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                    Welcome to LocalLens
                  </h1>
                  <p className="text-white/70 mt-1">
                    Your neighborhood intelligence dashboard
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User Info Card */}
          <div
            className="card shadow-2xl backdrop-blur-lg border-2 mb-8"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              borderColor: "rgba(34, 211, 238, 0.3)",
            }}
          >
            <div className="card-body">
              <h2 className="card-title text-white mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-cyan-400"
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
                  <p className="text-white/60 text-sm">Email</p>
                  <p className="text-white font-medium">{user.email}</p>
                </div>
                {user.displayName && (
                  <div>
                    <p className="text-white/60 text-sm">Display Name</p>
                    <p className="text-white font-medium">{user.displayName}</p>
                  </div>
                )}
                <div>
                  <p className="text-white/60 text-sm">User ID</p>
                  <p className="text-white font-mono text-xs break-all">
                    {user.uid}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Account Created</p>
                  <p className="text-white font-medium">
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
            <div
              className="card shadow-xl backdrop-blur-lg border-2 hover-lift"
              style={{
                backgroundColor: "rgba(51, 65, 85, 0.4)",
                borderColor: "rgba(34, 211, 238, 0.5)",
              }}
            >
              <div className="card-body">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-cyan-400"
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
                <h3 className="card-title text-white text-lg">
                  Interactive Maps
                </h3>
                <p className="text-white/80 text-sm">
                  Explore neighborhoods with dynamic heatmaps
                </p>
              </div>
            </div>

            <div
              className="card shadow-xl backdrop-blur-lg border-2 hover-lift"
              style={{
                backgroundColor: "rgba(51, 65, 85, 0.4)",
                borderColor: "rgba(34, 211, 238, 0.5)",
              }}
            >
              <div className="card-body">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-blue-400"
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
                <h3 className="card-title text-white text-lg">
                  Data Analytics
                </h3>
                <p className="text-white/80 text-sm">
                  Track trends and analyze historical data
                </p>
              </div>
            </div>

            <div
              className="card shadow-xl backdrop-blur-lg border-2 hover-lift"
              style={{
                backgroundColor: "rgba(51, 65, 85, 0.4)",
                borderColor: "rgba(34, 211, 238, 0.5)",
              }}
            >
              <div className="card-body">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-purple-400"
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
                <h3 className="card-title text-white text-lg">Community</h3>
                <p className="text-white/80 text-sm">
                  Connect with your neighborhood
                </p>
              </div>
            </div>

            <div
              className="card shadow-xl backdrop-blur-lg border-2 hover-lift"
              style={{
                backgroundColor: "rgba(51, 65, 85, 0.4)",
                borderColor: "rgba(34, 211, 238, 0.5)",
              }}
            >
              <div className="card-body">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-cyan-400"
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
                <h3 className="card-title text-white text-lg">
                  Real-Time Updates
                </h3>
                <p className="text-white/80 text-sm">
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
