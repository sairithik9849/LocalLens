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
const validateIncidentType = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Incident type is required';
  }
  if (trimmed.length < 3) {
    return 'Incident type must be at least 3 characters';
  }
  if (trimmed.length > 200) {
    return 'Incident type must be 200 characters or less';
  }
  if (!/^[a-zA-Z0-9\s\-_.,!?;:'"()]+$/.test(trimmed)) {
    return 'Incident type contains invalid characters';
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

const validateDateTime = (value) => {
  if (!value) {
    return 'Date and time is required';
  }
  
  const date = new Date(value);
  const now = new Date();
  
  if (isNaN(date.getTime())) {
    return 'Invalid date and time format';
  }
  
  if (date > now) {
    return 'Date and time cannot be in the future';
  }
  
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (date < oneYearAgo) {
    return 'Date and time cannot be more than 1 year in the past';
  }
  
  return '';
};

export default function EditIncidentModal({ incident, isOpen, onClose, onSave, user }) {
  const { apiKey, isGoogleMapsLoaded, isLoadingKey } = useGoogleMapsLoader(libraries);
  const mapRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    incidentType: '',
    description: '',
    reportedAt: ''
  });

  const [formData, setFormData] = useState({
    location: { lat: null, lng: null },
    incidentType: '',
    description: '',
    reportedAt: getCurrentDateTimeLocal()
  });

  const [mapCenter, setMapCenter] = useState({ lat: 40.748817, lng: -74.044502 });
  const [selectedLocation, setSelectedLocation] = useState(null);


  // Initialize form data when incident changes or modal opens
  useEffect(() => {
    if (incident && isOpen) {
      setFormData({
        location: {
          lat: incident.location?.lat || null,
          lng: incident.location?.lng || null
        },
        incidentType: incident.incidentType || '',
        description: incident.description || '',
        reportedAt: dateToLocalDateTime(incident.reportedAt)
      });
      setSelectedLocation({
        lat: incident.location?.lat || null,
        lng: incident.location?.lng || null
      });
      if (incident.location?.lat && incident.location?.lng) {
        setMapCenter({
          lat: incident.location.lat,
          lng: incident.location.lng
        });
      }
      setError('');
      setFieldErrors({
        incidentType: '',
        description: '',
        reportedAt: ''
      });
    }
  }, [incident, isOpen]);

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSelectedLocation({ lat, lng });
    setFormData(prev => ({
      ...prev,
      location: { lat, lng }
    }));
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Real-time validation
    let error = '';
    if (field === 'incidentType') {
      error = validateIncidentType(value);
    } else if (field === 'description') {
      error = validateDescription(value);
    } else if (field === 'reportedAt') {
      error = validateDateTime(value);
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
      setError('You must be logged in to edit an incident');
      return;
    }

    // Validate location
    if (!formData.location.lat || !formData.location.lng) {
      setError('Please select a location on the map');
      return;
    }

    // Validate all fields
    const incidentTypeError = validateIncidentType(formData.incidentType);
    const descriptionError = validateDescription(formData.description);
    const dateTimeError = validateDateTime(formData.reportedAt);

    setFieldErrors({
      incidentType: incidentTypeError,
      description: descriptionError,
      reportedAt: dateTimeError
    });

    if (incidentTypeError || descriptionError || dateTimeError) {
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

      const response = await fetch(`/api/incidents/${incident._id}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
          location: formData.location,
          incidentType: formData.incidentType,
          description: formData.description,
          reportedAt: formData.reportedAt ? new Date(formData.reportedAt).toISOString() : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update incident');
        setSubmitting(false);
        return;
      }

      // Call onSave callback with updated incident
      onSave(data.incident);
      onClose();
    } catch (error) {
      console.error('Error updating incident:', error);
      setError('Failed to update incident. Please try again.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Edit Incident</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Selection */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Location</h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Click on the map to update the incident location
                </p>
                {selectedLocation && (
                  <p className="text-sm text-gray-700 mb-2">
                    Selected: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                  </p>
                )}
              </div>

              {!isLoadingKey && (isGoogleMapsLoaded || apiKey) && (
                <div className="mt-4 h-64 rounded-lg overflow-hidden border border-gray-300">
                  {isGoogleMapsLoaded ? (
                    // Google Maps already loaded, render map directly
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
                          title="Incident Location"
                          iconUrl="https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                        />
                      )}
                    </GoogleMap>
                  ) : (
                    // Google Maps not loaded, use LoadScript
                    <LoadScript
                      googleMapsApiKey={apiKey}
                      libraries={libraries}
                      loadingElement={
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                            title="Incident Location"
                            iconUrl="https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                          />
                        )}
                      </GoogleMap>
                    </LoadScript>
                  )}
                </div>
              )}
            </div>

            {/* Incident Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Incident Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.incidentType}
                onChange={(e) => handleInputChange('incidentType', e.target.value)}
                onBlur={(e) => handleInputChange('incidentType', e.target.value)}
                placeholder="e.g., Theft, Vandalism, Assault, etc."
                maxLength={200}
                required
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  fieldErrors.incidentType 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300'
                }`}
              />
              <div className="flex justify-between items-center mt-1">
                <p className={`text-xs ${fieldErrors.incidentType ? 'text-red-500' : 'text-gray-500'}`}>
                  {fieldErrors.incidentType || `${formData.incidentType.length}/200 characters`}
                </p>
                {formData.incidentType.trim().length > 0 && formData.incidentType.trim().length < 3 && (
                  <p className="text-xs text-amber-600">
                    Minimum 3 characters required
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                onBlur={(e) => handleInputChange('description', e.target.value)}
                placeholder="Provide details about the incident..."
                rows={6}
                maxLength={2000}
                required
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none ${
                  fieldErrors.description 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300'
                }`}
              />
              <div className="flex justify-between items-center mt-1">
                <p className={`text-xs ${fieldErrors.description ? 'text-red-500' : 'text-gray-500'}`}>
                  {fieldErrors.description || `${formData.description.length}/2000 characters`}
                </p>
                {formData.description.trim().length > 0 && formData.description.trim().length < 10 && (
                  <p className="text-xs text-amber-600">
                    Minimum 10 characters required
                  </p>
                )}
              </div>
            </div>

            {/* Date/Time */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleInputChange('reportedAt', getCurrentDateTimeLocal())}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Use Current Time
                </button>
              </div>
              <input
                type="datetime-local"
                value={formData.reportedAt}
                onChange={(e) => handleInputChange('reportedAt', e.target.value)}
                onBlur={(e) => handleInputChange('reportedAt', e.target.value)}
                max={getCurrentDateTimeLocal()}
                required
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  fieldErrors.reportedAt 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300'
                }`}
              />
              <p className={`text-xs mt-1 ${fieldErrors.reportedAt ? 'text-red-500' : 'text-gray-500'}`}>
                {fieldErrors.reportedAt || 'Date and time cannot be in the future or more than 1 year in the past'}
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
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

