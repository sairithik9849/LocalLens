'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import { useCheckBanned } from '@/hooks/useCheckBanned';
import Navigation from '@/app/components/Navigation';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/app/components/AdvancedMarker';
import { useGoogleMapsLoader } from '@/lib/useGoogleMapsLoader';
import { zipcodeToCoordsGoogle, zipcodeToCoords } from '@/lib/geocoding';
import { getGoogleMapsApiKey } from '@/lib/gistApiKey';
import Link from 'next/link';

// Static libraries array to prevent LoadScript reload
const libraries = ['places', 'marker'];

export default function CreateEventPage() {
  const { user, loading: authLoading } = useAuth();
  const { checkingBanned } = useCheckBanned();
  const router = useRouter();
  const { apiKey, isGoogleMapsLoaded, isLoadingKey } = useGoogleMapsLoader(libraries);
  const mapRef = useRef(null);

  // Helper function to get current date/time in local timezone for datetime-local input
  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    // Add 1 hour to ensure it's in the future
    now.setHours(now.getHours() + 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    location: { lat: null, lng: null },
    title: '',
    description: '',
    eventDate: getCurrentDateTimeLocal()
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    title: '',
    description: '',
    eventDate: '',
    location: ''
  });
  const [pincode, setPincode] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 40.748817, lng: -74.044502 }); // Default: Hoboken, NJ
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingPincode, setLoadingPincode] = useState(true);

  // Fetch user pincode and center map
  useEffect(() => {
    if (!user || authLoading || checkingBanned) return;

    const fetchUserPincode = async () => {
      try {
        setLoadingPincode(true);
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
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch user profile');
        }

        const userPincode = data.user?.profile?.pincode;
        setPincode(userPincode);

        if (userPincode) {
          // Geocode pincode to center map
          try {
            const apiKey = await getGoogleMapsApiKey();
            const coords = await zipcodeToCoordsGoogle(userPincode, apiKey);
            if (coords && coords.lat && coords.lng) {
              setMapCenter({ lat: coords.lat, lng: coords.lng });
            }
          } catch (error) {
            console.warn('Google geocoding failed, trying OpenStreetMap:', error);
            try {
              const coords = await zipcodeToCoords(userPincode);
              if (coords && coords.lat && coords.lng) {
                setMapCenter({ lat: coords.lat, lng: coords.lng });
              }
            } catch (osmError) {
              console.error('Both geocoding services failed:', osmError);
            }
          }
        }
        setLoadingPincode(false);
      } catch (err) {
        console.error('Error fetching user pincode:', err);
        setLoadingPincode(false);
      }
    };

    fetchUserPincode();
  }, [user, authLoading, checkingBanned]);

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSelectedLocation({ lat, lng });
    setFormData(prev => ({
      ...prev,
      location: { lat, lng }
    }));
    // Clear location error when location is selected
    setFieldErrors(prev => ({
      ...prev,
      location: ''
    }));
  };

  // Validation functions
  const validateTitle = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Title is required';
    }
    if (trimmed.length < 3) {
      return 'Title must be at least 3 characters';
    }
    if (trimmed.length > 200) {
      return 'Title must be 200 characters or less';
    }
    return '';
  };

  const validateDescription = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Description is required';
    }
    if (trimmed.length < 10) {
      return 'Description must be at least 10 characters';
    }
    if (trimmed.length > 2000) {
      return 'Description must be 2000 characters or less';
    }
    return '';
  };

  const validateEventDate = (value) => {
    if (!value) {
      return 'Event date and time is required';
    }
    
    const date = new Date(value);
    const now = new Date();
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date and time format';
    }
    
    // Check if date is in the future
    if (date <= now) {
      return 'Event date must be in the future';
    }
    
    return '';
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Real-time validation
    let error = '';
    if (field === 'title') {
      error = validateTitle(value);
    } else if (field === 'description') {
      error = validateDescription(value);
    } else if (field === 'eventDate') {
      error = validateEventDate(value);
    }

    setFieldErrors(prev => {
      if (error === '' && prev[field] !== '') {
        setError('');
      }
      return {
        ...prev,
        [field]: error
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('You must be logged in to create an event');
      return;
    }

    if (!pincode) {
      setError('Pincode is required. Please set your pincode in your profile.');
      return;
    }

    // Validate location
    if (!formData.location.lat || !formData.location.lng) {
      setFieldErrors(prev => ({
        ...prev,
        location: 'Please select a location on the map'
      }));
      setError('Please select a location on the map');
      return;
    }

    // Validate all fields
    const titleError = validateTitle(formData.title);
    const descriptionError = validateDescription(formData.description);
    const dateError = validateEventDate(formData.eventDate);

    setFieldErrors({
      title: titleError,
      description: descriptionError,
      eventDate: dateError,
      location: ''
    });

    // If any validation errors, stop submission
    if (titleError || descriptionError || dateError) {
      setError('Please fix all validation errors before submitting');
      return;
    }

    setSubmitting(true);

    try {
      // Get Firebase ID token for authentication
      const { auth } = await import('@/firebase/config');
      const { getAuth } = await import('firebase/auth');
      const currentAuth = auth || getAuth();
      const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

      const headers = {
        'Content-Type': 'application/json'
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          eventDate: formData.eventDate ? new Date(formData.eventDate).toISOString() : null,
          location: formData.location,
          uid: user.uid
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create event');
        setSubmitting(false);
        return;
      }

      // Show success message and redirect
      setSuccessMessage('Event created successfully!');
      setTimeout(() => {
        router.push(`/events/${data.event._id}`);
      }, 1500);
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event. Please try again.');
      setSubmitting(false);
    }
  };

  if (authLoading || loadingPincode) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content/70">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center">
            <p className="text-base-content/70 mb-4">Please log in to create an event.</p>
            <button
              onClick={() => router.push('/login')}
              className="btn btn-primary"
            >
              Go to Login
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!pincode) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center max-w-md p-6">
            <div className="mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-primary mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-4 text-base-content">Pincode Required</h2>
            <p className="text-base-content/70 mb-8 text-lg">
              Please set your pincode in your profile to create events.
            </p>
            <Link
              href="/profile"
              className="btn btn-primary btn-lg gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Go to Profile
            </Link>
          </div>
        </div>
      </>
    );
  }

  const mapOptions = {
    disableDefaultUI: false,
    clickableIcons: true,
    scrollwheel: true,
    mapId: 'DEMO_MAP_ID',
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-base-200">
        <div className="max-w-6xl mx-auto p-6">
          {/* Navigation Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-sm text-base-content/70">
            <Link 
              href="/events" 
              className="hover:text-primary transition-colors"
            >
              Events
            </Link>
            <span>/</span>
            <span className="text-base-content font-medium">Create Event</span>
          </div>

          {/* Header with Back Button */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-base-content">Create Event</h1>
            <Link
              href="/events"
              className="btn btn-outline gap-2"
            >
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Events
            </Link>
          </div>

          {error && (
            <div className="alert alert-error mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="alert alert-success mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Selection */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="text-xl font-semibold mb-4">Event Location</h2>
                
                <div className="mb-4">
                  <p className="text-sm text-base-content/70 mb-2">
                    Click on the map to select the event location (must be within your pincode: {pincode})
                  </p>
                  {selectedLocation && (
                    <p className="text-sm text-base-content font-medium mb-2">
                      Selected: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                    </p>
                  )}
                  {fieldErrors.location && (
                    <p className="text-sm text-error">{fieldErrors.location}</p>
                  )}
                </div>

                {!isLoadingKey && (isGoogleMapsLoaded || apiKey) && (
                  <div className="mt-4 h-64 rounded-lg overflow-hidden border border-base-300">
                    {isGoogleMapsLoaded ? (
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={selectedLocation || mapCenter}
                        zoom={selectedLocation ? 15 : 12}
                        options={mapOptions}
                        onClick={handleMapClick}
                        onLoad={(map) => {
                          mapRef.current = map;
                        }}
                      >
                        {selectedLocation && (
                          <AdvancedMarker
                            position={selectedLocation}
                            title="Event Location"
                            iconUrl="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                          />
                        )}
                      </GoogleMap>
                    ) : (
                      <LoadScript
                        googleMapsApiKey={apiKey}
                        libraries={libraries}
                        loadingElement={
                          <div className="flex items-center justify-center h-full">
                            <span className="loading loading-spinner loading-lg text-primary"></span>
                          </div>
                        }
                      >
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '100%' }}
                          center={selectedLocation || mapCenter}
                          zoom={selectedLocation ? 15 : 12}
                          options={mapOptions}
                          onClick={handleMapClick}
                          onLoad={(map) => {
                            mapRef.current = map;
                          }}
                        >
                          {selectedLocation && (
                            <AdvancedMarker
                              position={selectedLocation}
                              title="Event Location"
                              iconUrl="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                            />
                          )}
                        </GoogleMap>
                      </LoadScript>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Event Title <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  onBlur={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Community BBQ, Book Club Meeting, etc."
                  maxLength={200}
                  required
                  className={`input input-bordered w-full ${
                    fieldErrors.title ? 'input-error' : ''
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className={`text-xs ${fieldErrors.title ? 'text-error' : 'text-base-content/50'}`}>
                    {fieldErrors.title || `${formData.title.length}/200 characters`}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Description <span className="text-error">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  onBlur={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Provide details about the event..."
                  rows={6}
                  maxLength={2000}
                  required
                  className={`textarea textarea-bordered w-full ${
                    fieldErrors.description ? 'textarea-error' : ''
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className={`text-xs ${fieldErrors.description ? 'text-error' : 'text-base-content/50'}`}>
                    {fieldErrors.description || `${formData.description.length}/2000 characters`}
                  </p>
                </div>
              </div>
            </div>

            {/* Event Date/Time */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Event Date & Time <span className="text-error">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.eventDate}
                  onChange={(e) => handleInputChange('eventDate', e.target.value)}
                  onBlur={(e) => handleInputChange('eventDate', e.target.value)}
                  min={getCurrentDateTimeLocal()}
                  required
                  className={`input input-bordered w-full ${
                    fieldErrors.eventDate ? 'input-error' : ''
                  }`}
                />
                <p className={`text-xs mt-1 ${fieldErrors.eventDate ? 'text-error' : 'text-base-content/50'}`}>
                  {fieldErrors.eventDate || 'Event date must be in the future'}
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 items-center">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Creating...
                  </>
                ) : (
                  'Create Event'
                )}
              </button>
              <Link
                href="/events"
                className="btn btn-outline"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
