'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { getGoogleMapsApiKey } from '@/lib/gistApiKey';

// Static libraries array to prevent LoadScript reload
const libraries = ['places'];

const MapContainer = ({ center, zoom, viewportBounds, filters }) => {
  const mapRef = useRef(null);
  const [apiKey, setApiKey] = useState(null);
  const [apiKeyError, setApiKeyError] = useState(null);
  const [isLoadingKey, setIsLoadingKey] = useState(true);

  useEffect(() => {
    // Fetch API key from Gist
    const loadApiKey = async () => {
      try {
        setIsLoadingKey(true);
        setApiKeyError(null);
        const key = await getGoogleMapsApiKey();
        setApiKey(key);
      } catch (error) {
        console.error('Error loading API key:', error);
        setApiKeyError(error.message);
      } finally {
        setIsLoadingKey(false);
      }
    };

    loadApiKey();
  }, []);

  // Update map center and zoom when props change
  useEffect(() => {
    if (!mapRef.current || !center) return;
    
    try {
      // Use fitBounds if we have viewport bounds for better zooming
      if (viewportBounds) { 
        try {
          mapRef.current.fitBounds(viewportBounds);
        } catch (boundsError) {
          console.error('Error fitting bounds:', boundsError);
          // Fallback to pan and zoom
          mapRef.current.panTo(center);
          mapRef.current.setZoom(zoom);
        }
      } else {
        // Otherwise, pan to center and set zoom
        mapRef.current.panTo(center);
        mapRef.current.setZoom(zoom);
      }
    } catch (error) {
      console.error('Error updating map:', error);
    }
  }, [center, zoom, viewportBounds]);

  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    clickableIcons: true,
    scrollwheel: true,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      },
    ],
  }), []);

  // Dummy markers for demonstration
  const dummyMarkers = [
    {
      id: 2,
      position: { lat: center.lat - 0.01, lng: center.lng - 0.01 },
      title: 'Alert: Road Closure',
      type: 'alert',
      visible: filters.showAlerts,
    },
    {
      id: 3,
      position: { lat: center.lat, lng: center.lng + 0.015 },
      title: 'Community Event',
      type: 'event',
      visible: filters.showEvents,
    },
  ];

  const visibleMarkers = dummyMarkers.filter(marker => marker.visible);

  // Loading state
  if (isLoadingKey) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading API key...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (apiKeyError || !apiKey) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Google Maps API Key Required</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {apiKeyError 
              ? `Error: ${apiKeyError}`
              : 'Failed to load API key'
            }
          </p>
          <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-lg text-left text-sm">
            <p className="font-semibold mb-2">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400">
              <li>Create a GitHub Gist with your API key in this format:</li>
              <code className="block bg-gray-300 dark:bg-gray-700 px-2 py-1 rounded my-2">
                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
              </code>
              <li>Get the raw URL from your Gist (click "Raw" button)</li>
              <li>Update <code className="bg-gray-300 dark:bg-gray-700 px-1 rounded">GIST_RAW_URL</code> in <code className="bg-gray-300 dark:bg-gray-700 px-1 rounded">src/lib/gistApiKey.js</code></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      libraries={libraries}
      loadingElement={
        <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading map...</p>
          </div>
        </div>
      }
      preventGoogleFontsLoading={true}
    >
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        options={mapOptions}
        onLoad={(map) => {
          mapRef.current = map;
          // Center map on initial load
          try {
            if (viewportBounds) {
              map.fitBounds(viewportBounds);
            } else {
              map.panTo(center);
              map.setZoom(zoom);
            }
          } catch (error) {
            console.error('Error initializing map:', error);
            map.panTo(center);
            map.setZoom(zoom);
          }
        }}
      >
        {visibleMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            title={marker.title}
            icon={{
              url: getMarkerIcon(marker.type),
              scaledSize: typeof window !== 'undefined' && window.google 
                ? new window.google.maps.Size(32, 32)
                : undefined,
            }}
          />
        ))}
      </GoogleMap>
    </LoadScript>
  );
};

// Helper function to get marker icons based on type
const getMarkerIcon = (type) => {
  const icons = {
    weather: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
    alert: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
    event: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
    trend: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
  };
  return icons[type] || icons.weather;
};

export default MapContainer;

