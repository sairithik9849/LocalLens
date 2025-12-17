'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import { useCheckBanned } from '@/hooks/useCheckBanned';
import Navigation from '@/app/components/Navigation';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/app/components/AdvancedMarker';
import { useGoogleMapsLoader } from '@/lib/useGoogleMapsLoader';
import EditYardSaleModal from '@/app/components/EditYardSaleModal';
import Link from 'next/link';

const libraries = ['places', 'marker'];

export default function YardSaleDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { checkingBanned } = useCheckBanned();
  const router = useRouter();
  const params = useParams();
  const { apiKey, isGoogleMapsLoaded, isLoadingKey } = useGoogleMapsLoader(libraries);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [yardSale, setYardSale] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingYardSale, setEditingYardSale] = useState(null);

  useEffect(() => {
    if (authLoading || checkingBanned) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const fetchYardSale = async () => {
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

        const response = await fetch(`/api/yardsales/${params.id}`, {
          headers: headers
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch yard sale');
        }

        setYardSale(data.yardSale);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching yard sale:', err);
        setError(err.message || 'Failed to load yard sale');
        setLoading(false);
      }
    };

    if (params.id) {
      fetchYardSale();
    }
  }, [user, authLoading, checkingBanned, router, params.id]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this yard sale? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const { auth } = await import('@/firebase/config');
      const { getAuth } = await import('firebase/auth');
      const currentAuth = auth || getAuth();
      const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

      const headers = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/yardsales/${params.id}`, {
        method: 'DELETE',
        headers: headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete yard sale');
      }

      router.push('/yardsales');
    } catch (err) {
      console.error('Error deleting yard sale:', err);
      setError(err.message || 'Failed to delete yard sale');
      setDeleting(false);
    }
  };

  const handleEditSave = (updatedYardSale) => {
    // Update the yard sale in state
    setYardSale(updatedYardSale);
    setIsEditModalOpen(false);
    setEditingYardSale(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (authLoading || loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content/70">Loading yard sale...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (error && !yardSale) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center max-w-md p-6">
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
            <Link href="/yardsales" className="btn btn-primary">
              Back to Yard Sales
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!yardSale) {
    return null;
  }

  const mapOptions = {
    disableDefaultUI: false,
    clickableIcons: true,
    scrollwheel: true,
    mapId: 'DEMO_MAP_ID',
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-base-200">
        <div className="max-w-6xl mx-auto p-6">
          {/* Navigation Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-sm text-base-content/70">
            <Link 
              href="/yardsales" 
              className="hover:text-primary transition-colors"
            >
              Yard Sales
            </Link>
            <span>/</span>
            <span className="text-base-content font-medium">{yardSale.title}</span>
          </div>

          {error && (
            <div className="alert alert-error mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Images Gallery */}
              {yardSale.images && yardSale.images.length > 0 ? (
                <div className="card bg-base-100 shadow-lg">
                  <div className="card-body p-0">
                    <div className="relative">
                      <img
                        src={yardSale.images[currentImageIndex]}
                        alt={yardSale.title}
                        className="w-full h-96 object-cover"
                      />
                      {yardSale.images.length > 1 && (
                        <>
                          <button
                            onClick={() => setCurrentImageIndex((prev) => (prev - 1 + yardSale.images.length) % yardSale.images.length)}
                            className="absolute left-4 top-1/2 -translate-y-1/2 btn btn-circle btn-sm bg-base-100/80 hover:bg-base-100"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setCurrentImageIndex((prev) => (prev + 1) % yardSale.images.length)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 btn btn-circle btn-sm bg-base-100/80 hover:bg-base-100"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                            {yardSale.images.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => setCurrentImageIndex(index)}
                                className={`w-2 h-2 rounded-full ${
                                  index === currentImageIndex ? 'bg-primary' : 'bg-base-100/50'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {yardSale.images.length > 1 && (
                      <div className="p-4 grid grid-cols-4 gap-2">
                        {yardSale.images.map((image, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentImageIndex(index)}
                            className={`aspect-square overflow-hidden rounded-lg border-2 ${
                              index === currentImageIndex ? 'border-primary' : 'border-transparent'
                            }`}
                          >
                            <img
                              src={image}
                              alt={`${yardSale.title} ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="card bg-base-100 shadow-lg">
                  <div className="card-body h-96 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Title and Description */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h1 className="text-3xl font-bold text-base-content mb-4">{yardSale.title}</h1>
                  <div className="prose max-w-none">
                    <p className="text-base-content whitespace-pre-wrap">{yardSale.description}</p>
                  </div>
                </div>
              </div>

              {/* Map */}
              {yardSale.location && (
                <div className="card bg-base-100 shadow-lg">
                  <div className="card-body">
                    <h2 className="text-xl font-semibold mb-4">Location</h2>
                    {!isLoadingKey && (isGoogleMapsLoaded || apiKey) && (
                      <div className="h-64 rounded-lg overflow-hidden border border-base-300">
                        {isGoogleMapsLoaded ? (
                          <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={yardSale.location}
                            zoom={15}
                            options={mapOptions}
                          >
                            <AdvancedMarker
                              position={yardSale.location}
                              title={yardSale.address}
                              iconUrl="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                            />
                          </GoogleMap>
                        ) : (
                          <LoadScript
                            googleMapsApiKey={apiKey}
                            libraries={libraries}
                            loadingElement={
                              <div className="flex items-center justify-center h-full">
                                <span className="loading loading-spinner loading-lg text-primary"></span>
                              </div>
                            }
                          >
                            <GoogleMap
                              mapContainerStyle={{ width: '100%', height: '100%' }}
                              center={yardSale.location}
                              zoom={15}
                              options={mapOptions}
                            >
                              <AdvancedMarker
                                position={yardSale.location}
                                title={yardSale.address}
                                iconUrl="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                              />
                            </GoogleMap>
                          </LoadScript>
                        )}
                      </div>
                    )}
                    <p className="mt-4 text-base-content/70">{yardSale.address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Details Card */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h2 className="text-xl font-semibold mb-4">Details</h2>
                  
                  <div className="space-y-4">
                    {/* Date */}
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-base-content/70 mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Date & Time
                      </div>
                      <p className="text-base-content font-medium">{formatDate(yardSale.saleDate)}</p>
                      {yardSale.saleTime && (
                        <p className="text-base-content/70 text-sm">Time: {yardSale.saleTime}</p>
                      )}
                    </div>

                    {/* Price Range */}
                    {yardSale.priceRange && (
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-base-content/70 mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Price Range
                        </div>
                        <p className="font-semibold text-primary">{yardSale.priceRange}</p>
                      </div>
                    )}

                    {/* Contact Info */}
                    {(yardSale.contactInfo?.phone || yardSale.contactInfo?.email) && (
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-base-content/70 mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Contact
                        </div>
                        <div className="space-y-1">
                          {yardSale.contactInfo.phone && (
                            <p className="text-base-content">
                              <a href={`tel:${yardSale.contactInfo.phone}`} className="hover:text-primary">
                                {yardSale.contactInfo.phone}
                              </a>
                            </p>
                          )}
                          {yardSale.contactInfo.email && (
                            <p className="text-base-content">
                              <a href={`mailto:${yardSale.contactInfo.email}`} className="hover:text-primary">
                                {yardSale.contactInfo.email}
                              </a>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Creator */}
                    <div className="pt-4 border-t border-base-300">
                      <div className="flex items-center gap-3">
                        <img
                          src={yardSale.createdBy?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(yardSale.createdBy?.name || 'User')}&background=f39c12&color=fff`}
                          alt={yardSale.createdBy?.name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div>
                          <p className="text-sm text-base-content/70">Created by</p>
                          <p className="font-semibold text-base-content">{yardSale.createdBy?.name}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {yardSale.isOwner && (
                <div className="card bg-base-100 shadow-lg">
                  <div className="card-body">
                    <h3 className="text-lg font-semibold mb-4">Actions</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setEditingYardSale(yardSale);
                          setIsEditModalOpen(true);
                        }}
                        className="btn btn-outline btn-block"
                      >
                        Edit Yard Sale
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="btn btn-error btn-block"
                      >
                        {deleting ? (
                          <>
                            <span className="loading loading-spinner"></span>
                            Deleting...
                          </>
                        ) : (
                          'Delete Yard Sale'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Back Button */}
              <Link
                href="/yardsales"
                className="btn btn-outline btn-block"
              >
                Back to Yard Sales
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingYardSale && (
        <EditYardSaleModal
          yardSale={editingYardSale}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingYardSale(null);
          }}
          onSave={handleEditSave}
          user={user}
        />
      )}
    </>
  );
}

