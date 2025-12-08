"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/AuthContext";
import { validatePincode } from "@/lib/pincodeValidation.js";
import { validateNameField, validateCity } from "@/lib/userProfileCheck.js";
import { sanitizeBio, sanitizeQuote } from "@/lib/sanitizeInput.js";

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
  const router = useRouter();

  // Fetch user profile on mount
  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading) {
      return;
    }

    // Redirect to login if not authenticated
    if (!user) {
      router.push("/login");
      return;
    }

    fetchUserProfile();
  }, [user, authLoading, router]);

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
        
        // Refresh user profile in context
        if (refreshUserProfile) {
          await refreshUserProfile();
        }
        
        // Reload profile data
        await fetchUserProfile();
        
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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-cyan-400"></span>
          <p className="text-white mt-4">
            {authLoading ? "Checking authentication..." : "Loading profile..."}
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated, will redirect via useEffect
  if (!user) {
    return null;
  }

  // Show loading state if profile hasn't loaded yet
  if (!userProfile) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-cyan-400"></span>
          <p className="text-white mt-4">Loading profile...</p>
        </div>
      </div>
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
    <div
      className="min-h-screen flex items-center justify-center relative py-8"
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

      <div className="w-full max-w-2xl mx-auto px-4 z-10">
        <div
          className="card shadow-2xl backdrop-blur-lg border border-gray-700/50"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.85)" }}
        >
          <div className="card-body p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt="Profile"
                    className="w-16 h-16 rounded-full border-2 border-cyan-400 object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-linear-to-br from-cyan-500 to-purple-600 flex items-center justify-center border-2 border-cyan-400">
                    <span className="text-white text-2xl font-bold">
                      {userProfile?.firstName?.[0]?.toUpperCase() || userProfile?.lastName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold bg-linear-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                    {userProfile.firstName && userProfile.lastName
                      ? `${userProfile.firstName} ${userProfile.lastName}`
                      : "My Profile"}
                  </h1>
                  <p className="text-white/70 text-sm">{user.email}</p>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="btn btn-sm text-white border-2 border-cyan-400 bg-cyan-400/20 hover:bg-cyan-400/30 hover:border-cyan-300 font-semibold shadow-lg shadow-cyan-400/20"
                >
                  Edit Profile
                </button>
              )}
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
                <span className="text-sm">{success}</span>
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
                <span className="text-sm">{error}</span>
              </div>
            )}

            {isEditing ? (
              /* Edit Mode Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label htmlFor="profile-firstname" className="label pb-1.5">
                      <span className="label-text text-white font-medium">
                        First Name *
                      </span>
                    </label>
                    <input
                      id="profile-firstname"
                      type="text"
                      placeholder="Enter your first name"
                      className={`input input-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                        firstNameError ? 'border-red-500' : ''
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
                        <span className="label-text-alt text-red-400">
                          {firstNameError}
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="form-control">
                    <label htmlFor="profile-lastname" className="label pb-1.5">
                      <span className="label-text text-white font-medium">
                        Last Name *
                      </span>
                    </label>
                    <input
                      id="profile-lastname"
                      type="text"
                      placeholder="Enter your last name"
                      className={`input input-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                        lastNameError ? 'border-red-500' : ''
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
                        <span className="label-text-alt text-red-400">
                          {lastNameError}
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label htmlFor="profile-pincode" className="label pb-1.5">
                      <span className="label-text text-white font-medium">
                        ZIP Code *
                      </span>
                    </label>
                    <input
                      id="profile-pincode"
                      type="text"
                      placeholder="12345 or 12345-6789"
                      className={`input input-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                        pincodeError ? 'border-red-500' : ''
                      }`}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      required
                      disabled={saving}
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
                    <label htmlFor="profile-city" className="label pb-1.5">
                      <span className="label-text text-white font-medium">
                        City *
                      </span>
                    </label>
                    <input
                      id="profile-city"
                      type="text"
                      placeholder="Enter your city"
                      className={`input input-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                        cityError ? 'border-red-500' : ''
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
                </div>

                <div className="form-control">
                  <label htmlFor="profile-bio" className="label pb-1.5">
                    <span className="label-text text-white font-medium">
                      Bio
                    </span>
                  </label>
                  <textarea
                    id="profile-bio"
                    placeholder="Tell us about yourself..."
                    className={`textarea textarea-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                      bioError ? 'border-red-500' : ''
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
                      <span className="label-text-alt text-red-400">
                        {bioError}
                      </span>
                    </label>
                  )}
                  <label className="label">
                    <span className="label-text-alt text-white/60">
                      {bio.length}/500 characters
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label htmlFor="profile-favoritequote" className="label pb-1.5">
                    <span className="label-text text-white font-medium">
                      Favorite Quote
                    </span>
                  </label>
                  <textarea
                    id="profile-favoritequote"
                    placeholder="Share your favorite quote..."
                    className={`textarea textarea-bordered w-full bg-slate-900/80 border-slate-600/50 text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:bg-slate-900 ${
                      favoriteQuoteError ? 'border-red-500' : ''
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
                      <span className="label-text-alt text-red-400">
                        {favoriteQuoteError}
                      </span>
                    </label>
                  )}
                  <label className="label">
                    <span className="label-text-alt text-white/60">
                      {favoriteQuote.length}/200 characters
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn flex-1 text-white border-2 border-cyan-400 bg-cyan-400/20 hover:bg-cyan-400/30 hover:border-cyan-300 font-semibold shadow-lg shadow-cyan-400/20 hover:scale-105 transition-transform disabled:opacity-50"
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
                    className="btn flex-1 text-white border-2 border-slate-500 bg-slate-700/50 hover:bg-slate-600 hover:border-slate-400 font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* View Mode */
              <div className="space-y-6">
                {/* Account Information */}
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">Account Information</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-white/60">Email</span>
                      <span className="text-white font-medium">{user.email}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-white/60">Account Created</span>
                      <span className="text-white font-medium">
                        {formatDate(userProfile.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-white/60">Last Login</span>
                      <span className="text-white font-medium">
                        {formatDate(userProfile.lastLogin)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-white/60">Auth Methods</span>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {userProfile.authProviders && userProfile.authProviders.length > 0 ? (
                          userProfile.authProviders.map((provider, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 rounded text-xs font-medium bg-cyan-400/20 text-cyan-300 border border-cyan-400/50"
                            >
                              {provider === "google.com" ? "Google" : provider === "password" ? "Email/Password" : provider}
                            </span>
                          ))
                        ) : (
                          <span className="text-white font-medium capitalize">
                            {userProfile.metadata?.signUpMethod || "N/A"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Information */}
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-white/60">First Name</span>
                      <span className="text-white font-medium">
                        {userProfile.firstName || "Not set"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-white/60">Last Name</span>
                      <span className="text-white font-medium">
                        {userProfile.lastName || "Not set"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-white/60">ZIP Code</span>
                      <span className="text-white font-medium">
                        {userProfile.profile?.pincode || "Not set"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-white/60">City</span>
                      <span className="text-white font-medium">
                        {userProfile.profile?.city || "Not set"}
                      </span>
                    </div>
                    {userProfile.profile?.bio && (
                      <div className="py-2 border-b border-slate-700/50">
                        <span className="text-white/60 block mb-2">Bio</span>
                        <p className="text-white">{userProfile.profile.bio}</p>
                      </div>
                    )}
                    {userProfile.profile?.favoriteQuote && (
                      <div className="py-2 border-b border-slate-700/50">
                        <span className="text-white/60 block mb-2">Favorite Quote</span>
                        <p className="text-white italic">"{userProfile.profile.favoriteQuote}"</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4">
                  <Link
                    href="/dashboard"
                    className="btn w-full text-white border-2 border-cyan-400 bg-cyan-400/20 hover:bg-cyan-400/30 hover:border-cyan-300 font-semibold shadow-lg shadow-cyan-400/20"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

