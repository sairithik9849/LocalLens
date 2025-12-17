'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/app/components/AdvancedMarker';
import { useGoogleMapsLoader } from '@/lib/useGoogleMapsLoader';

// Static libraries array to prevent LoadScript reload
const libraries = ['places', 'marker'];

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

// Convert date to local datetime-local format
const dateToLocalDateTime = (date) => {
  if (!date) return getCurrentDateTimeLocal();
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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
  
  if (isNaN(date.getTime())) {
    return 'Invalid date and time format';
  }
  
  if (date <= now) {
    return 'Event date must be in the future';
  }
  
  return '';
};

export default function EditEventModal({ event, isOpen, onClose, onSave, user }) {
  const { apiKey, isGoogleMapsLoaded, isLoadingKey } = useGoogleMapsLoader(libraries);
  const mapRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    title: '',
    description: '',
    eventDate: '',
    location: ''
  });

  const [formData, setFormData] = useState({
    location: { lat: null, lng: null },
    title: '',
    description: '',
    eventDate: getCurrentDateTimeLocal()
  });

  const [mapCenter, setMapCenter] = useState({ lat: 40.748817, lng: -74.044502 });
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Initialize form data when event changes or modal opens
  useEffect(() => {
    if (event && isOpen) {
      setFormData({
        location: {
          lat: event.location?.lat || null,
          lng: event.location?.lng || null
        },
        title: event.title || '',
        description: event.description || '',
        eventDate: dateToLocalDateTime(event.eventDate)
      });
      setSelectedLocation({
        lat: event.location?.lat || null,
        lng: event.location?.lng || null
      });
      if (event.location?.lat && event.location?.lng) {
        setMapCenter({
          lat: event.location.lat,
          lng: event.location.lng
        });
      }
      setError('');
      setFieldErrors({
        title: '',
        description: '',
        eventDate: '',
        location: ''
      });
    }
  }, [event, isOpen]);

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
      setError('You must be logged in to edit an event');
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

    if (titleError || descriptionError || dateError) {
      setError('Please fix all validation errors before submitting');
      return;
    }

    setSubmitting(true);

    try {
      // Get Firebase ID token
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

      const response = await fetch(`/api/events/${event._id}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          eventDate: formData.eventDate ? new Date(formData.eventDate).toISOString() : null,
          location: formData.location
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update event');
        setSubmitting(false);
        return;
      }

      // Call onSave callback with updated event
      onSave(data.event);
      onClose();
    } catch (error) {
      console.error('Error updating event:', error);
      setError('Failed to update event. Please try again.');
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const mapOptions = {
    disableDefaultUI: false,
    clickableIcons: true,
    scrollwheel: true,
    mapId: 'DEMO_MAP_ID',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="card bg-base-100 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-base-content">Edit Event</h2>
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="alert alert-error mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Selection */}
            <div className="card bg-base-200 shadow">
              <div className="card-body">
                <h3 className="text-lg font-semibold mb-4 text-base-content">Event Location</h3>
                
                <div className="mb-4">
                  <p className="text-sm text-base-content/70 mb-2">
                    Click on the map to update the event location (must be within your pincode)
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
            <div>
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

            {/* Description */}
            <div>
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

            {/* Event Date/Time */}
            <div>
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

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
