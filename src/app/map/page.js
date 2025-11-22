'use client';

import { useState, useEffect } from 'react';
import MapContainer from '@/app/components/MapContainer';
import MapFilters from '@/app/components/MapFilters';
import ZipcodeInput from '@/app/components/ZipcodeInput';
import WeatherPill from '@/app/components/WeatherPill';
import { zipcodeToCoords, zipcodeToCoordsGoogle } from '@/lib/geocoding';

export default function MapPage() {
  const [filters, setFilters] = useState({
    tags: [],
    showWeather: true,
    showAlerts: true,
    showEvents: true,
    showTrends: false,
  });

  // Default zipcode - hardcoded for now
  const defaultZipcode = '07030'; // Hoboken, NJ
  const [zipcode, setZipcode] = useState(defaultZipcode);
  const defaultCenter = { lat: 40.748817, lng: -74.044502 }; // Hoboken, NJ
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(12);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [mapKey, setMapKey] = useState(0); // Force map re-render on center change

  // Load default zipcode location on mount
  useEffect(() => {
    const loadDefaultLocation = async () => {
      try {
        // Try Google Geocoding first, fallback to OpenStreetMap
        try {
          const { getGoogleMapsApiKey } = await import('@/lib/gistApiKey');
          const apiKey = await getGoogleMapsApiKey();
          const coords = await zipcodeToCoordsGoogle(defaultZipcode, apiKey);
          setMapCenter({ lat: coords.lat, lng: coords.lng });
        } catch (error) {
          // Fallback to OpenStreetMap
          const coords = await zipcodeToCoords(defaultZipcode);
          setMapCenter({ lat: coords.lat, lng: coords.lng });
        }
        setMapKey(prev => prev + 1); // Force map update
      } catch (error) {
        console.error('Failed to load default location:', error);
        // Keep default center if geocoding fails
      }
    };
    loadDefaultLocation();
  }, []);

  const handleZipcodeChange = (newZipcode, googleLocation, viewport) => {
    // Prevent errors from crashing the app
    if (!newZipcode || !googleLocation) {
      console.warn('Missing zipcode or location');
      return;
    }
    
    try {
      setZipcode(newZipcode);
      
      // Handle both Google Maps LatLng object and plain object
      let coords;
      try {
        coords = {
          lat: typeof googleLocation.lat === 'function' ? googleLocation.lat() : googleLocation.lat,
          lng: typeof googleLocation.lng === 'function' ? googleLocation.lng() : googleLocation.lng,
        };
      } catch (error) {
        console.error('Error extracting coordinates:', error);
        return;
      }
      
      // Determine appropriate zoom level based on viewport bounds
      let newZoom = 13; // Default zoom for zipcodes
      
      if (viewport) {
        try {
          // Check if viewport is a Google Maps LatLngBounds object or plain object
          let ne, sw;
          
          if (typeof viewport.getNorthEast === 'function') {
            // Google Maps LatLngBounds object (from autocomplete)
            ne = viewport.getNorthEast();
            sw = viewport.getSouthWest();
            // Store the bounds object - React should handle it fine
            setViewportBounds(viewport);
          } else if (viewport.northeast && viewport.southwest) {
            // Plain object from geocoding API
            ne = viewport.northeast;
            sw = viewport.southwest;
            // Convert to Google Maps LatLngBounds for fitBounds
            if (typeof window !== 'undefined' && window.google && window.google.maps) {
              try {
                const bounds = new window.google.maps.LatLngBounds(
                  new window.google.maps.LatLng(sw.lat, sw.lng),
                  new window.google.maps.LatLng(ne.lat, ne.lng)
                );
                setViewportBounds(bounds);
              } catch (boundsError) {
                console.error('Error creating bounds:', boundsError);
                setViewportBounds(null);
              }
            } else {
              setViewportBounds(null);
            }
          } else {
            setViewportBounds(null);
          }
          
          // Calculate zoom based on viewport bounds
          if (ne && sw) {
            try {
              const neLat = typeof ne.lat === 'function' ? ne.lat() : ne.lat;
              const neLng = typeof ne.lng === 'function' ? ne.lng() : ne.lng;
              const swLat = typeof sw.lat === 'function' ? sw.lat() : sw.lat;
              const swLng = typeof sw.lng === 'function' ? sw.lng() : sw.lng;
              
              const latDiff = neLat - swLat;
              const lngDiff = neLng - swLng;
              
              // Adjust zoom based on area size
              // Smaller area = higher zoom, larger area = lower zoom
              if (latDiff < 0.01 || lngDiff < 0.01) {
                newZoom = 15; // Very specific location (building/address)
              } else if (latDiff < 0.05 || lngDiff < 0.05) {
                newZoom = 14; // Neighborhood
              } else if (latDiff < 0.1 || lngDiff < 0.1) {
                newZoom = 13; // City area
              } else if (latDiff < 0.5 || lngDiff < 0.5) {
                newZoom = 11; // Larger city/metro area
              } else {
                newZoom = 10; // State/region
              }
            } catch (zoomError) {
              console.error('Error calculating zoom:', zoomError);
            }
          }
        } catch (viewportError) {
          console.error('Error processing viewport:', viewportError);
          setViewportBounds(null);
        }
      } else {
        setViewportBounds(null);
      }
      
      // Update map center and zoom to focus on the location
      // Use setTimeout to batch state updates and prevent race conditions
      setTimeout(() => {
        setMapCenter(coords);
        setZoom(newZoom);
        setMapKey(prev => prev + 1); // Force map update
      }, 0);
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Filter Sidebar */}
      <MapFilters 
        filters={filters} 
        onFilterChange={handleFilterChange}
      />

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapContainer 
          key={mapKey}
          center={mapCenter}
          zoom={zoom}
          viewportBounds={viewportBounds}
          filters={filters}
        />
        
        {/* Overlay Controls */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-3">
          {/* Zipcode Input */}
          <ZipcodeInput 
            onZipcodeChange={handleZipcodeChange}
            defaultZipcode={zipcode}
          />
          
          {/* Weather Pill */}
          {filters.showWeather && (
            <div className="flex justify-start">
              <WeatherPill 
                zipcode={zipcode}
                lat={mapCenter.lat}
                lng={mapCenter.lng}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

