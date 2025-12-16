'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import { useRequireNonAdmin } from '@/hooks/useRequireNonAdmin';
import { useCheckBanned } from '@/hooks/useCheckBanned';
import Navigation from '@/app/components/Navigation';
import Link from 'next/link';

export default function EventsPage() {
  const { user, loading: authLoading } = useAuth();
  const { checkingAdmin } = useRequireNonAdmin();
  const { checkingBanned } = useCheckBanned();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pincode, setPincode] = useState(null);
  const [events, setEvents] = useState([]);
  const [notification, setNotification] = useState({ type: '', message: '' });
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [filteredEvents, setFilteredEvents] = useState([]);

  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading || checkingAdmin || checkingBanned) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    const fetchEvents = async () => {
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

        // Fetch user profile to get pincode
        const profileResponse = await fetch(`/api/users/profile?uid=${encodeURIComponent(user.uid)}`, {
          headers: headers
        });
        const profileData = await profileResponse.json();

        if (!profileResponse.ok) {
          throw new Error(profileData.error || 'Failed to fetch user profile');
        }

        const userPincode = profileData.user?.profile?.pincode;
        
        if (!userPincode) {
          setPincode(null);
          setLoading(false);
          return;
        }

        setPincode(userPincode);

        // Fetch events
        const eventsResponse = await fetch(`/api/events?includePast=${includePast}`, {
          headers: headers
        });
        const eventsData = await eventsResponse.json();

        if (!eventsResponse.ok) {
          throw new Error(eventsData.error || 'Failed to fetch events');
        }

        const eventsList = eventsData.events || [];
        
        // Fetch RSVP status for each event
        const eventsWithRSVP = await Promise.all(
          eventsList.map(async (event) => {
            try {
              const rsvpResponse = await fetch(`/api/events/${event._id}`, {
                headers: headers
              });
              const rsvpData = await rsvpResponse.json();
              if (rsvpResponse.ok && rsvpData.event) {
                return {
                  ...event,
                  rsvpCounts: rsvpData.event.rsvpCounts,
                  userRSVP: rsvpData.event.userRSVP
                };
              }
              return event;
            } catch (err) {
              console.error('Error fetching RSVP for event:', err);
              return event;
            }
          })
        );

        setEvents(eventsWithRSVP);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError(err.message || 'Failed to load events');
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user, authLoading, checkingAdmin, checkingBanned, router, includePast]);

  // Filter events
  useEffect(() => {
    let filtered = [...events];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => {
        const titleMatch = event.title?.toLowerCase().includes(query);
        const descMatch = event.description?.toLowerCase().includes(query);
        const creatorMatch = event.createdBy?.name?.toLowerCase().includes(query);
        return titleMatch || descMatch || creatorMatch;
      });
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery]);

  // Handle RSVP
  const handleRSVP = async (eventId, status) => {
    if (!user) return;

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

      // Update event in list
      setEvents(prevEvents =>
        prevEvents.map(event => {
          if (event._id === eventId) {
            const newRSVP = { status, createdAt: new Date() };
            const goingCount = status === 'going' 
              ? (event.rsvpCounts?.going || 0) + (event.userRSVP?.status === 'going' ? 0 : 1) - (event.userRSVP?.status === 'not_going' ? 0 : 0)
              : (event.rsvpCounts?.going || 0) - (event.userRSVP?.status === 'going' ? 1 : 0);
            const notGoingCount = status === 'not_going'
              ? (event.rsvpCounts?.notGoing || 0) + (event.userRSVP?.status === 'not_going' ? 0 : 1) - (event.userRSVP?.status === 'going' ? 0 : 0)
              : (event.rsvpCounts?.notGoing || 0) - (event.userRSVP?.status === 'not_going' ? 1 : 0);
            
            return {
              ...event,
              userRSVP: newRSVP,
              rsvpCounts: {
                going: Math.max(0, goingCount),
                notGoing: Math.max(0, notGoingCount),
                total: Math.max(0, goingCount) + Math.max(0, notGoingCount)
              }
            };
          }
          return event;
        })
      );

      setNotification({ type: 'success', message: `RSVP updated: ${status === 'going' ? 'Going' : 'Not Going'}` });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    } catch (error) {
      console.error('Error updating RSVP:', error);
      setNotification({ type: 'error', message: 'Failed to update RSVP. Please try again.' });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    }
  };

  // Handle remove RSVP
  const handleRemoveRSVP = async (eventId) => {
    if (!user) return;

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

      // Update event in list
      setEvents(prevEvents =>
        prevEvents.map(event => {
          if (event._id === eventId) {
            const goingCount = (event.rsvpCounts?.going || 0) - (event.userRSVP?.status === 'going' ? 1 : 0);
            const notGoingCount = (event.rsvpCounts?.notGoing || 0) - (event.userRSVP?.status === 'not_going' ? 1 : 0);
            
            return {
              ...event,
              userRSVP: null,
              rsvpCounts: {
                going: Math.max(0, goingCount),
                notGoing: Math.max(0, notGoingCount),
                total: Math.max(0, goingCount) + Math.max(0, notGoingCount)
              }
            };
          }
          return event;
        })
      );

      setNotification({ type: 'success', message: 'RSVP removed' });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    } catch (error) {
      console.error('Error removing RSVP:', error);
      setNotification({ type: 'error', message: 'Failed to remove RSVP. Please try again.' });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    }
  };

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
            <div className="h-10 bg-base-300 rounded w-64 mb-2 animate-pulse"></div>
            <div className="space-y-4 mt-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="card bg-base-100 shadow-lg">
                  <div className="card-body">
                    <div className="h-5 bg-base-300 rounded w-32 mb-2 animate-pulse"></div>
                    <div className="h-4 bg-base-300 rounded w-full mb-2 animate-pulse"></div>
                  </div>
                </div>
              ))}
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
            <h2 className="text-2xl font-bold mb-4 text-base-content">Error Loading Events</h2>
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
              Please set your pincode in your profile to view events in your area.
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

  // Helper function to format date
  const formatEventDate = (date) => {
    const eventDate = new Date(date);
    return eventDate.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to check if event is upcoming
  const isUpcoming = (date) => {
    return new Date(date) > new Date();
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
          <div className="mb-8">
            <div className="card bg-linear-to-r from-primary/10 via-secondary/10 to-primary/10 border border-primary/20 shadow-xl mb-6">
              <div className="card-body p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h1 className="text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Local Events
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
                    href="/events/create"
                    className="btn btn-primary btn-lg gap-2 shadow-lg hover:shadow-xl transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Event
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
                        placeholder="Search events by title, description, or creator..."
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
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={includePast}
                        onChange={(e) => setIncludePast(e.target.checked)}
                      />
                      <span className="label-text">Include Past Events</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Events List */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-base-content flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Events
                  <span className="badge badge-primary badge-lg ml-2">
                    {filteredEvents.length}
                  </span>
                </h2>
              </div>
              {filteredEvents.length === 0 ? (
                <div className="text-center py-16">
                  <div className="mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-primary mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-base-content">No events found</h3>
                  <p className="text-base-content/70 mb-6">
                    {searchQuery ? 'Try adjusting your search criteria.' : 'Be the first to create an event in your area.'}
                  </p>
                  {!searchQuery && (
                    <Link
                      href="/events/create"
                      className="btn btn-primary btn-lg gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create First Event
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEvents.map((event) => (
                    <div
                      key={event._id}
                      className="card bg-base-200 border border-base-300 hover:border-primary/50 hover:shadow-xl transition-all duration-300"
                    >
                      <div className="card-body p-6">
                        <div className="flex gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`badge badge-lg ${isUpcoming(event.eventDate) ? 'badge-primary' : 'badge-neutral'}`}>
                                    {isUpcoming(event.eventDate) ? 'Upcoming' : 'Past'}
                                  </span>
                                  {event.createdBy?.firebaseUid === user?.uid && (
                                    <span className="badge badge-secondary badge-lg">
                                      My Event
                                    </span>
                                  )}
                                  {event.rsvpCounts && (
                                    <span className="badge badge-outline badge-sm">
                                      {event.rsvpCounts.going} going
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-lg font-bold text-base-content mb-2 line-clamp-1">
                                  {event.title}
                                </h3>
                                <p className="text-sm text-base-content/70 line-clamp-2 leading-relaxed mb-3">
                                  {event.description}
                                </p>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-base-content/60">
                                  <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span>{formatEventDate(event.eventDate)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="font-medium">{event.createdBy?.name || 'Unknown'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* RSVP Controls / Attendees Info */}
                            <div className="flex gap-2 mt-4 pt-4 border-t border-base-300">
                              {event.createdBy?.firebaseUid === user?.uid ? (
                                // Creator view: Show attendees count
                                <>
                                  <span className="badge badge-primary badge-lg">
                                    {event.rsvpCounts?.going || 0} Attendees
                                  </span>
                                  <Link
                                    href={`/events/${event._id}`}
                                    className="btn btn-sm btn-outline ml-auto"
                                  >
                                    View Attendees
                                  </Link>
                                </>
                              ) : (
                                // Non-creator view: Show RSVP controls
                                <>
                                  {event.userRSVP ? (
                                    <>
                                      <button
                                        onClick={() => handleRSVP(event._id, 'going')}
                                        className={`btn btn-sm ${event.userRSVP.status === 'going' ? 'btn-primary' : 'btn-outline'}`}
                                      >
                                        {event.userRSVP.status === 'going' ? '✓ Going' : 'Going'}
                                      </button>
                                      <button
                                        onClick={() => handleRSVP(event._id, 'not_going')}
                                        className={`btn btn-sm ${event.userRSVP.status === 'not_going' ? 'btn-error' : 'btn-outline'}`}
                                      >
                                        {event.userRSVP.status === 'not_going' ? '✗ Not Going' : 'Not Going'}
                                      </button>
                                      <button
                                        onClick={() => handleRemoveRSVP(event._id)}
                                        className="btn btn-sm btn-ghost"
                                      >
                                        Remove RSVP
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleRSVP(event._id, 'going')}
                                        className="btn btn-sm btn-primary"
                                      >
                                        RSVP: Going
                                      </button>
                                      <button
                                        onClick={() => handleRSVP(event._id, 'not_going')}
                                        className="btn btn-sm btn-outline"
                                      >
                                        RSVP: Not Going
                                      </button>
                                    </>
                                  )}
                                  <Link
                                    href={`/events/${event._id}`}
                                    className="btn btn-sm btn-outline ml-auto"
                                  >
                                    View Details
                                  </Link>
                                </>
                              )}
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
    </>
  );
}
