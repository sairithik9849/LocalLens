'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import Navigation from '@/app/components/Navigation';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/app/components/AdvancedMarker';
import { useGoogleMapsLoader } from '@/lib/useGoogleMapsLoader';
import Link from 'next/link';

// Static libraries array to prevent LoadScript reload
// 'marker' library is required for AdvancedMarkerElement
const libraries = ['places', 'marker'];

export default function ReportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { apiKey, isGoogleMapsLoaded, isLoadingKey } = useGoogleMapsLoader(libraries);
  const mapRef = useRef(null);

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

  const [formData, setFormData] = useState({
    location: { lat: null, lng: null },
    incidentType: '',
    description: '',
    reportedAt: getCurrentDateTimeLocal() // Format: YYYY-MM-DDTHH:mm in local timezone
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    incidentType: '',
    description: '',
    reportedAt: ''
  });

  // Default center (Hoboken, NJ)
  const defaultCenter = { lat: 40.748817, lng: -74.044502 };
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [selectedLocation, setSelectedLocation] = useState(null);


  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSelectedLocation({ lat, lng });
    setFormData(prev => ({
      ...prev,
      location: { lat, lng }
    }));
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
    // Check for only whitespace or special characters
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
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date and time format';
    }
    
    // Check if date is in the future
    if (date > now) {
      return 'Date and time cannot be in the future';
    }
    
    // Check if date is too far in the past (more than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (date < oneYearAgo) {
      return 'Date and time cannot be more than 1 year in the past';
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
    if (field === 'incidentType') {
      error = validateIncidentType(value);
    } else if (field === 'description') {
      error = validateDescription(value);
    } else if (field === 'reportedAt') {
      error = validateDateTime(value);
    }

    setFieldErrors(prev => {
      // Clear general error when user starts typing and fixes an error
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
      setError('You must be logged in to report an incident');
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

    // If any validation errors, stop submission
    if (incidentTypeError || descriptionError || dateTimeError) {
      setError('Please fix all validation errors before submitting');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.uid
        },
        body: JSON.stringify({
          location: formData.location,
          incidentType: formData.incidentType,
          description: formData.description,
          reportedAt: formData.reportedAt ? new Date(formData.reportedAt).toISOString() : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to submit report');
        setSubmitting(false);
        return;
      }

      // Show confirmation and reset form
      alert('Report submitted successfully!');
      
      // Reset form
      setFormData({
        location: { lat: null, lng: null },
        incidentType: '',
        description: '',
        reportedAt: getCurrentDateTimeLocal()
      });
      setSelectedLocation(null);
      setError('');
      setSubmitting(false);
    } catch (error) {
      console.error('Error submitting report:', error);
      setError('Failed to submit report. Please try again.');
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Please log in to report an incident.</p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Go to Login
            </button>
          </div>
        </div>
      </>
    );
  }

  const mapOptions = {
    disableDefaultUI: false,
    clickableIcons: true,
    scrollwheel: true,
    mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto p-6">
          {/* Navigation Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-600">
            <Link 
              href="/incidents" 
              className="hover:text-blue-600 transition-colors"
            >
              Incidents
            </Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Report Incident</span>
          </div>

          {/* Header with Back Button */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Report Crime/Incident</h1>
            <Link
              href="/incidents"
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors flex items-center gap-2"
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
              Back to Incidents
            </Link>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Selection */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Location</h2>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Click on the map to select the incident location
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
            <div className="bg-white p-6 rounded-lg shadow">
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
            <div className="bg-white p-6 rounded-lg shadow">
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
            <div className="bg-white p-6 rounded-lg shadow">
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

            {/* Submit Button */}
            <div className="flex gap-4 items-center">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/incidents')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
              <Link
                href="/incidents"
                className="ml-auto px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
              >
                View All Incidents →
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

