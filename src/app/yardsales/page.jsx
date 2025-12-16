'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import { useCheckBanned } from '@/hooks/useCheckBanned';
import Navigation from '@/app/components/Navigation';
import Link from 'next/link';

export default function YardSalesPage() {
  const { user, loading: authLoading } = useAuth();
  const { checkingBanned } = useCheckBanned();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pincode, setPincode] = useState(null);
  const [yardSales, setYardSales] = useState([]);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [filteredYardSales, setFilteredYardSales] = useState([]);

  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading || checkingBanned) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    const fetchYardSales = async () => {
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

        // Fetch yard sales
        const yardSalesResponse = await fetch(`/api/yardsales?includePast=${includePast}`, {
          headers: headers
        });
        const yardSalesData = await yardSalesResponse.json();

        if (!yardSalesResponse.ok) {
          throw new Error(yardSalesData.error || 'Failed to fetch yard sales');
        }

        const yardSalesList = yardSalesData.yardSales || [];
        setYardSales(yardSalesList);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching yard sales:', err);
        setError(err.message || 'Failed to load yard sales');
        setLoading(false);
      }
    };

    fetchYardSales();
  }, [user, authLoading, checkingBanned, router, includePast]);

  // Filter yard sales
  useEffect(() => {
    let filtered = [...yardSales];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(yardSale => {
        const titleMatch = yardSale.title?.toLowerCase().includes(query);
        const descMatch = yardSale.description?.toLowerCase().includes(query);
        const addressMatch = yardSale.address?.toLowerCase().includes(query);
        const creatorMatch = yardSale.createdBy?.name?.toLowerCase().includes(query);
        return titleMatch || descMatch || addressMatch || creatorMatch;
      });
    }

    setFilteredYardSales(filtered);
  }, [yardSales, searchQuery]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (authLoading || loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content/70">Loading yard sales...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return null; // Will redirect
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
              Please set your pincode in your profile to view yard sales.
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

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-base-200">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-base-content mb-2">Yard Sales</h1>
              <p className="text-base-content/70">Yard sales in your pincode: {pincode}</p>
            </div>
            <Link
              href="/yardsales/create"
              className="btn btn-primary gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Yard Sale
            </Link>
          </div>

          {error && (
            <div className="alert alert-error mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Filters */}
          <div className="card bg-base-100 shadow-lg mb-6">
            <div className="card-body">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search yard sales..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input input-bordered w-full"
                  />
                </div>
                {/* Include Past Toggle */}
                <div className="form-control">
                  <label className="label cursor-pointer gap-2">
                    <span className="label-text">Include Past Sales</span>
                    <input
                      type="checkbox"
                      checked={includePast}
                      onChange={(e) => setIncludePast(e.target.checked)}
                      className="toggle toggle-primary"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Yard Sales Grid */}
          {filteredYardSales.length === 0 ? (
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-base-content/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h3 className="text-xl font-semibold text-base-content mb-2">
                  {searchQuery ? 'No yard sales found' : 'No yard sales yet'}
                </h3>
                <p className="text-base-content/70 mb-6">
                  {searchQuery 
                    ? 'Try adjusting your search terms'
                    : 'Be the first to create a yard sale in your area!'}
                </p>
                {!searchQuery && (
                  <Link href="/yardsales/create" className="btn btn-primary">
                    Create Yard Sale
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredYardSales.map((yardSale) => (
                <Link
                  key={yardSale._id}
                  href={`/yardsales/${yardSale._id}`}
                  className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow"
                >
                  {/* Image */}
                  {yardSale.images && yardSale.images.length > 0 ? (
                    <figure className="h-48 overflow-hidden">
                      <img
                        src={yardSale.images[0]}
                        alt={yardSale.title}
                        className="w-full h-full object-cover"
                      />
                    </figure>
                  ) : (
                    <figure className="h-48 bg-base-200 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </figure>
                  )}
                  
                  <div className="card-body">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h2 className="card-title text-lg flex-1">{yardSale.title}</h2>
                      {yardSale.isOwner && (
                        <span className="badge badge-primary badge-sm whitespace-nowrap">
                          My Posting
                        </span>
                      )}
                    </div>
                    <p className="text-base-content/70 text-sm line-clamp-2">
                      {yardSale.description}
                    </p>
                    
                    <div className="mt-4 space-y-2">
                      {/* Date */}
                      <div className="flex items-center gap-2 text-sm text-base-content/70">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatDateShort(yardSale.saleDate)}</span>
                        {yardSale.saleTime && <span className="text-xs">• {yardSale.saleTime}</span>}
                      </div>
                      
                      {/* Address */}
                      <div className="flex items-center gap-2 text-sm text-base-content/70">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{yardSale.address}</span>
                      </div>
                      
                      {/* Price Range */}
                      {yardSale.priceRange && (
                        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{yardSale.priceRange}</span>
                        </div>
                      )}
                      
                      {/* Creator */}
                      <div className="flex items-center gap-2 text-xs text-base-content/50 pt-2 border-t border-base-300">
                        <img
                          src={yardSale.createdBy?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(yardSale.createdBy?.name || 'User')}&background=f39c12&color=fff`}
                          alt={yardSale.createdBy?.name}
                          className="w-6 h-6 rounded-full"
                        />
                        <span>{yardSale.createdBy?.name}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

