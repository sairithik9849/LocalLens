'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import { useCheckBanned } from '@/hooks/useCheckBanned';
import Navigation from '@/app/components/Navigation';
import EditEventModal from '@/app/components/EditEventModal';
import Link from 'next/link';

export default function EventDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { checkingBanned } = useCheckBanned();
  const router = useRouter();
  const params = useParams();
  const eventId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState({ going: [], notGoing: [] });
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [locationAddress, setLocationAddress] = useState(null);
  const [locationAddressLoading, setLocationAddressLoading] = useState(false);

  useEffect(() => {
    if (authLoading || checkingBanned) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!eventId) return;

    const fetchEvent = async () => {
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

        // Fetch event details
        const eventResponse = await fetch(`/api/events/${eventId}`, {
          headers: headers
        });
        const eventData = await eventResponse.json();

        if (!eventResponse.ok) {
          throw new Error(eventData.error || 'Failed to fetch event');
        }

        setEvent(eventData.event);

        // Fetch RSVPs
        const rsvpsResponse = await fetch(`/api/events/${eventId}/rsvps`, {
          headers: headers
        });
        const rsvpsData = await rsvpsResponse.json();

        if (rsvpsResponse.ok && rsvpsData.rsvps) {
          setRsvps(rsvpsData.rsvps);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching event:', err);
        setError(err.message || 'Failed to load event');
        setLoading(false);
      }
    };

    fetchEvent();
  }, [user, authLoading, checkingBanned, router, eventId]);

  // Fetch address when event data is loaded
  useEffect(() => {
    if (!event || !event.location?.lat || !event.location?.lng) {
      setLocationAddress(null);
      return;
    }

    const fetchAddress = async () => {
      try {
        setLocationAddressLoading(true);
        const response = await fetch(
          `/api/geocoding/reverse-address?lat=${event.location.lat}&lng=${event.location.lng}`
        );
        const data = await response.json();

        if (response.ok && data.success && data.address) {
          setLocationAddress(data.address);
        } else {
          // If address lookup fails, keep address as null to show coordinates
          setLocationAddress(null);
        }
      } catch (error) {
        console.error('Error fetching address:', error);
        setLocationAddress(null);
      } finally {
        setLocationAddressLoading(false);
      }
    };

    fetchAddress();
  }, [event]);

  const handleRSVP = async (status) => {
    if (!user || !eventId) return;

    try {
      const { auth } = await import('@/firebase/config');
      const { getAuth } = await import('firebase/auth');
      const currentAuth = auth || getAuth();
      const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

      const headers = {
        'Content-Type': 'application/json'
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ status })
      });

      const data = await response.json();

      if (!response.ok) {
        setNotification({ type: 'error', message: data.error || 'Failed to RSVP' });
        setTimeout(() => setNotification({ type: '', message: '' }), 5000);
        return;
      }

      // Refresh event and RSVPs
      window.location.reload();
    } catch (error) {
      console.error('Error updating RSVP:', error);
      setNotification({ type: 'error', message: 'Failed to update RSVP. Please try again.' });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    }
  };

  const handleRemoveRSVP = async () => {
    if (!user || !eventId) return;

    try {
      const { auth } = await import('@/firebase/config');
      const { getAuth } = await import('firebase/auth');
      const currentAuth = auth || getAuth();
      const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

      const headers = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/events/${eventId}/rsvp`, {
        method: 'DELETE',
        headers: headers
      });

      const data = await response.json();

      if (!response.ok) {
        setNotification({ type: 'error', message: data.error || 'Failed to remove RSVP' });
        setTimeout(() => setNotification({ type: '', message: '' }), 5000);
        return;
      }

      // Refresh event and RSVPs
      window.location.reload();
    } catch (error) {
      console.error('Error removing RSVP:', error);
      setNotification({ type: 'error', message: 'Failed to remove RSVP. Please try again.' });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    }
  };

  const handleDelete = async () => {
    if (!user || !eventId || !event) return;

    setIsDeleting(true);

    try {
      const { auth } = await import('@/firebase/config');
      const { getAuth } = await import('firebase/auth');
      const currentAuth = auth || getAuth();
      const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

      const headers = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: headers
      });

      const data = await response.json();

      if (!response.ok) {
        setNotification({ type: 'error', message: data.error || 'Failed to delete event' });
        setTimeout(() => setNotification({ type: '', message: '' }), 5000);
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }

      // Redirect to events list
      router.push('/events');
    } catch (error) {
      console.error('Error deleting event:', error);
      setNotification({ type: 'error', message: 'Failed to delete event. Please try again.' });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEditSave = (updatedEvent) => {
    // Update the event in state
    setEvent(updatedEvent);
    setNotification({ type: 'success', message: 'Event updated successfully' });
    setTimeout(() => setNotification({ type: '', message: '' }), 5000);
  };

  const isCreator = event && user && event.createdBy?.firebaseUid === user.uid;
  const isUpcoming = event && new Date(event.eventDate) > new Date();

  if (authLoading || loading) {
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
            <h2 className="text-2xl font-bold mb-4 text-base-content">Error Loading Event</h2>
            <div className="alert alert-error mb-6 shadow-lg">
              <span>{error}</span>
            </div>
            <Link href="/events" className="btn btn-primary">
              Back to Events
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center">
            <p className="text-base-content/70">Event not found</p>
            <Link href="/events" className="btn btn-primary mt-4">
              Back to Events
            </Link>
          </div>
        </div>
      </>
    );
  }

  const formatEventDate = (date) => {
    const eventDate = new Date(date);
    return eventDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-base-200">
        <div className="max-w-4xl mx-auto p-6">
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

          {/* Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-sm text-base-content/70">
            <Link href="/events" className="hover:text-primary transition-colors">
              Events
            </Link>
            <span>/</span>
            <span className="text-base-content font-medium">Event Details</span>
          </div>

          {/* Event Card */}
          <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge badge-lg ${isUpcoming ? 'badge-primary' : 'badge-neutral'}`}>
                      {isUpcoming ? 'Upcoming' : 'Past'}
                    </span>
                    {event.rsvpCounts && (
                      <span className="badge badge-outline">
                        {event.rsvpCounts.going} going
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-base-content mb-4">{event.title}</h1>
                </div>
                {isCreator && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingEvent(event);
                        setIsEditModalOpen(true);
                      }}
                      className="btn btn-sm btn-primary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="btn btn-sm btn-error"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="divider"></div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2 block">
                    Description
                  </label>
                  <p className="text-base text-base-content whitespace-pre-wrap">{event.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2 block">
                      Date & Time
                    </label>
                    <p className="text-base text-base-content">{formatEventDate(event.eventDate)}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2 block">
                      Created By
                    </label>
                    <div className="flex items-center gap-2">
                      {event.createdBy?.photoURL && (
                        <img
                          src={event.createdBy.photoURL}
                          alt={event.createdBy.name}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <p className="text-base text-base-content">{event.createdBy?.name || 'Unknown'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2 block">
                    Location
                  </label>
                  {locationAddressLoading ? (
                    <div className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-sm"></span>
                      <p className="text-base text-base-content/60">Loading address...</p>
                    </div>
                  ) : locationAddress ? (
                    <p className="text-base text-base-content">{locationAddress}</p>
                  ) : (
                    <p className="text-base text-base-content font-mono">
                      {event.location?.lat?.toFixed(6)}, {event.location?.lng?.toFixed(6)}
                    </p>
                  )}
                  <a
                    href={`https://www.google.com/maps?q=${event.location?.lat},${event.location?.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline mt-2"
                  >
                    View on Google Maps
                  </a>
                </div>
              </div>

              {/* RSVP Controls */}
              {!isCreator && (
                <>
                  <div className="divider"></div>
                  <div>
                    <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-4 block">
                      RSVP
                    </label>
                    {event.userRSVP ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRSVP('going')}
                        className={`btn ${event.userRSVP.status === 'going' ? 'btn-primary' : 'btn-outline'}`}
                      >
                        {event.userRSVP.status === 'going' ? '✓ Going' : 'Going'}
                      </button>
                      <button
                        onClick={() => handleRSVP('not_going')}
                        className={`btn ${event.userRSVP.status === 'not_going' ? 'btn-error' : 'btn-outline'}`}
                      >
                        {event.userRSVP.status === 'not_going' ? '✗ Not Going' : 'Not Going'}
                      </button>
                      <button
                        onClick={handleRemoveRSVP}
                        className="btn btn-ghost"
                      >
                        Remove RSVP
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRSVP('going')}
                        className="btn btn-primary"
                      >
                        RSVP: Going
                      </button>
                      <button
                        onClick={() => handleRSVP('not_going')}
                        className="btn btn-outline"
                      >
                        RSVP: Not Going
                      </button>
                    </div>
                  )}
                  </div>
                </>
              )}

              {/* RSVP List / Attendees List */}
              {((rsvps.going.length > 0 || rsvps.notGoing.length > 0) || isCreator) && (
                <>
                  <div className="divider"></div>
                  <div>
                    <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-4 block">
                      {isCreator ? 'Attendees' : 'RSVPs'} ({rsvps.total || 0})
                    </label>
                    {rsvps.going.length > 0 ? (
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-base-content mb-2">
                          Going ({rsvps.going.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {rsvps.going.map((rsvp) => (
                            <div key={rsvp._id} className="flex items-center gap-2 badge badge-primary badge-lg">
                              {rsvp.user?.photoURL && (
                                <img
                                  src={rsvp.user.photoURL}
                                  alt={rsvp.user.name}
                                  className="w-6 h-6 rounded-full"
                                />
                              )}
                              <span>{rsvp.user?.name || 'Unknown'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : isCreator && (
                      <div className="mb-4">
                        <p className="text-sm text-base-content/60">No one has RSVPed as going yet.</p>
                      </div>
                    )}
                    {rsvps.notGoing.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-base-content mb-2">
                          Not Going ({rsvps.notGoing.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {rsvps.notGoing.map((rsvp) => (
                            <div key={rsvp._id} className="flex items-center gap-2 badge badge-neutral badge-lg">
                              {rsvp.user?.photoURL && (
                                <img
                                  src={rsvp.user.photoURL}
                                  alt={rsvp.user.name}
                                  className="w-6 h-6 rounded-full"
                                />
                              )}
                              <span>{rsvp.user?.name || 'Unknown'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Back Button */}
          <Link href="/events" className="btn btn-outline">
            ← Back to Events
          </Link>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card bg-base-100 shadow-2xl max-w-md w-full m-4">
            <div className="card-body">
              <h3 className="text-xl font-bold mb-4 text-base-content">Confirm Delete</h3>
              <p className="text-base-content/70 mb-6">
                Are you sure you want to delete the event &quot;{event.title}&quot;? This action cannot be undone and all RSVPs will be removed.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn btn-error"
                >
                  {isDeleting ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setIsDeleting(false);
                  }}
                  disabled={isDeleting}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingEvent && (
        <EditEventModal
          event={editingEvent}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingEvent(null);
          }}
          onSave={handleEditSave}
          user={user}
        />
      )}
    </>
  );
}
