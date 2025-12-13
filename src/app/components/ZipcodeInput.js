'use client';

import { useState, useRef, useEffect } from 'react';

const ZipcodeInput = ({ onZipcodeChange, defaultZipcode = '' }) => {
  const [zipcode, setZipcode] = useState(defaultZipcode);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  // Check if Google Maps is already loaded (by MapContainer)
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const checkGoogleMaps = () => {
      try {
        if (window.google && 
            window.google.maps && 
            window.google.maps.places &&
            window.google.maps.places.Autocomplete) {
          setIsGoogleMapsLoaded(true);
          return true;
        }
      } catch (error) {
        // Silently fail if google is not ready
        return false;
      }
      return false;
    };

    // Check immediately
    if (checkGoogleMaps()) {
      return;
    }

    // Poll for Google Maps to be loaded (since MapContainer loads it)
    const interval = setInterval(() => {
      if (checkGoogleMaps()) {
        clearInterval(interval);
      }
    }, 100);

    // Stop polling after 10 seconds to avoid infinite polling
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    // Cleanup
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    // Only run on client side and when Google Maps is loaded
    if (typeof window === 'undefined' || !isGoogleMapsLoaded || !inputRef.current || autocompleteRef.current) {
      return;
    }

    // Double-check that Google Maps Places API is actually available
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.warn('Google Maps Places API not yet available');
      return;
    }

    // Initialize Google Places Autocomplete restricted to postal codes only
    let autocomplete;
    try {
      autocomplete = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['postal_code'],
          componentRestrictions: { country: 'us' },
          fields: ['address_components', 'geometry', 'formatted_address'],
        }
      );
    } catch (error) {
      console.error('Error creating Autocomplete:', error);
      return;
    }

    if (autocomplete) {
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry) {
          return;
        }
        
        // Extract zipcode from address components
        const zipcodeComponent = place.address_components?.find(
          (component) => component.types.includes('postal_code')
        );
        
        if (!zipcodeComponent) {
          return;
        }
        
        const newZipcode = zipcodeComponent.long_name;
        setZipcode(newZipcode);
        
        // Pass the place object so we can get viewport/bounds for proper zooming
        // Wrap in try-catch to prevent crashes
        try {
          onZipcodeChange(newZipcode, place.geometry.location, place.geometry.viewport);
        } catch (error) {
          console.error('Error handling zipcode change:', error);
        }
      });

      autocompleteRef.current = autocomplete;
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current && window.google && window.google.maps && window.google.maps.event) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (error) {
          console.warn('Error clearing autocomplete listeners:', error);
        }
        autocompleteRef.current = null;
      } else if (autocompleteRef.current) {
        autocompleteRef.current = null;
      }
    };
  }, [isGoogleMapsLoaded, onZipcodeChange]);

  const handleZipcodeSubmit = async () => {
    if (zipcode.length !== 5) return;
    
    try {
      // Geocode the zipcode using Google Geocoding API
      const { getGoogleMapsApiKey } = await import('@/lib/gistApiKey');
      const apiKey = await getGoogleMapsApiKey();
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${zipcode}&key=${apiKey}`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.status === 'OK' && geocodeData.results[0]) {
        const result = geocodeData.results[0];
        const location = result.geometry.location;
        const viewport = result.geometry.viewport; // This is a plain object, not LatLngBounds
        
        // Pass location and viewport as plain objects
        onZipcodeChange(zipcode, location, viewport);
      }
    } catch (error) {
      console.error('Failed to geocode zipcode:', error);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    // Only allow digits
    const numericValue = value.replace(/\D/g, '');
    // Limit to 5 digits
    const limitedValue = numericValue.slice(0, 5);
    setZipcode(limitedValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && zipcode.length === 5) {
      e.preventDefault();
      // Trigger geocoding for the zipcode
      handleZipcodeSubmit();
    }
  };

  const handleBlur = () => {
    if (zipcode.length === 5) {
      handleZipcodeSubmit();
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter ZIP code (5 digits)..."
          value={zipcode}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          maxLength={5}
          className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {zipcode.length === 5 && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg
              className="w-5 h-5 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZipcodeInput;

