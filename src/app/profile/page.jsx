"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/AuthContext";
import { useCheckBanned } from "@/hooks/useCheckBanned";
import { validatePincode } from "@/lib/pincodeValidation.js";
import { validateNameField, validateCity } from "@/lib/userProfileCheck.js";
import { sanitizeBio, sanitizeQuote } from "@/lib/sanitizeInput.js";
import Navigation from "@/app/components/Navigation";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingCity, setFetchingCity] = useState(false);
  
  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [favoriteQuote, setFavoriteQuote] = useState("");
  
  // Error states
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pincodeError, setPincodeError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [cityError, setCityError] = useState("");
  const [bioError, setBioError] = useState("");
  const [favoriteQuoteError, setFavoriteQuoteError] = useState("");
  
  // User profile data
  const [userProfile, setUserProfile] = useState(null);
  
  const { user, refreshUserProfile, loading: authLoading } = useAuth();
  const { checkingBanned } = useCheckBanned();
  const router = useRouter();

  // Fetch user profile on mount
  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading || checkingBanned) {
      return;
    }

    // Redirect to login if not authenticated
    if (!user) {
      router.push("/login");
      return;
    }

    fetchUserProfile();
  }, [user, authLoading, checkingBanned, router]);

  const fetchUserProfile = async () => {
    if (!user?.uid) return;

    setLoading(true);
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
          setError("Failed to load profile data: Invalid response format");
          return;
        }
        
        // Check if user is banned
        if (data.user?.moderation?.banned === true) {
          router.replace("/banned");
          return;
        }
        
        setUserProfile(data.user);
        
        // Populate form fields
        setFirstName(data.user.firstName || "");
        setLastName(data.user.lastName || "");
        setPincode(data.user.profile?.pincode || "");
        setCity(data.user.profile?.city || "");
        setBio(data.user.profile?.bio || "");
        setFavoriteQuote(data.user.profile?.favoriteQuote || "");
      } else {
        if (response.status === 403) {
          // Banned user
          router.replace("/banned");
          return;
        }
        setError("Failed to load profile data");
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setError("An error occurred while loading your profile");
    } finally {
      setLoading(false);
    }
  };

  // Debounced city fetch when pincode changes (only in edit mode)
  useEffect(() => {
    if (!isEditing || !pincode || pincode.trim() === '') {
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
          setFetchingCity(false);
          return;
        }
        
        // Handle async queue response (202 Accepted)
        if (response.status === 202 && data.jobId) {
          // Job queued, poll for result
          const jobId = data.jobId;
          let attempts = 0;
          const maxAttempts = 20; // 20 seconds max wait
          let result = null;

          while (attempts < maxAttempts && !result) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            
            const statusResponse = await fetch(`/api/geocoding/status/${jobId}`);
            const statusData = await statusResponse.json();

            if (statusData.status === 'completed' && statusData.result?.city) {
              result = statusData.result.city;
              setCity(result);
              setError('');
              setCityError('');
              break;
            } else if (statusData.status === 'failed') {
              setCity('');
              setError('City not found automatically. Please enter manually.');
              break;
            }

            attempts++;
          }

          if (!result && attempts >= maxAttempts) {
            setCity('');
            setError('City lookup timed out. Please enter manually.');
          }
        } else if (response.ok && data.city) {
          // Direct result (fallback mode)
          setCity(data.city);
          setError('');
          setCityError('');
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
  }, [pincode, isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setError("");
    setSuccess("");
    // Reset errors
    setPincodeError("");
    setFirstNameError("");
    setLastNameError("");
    setCityError("");
    setBioError("");
    setFavoriteQuoteError("");
  };

  const handleCancel = () => {
    // Reset form to original values
    if (userProfile) {
      setFirstName(userProfile.firstName || "");
      setLastName(userProfile.lastName || "");
      setPincode(userProfile.profile?.pincode || "");
      setCity(userProfile.profile?.city || "");
      setBio(userProfile.profile?.bio || "");
      setFavoriteQuote(userProfile.profile?.favoriteQuote || "");
    }
    setIsEditing(false);
    setError("");
    setSuccess("");
    setPincodeError("");
    setFirstNameError("");
    setLastNameError("");
    setCityError("");
    setBioError("");
    setFavoriteQuoteError("");
  };

  const validateBio = (value) => {
    if (!value || value.trim() === '') {
      return { isValid: true, error: null, sanitized: '' }; // Bio is optional
    }
    
    // Sanitize before validation
    const sanitized = sanitizeBio(value);
    
    if (sanitized.length > 500) {
      return { isValid: false, error: 'Bio cannot exceed 500 characters', sanitized };
    }
    return { isValid: true, error: null, sanitized };
  };

  const validateFavoriteQuote = (value) => {
    if (!value || value.trim() === '') {
      return { isValid: true, error: null, sanitized: '' }; // Favorite quote is optional
    }
    
    // Sanitize before validation
    const sanitized = sanitizeQuote(value);
    
    if (sanitized.length > 200) {
      return { isValid: false, error: 'Favorite quote cannot exceed 200 characters', sanitized };
    }
    return { isValid: true, error: null, sanitized };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setPincodeError("");
    setFirstNameError("");
    setLastNameError("");
    setCityError("");
    setBioError("");
    setFavoriteQuoteError("");

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

    // Validate bio
    const bioValidation = validateBio(bio);
    if (!bioValidation.isValid) {
      setBioError(bioValidation.error);
      setError(bioValidation.error);
      return;
    }

    // Validate favoriteQuote
    const favoriteQuoteValidation = validateFavoriteQuote(favoriteQuote);
    if (!favoriteQuoteValidation.isValid) {
      setFavoriteQuoteError(favoriteQuoteValidation.error);
      setError(favoriteQuoteValidation.error);
      return;
    }

    setSaving(true);
    try {
      // Get Firebase ID token for authentication
      const { auth } = await import('@/firebase/config');
      const { getAuth } = await import('firebase/auth');
      const currentAuth = auth || getAuth();
      const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

      const headers = {
        "Content-Type": "application/json",
      };
      
      if (idToken) {
        headers["Authorization"] = `Bearer ${idToken}`;
      }

      // Use sanitized values from validation
      const response = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: headers,
        body: JSON.stringify({
          uid: user.uid,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          pincode: pincodeValidation.formatted,
          city: city.trim(),
          bio: bioValidation.sanitized || null,
          favoriteQuote: favoriteQuoteValidation.sanitized || null,
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

      if (response.ok) {
        setSuccess("Profile updated successfully!");
        setIsEditing(false);
        
        // Update local state with the new values
        setUserProfile({
          ...userProfile,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          profile: {
            ...userProfile.profile,
            pincode: pincodeValidation.formatted,
            city: city.trim(),
            bio: bioValidation.sanitized || null,
            favoriteQuote: favoriteQuoteValidation.sanitized || null,
          }
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to update profile. Please try again.");
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("An unexpected error occurred while updating your profile.");
    } finally {
      setSaving(false);
    }
  };

  // Show loading state while auth is loading or profile is fetching
  if (authLoading || loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content mt-4">
              {authLoading ? "Checking authentication..." : "Loading profile..."}
            </p>
          </div>
        </div>
      </>
    );
  }

  // If not authenticated, will redirect via useEffect
  if (!user) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-600">Please log in to view your profile.</p>
        </div>
      </>
    );
  }

  // Show loading state if profile hasn't loaded yet
  if (!userProfile) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content mt-4">Loading profile...</p>
          </div>
        </div>
      </>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8 lg:py-12">
          {/* Header Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt="Profile"
                    className="w-20 h-20 rounded-full border-2 border-primary object-cover shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center border-2 border-primary shadow-md">
                    <span className="text-primary-content text-3xl font-bold">
                      {userProfile?.firstName?.[0]?.toUpperCase() || userProfile?.lastName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {userProfile.firstName && userProfile.lastName
                      ? `${userProfile.firstName} ${userProfile.lastName}`
                      : "My Profile"}
                  </h1>
                  <p className="text-gray-600 text-sm mt-1">{user.email}</p>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="btn btn-primary font-semibold hover:scale-105 transition-transform"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="alert alert-success mb-6">
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
              <span className="text-sm">{success}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="alert alert-error mb-6">
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

          {isEditing ? (
            /* Edit Mode Form */
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label htmlFor="profile-firstname" className="label pb-1.5">
                      <span className="label-text font-medium">
                        First Name *
                      </span>
                    </label>
                    <input
                      id="profile-firstname"
                      type="text"
                      placeholder="Enter your first name"
                      className={`input input-bordered w-full ${
                        firstNameError ? 'input-error' : ''
                      }`}
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setFirstNameError("");
                      }}
                      required
                      disabled={saving}
                    />
                    {firstNameError && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {firstNameError}
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="form-control">
                    <label htmlFor="profile-lastname" className="label pb-1.5">
                      <span className="label-text font-medium">
                        Last Name *
                      </span>
                    </label>
                    <input
                      id="profile-lastname"
                      type="text"
                      placeholder="Enter your last name"
                      className={`input input-bordered w-full ${
                        lastNameError ? 'input-error' : ''
                      }`}
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setLastNameError("");
                      }}
                      required
                      disabled={saving}
                    />
                    {lastNameError && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {lastNameError}
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label htmlFor="profile-pincode" className="label pb-1.5">
                      <span className="label-text font-medium">
                        ZIP Code *
                      </span>
                    </label>
                    <input
                      id="profile-pincode"
                      type="text"
                      placeholder="12345 or 12345-6789"
                      className={`input input-bordered w-full ${
                        pincodeError ? 'input-error' : ''
                      }`}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      required
                      disabled={saving}
                    />
                    {pincodeError && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {pincodeError}
                        </span>
                      </label>
                    )}
                    {fetchingCity && (
                      <label className="label">
                        <span className="label-text-alt text-primary">
                          <span className="loading loading-spinner loading-xs mr-1"></span>
                          Finding city...
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="form-control">
                    <label htmlFor="profile-city" className="label pb-1.5">
                      <span className="label-text font-medium">
                        City *
                      </span>
                    </label>
                    <input
                      id="profile-city"
                      type="text"
                      placeholder="Enter your city"
                      className={`input input-bordered w-full ${
                        cityError ? 'input-error' : ''
                      }`}
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setCityError("");
                      }}
                      required
                      disabled={saving}
                    />
                    {cityError && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {cityError}
                        </span>
                      </label>
                    )}
                    {city && !fetchingCity && !cityError && (
                      <label className="label">
                        <span className="label-text-alt text-success">
                          ✓ City found
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="form-control">
                  <label htmlFor="profile-bio" className="label pb-1.5">
                    <span className="label-text font-medium">
                      Bio
                    </span>
                  </label>
                  <textarea
                    id="profile-bio"
                    placeholder="Tell us about yourself..."
                    className={`textarea textarea-bordered w-full ${
                      bioError ? 'textarea-error' : ''
                    }`}
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      setBioError("");
                    }}
                    rows={4}
                    disabled={saving}
                    maxLength={500}
                  />
                  {bioError && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {bioError}
                      </span>
                    </label>
                  )}
                  <label className="label">
                    <span className="label-text-alt text-base-content/60">
                      {bio.length}/500 characters
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label htmlFor="profile-favoritequote" className="label pb-1.5">
                    <span className="label-text font-medium">
                      Favorite Quote
                    </span>
                  </label>
                  <textarea
                    id="profile-favoritequote"
                    placeholder="Share your favorite quote..."
                    className={`textarea textarea-bordered w-full ${
                      favoriteQuoteError ? 'textarea-error' : ''
                    }`}
                    value={favoriteQuote}
                    onChange={(e) => {
                      setFavoriteQuote(e.target.value);
                      setFavoriteQuoteError("");
                    }}
                    rows={3}
                    disabled={saving}
                    maxLength={200}
                  />
                  {favoriteQuoteError && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {favoriteQuoteError}
                      </span>
                    </label>
                  )}
                  <label className="label">
                    <span className="label-text-alt text-base-content/60">
                      {favoriteQuote.length}/200 characters
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn flex-1 btn-primary font-semibold hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {saving ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="btn flex-1 btn-outline font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* View Mode */}
              {/* Account Information */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
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
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Email</span>
                    <span className="text-gray-900 font-medium">{user.email}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Account Created</span>
                    <span className="text-gray-900 font-medium">
                      {formatDate(userProfile.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Last Login</span>
                    <span className="text-gray-900 font-medium">
                      {formatDate(userProfile.lastLogin)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-gray-600 font-medium">Auth Methods</span>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {userProfile.authProviders && userProfile.authProviders.length > 0 ? (
                        userProfile.authProviders.map((provider, index) => (
                          <span
                            key={index}
                            className="badge badge-primary badge-outline"
                          >
                            {provider === "google.com" ? "Google" : provider === "password" ? "Email/Password" : provider}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-900 font-medium capitalize">
                          {userProfile.metadata?.signUpMethod || "N/A"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Information */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
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
                      d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Profile Information
                </h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">First Name</span>
                    <span className="text-gray-900 font-medium">
                      {userProfile.firstName || "Not set"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Last Name</span>
                    <span className="text-gray-900 font-medium">
                      {userProfile.lastName || "Not set"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">ZIP Code</span>
                    <span className="text-gray-900 font-medium">
                      {userProfile.profile?.pincode || "Not set"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">City</span>
                    <span className="text-gray-900 font-medium">
                      {userProfile.profile?.city || "Not set"}
                    </span>
                  </div>
                  {userProfile.profile?.bio && (
                    <div className="py-3 border-b border-gray-200">
                      <span className="text-gray-600 font-medium block mb-2">Bio</span>
                      <p className="text-gray-900">{userProfile.profile.bio}</p>
                    </div>
                  )}
                  {userProfile.profile?.favoriteQuote && (
                    <div className="py-3">
                      <span className="text-gray-600 font-medium block mb-2">Favorite Quote</span>
                      <p className="text-gray-900 italic">"{userProfile.profile.favoriteQuote}"</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/feed"
                  className="btn btn-primary w-full font-semibold"
                >
                  Back to Feed
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

