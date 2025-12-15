'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { useGoogleMapsLoader } from '@/lib/useGoogleMapsLoader';
import Link from 'next/link';

const libraries = ['places'];

const MapContainer = ({ center, zoom, viewportBounds, filters, zipcode }) => {
  const mapRef = useRef(null);
  const { apiKey, isGoogleMapsLoaded, isLoadingKey } = useGoogleMapsLoader(libraries);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const hasFetchedRef = useRef(false);

  // Debug: Log when incidents change
  useEffect(() => {
    console.log('[MapContainer] Incidents state updated:', incidents.length, 'incidents');
    console.log('[MapContainer] Filters.showIncidents:', filters.showIncidents);
    if (incidents.length > 0) {
      console.log('[MapContainer] First incident:', incidents[0]);
    }
  }, [incidents, filters.showIncidents]);


  useEffect(() => {
    if (!mapRef.current || !center) return;
    
    try {
      if (viewportBounds) { 
        try {
          let boundsToFit = viewportBounds;
          
          if (typeof window !== 'undefined' && window.google && window.google.maps) {
            if (viewportBounds.northeast && viewportBounds.southwest && typeof viewportBounds.getNorthEast !== 'function') {
              boundsToFit = new window.google.maps.LatLngBounds(
                new window.google.maps.LatLng(viewportBounds.southwest.lat, viewportBounds.southwest.lng),
                new window.google.maps.LatLng(viewportBounds.northeast.lat, viewportBounds.northeast.lng)
              );
            }
          }
          
          mapRef.current.fitBounds(boundsToFit);
        } catch (boundsError) {
          console.error('Error fitting bounds:', boundsError);
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
    streetViewControl: false, // Remove street view pegman icon
    mapTypeControl: false, // Remove map/satellite view toggle
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      },
    ],
  }), []);

  // Fetch incidents when center changes and incidents filter is enabled
  useEffect(() => {
    // Check conditions - we don't need Google Maps loaded to fetch data, only to display markers
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
      console.log('[MapContainer] No valid center, skipping incidents fetch', center);
      return;
    }
    
    if (!filters.showIncidents) {
      console.log('[MapContainer] Incidents filter disabled, skipping fetch');
      return;
    }

    // Create a location key to track if we've fetched for this location
    const locationKey = `${center.lat.toFixed(4)}_${center.lng.toFixed(4)}_${zipcode || 'nozip'}`;
    const isFirstFetch = !hasFetchedRef.current || hasFetchedRef.current !== locationKey;

    console.log('[MapContainer] Fetching incidents for:', { lat: center.lat, lng: center.lng, zipcode, isFirstFetch });

    const fetchIncidents = async () => {
      try {
        setLoadingIncidents(true);
        
        // Get Firebase ID token for authentication
        const { auth } = await import('@/firebase/config');
        const { getAuth } = await import('firebase/auth');
        const currentAuth = auth || getAuth();
        const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

        const headers = {};
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }

        const params = new URLSearchParams({
          lat: center.lat.toString(),
          lng: center.lng.toString(),
        });
        if (zipcode) {
          params.append('zipcode', zipcode);
        }

        if (isFirstFetch) {
          params.append('refresh', 'true');
          hasFetchedRef.current = locationKey;
          console.log('[MapContainer] First fetch for location, forcing refresh to bypass cache');
        }

        const url = `/api/map/incidents?${params.toString()}`;
        console.log('[MapContainer] Fetching from:', url);

        const response = await fetch(url, {
          headers: headers
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch incidents');
        }

        const data = await response.json();
        console.log('[MapContainer] Received incidents:', data.count || 0);
        console.log('[MapContainer] Incidents data:', data.incidents);
        const incidentsArray = data.incidents || [];
        console.log('[MapContainer] Setting incidents state with:', incidentsArray.length, 'items');
        setIncidents(incidentsArray);
      } catch (error) {
        console.error('[MapContainer] Error fetching incidents:', error);
        setIncidents([]);
      } finally {
        setLoadingIncidents(false);
      }
    };

    fetchIncidents();
  }, [center, filters.showIncidents, zipcode]);

  // Loading state
  if (isLoadingKey) {
    return (
      <div className="flex items-center justify-center h-full bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content/70 mt-4">Loading map...</p>
        </div>
      </div>
    );
  }

  // Error state - only show if we need API key but don't have it
  if (!isGoogleMapsLoaded && !apiKey) {
    return (
      <div className="flex items-center justify-center h-full bg-base-200">
        <div className="card bg-base-100 shadow-xl max-w-md">
          <div className="card-body">
            <h2 className="card-title text-base-content">Google Maps API Key Required</h2>
            <p className="text-base-content/70">
              Failed to load API key
            </p>
            <div className="bg-base-200 p-4 rounded-lg text-left text-sm mt-4">
              <p className="font-semibold mb-2">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-2 text-base-content/70">
                <li>Create a GitHub Gist with your API key in this format:</li>
                <code className="block bg-base-300 px-2 py-1 rounded my-2">
                  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
                </code>
                <li>Get the raw URL from your Gist (click "Raw" button)</li>
                <li>Update <code className="bg-base-300 px-1 rounded">GIST_RAW_URL</code> in <code className="bg-base-300 px-1 rounded">src/lib/gistApiKey.js</code></li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Map component - render directly if Google Maps is already loaded, otherwise use LoadScript
  const mapComponent = (
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
            let boundsToFit = viewportBounds;
            
            // If viewportBounds is a plain object (not a LatLngBounds instance), convert it
            if (viewportBounds.northeast && viewportBounds.southwest && typeof viewportBounds.getNorthEast !== 'function') {
              // It's a plain object, convert to LatLngBounds
              boundsToFit = new window.google.maps.LatLngBounds(
                new window.google.maps.LatLng(viewportBounds.southwest.lat, viewportBounds.southwest.lng),
                new window.google.maps.LatLng(viewportBounds.northeast.lat, viewportBounds.northeast.lng)
              );
            }
            
            map.fitBounds(boundsToFit);
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
      {/* Incident Markers */}
      {filters.showIncidents && incidents.length > 0 && incidents.map((incident) => {
        if (!incident.location || typeof incident.location.lat !== 'number' || typeof incident.location.lng !== 'number') {
          console.warn('[MapContainer] Invalid incident location:', incident);
          return null;
        }
        
        // Check if incident is old (older than 3 days)
        const now = new Date();
        // Calculate timeToOld if not provided (for cached data compatibility)
        let timeToOld = incident.timeToOld ? new Date(incident.timeToOld) : null;
        if (!timeToOld && incident.reportedAt) {
          const reportedAt = new Date(incident.reportedAt);
          const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
          timeToOld = new Date(reportedAt.getTime() + threeDaysInMs);
        }
        const isOld = timeToOld && now > timeToOld;
        
        // Determine marker color: grey if old, red if recent
        const markerColor = isOld ? '#6B7280' : '#DC2626'; // grey-500 if old, red-600 if recent
        
        // Create custom icon for incident marker (red or grey circle with exclamation)
        const iconUrl = typeof window !== 'undefined' && window.google
          ? 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="${markerColor}" stroke="#FFFFFF" stroke-width="2"/>
                <text x="16" y="22" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">!</text>
              </svg>
            `)
          : isOld 
            ? 'https://maps.google.com/mapfiles/ms/icons/grey-dot.png'
            : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'; // Fallback

        return (
          <Marker
            key={incident._id}
            position={{ lat: incident.location.lat, lng: incident.location.lng }}
            title={incident.incidentType}
            icon={typeof window !== 'undefined' && window.google ? {
              url: iconUrl,
              scaledSize: new window.google.maps.Size(32, 32),
              anchor: new window.google.maps.Point(16, 32),
            } : undefined}
            onClick={() => {
              console.log('[MapContainer] Marker clicked:', incident);
              setSelectedIncident(incident);
            }}
          />
        );
      })}

    </GoogleMap>
  );

  // Helper function to format relative time
  const getRelativeTime = (date) => {
    const now = new Date();
    const incidentDate = new Date(date);
    const diffInSeconds = Math.floor((now - incidentDate) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return incidentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Helper function to get incident type icon
  const getIncidentTypeIcon = (type) => {
    const icons = {
      'Accident': '🚗',
      'Crime': '🚨',
      'Fire': '🔥',
      'Medical': '🏥',
      'Weather': '⛈️',
      'Infrastructure': '🏗️',
      'Other': '📋'
    };
    // Check for partial matches (case-insensitive)
    const typeLower = type?.toLowerCase() || '';
    if (typeLower.includes('theft') || typeLower.includes('stolen')) return '🚨';
    if (typeLower.includes('accident') || typeLower.includes('crash')) return '🚗';
    if (typeLower.includes('fire')) return '🔥';
    if (typeLower.includes('bike') || typeLower.includes('vehicle')) return '🚲';
    return icons[type] || '📍';
  };

  // Helper function to get incident type color
  const getIncidentTypeColor = (type) => {
    const colors = {
      'Accident': 'badge-error',
      'Crime': 'badge-warning',
      'Fire': 'badge-error',
      'Medical': 'badge-info',
      'Weather': 'badge-secondary',
      'Infrastructure': 'badge-primary',
      'Other': 'badge-neutral'
    };
    // Check for partial matches (case-insensitive)
    const typeLower = type?.toLowerCase() || '';
    if (typeLower.includes('theft') || typeLower.includes('stolen')) return 'badge-error';
    if (typeLower.includes('accident') || typeLower.includes('crash')) return 'badge-error';
    if (typeLower.includes('fire')) return 'badge-error';
    return colors[type] || 'badge-neutral';
  };

  // If Google Maps is already loaded, render map directly without LoadScript
  if (isGoogleMapsLoaded) {
    return (
      <>
        {mapComponent}
        {/* Incident Detail Modal */}
        {selectedIncident && (
          <IncidentDetailModal
            incident={selectedIncident}
            onClose={() => setSelectedIncident(null)}
            getRelativeTime={getRelativeTime}
            getIncidentTypeColor={getIncidentTypeColor}
            getIncidentTypeIcon={getIncidentTypeIcon}
          />
        )}
      </>
    );
  }

  // Otherwise, use LoadScript to load Google Maps
  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      libraries={libraries}
       loadingElement={
         <div className="flex items-center justify-center h-full bg-base-200">
           <div className="text-center">
             <span className="loading loading-spinner loading-lg text-primary"></span>
             <p className="text-base-content/70 mt-4">Loading map...</p>
           </div>
         </div>
       }
      preventGoogleFontsLoading={true}
    >
      {mapComponent}
      {/* Incident Detail Modal */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          getRelativeTime={getRelativeTime}
          getIncidentTypeColor={getIncidentTypeColor}
          getIncidentTypeIcon={getIncidentTypeIcon}
        />
      )}
    </LoadScript>
  );
};

// Incident Detail Modal Component
const IncidentDetailModal = ({ incident, onClose, getRelativeTime, getIncidentTypeColor, getIncidentTypeIcon }) => {
  if (!incident) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="card bg-base-100 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-base-300 animate-fade-in-up">
        {/* Header */}
        <div className="card-body pb-4 border-b border-base-300 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl ${getIncidentTypeColor(incident.incidentType).replace('badge-', 'bg-')}/20 flex items-center justify-center text-4xl shadow-lg`}>
                {getIncidentTypeIcon(incident.incidentType)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-base-content">Incident Details</h2>
                  <span className={`badge badge-lg ${getIncidentTypeColor(incident.incidentType)}`}>
                    {incident.incidentType}
                  </span>
                </div>
                <p className="text-sm text-base-content/60 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reported {getRelativeTime(incident.reportedAt)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost hover:bg-base-200 transition-all"
              aria-label="Close modal"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          <div className="card-body space-y-6">
            {/* Description */}
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body py-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-base-content/60"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                    Description
                  </label>
                </div>
                <p className="text-base text-base-content whitespace-pre-wrap leading-relaxed">
                  {incident.description}
                </p>
              </div>
            </div>

            {/* Grid Layout for Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reported By */}
              {incident.reportedBy && (
                <div className="card bg-base-200 border border-base-300">
                  <div className="card-body py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-base-content/60"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                        Reported By
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      {incident.reportedBy.photoURL ? (
                        <img
                          src={incident.reportedBy.photoURL}
                          alt={`${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`}
                          className="w-12 h-12 rounded-full border-2 border-base-300"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary text-primary-content flex items-center justify-center font-semibold text-lg border-2 border-base-300">
                          {incident.reportedBy.firstName?.[0] || incident.reportedBy.lastName?.[0] || 'U'}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-base-content">
                          {incident.reportedBy.firstName} {incident.reportedBy.lastName}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Location */}
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-base-content/60"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
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
                    <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                      Location
                    </label>
                  </div>
                  <p className="text-sm text-base-content/70 font-mono">
                    {incident.location.lat.toFixed(6)}, {incident.location.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="card-body pt-4 border-t border-base-300 bg-base-200">
          <Link
            href="/incidents"
            className="btn btn-primary w-full"
          >
            View All Incidents →
          </Link>
        </div>
      </div>
    </div>
  );
};


export default MapContainer;

