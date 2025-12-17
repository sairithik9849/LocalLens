/**
 * Maps Firebase authentication error codes to user-friendly error messages
 * @param {Error} error - Firebase authentication error object
 * @returns {string} User-friendly error message
 */
export function getAuthErrorMessage(error) {
  if (!error || !error.code) {
    return "An unexpected error occurred. Please try again.";
  }

  const errorMessages = {
    // Login errors
    "auth/user-not-found": "No account found with this email address.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-email": "Invalid email address format.",
    "auth/user-disabled":
      "This account has been disabled. Please contact support.",
    "auth/invalid-credential": "Invalid email or password. Please try again.",

    // Signup errors
    "auth/email-already-in-use":
      "An account with this email already exists. Please sign in instead.",
    "auth/weak-password":
      "Password is too weak. Password must be at least 8 characters with uppercase, lowercase, numbers, and symbols.",
    "auth/invalid-password":
      "Invalid password. Password must be at least 8 characters with uppercase, lowercase, numbers, and symbols.",

    // Network errors
    "auth/network-request-failed":
      "Network error. Please check your internet connection and try again.",
    "auth/too-many-requests":
      "Too many failed attempts. Please try again later.",
    "auth/operation-not-allowed":
      "This sign-in method is not enabled. Please contact support.",

    // Google Sign-in errors
    "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
    "auth/cancelled-popup-request": "Sign-in was cancelled. Please try again.",
    "auth/popup-blocked":
      "Pop-up was blocked by your browser. Please allow pop-ups and try again.",
    "auth/account-exists-with-different-credential":
      "An account already exists with the same email but different sign-in method.",

    // Password reset errors
    "auth/user-not-found": "No account found with this email address.",
    "auth/invalid-email": "Invalid email address format.",
    "auth/too-many-requests":
      "Too many password reset attempts. Please try again later.",
    "auth/network-request-failed":
      "Network error. Please check your internet connection and try again.",
    "auth/expired-action-code":
      "This password reset link has expired. Please request a new one.",
    "auth/invalid-action-code":
      "Invalid or already used reset link. Please request a new one.",

    // General errors
    "auth/requires-recent-login":
      "This operation requires recent authentication. Please sign in again.",
    "auth/timeout": "Request timed out. Please try again.",
  };

  return (
    errorMessages[error.code] ||
    error.message ||
    "An error occurred. Please try again."
  );
}
