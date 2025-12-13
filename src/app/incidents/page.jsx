'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import Navigation from '@/app/components/Navigation';
import EditIncidentModal from '@/app/components/EditIncidentModal';
import { zipcodeToCoordsGoogle, zipcodeToCoords } from '@/lib/geocoding';
import { getGoogleMapsApiKey } from '@/lib/gistApiKey';
import Link from 'next/link';

export default function IncidentsPage() {
  const { user, loading: authLoading } = useAuth();
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

  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading) {
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
          const geocodeData = await geocodeResponse.json();

          if (geocodeResponse.status === 202 && geocodeData.jobId) {
            // Job queued, poll for result
            console.log('[Incidents] Geocoding job queued, polling for result...');
            const jobId = geocodeData.jobId;
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds max wait
            let result = null;

            while (attempts < maxAttempts && !result) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              
              const statusResponse = await fetch(`/api/geocoding/status/${jobId}`);
              const statusData = await statusResponse.json();

              if (statusData.status === 'completed' && statusData.result) {
                result = statusData.result;
                coords = { lat: result.lat, lng: result.lng };
                break;
              } else if (statusData.status === 'failed') {
                throw new Error(statusData.error || 'Geocoding failed');
              }

              attempts++;
            }

            if (!coords) {
              throw new Error('Geocoding timeout - job did not complete in time');
            }
          } else if (geocodeData.lat && geocodeData.lng) {
            // Direct result (fallback mode)
            coords = { lat: geocodeData.lat, lng: geocodeData.lng };
          } else {
            throw new Error('Invalid geocoding response');
          }
        } catch (queueError) {
          // Queue unavailable or failed, fallback to direct geocoding
          console.warn('Queue geocoding failed, using direct geocoding:', queueError.message);
        try {
          const apiKey = await getGoogleMapsApiKey();
          coords = await zipcodeToCoordsGoogle(userPincode, apiKey);
        } catch (error) {
          console.warn('Google geocoding failed, trying OpenStreetMap:', error);
            try {
          coords = await zipcodeToCoords(userPincode);
            } catch (osmError) {
              console.error('Both geocoding services failed:', osmError);
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

        setLoading(false);
      } catch (err) {
        console.error('Error fetching incidents:', err);
        setError(err.message || 'Failed to load incidents');
        setLoading(false);
      }
    };

    fetchUserPincode();
  }, [user, authLoading, router]);

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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-base-content/70">Loading incidents...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md">
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-base-content">Pincode Required</h2>
            <p className="text-base-content/70 mb-6">
              Please set your pincode in your profile to view incidents in your area.
            </p>
            <Link
              href="/profile"
              className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
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
    setIncidents(prev => 
      prev.map(inc => inc._id === updatedIncident._id ? updatedIncident : inc)
    );
    
    // Recalculate insights
    const updatedIncidents = incidents.map(inc => 
      inc._id === updatedIncident._id ? updatedIncident : inc
    );
    
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
    
    setIsEditModalOpen(false);
    setEditingIncident(null);
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

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-base-content">Nearby Incidents</h1>
              <p className="text-base-content/70 mt-1">Pincode: {pincode}</p>
            </div>
            <Link
              href="/incidents/report"
              className="btn btn-primary"
            >
              Report Incident
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h3 className="text-sm font-medium text-base-content/60 mb-2">Total Incidents</h3>
                <p className="text-3xl font-bold text-base-content">{insights.totalCount}</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h3 className="text-sm font-medium text-base-content/60 mb-2">Incident Types</h3>
                <p className="text-3xl font-bold text-base-content">{sortedTypes.length}</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h3 className="text-sm font-medium text-base-content/60 mb-2">Recent Reports</h3>
                <p className="text-3xl font-bold text-base-content">{insights.recentIncidents.length}</p>
              </div>
            </div>
          </div>

          {/* Incident Types Breakdown */}
          {sortedTypes.length > 0 && (
            <div className="card bg-base-100 shadow-lg mb-6">
              <div className="card-body">
                <h2 className="text-xl font-semibold mb-4 text-base-content">Incident Types Breakdown</h2>
              <div className="space-y-3">
                {sortedTypes.map(({ type, count }) => (
                  <div key={type} className="flex items-center justify-between">
                      <span className="text-base-content">{type}</span>
                    <div className="flex items-center gap-3">
                        <div className="w-32 bg-base-300 rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${(count / insights.totalCount) * 100}%`
                          }}
                        ></div>
                      </div>
                        <span className="text-base-content/70 font-medium w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                  </div>
              </div>
            </div>
          )}

          {/* Recent Incidents List */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h2 className="text-xl font-semibold mb-4 text-base-content">Recent Incidents</h2>
            {insights.recentIncidents.length === 0 ? (
              <div className="text-center py-8">
                  <p className="text-base-content/70">No incidents found in your area.</p>
                <Link
                  href="/incidents/report"
                    className="btn btn-primary mt-4"
                >
                  Report First Incident
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {insights.recentIncidents.map((incident) => (
                  <div
                    key={incident._id}
                    className="card bg-base-200 border border-base-300 hover:shadow-md transition cursor-pointer"
                    onClick={(e) => {
                      // Don't open modal if clicking on buttons
                      if (e.target.closest('button')) {
                        return;
                      }
                      setViewingIncident(incident);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <div className="card-body">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                          <h3 className="font-semibold text-base-content mb-1">
                          {incident.incidentType}
                        </h3>
                          <p className="text-sm text-base-content/70 line-clamp-2">
                          {incident.description}
                        </p>
                      </div>
                      {isUserCreator(incident) && (
                          <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleEdit(incident)}
                              className="btn btn-sm btn-primary"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(incident)}
                              className="btn btn-sm btn-error"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                      <div className="flex justify-between items-center mt-3 text-xs text-base-content/60">
                      <div className="flex items-center gap-4">
                        <span>
                          {incident.reportedBy?.name || 'Unknown'}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(incident.reportedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                        <span className="text-base-content/50">
                        {incident.location?.lat?.toFixed(4)}, {incident.location?.lng?.toFixed(4)}
                      </span>
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

      {/* Incident Detail Modal */}
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
          <div className="card bg-base-100 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-base-300">
            {/* Header */}
            <div className="card-body pb-4 border-b border-base-300 bg-gradient-to-r from-primary/10 to-secondary/10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-primary-content"
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
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-base-content">Incident Details</h2>
                    <p className="text-sm text-base-content/60">Complete incident information</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setViewingIncident(null);
                  }}
                  className="btn btn-sm btn-circle btn-ghost hover:bg-base-200"
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
                {/* Incident Type - Highlighted */}
                <div className="card bg-primary/5 border border-primary/20">
                  <div className="card-body py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      <label className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Incident Type
                      </label>
                    </div>
                    <p className="text-xl font-bold text-base-content">
                      {viewingIncident.incidentType}
                    </p>
                  </div>
                </div>

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

