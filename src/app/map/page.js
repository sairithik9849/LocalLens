'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import Navigation from '@/app/components/Navigation';
import MapContainer from '@/app/components/MapContainer';
import MapFilters from '@/app/components/MapFilters';
import WeatherPill from '@/app/components/WeatherPill';
import { zipcodeToCoords, zipcodeToCoordsGoogle } from '@/lib/geocoding';
import { getGoogleMapsApiKey } from '@/lib/gistApiKey';

export default function MapPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    showIncidents: true,
    showEvents: false,
    showWeather: true,
  });

  const [zipcode, setZipcode] = useState(null);
  const defaultCenter = { lat: 40.748817, lng: -74.044502 }; // Hoboken, NJ fallback
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(12);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [mapKey, setMapKey] = useState(0); // Force map re-render on center change

  // Fetch user zipcode from MongoDB and load map location
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Redirect to login if not authenticated
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchUserZipcode = async () => {
      try {
        setLoading(true);
        setError('');

        // Get Firebase ID token for authentication
        const { auth } = await import('@/firebase/config');
        const { getAuth } = await import('firebase/auth');
        const currentAuth = auth || getAuth();
        const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

        const headers = {};
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }

        // Fetch user profile
        const response = await fetch(`/api/users/profile?uid=${encodeURIComponent(user.uid)}`, {
          headers: headers
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch user profile');
        }

        const data = await response.json();
        
        // Check if user is banned
        if (data.user?.moderation?.banned === true) {
          router.replace('/banned');
          return;
        }

        // Get zipcode from profile (check both zipcode and pincode for compatibility)
        const userZipcode = data.user?.profile?.zipcode || data.user?.profile?.pincode;
        
        if (!userZipcode) {
          setError('No zipcode found in your profile. Please update your profile with a zipcode.');
          setLoading(false);
          return;
        }

        setZipcode(userZipcode);

        // Geocode the zipcode to get coordinates
        let coords;
        let viewport = null;
        
        try {
          // Try Google Geocoding first
          const apiKey = await getGoogleMapsApiKey();
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${userZipcode}&key=${apiKey}`;
          const geocodeResponse = await fetch(geocodeUrl);
          const geocodeData = await geocodeResponse.json();

          if (geocodeData.status === 'OK' && geocodeData.results[0]) {
            const result = geocodeData.results[0];
            coords = {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng,
            };
            viewport = result.geometry.viewport; // Plain object with northeast and southwest
          } else {
            throw new Error('Google Geocoding failed');
          }
        } catch (error) {
          console.warn('Google Geocoding failed, trying OpenStreetMap:', error);
          // Fallback to OpenStreetMap
          const coordsData = await zipcodeToCoords(userZipcode);
          coords = { lat: coordsData.lat, lng: coordsData.lng };
        }

        // Calculate bounds for 2.5-mile radius around the zipcode
        // Average US zipcode has a radius of ~2.5 miles (covers ~29 square miles)
        // 1 degree latitude ≈ 69 miles
        // 2.5 miles ≈ 2.5/69 ≈ 0.036 degrees
        const radiusInMiles = 0.8;
        const radiusInDegrees = radiusInMiles / 69; // Approximately 0.036 degrees for 2.5 miles
        
        const latRad = (coords.lat * Math.PI) / 180;
        const lngRadiusInDegrees = radiusInDegrees / Math.cos(latRad);
        
        const boundsData = {
          northeast: {
            lat: coords.lat + radiusInDegrees,
            lng: coords.lng + lngRadiusInDegrees
          },
          southwest: {
            lat: coords.lat - radiusInDegrees,
            lng: coords.lng - lngRadiusInDegrees
          }
        };
        
        // Set viewport bounds for 2.5-mile radius
        // We'll convert this to LatLngBounds in the MapContainer when Google Maps is loaded
        setViewportBounds(boundsData);
        
        // Set a default zoom level (will be overridden by fitBounds)
        let newZoom = 13;

        // Update map center and zoom
        setMapCenter(coords);
        setZoom(newZoom);
        setMapKey(prev => prev + 1);
      } catch (error) {
        console.error('Failed to load user zipcode:', error);
        setError(error.message || 'Failed to load your location');
      } finally {
        setLoading(false);
      }
    };

    fetchUserZipcode();
  }, [user, authLoading, router]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-base-200 animate-page-transition">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content/70 mt-4">Loading your location...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if no zipcode
  if (error || !zipcode) {
    return (
      <div className="min-h-screen bg-base-200 animate-page-transition">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="card bg-base-100 shadow-xl max-w-md">
            <div className="card-body">
              <h2 className="card-title text-base-content">Location Required</h2>
              <p className="text-base-content/70">{error || 'No zipcode found in your profile.'}</p>
              <div className="card-actions justify-end mt-4">
                <button
                  onClick={() => router.push('/profile')}
                  className="btn btn-primary"
                >
                  Update Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 animate-page-transition">
      <Navigation />
      
      <div className="h-[calc(100vh-64px)] w-full overflow-hidden relative">
        {/* Map Container */}
        <div className="absolute inset-0">
          <MapContainer 
            key={mapKey}
            center={mapCenter}
            zoom={zoom}
            viewportBounds={viewportBounds}
            filters={filters}
            zipcode={zipcode}
          />
        </div>
        
        {/* Map Header with Filters */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <MapFilters 
            filters={filters} 
            onFilterChange={handleFilterChange}
          />
        </div>
          
        {/* Overlay Controls */}
        <div className="absolute top-16 left-1 right-1 z-10 flex flex-col gap-3">
          {/* Weather Pill */}
          {filters.showWeather && zipcode && (
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

