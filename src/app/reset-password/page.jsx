"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/AuthContext";
import { getAuthErrorMessage } from "@/firebase/authErrors";
import {
  validatePassword,
  getPasswordRequirementsMessage,
} from "@/firebase/passwordValidation";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oobCode, setOobCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { confirmPasswordResetWithCode, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Redirect if already logged in
    if (user) {
      router.push("/feed");
      return;
    }

    // Extract oobCode from URL
    const code = searchParams.get("oobCode");
    const mode = searchParams.get("mode");

    if (!code || mode !== "resetPassword") {
      setError(
        "Invalid or expired password reset link. Please request a new one."
      );
      // Don't return early - let the form render with error message
      return;
    }

    setOobCode(code);
  }, [user, router, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate password confirmation
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Validate password requirements
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(getPasswordRequirementsMessage(passwordValidation.errors));
      return;
    }

    if (!oobCode) {
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordResetWithCode(oobCode, password);
      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login?reset=success");
      }, 2000);
    } catch (err) {
      console.error("Password reset error:", err);
      if (err.code === "auth/expired-action-code") {
        setError(
          "This password reset link has expired. Please request a new one."
        );
      } else if (err.code === "auth/invalid-action-code") {
        setError(
          "Invalid or already used reset link. Please request a new one."
        );
      } else {
        setError(
          getAuthErrorMessage(err) ||
            "Failed to reset password. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading only if we're still checking (no error and no code yet)
  const isLoading = !oobCode && !error && searchParams.get("oobCode") === null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="w-full max-w-md mx-auto px-4 py-8">
        <div className="card shadow-2xl bg-base-100 border border-base-300">
          <div className="card-body p-6">
            {/* Logo and Title */}
            <div className="text-center mb-4">
              <div className="flex flex-col items-center mb-3">
                <Link
                  href="/"
                  className="mb-2"
                  aria-label="Go to LocalLens homepage"
                >
                  <div
                    className="w-16 h-16 rounded-full bg-linear-to-br from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center shadow-2xl mx-auto"
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
                <h1 className="text-3xl font-bold text-base-content">
                  Reset Password
                </h1>
              </div>
              <p className="text-base-content/70 mt-1">
                {success
                  ? "Password reset successful! Redirecting to login..."
                  : "Enter your new password below"}
              </p>
            </div>

            {/* Success Message */}
            {success && (
              <div className="alert alert-success mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
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
                <span className="text-sm">
                  Your password has been reset successfully. You will be
                  redirected to the login page shortly.
                </span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="alert alert-error mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
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
                <div className="flex flex-col">
                  <span className="text-sm">{error}</span>
                  {!oobCode && (
                    <Link
                      href="/forgot-password"
                      className="text-sm underline mt-2 hover:text-primary"
                    >
                      Request a new password reset link
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Password Reset Form */}
            {!success && (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="form-control">
                  <label htmlFor="new-password" className="label pb-1.5">
                    <span className="label-text font-medium">
                      New Password
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 chars: uppercase, lowercase, number, symbol"
                      className="input input-bordered w-full disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading || !oobCode}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onMouseDown={() => setShowPassword(true)}
                      onMouseUp={() => setShowPassword(false)}
                      onMouseLeave={() => setShowPassword(false)}
                      onTouchStart={() => setShowPassword(true)}
                      onTouchEnd={() => setShowPassword(false)}
                      disabled={loading || !oobCode}
                      aria-label="Press and hold to show password"
                    >
                      {showPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L9.88 9.88m-3.59-3.59l3.29 3.29M12 12l.01.01M21 12l-3.29-3.29m0 0L15.12 9.88m3.59 3.59L15.12 15.12m0 0L12 12"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
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
                      )}
                    </button>
                  </div>
                </div>

                <div className="form-control">
                  <label
                    htmlFor="confirm-new-password"
                    className="label pb-1.5"
                  >
                    <span className="label-text font-medium">
                      Confirm New Password
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your new password"
                      className="input input-bordered w-full disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading || !oobCode}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onMouseDown={() => setShowConfirmPassword(true)}
                      onMouseUp={() => setShowConfirmPassword(false)}
                      onMouseLeave={() => setShowConfirmPassword(false)}
                      onTouchStart={() => setShowConfirmPassword(true)}
                      onTouchEnd={() => setShowConfirmPassword(false)}
                      disabled={loading || !oobCode}
                      aria-label="Press and hold to show password"
                    >
                      {showConfirmPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L9.88 9.88m-3.59-3.59l3.29 3.29M12 12l.01.01M21 12l-3.29-3.29m0 0L15.12 9.88m3.59 3.59L15.12 15.12m0 0L12 12"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
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
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !oobCode}
                  className="btn btn-primary w-full font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>
            )}

            {/* Back to Login */}
            {!success && (
              <div className="text-center mt-4">
                <Link
                  href="/login"
                  className="btn btn-ghost btn-sm"
                  aria-label="Back to login page"
                >
                  ← Back to Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <span className="loading loading-spinner loading-lg text-cyan-400"></span>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
