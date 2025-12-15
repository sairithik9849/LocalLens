'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import Navigation from '@/app/components/Navigation';
import MapContainer from '@/app/components/MapContainer';
import MapFilters from '@/app/components/MapFilters';
import WeatherPill from '@/app/components/WeatherPill';
import { zipcodeToCoords } from '@/lib/geocoding';
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
  const defaultCenter = { lat: 40.748817, lng: -74.044502 };
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(12);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [mapKey, setMapKey] = useState(0); 

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    const fetchUserZipcode = async () => {
      try {
        setLoading(true);
        setError('');

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

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch user profile');
        }

        const data = await response.json();
        
        if (data.user?.moderation?.banned === true) {
          router.replace('/banned');
          return;
        }

        const userZipcode = data.user?.profile?.zipcode || data.user?.profile?.pincode;
        
        if (!userZipcode) {
          setError('No zipcode found in your profile. Please update your profile with a zipcode.');
          setLoading(false);
          return;
        }

        setZipcode(userZipcode);

        let coords;
        let viewport = null;
        
        try {
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
            viewport = result.geometry.viewport;
          } else {
            throw new Error('Google Geocoding failed');
          }
        } catch (error) {
          console.warn('Google Geocoding failed, trying OpenStreetMap:', error);
          const coordsData = await zipcodeToCoords(userZipcode);
          coords = { lat: coordsData.lat, lng: coordsData.lng };
        }

        const radiusInMiles = 0.8;
        const radiusInDegrees = radiusInMiles / 69;
        
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
        
        setViewportBounds(boundsData);
        
        let newZoom = 13;

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

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const loadFilters = async () => {
      try {
        const { auth } = await import('@/firebase/config');
        const { getAuth } = await import('firebase/auth');
        const currentAuth = auth || getAuth();
        const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

        const headers = {};
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }

        const response = await fetch('/api/map/preferences', {
          headers,
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json().catch(() => ({}));
        if (data && data.filters && typeof data.filters === 'object') {
          setFilters((prev) => ({
            ...prev,
            ...data.filters,
          }));
        }
      } catch {
        
      }
    };

    loadFilters();
  }, [authLoading, user]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);

    const saveFilters = async () => {
      try {
        const { auth } = await import('@/firebase/config');
        const { getAuth } = await import('firebase/auth');
        const currentAuth = auth || getAuth();
        const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

        const headers = {
          'Content-Type': 'application/json',
        };
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }

        await fetch('/api/map/preferences', {
          method: 'POST',
          headers,
          body: JSON.stringify({ filters: newFilters }),
        });
      } catch {
      }
    };

    saveFilters();
  };

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

