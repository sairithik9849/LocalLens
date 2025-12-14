'use client';

import { useState, useEffect } from 'react';
import { getGoogleMapsApiKey } from '@/lib/gistApiKey';

/**
 * Custom hook to check if Google Maps API is already loaded
 * and handle API key loading if needed
 * @param {string[]} requiredLibraries - Array of required libraries (e.g., ['places', 'marker'])
 * @returns {Object} { apiKey, isGoogleMapsLoaded, isLoadingKey }
 */
export function useGoogleMapsLoader(requiredLibraries = ['places', 'marker']) {
  const [apiKey, setApiKey] = useState(null);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  useEffect(() => {
    // Check if Google Maps is already loaded
    const checkGoogleMaps = () => {
      if (typeof window === 'undefined') return false;
      
      if (window.google && window.google.maps) {
        // Check if all required libraries are loaded
        const allLibrariesLoaded = requiredLibraries.every(lib => {
          if (lib === 'places') {
            return window.google.maps.places !== undefined;
          }
          if (lib === 'marker') {
            return window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;
          }
          return true; // For other libraries, assume loaded if maps is loaded
        });

        if (allLibrariesLoaded) {
          setIsGoogleMapsLoaded(true);
          setIsLoadingKey(false);
          return true;
        }
      }
      return false;
    };

    // Check immediately
    if (checkGoogleMaps()) {
      return;
    }

    // Poll for Google Maps to be loaded (in case it's loading from another component)
    const checkInterval = setInterval(() => {
      if (checkGoogleMaps()) {
        clearInterval(checkInterval);
      }
    }, 100);

    // Load API key if Google Maps is not already loaded
    const loadApiKey = async () => {
      try {
        setIsLoadingKey(true);
        const key = await getGoogleMapsApiKey();
        setApiKey(key);
      } catch (error) {
        console.error('Error loading API key:', error);
      } finally {
        setIsLoadingKey(false);
      }
    };
    
    // Wait a bit to see if another component loads it
    // Check window object directly instead of state to avoid stale closure
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      // Check again if Google Maps was loaded by another component
      if (!checkGoogleMaps()) {
        loadApiKey();
      }
    }, 500);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, [requiredLibraries]);

  return { apiKey, isGoogleMapsLoaded, isLoadingKey };
}

