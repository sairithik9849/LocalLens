'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import { useRequireNonAdmin } from '@/hooks/useRequireNonAdmin';
import { useCheckBanned } from '@/hooks/useCheckBanned';
import Navigation from '@/app/components/Navigation';
import EditIncidentModal from '@/app/components/EditIncidentModal';
import { zipcodeToCoordsGoogle, zipcodeToCoords } from '@/lib/geocoding';
import { getGoogleMapsApiKey } from '@/lib/gistApiKey';
import Link from 'next/link';

export default function IncidentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { checkingAdmin } = useRequireNonAdmin();
  const { checkingBanned } = useCheckBanned();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pincode, setPincode] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [insights, setInsights] = useState({
    totalCount: 0,
    typesBreakdown: {},
    recentIncidents: []
  });
  const [editingIncident, setEditingIncident] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingIncident, setDeletingIncident] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewingIncident, setViewingIncident] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [incidentAddress, setIncidentAddress] = useState(null);
  const [incidentAddressLoading, setIncidentAddressLoading] = useState(false);
  const [incidentAddresses, setIncidentAddresses] = useState({}); // Map of incident ID to address
  const [incidentAddressesLoading, setIncidentAddressesLoading] = useState({}); // Map of incident ID to loading state
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState(null);
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'type'
  const [filteredIncidents, setFilteredIncidents] = useState([]);

  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading || checkingAdmin || checkingBanned) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    const fetchUserPincode = async () => {
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
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch user profile');
        }

        const userPincode = data.user?.profile?.pincode;
        setUserProfile(data.user); // Store user profile to get MongoDB _id
        
        if (!userPincode) {
          setPincode(null);
          setLoading(false);
          return;
        }

        setPincode(userPincode);

        // Try to use RabbitMQ queue for geocoding
        let coords;
        try {
          // Publish geocoding job to queue
          const geocodeResponse = await fetch(`/api/geocoding/coords?pincode=${encodeURIComponent(userPincode)}`);
          
          if (!geocodeResponse.ok && geocodeResponse.status !== 202) {
            // Non-202 error, fall back to direct geocoding
            throw new Error(`Geocoding API returned status ${geocodeResponse.status}`);
          }
          
          const geocodeData = await geocodeResponse.json();

          if (geocodeResponse.status === 202 && geocodeData.jobId) {
            // Job queued, poll for result with improved error handling
            console.log('[Incidents] Geocoding job queued, polling for result...');
            const jobId = geocodeData.jobId;
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds max wait
            const earlyTimeoutAttempts = 8; // Fall back early if stuck in queued for 8 seconds
            let result = null;
            let queuedAt = null;
            let consecutiveQueuedStatus = 0;

            while (attempts < maxAttempts && !result) {
              // Exponential backoff: start with 500ms, max 2 seconds
              const delay = Math.min(500 * Math.pow(1.2, attempts), 2000);
              await new Promise(resolve => setTimeout(resolve, delay));
              
              try {
                const statusResponse = await fetch(`/api/geocoding/status/${jobId}`);
                
                if (!statusResponse.ok) {
                  // If status check fails, assume RabbitMQ is unavailable
                  console.warn('[Incidents] Status check failed, falling back to direct geocoding');
                  throw new Error('Status check failed - RabbitMQ may be unavailable');
                }
                
                const statusData = await statusResponse.json();

                if (statusData.status === 'completed' && statusData.result) {
                  result = statusData.result;
                  coords = { lat: result.lat, lng: result.lng };
                  console.log('[Incidents] Geocoding job completed successfully');
                  break;
                } else if (statusData.status === 'failed') {
                  throw new Error(statusData.error || 'Geocoding failed');
                } else if (statusData.status === 'queued') {
                  // Track how long job has been queued
                  if (statusData.queuedAt) {
                    queuedAt = statusData.queuedAt;
                    const queuedFor = Math.floor(Date.now() / 1000) - queuedAt;
                    if (queuedFor > 10) {
                      // Job has been queued for more than 10 seconds, likely stuck
                      console.warn(`[Incidents] Job stuck in queued status for ${queuedFor}s, falling back to direct geocoding`);
                      throw new Error('Job stuck in queue - RabbitMQ worker may be unavailable');
                    }
                  }
                  
                  consecutiveQueuedStatus++;
                  // If job has been queued for too many consecutive checks, fall back early
                  if (consecutiveQueuedStatus >= earlyTimeoutAttempts) {
                    console.warn(`[Incidents] Job stuck in queued status for ${consecutiveQueuedStatus} checks, falling back to direct geocoding`);
                    throw new Error('Job stuck in queue - RabbitMQ worker may be unavailable');
                  }
                } else if (statusData.status === 'processing') {
                  // Reset consecutive queued counter if job is processing
                  consecutiveQueuedStatus = 0;
                }
              } catch (statusError) {
                // If status check fails or job is stuck, fall back to direct geocoding
                console.warn('[Incidents] Status check error, falling back to direct geocoding:', statusError.message);
                throw statusError;
              }

              attempts++;
            }

            if (!coords) {
              throw new Error('Geocoding timeout - job did not complete in time');
            }
          } else if (geocodeData.lat && geocodeData.lng) {
            // Direct result (fallback mode or cached)
            console.log('[Incidents] Received direct geocoding result (fallback or cached)');
            coords = { lat: geocodeData.lat, lng: geocodeData.lng };
          } else if (geocodeData.status === 'completed' && geocodeData.result) {
            // Cached result returned immediately
            console.log('[Incidents] Received cached geocoding result');
            coords = { lat: geocodeData.result.lat, lng: geocodeData.result.lng };
          } else {
            throw new Error('Invalid geocoding response');
          }
        } catch (queueError) {
          // Queue unavailable or failed, fallback to direct geocoding
          console.warn('[Incidents] Queue geocoding failed, using direct geocoding:', queueError.message);
          try {
            const apiKey = await getGoogleMapsApiKey();
            coords = await zipcodeToCoordsGoogle(userPincode, apiKey);
          } catch (error) {
            console.warn('[Incidents] Google geocoding failed, trying OpenStreetMap:', error);
            try {
              coords = await zipcodeToCoords(userPincode);
            } catch (osmError) {
              console.error('[Incidents] Both geocoding services failed:', osmError);
              throw new Error('Failed to geocode pincode. Please check your pincode and try again.');
            }
          }
        }

        // Validate coords were obtained
        if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
          throw new Error('Invalid coordinates received from geocoding service.');
        }

        // Calculate bounds (±0.05 degrees for zipcode area)
        const bounds = {
          minLat: coords.lat - 0.05,
          maxLat: coords.lat + 0.05,
          minLng: coords.lng - 0.05,
          maxLng: coords.lng + 0.05
        };

        // Fetch incidents with bounds
        const incidentsResponse = await fetch(
          `/api/incidents?minLat=${bounds.minLat}&maxLat=${bounds.maxLat}&minLng=${bounds.minLng}&maxLng=${bounds.maxLng}&limit=100`
        );
        const incidentsData = await incidentsResponse.json();

        if (!incidentsResponse.ok) {
          throw new Error(incidentsData.error || 'Failed to fetch incidents');
        }

        const incidentsList = incidentsData.incidents || [];
        setIncidents(incidentsList);

        // Calculate insights
        const totalCount = incidentsList.length;
        
        // Count by incident type
        const typesBreakdown = {};
        incidentsList.forEach(incident => {
          const type = incident.incidentType || 'Unknown';
          typesBreakdown[type] = (typesBreakdown[type] || 0) + 1;
        });

        // Get recent incidents (last 20, sorted by reportedAt)
        const recentIncidents = [...incidentsList]
          .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))
          .slice(0, 20);

        setInsights({
          totalCount,
          typesBreakdown,
          recentIncidents
        });

        // Fetch addresses for all incidents
        fetchIncidentAddresses(incidentsList);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching incidents:', err);
        setError(err.message || 'Failed to load incidents');
        setLoading(false);
      }
    };

    fetchUserPincode();
  }, [user, authLoading, checkingAdmin, checkingBanned, router]);

  // Fetch address when viewing incident changes
  useEffect(() => {
    if (!viewingIncident || !viewingIncident.location?.lat || !viewingIncident.location?.lng) {
      setIncidentAddress(null);
      return;
    }

    const fetchAddress = async () => {
      try {
        setIncidentAddressLoading(true);
        const response = await fetch(
          `/api/geocoding/reverse-address?lat=${viewingIncident.location.lat}&lng=${viewingIncident.location.lng}`
        );
        const data = await response.json();

        if (response.ok && data.success && data.address) {
          setIncidentAddress(data.address);
        } else {
          // If address lookup fails, keep address as null to show coordinates
          setIncidentAddress(null);
        }
      } catch (error) {
        console.error('Error fetching address:', error);
        setIncidentAddress(null);
      } finally {
        setIncidentAddressLoading(false);
      }
    };

    fetchAddress();
  }, [viewingIncident]);

  // Fetch addresses for all incidents
  const fetchIncidentAddresses = async (incidentsList) => {
    if (!incidentsList || incidentsList.length === 0) return;

    // Fetch addresses for all incidents in parallel
    const addressPromises = incidentsList.map(async (incident) => {
      if (!incident.location?.lat || !incident.location?.lng) {
        return { id: incident._id, address: null };
      }

      try {
        setIncidentAddressesLoading(prev => ({ ...prev, [incident._id]: true }));
        const response = await fetch(
          `/api/geocoding/reverse-address?lat=${incident.location.lat}&lng=${incident.location.lng}`
        );
        const data = await response.json();

        if (response.ok && data.success && data.address) {
          return { id: incident._id, address: data.address };
        }
        return { id: incident._id, address: null };
      } catch (error) {
        console.error(`Error fetching address for incident ${incident._id}:`, error);
        return { id: incident._id, address: null };
      } finally {
        setIncidentAddressesLoading(prev => ({ ...prev, [incident._id]: false }));
      }
    });

    const results = await Promise.all(addressPromises);
    const addressMap = {};
    results.forEach(({ id, address }) => {
      addressMap[id] = address;
    });
    setIncidentAddresses(prev => ({ ...prev, ...addressMap }));
  };

  // Helper function to get a brief/short address
  const getBriefAddress = (address) => {
    if (!address) return null;
    // Take first 50 characters or first comma-separated part, whichever is shorter
    const parts = address.split(',');
    if (parts.length > 0 && parts[0].length <= 50) {
      return parts[0].trim();
    }
    // If first part is too long, truncate to 50 chars
    return address.length > 50 ? address.substring(0, 47) + '...' : address;
  };

  // Filter and sort incidents
  useEffect(() => {
    let filtered = [...incidents];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(incident => {
        const typeMatch = incident.incidentType?.toLowerCase().includes(query);
        const descMatch = incident.description?.toLowerCase().includes(query);
        const reporterMatch = incident.reportedBy?.name?.toLowerCase().includes(query);
        return typeMatch || descMatch || reporterMatch;
      });
    }

    // Apply type filter
    if (selectedTypeFilter) {
      filtered = filtered.filter(incident => incident.incidentType === selectedTypeFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.reportedAt) - new Date(a.reportedAt);
        case 'oldest':
          return new Date(a.reportedAt) - new Date(b.reportedAt);
        case 'type':
          return (a.incidentType || '').localeCompare(b.incidentType || '');
        default:
          return 0;
      }
    });

    setFilteredIncidents(filtered);
  }, [incidents, searchQuery, selectedTypeFilter, sortBy]);

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content/70">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-base-200">
          <div className="max-w-7xl mx-auto p-6">
            {/* Header Skeleton */}
            <div className="mb-8">
              <div className="h-10 bg-base-300 rounded w-64 mb-2 animate-pulse"></div>
              <div className="h-5 bg-base-300 rounded w-32 animate-pulse"></div>
            </div>
            
            {/* Stats Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="card bg-base-100 shadow-lg">
                  <div className="card-body">
                    <div className="h-4 bg-base-300 rounded w-24 mb-4 animate-pulse"></div>
                    <div className="h-10 bg-base-300 rounded w-16 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Incident Cards Skeleton */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="h-6 bg-base-300 rounded w-48 mb-6 animate-pulse"></div>
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card bg-base-200 border border-base-300">
                      <div className="card-body">
                        <div className="h-5 bg-base-300 rounded w-32 mb-2 animate-pulse"></div>
                        <div className="h-4 bg-base-300 rounded w-full mb-2 animate-pulse"></div>
                        <div className="h-4 bg-base-300 rounded w-3/4 animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center max-w-md p-6">
            <div className="mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-error mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-4 text-base-content">Error Loading Incidents</h2>
            <div className="alert alert-error mb-6 shadow-lg">
              <span>{error}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!pincode) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center max-w-md p-6">
            <div className="mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-primary mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-4 text-base-content">Pincode Required</h2>
            <p className="text-base-content/70 mb-8 text-lg">
              Please set your pincode in your profile to view incidents in your area.
            </p>
            <Link
              href="/profile"
              className="btn btn-primary btn-lg gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Go to Profile
            </Link>
          </div>
        </div>
      </>
    );
  }

  const sortedTypes = Object.entries(insights.typesBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  // Helper function to get relative time
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
    return colors[type] || 'badge-neutral';
  };

  // Check if user is the creator of an incident
  const isUserCreator = (incident) => {
    if (!user || !incident.reportedBy?.firebaseUid) return false;
    return user.uid === incident.reportedBy.firebaseUid;
  };

  // Handle edit
  const handleEdit = (incident) => {
    setEditingIncident(incident);
    setIsEditModalOpen(true);
  };

  const handleEditSave = (updatedIncident) => {
    // Update the incident in the list
    const updatedIncidents = incidents.map(inc => 
      inc._id === updatedIncident._id ? updatedIncident : inc
    );
    setIncidents(updatedIncidents);
    
    // Recalculate insights
    const totalCount = updatedIncidents.length;
    const typesBreakdown = {};
    updatedIncidents.forEach(incident => {
      const type = incident.incidentType || 'Unknown';
      typesBreakdown[type] = (typesBreakdown[type] || 0) + 1;
    });
    const recentIncidents = [...updatedIncidents]
      .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))
      .slice(0, 20);
    
    setInsights({
      totalCount,
      typesBreakdown,
      recentIncidents
    });
    
    // Update viewing incident if it's the one being edited
    if (viewingIncident && viewingIncident._id === updatedIncident._id) {
      setViewingIncident(updatedIncident);
    }
    
    setIsEditModalOpen(false);
    setEditingIncident(null);
    setNotification({ type: 'success', message: 'Incident updated successfully' });
    setTimeout(() => setNotification({ type: '', message: '' }), 5000);
  };

  // Handle delete
  const handleDelete = (incident) => {
    setDeletingIncident(incident);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingIncident || !user) return;

    try {
      // Get Firebase ID token
      const { auth } = await import('@/firebase/config');
      const { getAuth } = await import('firebase/auth');
      const currentAuth = auth || getAuth();
      const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

      const headers = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/incidents/${deletingIncident._id}`, {
        method: 'DELETE',
        headers: headers
      });

      const data = await response.json();

      if (!response.ok) {
        setNotification({ type: 'error', message: data.error || 'Failed to delete incident' });
        setTimeout(() => setNotification({ type: '', message: '' }), 5000);
        return;
      }

      // Remove from incidents list
      const updatedIncidents = incidents.filter(inc => inc._id !== deletingIncident._id);
      setIncidents(updatedIncidents);

      // Recalculate insights
      const totalCount = updatedIncidents.length;
      const typesBreakdown = {};
      updatedIncidents.forEach(incident => {
        const type = incident.incidentType || 'Unknown';
        typesBreakdown[type] = (typesBreakdown[type] || 0) + 1;
      });
      const recentIncidents = [...updatedIncidents]
        .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))
        .slice(0, 20);
      
      setInsights({
        totalCount,
        typesBreakdown,
        recentIncidents
      });

      setShowDeleteConfirm(false);
      setDeletingIncident(null);
      setNotification({ type: 'success', message: 'Incident deleted successfully' });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    } catch (error) {
      console.error('Error deleting incident:', error);
      setNotification({ type: 'error', message: 'Failed to delete incident. Please try again.' });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    }
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-base-200">
        <div className="max-w-7xl mx-auto p-6">
          {/* Notification Toast */}
          {notification.message && (
            <div className={`alert ${notification.type === 'success' ? 'alert-success' : 'alert-error'} mb-6 shadow-lg`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                {notification.type === 'success' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <span>{notification.message}</span>
              <button
                onClick={() => setNotification({ type: '', message: '' })}
                className="btn btn-sm btn-ghost"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Enhanced Header */}
          <div className="mb-8">
            <div className="card bg-linear-to-r from-primary/10 via-secondary/10 to-primary/10 border border-primary/20 shadow-xl mb-6">
              <div className="card-body p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h1 className="text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Nearby Incidents
                    </h1>
                    <div className="flex items-center gap-2 text-base-content/70">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-medium">Pincode: {pincode}</span>
                    </div>
                  </div>
                  <Link
                    href="/incidents/report"
                    className="btn btn-primary btn-lg gap-2 shadow-lg hover:shadow-xl transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Report Incident
                  </Link>
                </div>

                {/* Search and Filter Bar */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="input input-bordered flex items-center gap-2 bg-base-100 shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 opacity-70">
                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                      </svg>
                      <input
                        type="text"
                        className="grow"
                        placeholder="Search incidents by type, description, or reporter..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="btn btn-ghost btn-sm btn-circle"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="select select-bordered bg-base-100 shadow-md"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="type">Sort by Type</option>
                    </select>
                    {(searchQuery || selectedTypeFilter) && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedTypeFilter(null);
                        }}
                        className="btn btn-outline gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="card bg-linear-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <div className="card-body">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-base-content/70 uppercase tracking-wider">Total Incidents</h2>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold text-base-content mb-1">{insights.totalCount}</p>
                <p className="text-xs text-base-content/50">in your area</p>
              </div>
            </div>
            <div className="card bg-linear-to-br from-secondary/10 to-secondary/5 border border-secondary/20 shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <div className="card-body">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-base-content/70 uppercase tracking-wider">Incident Types</h2>
                  <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold text-base-content mb-1">{sortedTypes.length}</p>
                <p className="text-xs text-base-content/50">different categories</p>
              </div>
            </div>
            <div className="card bg-linear-to-br from-accent/10 to-accent/5 border border-accent/20 shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <div className="card-body">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-base-content/70 uppercase tracking-wider">Recent Reports</h2>
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold text-base-content mb-1">{filteredIncidents.length || insights.recentIncidents.length}</p>
                <p className="text-xs text-base-content/50">showing {searchQuery || selectedTypeFilter ? 'filtered' : 'recent'}</p>
              </div>
            </div>
          </div>

          {/* Incident Types Breakdown as Filter Chips */}
          {sortedTypes.length > 0 && (
            <div className="card bg-base-100 shadow-lg mb-6">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Filter by Type
                  </h2>
                  {selectedTypeFilter && (
                    <button
                      onClick={() => setSelectedTypeFilter(null)}
                      className="btn btn-sm btn-ghost gap-2"
                    >
                      Clear Filter
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {sortedTypes.map(({ type, count }) => {
                    const percentage = ((count / insights.totalCount) * 100).toFixed(1);
                    const isSelected = selectedTypeFilter === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedTypeFilter(isSelected ? null : type)}
                        className={`badge badge-lg gap-2 p-4 h-auto transition-all hover:scale-105 ${
                          isSelected
                            ? `${getIncidentTypeColor(type)} text-white shadow-lg`
                            : 'badge-outline hover:badge-primary'
                        }`}
                      >
                        <span className="text-lg">{getIncidentTypeIcon(type)}</span>
                        <span className="font-semibold">{type}</span>
                        <span className={`badge badge-sm ${isSelected ? 'badge-base-100 text-base-content' : 'badge-neutral'}`}>
                          {count}
                        </span>
                        <span className="text-xs opacity-70">({percentage}%)</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Redesigned Incidents List */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-base-content flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {searchQuery || selectedTypeFilter ? 'Filtered' : 'Recent'} Incidents
                  <span className="badge badge-primary badge-lg ml-2">
                    {filteredIncidents.length || insights.recentIncidents.length}
                  </span>
                </h2>
              </div>
            {(filteredIncidents.length === 0 && (searchQuery || selectedTypeFilter)) ? (
              <div className="text-center py-16">
                <div className="mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-base-content/30 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-base-content">No incidents match your filters</h2>
                <p className="text-base-content/70 mb-6">Try adjusting your search or filter criteria.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTypeFilter(null);
                  }}
                  className="btn btn-primary gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Filters
                </button>
              </div>
            ) : insights.recentIncidents.length === 0 ? (
              <div className="text-center py-16">
                <div className="mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-primary mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-2 text-base-content">No incidents in your area yet</h3>
                <p className="text-base-content/70 mb-6">Be the first to report an incident and help keep your community informed.</p>
                <Link
                  href="/incidents/report"
                  className="btn btn-primary btn-lg gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Report First Incident
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {(filteredIncidents.length > 0 ? filteredIncidents : insights.recentIncidents).map((incident) => (
                  <div
                    key={incident._id}
                    className="card bg-base-200 border border-base-300 hover:border-primary/50 hover:shadow-xl transition-all duration-300 cursor-pointer group"
                    onClick={(e) => {
                      // Don't open modal if clicking on buttons
                      if (e.target.closest('button')) {
                        return;
                      }
                      setViewingIncident(incident);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <div className="card-body p-6">
                      <div className="flex gap-4">
                        {/* Incident Type Icon */}
                        <div className="shrink-0">
                          <div className={`w-16 h-16 rounded-xl ${getIncidentTypeColor(incident.incidentType).replace('badge-', 'bg-')}/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform`}>
                            {getIncidentTypeIcon(incident.incidentType)}
                          </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`badge badge-lg ${getIncidentTypeColor(incident.incidentType)}`}>
                                  {incident.incidentType}
                                </span>
                                {incident.visibility && (
                                  <span className="badge badge-outline badge-sm">
                                    {incident.visibility}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-lg font-bold text-base-content mb-2 line-clamp-1">
                                {incident.incidentType}
                              </h3>
                              <p className="text-sm text-base-content/70 line-clamp-2 leading-relaxed">
                                {incident.description}
                              </p>
                            </div>
                            
                            {/* Action Buttons */}
                            {isUserCreator(incident) && (
                              <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleEdit(incident)}
                                  className="btn btn-sm btn-primary gap-2"
                                  title="Edit incident"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(incident)}
                                  className="btn btn-sm btn-error gap-2"
                                  title="Delete incident"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Footer Info */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-base-content/60 mt-4 pt-4 border-t border-base-300">
                            <div className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="font-medium">{incident.reportedBy?.name || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{getRelativeTime(incident.reportedAt)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {incidentAddressesLoading[incident._id] ? (
                                <span className="text-xs text-base-content/60">Loading...</span>
                              ) : incidentAddresses[incident._id] ? (
                                <span className="text-xs text-base-content" title={incidentAddresses[incident._id]}>
                                  {getBriefAddress(incidentAddresses[incident._id])}
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-base-content/60">
                                  {incident.location?.lat?.toFixed(4)}, {incident.location?.lng?.toFixed(4)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingIncident && (
        <EditIncidentModal
          incident={editingIncident}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingIncident(null);
          }}
          onSave={handleEditSave}
          user={user}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && deletingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card bg-base-100 shadow-2xl max-w-md w-full m-4">
            <div className="card-body">
              <h3 className="text-xl font-bold mb-4 text-base-content">Confirm Delete</h3>
              <p className="text-base-content/70 mb-6">
              Are you sure you want to delete the incident &quot;{deletingIncident.incidentType}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleDeleteConfirm}
                  className="btn btn-error"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingIncident(null);
                }}
                  className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Incident Detail Modal */}
      {isDetailModalOpen && viewingIncident && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDetailModalOpen(false);
              setViewingIncident(null);
            }
          }}
        >
          <div className="card bg-base-100 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-base-300 animate-fade-in-up">
            {/* Enhanced Header */}
            <div className="card-body pb-4 border-b border-base-300 bg-linear-to-r from-primary/10 via-secondary/10 to-primary/10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-xl ${getIncidentTypeColor(viewingIncident.incidentType).replace('badge-', 'bg-')}/20 flex items-center justify-center text-4xl shadow-lg`}>
                    {getIncidentTypeIcon(viewingIncident.incidentType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-2xl font-bold text-base-content">Incident Details</h2>
                      <span className={`badge badge-lg ${getIncidentTypeColor(viewingIncident.incidentType)}`}>
                        {viewingIncident.incidentType}
                      </span>
                    </div>
                    <p className="text-sm text-base-content/60 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Reported {getRelativeTime(viewingIncident.reportedAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setViewingIncident(null);
                  }}
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
                      {viewingIncident.description}
                    </p>
                  </div>
                </div>

                {/* Grid Layout for Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Reported By */}
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
                        {viewingIncident.reportedBy?.photoURL ? (
                          <img
                            src={viewingIncident.reportedBy.photoURL}
                            alt={viewingIncident.reportedBy.name || 'User'}
                            className="w-12 h-12 rounded-full ring-2 ring-primary/20"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary text-primary-content flex items-center justify-center text-lg font-bold ring-2 ring-primary/20">
                            {(viewingIncident.reportedBy?.name || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <p className="text-base font-medium text-base-content">
                          {viewingIncident.reportedBy?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visibility */}
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
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                          Visibility
                        </label>
                      </div>
                      <div>
                        <span className="badge badge-lg badge-primary badge-outline">
                          {viewingIncident.visibility || 'public'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

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
                    <div className="space-y-2">
                      {incidentAddressLoading ? (
                        <div className="flex items-center gap-2">
                          <span className="loading loading-spinner loading-sm"></span>
                          <p className="text-sm text-base-content/60">Loading address...</p>
                        </div>
                      ) : incidentAddress ? (
                        <p className="text-sm text-base-content">{incidentAddress}</p>
                      ) : (
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-base-content/60 font-medium">Lat:</span>
                            <span className="ml-2 text-base-content font-mono">
                              {viewingIncident.location?.lat?.toFixed(6)}
                            </span>
                          </div>
                          <div>
                            <span className="text-base-content/60 font-medium">Lng:</span>
                            <span className="ml-2 text-base-content font-mono">
                              {viewingIncident.location?.lng?.toFixed(6)}
                            </span>
                          </div>
                        </div>
                      )}
                      <a
                        href={`https://www.google.com/maps?q=${viewingIncident.location?.lat},${viewingIncident.location?.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-primary btn-outline w-full sm:w-auto"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        View on Google Maps
                      </a>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Reported At */}
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                          Reported At
                        </label>
                      </div>
                      <p className="text-sm text-base-content font-medium">
                        {new Date(viewingIncident.reportedAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          timeZoneName: 'short'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Created At (if different) */}
                  {viewingIncident.createdAt && new Date(viewingIncident.createdAt).getTime() !== new Date(viewingIncident.reportedAt).getTime() && (
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
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                            Created At
                          </label>
                        </div>
                        <p className="text-sm text-base-content font-medium">
                          {new Date(viewingIncident.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZoneName: 'short'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Incident ID */}
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
                          d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                        />
                      </svg>
                      <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                        Incident ID
                      </label>
                    </div>
                    <p className="text-xs text-base-content/70 font-mono break-all bg-base-100 p-2 rounded border border-base-300">
                      {viewingIncident._id}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with Action Buttons */}
            {isUserCreator(viewingIncident) && (
              <div className="card-body pt-4 border-t border-base-300 bg-base-200">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      setViewingIncident(null);
                      handleEdit(viewingIncident);
                    }}
                    className="btn btn-primary flex-1 gap-2"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Incident
                  </button>
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      setViewingIncident(null);
                      handleDelete(viewingIncident);
                    }}
                    className="btn btn-error flex-1 gap-2"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete Incident
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

