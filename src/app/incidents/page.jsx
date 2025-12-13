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

        // Geocode pincode to get coordinates
        let coords;
        try {
          const apiKey = await getGoogleMapsApiKey();
          coords = await zipcodeToCoordsGoogle(userPincode, apiKey);
        } catch (error) {
          console.warn('Google geocoding failed, trying OpenStreetMap:', error);
          coords = await zipcodeToCoords(userPincode);
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
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
            <p className="text-gray-600">Loading incidents...</p>
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
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
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
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Pincode Required</h2>
            <p className="text-gray-600 mb-6">
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
        alert(data.error || 'Failed to delete incident');
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
    } catch (error) {
      console.error('Error deleting incident:', error);
      alert('Failed to delete incident. Please try again.');
    }
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Incidents in Your Area</h1>
              <p className="text-gray-600 mt-1">Pincode: {pincode}</p>
            </div>
            <Link
              href="/incidents/report"
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium shadow-md"
            >
              Report Incident
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Incidents</h3>
              <p className="text-3xl font-bold text-gray-800">{insights.totalCount}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Incident Types</h3>
              <p className="text-3xl font-bold text-gray-800">{sortedTypes.length}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Recent Reports</h3>
              <p className="text-3xl font-bold text-gray-800">{insights.recentIncidents.length}</p>
            </div>
          </div>

          {/* Incident Types Breakdown */}
          {sortedTypes.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Incident Types Breakdown</h2>
              <div className="space-y-3">
                {sortedTypes.map(({ type, count }) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-gray-700">{type}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${(count / insights.totalCount) * 100}%`
                          }}
                        ></div>
                      </div>
                      <span className="text-gray-600 font-medium w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Incidents List */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Recent Incidents</h2>
            {insights.recentIncidents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No incidents found in your area.</p>
                <Link
                  href="/incidents/report"
                  className="inline-block mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Report First Incident
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {insights.recentIncidents.map((incident) => (
                  <div
                    key={incident._id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 mb-1">
                          {incident.incidentType}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {incident.description}
                        </p>
                      </div>
                      {isUserCreator(incident) && (
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEdit(incident)}
                            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(incident)}
                            className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
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
                      <span className="text-gray-400">
                        {incident.location?.lat?.toFixed(4)}, {incident.location?.lng?.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete the incident &quot;{deletingIncident.incidentType}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleDeleteConfirm}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingIncident(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

