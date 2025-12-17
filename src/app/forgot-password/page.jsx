"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/AuthContext";
import { getAuthErrorMessage } from "@/firebase/authErrors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/feed");
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      // Handle Google-only accounts
      if (
        err.code === "auth/operation-not-allowed" ||
        err.code === "auth/user-not-found"
      ) {
        // For security, show success even if account doesn't exist or uses Google
        setSuccess(true);
      } else if (err.code === "auth/invalid-email") {
        setError(getAuthErrorMessage(err));
      } else {
        // For other errors, show the error message
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="w-full max-w-md mx-auto px-4 py-8">
        <div className="card shadow-2xl bg-base-100 border border-base-300">
          <div className="card-body p-6">
            {/* Logo and Title */}
            <div className="text-center mb-6">
              <div className="flex flex-col items-center mb-4">
                <Link
                  href="/"
                  className="mb-3"
                  aria-label="Go to LocalLens homepage"
                >
                  <div
                    className="w-16 h-16 rounded-full bg-linear-to-br from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center shadow-2xl mx-auto transition-transform hover:scale-105"
                    style={{
                      boxShadow:
                        "0 0 40px rgba(34, 211, 238, 0.5), 0 0 60px rgba(147, 51, 234, 0.3)",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
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
                </Link>
                <h1 className="text-4xl font-bold mb-2 text-base-content">
                  Reset Password
                </h1>
              </div>
              <p className="text-base-content/70 text-sm leading-relaxed px-2">
                {success
                  ? "Check your email for password reset instructions"
                  : "Enter your email address and we'll send you a link to reset your password"}
              </p>
            </div>

            {/* Success Message */}
            {success && (
              <div className="alert alert-success mb-4 border-green-500/30 bg-green-500/10 backdrop-blur-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-green-300">
                    Email sent successfully!
                  </span>
                  <span className="text-xs text-green-400/80">
                    If an account exists with this email and uses email/password
                    authentication, you will receive a password reset link
                    shortly. If you signed up with Google, please use the "Sign
                    in with Google" option instead.
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="alert alert-error mb-4 border-red-500/30 bg-red-500/10 backdrop-blur-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm text-red-300">{error}</span>
              </div>
            )}

            {/* Email Form */}
            {!success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-control">
                  <label htmlFor="reset-email" className="label pb-1.5">
                    <span className="label-text font-medium">
                      Email
                    </span>
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    className="input input-bordered w-full transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full font-semibold hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      Send Reset Link
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Back to Login */}
            <div className="text-center mt-6 pt-4 border-t border-base-300">
              <Link
                href="/login"
                className="btn btn-ghost btn-sm transition-all"
                aria-label="Back to login page"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
