"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/AuthContext";
import { validatePincode } from "@/lib/pincodeValidation.js";
import { validateNameField, validateCity, isProfileComplete } from "@/lib/userProfileCheck.js";

export default function SetupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingCity, setFetchingCity] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [cityError, setCityError] = useState("");
  const { user, refreshUserProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    // Check if profile is already complete
    const checkProfileCompleteness = async () => {
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
            // Continue to setup page if we can't parse response
            return;
          }
          
          // Check if user is banned
          if (data.user?.moderation?.banned === true) {
            router.replace("/banned");
            return;
          }
          
          const { isComplete } = isProfileComplete(data.user);
          if (isComplete) {
            // Profile is already complete, redirect to dashboard
            router.replace("/dashboard");
          }
        }
      } catch (err) {
        // If check fails, allow user to continue to setup page
        console.error("Error checking profile completeness:", err);
      }
    };

    checkProfileCompleteness();
  }, [user, router]);

  // Debounced city fetch when pincode changes
  useEffect(() => {
    if (!pincode || pincode.trim() === '') {
      setCity('');
      return;
    }

    const validation = validatePincode(pincode);
    if (!validation.isValid) {
      setPincodeError(validation.error);
      setCity('');
      return;
    }

    setPincodeError('');
    
    // Debounce city fetch
    const timeoutId = setTimeout(async () => {
      setFetchingCity(true);
      try {
        const response = await fetch(`/api/geocoding/pincode-to-city?pincode=${encodeURIComponent(validation.formatted)}`);
        let data = {};
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            throw new Error('Invalid response format');
          }
        } catch (parseError) {
          console.error('Error parsing geocoding response:', parseError);
          setCityError('Failed to fetch city. Please enter manually.');
          return;
        }
        
        if (response.ok && data.city) {
          setCity(data.city);
          setError('');
        } else {
          // City not found, but allow manual entry
          setCity('');
          if (data.error) {
            setError('City not found automatically. Please enter manually.');
          }
        }
      } catch (err) {
        console.error('Error fetching city:', err);
        setCity('');
        setError('Could not fetch city. Please enter manually.');
      } finally {
        setFetchingCity(false);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timeoutId);
  }, [pincode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPincodeError("");
    setFirstNameError("");
    setLastNameError("");
    setCityError("");

    // Validate firstName
    const firstNameValidation = validateNameField(firstName, 'First name');
    if (!firstNameValidation.isValid) {
      setFirstNameError(firstNameValidation.error);
      setError(firstNameValidation.error);
      return;
    }

    // Validate lastName
    const lastNameValidation = validateNameField(lastName, 'Last name');
    if (!lastNameValidation.isValid) {
      setLastNameError(lastNameValidation.error);
      setError(lastNameValidation.error);
      return;
    }

    // Validate pincode
    const pincodeValidation = validatePincode(pincode);
    if (!pincodeValidation.isValid) {
      setPincodeError(pincodeValidation.error);
      setError(pincodeValidation.error);
      return;
    }

    // Validate city
    const cityValidation = validateCity(city);
    if (!cityValidation.isValid) {
      setCityError(cityValidation.error);
      setError(cityValidation.error);
      return;
    }

    setLoading(true);

    try {
      // Get Firebase ID token for authentication
      const { auth } = await import('@/firebase/config');
      const { getAuth } = await import('firebase/auth');
      const currentAuth = auth || getAuth();
      const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
          uid: user.uid,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          pincode: pincodeValidation.formatted,
          city: city.trim(),
        }),
      });

      let data = {};
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        data = { error: `HTTP ${response.status}: Failed to update profile` };
      }

      if (!response.ok) {
        setError(data.error || 'Failed to update profile');
        setLoading(false);
        return;
      }

      // Success - refresh user profile in context, then redirect
      if (refreshUserProfile) {
        await refreshUserProfile();
      }
      
      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Use replace to avoid adding to history and prevent back button issues
      router.replace('/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null; // Will redirect via useEffect
  }

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

      <div className="w-full max-w-md mx-auto px-4 z-10 py-8">
        <div
          className="card shadow-2xl backdrop-blur-lg border border-gray-700/50"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.85)" }}
        >
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
                <h1 className="text-3xl font-bold bg-linear-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                  Complete Your Profile
                </h1>
              </div>
              <p className="text-white/70 mt-1">
                Please provide a few details to get started
              </p>
            </div>

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
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Setup Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="form-control">
                <label htmlFor="setup-firstname" className="label pb-1.5">
                  <span className="label-text text-white font-medium">
                    First Name *
                  </span>
                </label>
                <input
                  id="setup-firstname"
                  type="text"
                  placeholder="Enter your first name"
                  className={`input input-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                    firstNameError ? 'border-red-500' : ''
                  }`}
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setFirstNameError(""); // Clear error on change
                  }}
                  required
                  disabled={loading}
                />
                {firstNameError && (
                  <label className="label">
                    <span className="label-text-alt text-red-400">
                      {firstNameError}
                    </span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label htmlFor="setup-lastname" className="label pb-1.5">
                  <span className="label-text text-white font-medium">
                    Last Name *
                  </span>
                </label>
                <input
                  id="setup-lastname"
                  type="text"
                  placeholder="Enter your last name"
                  className={`input input-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                    lastNameError ? 'border-red-500' : ''
                  }`}
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setLastNameError(""); // Clear error on change
                  }}
                  required
                  disabled={loading}
                />
                {lastNameError && (
                  <label className="label">
                    <span className="label-text-alt text-red-400">
                      {lastNameError}
                    </span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label htmlFor="setup-pincode" className="label pb-1.5">
                  <span className="label-text text-white font-medium">
                    ZIP Code *
                  </span>
                </label>
                <input
                  id="setup-pincode"
                  type="text"
                  placeholder="12345 or 12345-6789"
                  className={`input input-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                    pincodeError ? 'border-red-500' : ''
                  }`}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  required
                  disabled={loading}
                />
                {pincodeError && (
                  <label className="label">
                    <span className="label-text-alt text-red-400">
                      {pincodeError}
                    </span>
                  </label>
                )}
                {fetchingCity && (
                  <label className="label">
                    <span className="label-text-alt text-cyan-400">
                      <span className="loading loading-spinner loading-xs mr-1"></span>
                      Finding city...
                    </span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label htmlFor="setup-city" className="label pb-1.5">
                  <span className="label-text text-white font-medium">
                    City *
                  </span>
                </label>
                <input
                  id="setup-city"
                  type="text"
                  placeholder="Enter your city"
                  className={`input input-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                    cityError ? 'border-red-500' : ''
                  }`}
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setCityError(""); // Clear error on change
                  }}
                  required
                  disabled={loading}
                />
                {cityError && (
                  <label className="label">
                    <span className="label-text-alt text-red-400">
                      {cityError}
                    </span>
                  </label>
                )}
                {city && !fetchingCity && !cityError && (
                  <label className="label">
                    <span className="label-text-alt text-green-400">
                      ✓ City found
                    </span>
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn w-full text-white border-none font-semibold hover:scale-105 transition-transform bg-slate-800 hover:bg-slate-700"
              >
                {loading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Complete Setup"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

