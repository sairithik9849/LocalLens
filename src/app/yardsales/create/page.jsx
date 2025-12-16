'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import { useCheckBanned } from '@/hooks/useCheckBanned';
import Navigation from '@/app/components/Navigation';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/app/components/AdvancedMarker';
import { useGoogleMapsLoader } from '@/lib/useGoogleMapsLoader';
import { zipcodeToCoordsGoogle, zipcodeToCoords } from '@/lib/geocoding';
import { getGoogleMapsApiKey } from '@/lib/gistApiKey';
import Link from 'next/link';

// Static libraries array to prevent LoadScript reload
const libraries = ['places', 'marker'];

export default function CreateYardSalePage() {
  const { user, loading: authLoading } = useAuth();
  const { checkingBanned } = useCheckBanned();
  const router = useRouter();
  const { apiKey, isGoogleMapsLoaded, isLoadingKey } = useGoogleMapsLoader(libraries);
  const mapRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helper function to get current date/time in local timezone for datetime-local input
  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    // Set to today (allow current day)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    location: { lat: null, lng: null },
    title: '',
    description: '',
    saleDate: getCurrentDateTimeLocal(),
    saleTime: '',
    address: '',
    contactInfo: {
      phone: '',
      email: ''
    },
    priceRangeMin: '',
    priceRangeMax: '',
    images: []
  });

  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    title: '',
    description: '',
    saleDate: '',
    location: '',
    address: '',
    phone: '',
    email: '',
    priceRangeMin: '',
    priceRangeMax: ''
  });
  const [pincode, setPincode] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 40.748817, lng: -74.044502 }); // Default: Hoboken, NJ
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingPincode, setLoadingPincode] = useState(true);
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Fetch user pincode and center map
  useEffect(() => {
    if (!user || authLoading || checkingBanned) return;

    const fetchUserPincode = async () => {
      try {
        setLoadingPincode(true);
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
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch user profile');
        }

        const userPincode = data.user?.profile?.pincode;
        setPincode(userPincode);

        // Set default email from user profile
        const userEmail = data.user?.email || user?.email || '';
        if (userEmail) {
          setFormData(prev => ({
            ...prev,
            contactInfo: {
              ...prev.contactInfo,
              email: userEmail
            }
          }));
        }

        if (userPincode) {
          // Geocode pincode to center map
          try {
            const apiKey = await getGoogleMapsApiKey();
            const coords = await zipcodeToCoordsGoogle(userPincode, apiKey);
            if (coords && coords.lat && coords.lng) {
              setMapCenter({ lat: coords.lat, lng: coords.lng });
            }
          } catch (error) {
            console.warn('Google geocoding failed, trying OpenStreetMap:', error);
            try {
              const coords = await zipcodeToCoords(userPincode);
              if (coords && coords.lat && coords.lng) {
                setMapCenter({ lat: coords.lat, lng: coords.lng });
              }
            } catch (osmError) {
              console.error('Both geocoding services failed:', osmError);
            }
          }
        }
        setLoadingPincode(false);
      } catch (err) {
        console.error('Error fetching user pincode:', err);
        setLoadingPincode(false);
      }
    };

    fetchUserPincode();
  }, [user, authLoading, checkingBanned]);

  const handleMapClick = async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSelectedLocation({ lat, lng });
    setFormData(prev => ({
      ...prev,
      location: { lat, lng }
    }));
    
    // Clear location error when location is selected
    setFieldErrors(prev => ({
      ...prev,
      location: ''
    }));

    // Reverse geocode to get address via API
    setLoadingAddress(true);
    try {
      const response = await fetch(`/api/geocoding/reverse-address?lat=${lat}&lng=${lng}`);
      const data = await response.json();
      
      if (response.ok && data.success && data.address) {
        setFormData(prev => ({
          ...prev,
          address: data.address
        }));
      } else {
        console.warn('Address lookup failed, user can enter manually');
      }
    } catch (error) {
      console.error('Error getting address:', error);
      // Don't fail if address lookup fails, user can enter manually
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedImages.length > 4) {
      alert('Maximum 4 images allowed');
      return;
    }

    setSelectedImages([...selectedImages, ...files]);
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setImagePreviewUrls([...imagePreviewUrls, ...newPreviewUrls]);
  };

  const removeImage = (index) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviewUrls.filter((_, i) => i !== index);
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setSelectedImages(newImages);
    setImagePreviewUrls(newPreviews);
  };

  const convertImagesToBase64 = async (files) => {
    const promises = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(promises);
  };

  // Validation functions
  const validateTitle = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Title is required';
    }
    if (trimmed.length < 3) {
      return 'Title must be at least 3 characters';
    }
    if (trimmed.length > 200) {
      return 'Title must be 200 characters or less';
    }
    return '';
  };

  const validateDescription = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Description is required';
    }
    if (trimmed.length < 10) {
      return 'Description must be at least 10 characters';
    }
    if (trimmed.length > 2000) {
      return 'Description must be 2000 characters or less';
    }
    return '';
  };

  const validateSaleDate = (value) => {
    if (!value) {
      return 'Sale date and time is required';
    }
    
    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const saleDateOnly = new Date(date);
    saleDateOnly.setHours(0, 0, 0, 0);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date and time format';
    }
    
    // Check if date is today or in the future
    if (saleDateOnly < today) {
      return 'Sale date must be today or in the future';
    }
    
    return '';
  };

  const validateAddress = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Address is required';
    }
    return '';
  };

  const validateUSPhone = (value) => {
    if (!value || value.trim() === '') {
      return ''; // Phone is optional
    }
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    // US phone numbers should have exactly 10 digits
    if (digitsOnly.length !== 10) {
      return 'Phone number must be exactly 10 digits (e.g., (555) 123-4567)';
    }
    return '';
  };

  const validateEmail = (value) => {
    if (!value || value.trim() === '') {
      return ''; // Email is optional
    }
    const trimmed = value.trim();
    // Robust email validation regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(trimmed)) {
      return 'Please enter a valid email address';
    }
    // Check length constraints
    if (trimmed.length > 254) {
      return 'Email address is too long';
    }
    return '';
  };

  const validatePrice = (value, isMin = true) => {
    if (!value || value.trim() === '') {
      return ''; // Price is optional
    }
    // Remove $ and whitespace
    const cleaned = value.replace(/[$,\s]/g, '');
    // Check if it's a valid number
    if (isNaN(cleaned) || cleaned === '') {
      return isMin ? 'Minimum price must be a valid number' : 'Maximum price must be a valid number';
    }
    const numValue = parseFloat(cleaned);
    if (numValue < 0) {
      return 'Price cannot be negative';
    }
    if (numValue > 999999) {
      return 'Price is too large (max $999,999)';
    }
    return '';
  };

  const handleInputChange = (field, value) => {
    if (field === 'contactInfo') {
      const contactField = Object.keys(value)[0];
      const contactValue = value[contactField];
      
      setFormData(prev => ({
        ...prev,
        contactInfo: { ...prev.contactInfo, ...value }
      }));

      // Validate contact fields
      let error = '';
      if (contactField === 'phone') {
        error = validateUSPhone(contactValue);
        setFieldErrors(prev => ({
          ...prev,
          phone: error
        }));
      } else if (contactField === 'email') {
        error = validateEmail(contactValue);
        setFieldErrors(prev => ({
          ...prev,
          email: error
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));

      // Real-time validation
      let error = '';
      if (field === 'title') {
        error = validateTitle(value);
      } else if (field === 'description') {
        error = validateDescription(value);
      } else if (field === 'saleDate') {
        error = validateSaleDate(value);
      } else if (field === 'address') {
        error = validateAddress(value);
      } else if (field === 'priceRangeMin') {
        error = validatePrice(value, true);
        // Also validate that min <= max if max exists
        let maxError = '';
        if (!error && formData.priceRangeMax) {
          const minNum = parseFloat(value.replace(/[$,\s]/g, ''));
          const maxNum = parseFloat(formData.priceRangeMax.replace(/[$,\s]/g, ''));
          if (!isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum) {
            error = 'Minimum price must be less than or equal to maximum price';
            maxError = 'Maximum price must be greater than or equal to minimum price';
          }
        }
        setFieldErrors(prev => ({
          ...prev,
          priceRangeMin: error,
          priceRangeMax: maxError || prev.priceRangeMax
        }));
        return; // Early return to avoid double setting
      } else if (field === 'priceRangeMax') {
        error = validatePrice(value, false);
        // Also validate that min <= max if min exists
        let minError = '';
        if (!error && formData.priceRangeMin) {
          const minNum = parseFloat(formData.priceRangeMin.replace(/[$,\s]/g, ''));
          const maxNum = parseFloat(value.replace(/[$,\s]/g, ''));
          if (!isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum) {
            error = 'Maximum price must be greater than or equal to minimum price';
            minError = 'Minimum price must be less than or equal to maximum price';
          }
        }
        setFieldErrors(prev => ({
          ...prev,
          priceRangeMax: error,
          priceRangeMin: minError || prev.priceRangeMin
        }));
        return; // Early return to avoid double setting
      }

      setFieldErrors(prev => {
        if (error === '' && prev[field] !== '') {
          setError('');
        }
        return {
          ...prev,
          [field]: error
        };
      });
    }
  };

  // Format phone number as user types
  const formatPhoneNumber = (value) => {
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limited = digitsOnly.slice(0, 10);
    
    // Format as (XXX) XXX-XXXX
    if (limited.length === 0) return '';
    if (limited.length <= 3) return `(${limited}`;
    if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  };

  // Format price with $ prefix
  const formatPrice = (value) => {
    // Remove all non-digit characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    
    // If empty, return empty
    if (!cleaned) return '';
    
    // Add $ prefix
    return `$${cleaned}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('You must be logged in to create a yard sale');
      return;
    }

    if (!pincode) {
      setError('Pincode is required. Please set your pincode in your profile.');
      return;
    }

    // Validate location
    if (!formData.location.lat || !formData.location.lng) {
      setFieldErrors(prev => ({
        ...prev,
        location: 'Please select a location on the map'
      }));
      setError('Please select a location on the map');
      return;
    }

    // Validate all fields
    const titleError = validateTitle(formData.title);
    const descriptionError = validateDescription(formData.description);
    const dateError = validateSaleDate(formData.saleDate);
    const addressError = validateAddress(formData.address);
    const phoneError = validateUSPhone(formData.contactInfo.phone);
    const emailError = validateEmail(formData.contactInfo.email);
    const priceMinError = validatePrice(formData.priceRangeMin, true);
    const priceMaxError = validatePrice(formData.priceRangeMax, false);
    
    // Validate price range relationship
    let priceRangeError = '';
    if (!priceMinError && !priceMaxError && formData.priceRangeMin && formData.priceRangeMax) {
      const minNum = parseFloat(formData.priceRangeMin.replace(/[$,\s]/g, ''));
      const maxNum = parseFloat(formData.priceRangeMax.replace(/[$,\s]/g, ''));
      if (!isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum) {
        priceRangeError = 'Minimum price must be less than or equal to maximum price';
      }
    }

    setFieldErrors({
      title: titleError,
      description: descriptionError,
      saleDate: dateError,
      address: addressError,
      location: '',
      phone: phoneError,
      email: emailError,
      priceRangeMin: priceMinError || (priceRangeError ? priceRangeError : ''),
      priceRangeMax: priceMaxError || (priceRangeError ? priceRangeError : '')
    });

    // If any validation errors, stop submission
    if (titleError || descriptionError || dateError || addressError || phoneError || emailError || priceMinError || priceMaxError || priceRangeError) {
      setError('Please fix all validation errors before submitting');
      return;
    }

    setSubmitting(true);

    try {
      // Convert images to base64
      let imageBase64Array = [];
      if (selectedImages.length > 0) {
        imageBase64Array = await convertImagesToBase64(selectedImages);
      }

      // Get Firebase ID token for authentication
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

      // Format price range
      let priceRange = null;
      if (formData.priceRangeMin || formData.priceRangeMax) {
        const min = formData.priceRangeMin.replace(/[$,\s]/g, '');
        const max = formData.priceRangeMax.replace(/[$,\s]/g, '');
        if (min && max) {
          priceRange = `$${min}-$${max}`;
        } else if (min) {
          priceRange = `$${min}+`;
        } else if (max) {
          priceRange = `Up to $${max}`;
        }
      }

      // Format phone number (remove formatting, keep only digits)
      const formattedPhone = formData.contactInfo.phone ? formData.contactInfo.phone.replace(/\D/g, '') : '';

      const response = await fetch('/api/yardsales', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          saleDate: formData.saleDate ? new Date(formData.saleDate).toISOString() : null,
          saleTime: formData.saleTime || null,
          location: formData.location,
          address: formData.address,
          contactInfo: (formattedPhone || formData.contactInfo.email) ? {
            phone: formattedPhone || null,
            email: formData.contactInfo.email || null
          } : null,
          priceRange: priceRange,
          images: imageBase64Array,
          uid: user.uid
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create yard sale');
        setSubmitting(false);
        return;
      }

      // Show success message and redirect
      setSuccessMessage('Yard sale created successfully!');
      // Keep submitting true to show loading overlay during redirect
      setTimeout(() => {
        router.push(`/yardsales/${data.yardSale._id}`);
        // Keep loading state until navigation completes
      }, 1500);
    } catch (error) {
      console.error('Error creating yard sale:', error);
      setError('Failed to create yard sale. Please try again.');
      setSubmitting(false);
    }
  };

  if (authLoading || loadingPincode) {
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
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="text-center">
            <p className="text-base-content/70 mb-4">Please log in to create a yard sale.</p>
            <button
              onClick={() => router.push('/login')}
              className="btn btn-primary"
            >
              Go to Login
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
              Please set your pincode in your profile to create yard sales.
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
            <span className="text-base-content font-medium">Create Yard Sale</span>
          </div>

          {/* Header with Back Button */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-base-content">Create Yard Sale</h1>
            <Link
              href="/yardsales"
              className="btn btn-outline gap-2"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Yard Sales
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

          {successMessage && (
            <div className="alert alert-success mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Loading Overlay */}
          {submitting && (
            <div className="fixed inset-0 bg-base-200/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-base-100 rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
                <div className="text-center">
                  <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
                  <h3 className="text-xl font-semibold text-base-content mb-2">Creating Yard Sale...</h3>
                  <p className="text-base-content/70">Please wait while we create your yard sale posting.</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Selection */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="text-xl font-semibold mb-4">Yard Sale Location</h2>
                
                <div className="mb-4">
                  <p className="text-sm text-base-content/70 mb-2">
                    Click on the map to select the yard sale location (must be within your pincode: {pincode})
                  </p>
                  {selectedLocation && (
                    <p className="text-sm text-base-content font-medium mb-2">
                      Selected: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                    </p>
                  )}
                  {fieldErrors.location && (
                    <p className="text-sm text-error">{fieldErrors.location}</p>
                  )}
                </div>

                {!isLoadingKey && (isGoogleMapsLoaded || apiKey) && (
                  <div className="mt-4 h-64 rounded-lg overflow-hidden border border-base-300">
                    {isGoogleMapsLoaded ? (
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={selectedLocation || mapCenter}
                        zoom={selectedLocation ? 15 : 12}
                        options={mapOptions}
                        onClick={handleMapClick}
                        onLoad={(map) => {
                          mapRef.current = map;
                        }}
                      >
                        {selectedLocation && (
                          <AdvancedMarker
                            position={selectedLocation}
                            title="Yard Sale Location"
                            iconUrl="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                          />
                        )}
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
                          center={selectedLocation || mapCenter}
                          zoom={selectedLocation ? 15 : 12}
                          options={mapOptions}
                          onClick={handleMapClick}
                          onLoad={(map) => {
                            mapRef.current = map;
                          }}
                        >
                          {selectedLocation && (
                            <AdvancedMarker
                              position={selectedLocation}
                              title="Yard Sale Location"
                              iconUrl="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                            />
                          )}
                        </GoogleMap>
                      </LoadScript>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Address <span className="text-error">*</span>
                  {loadingAddress && <span className="text-xs text-base-content/50 ml-2">(Loading...)</span>}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  onBlur={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Street address (auto-filled when you click on map)"
                  required
                  className={`input input-bordered w-full ${
                    fieldErrors.address ? 'input-error' : ''
                  }`}
                />
                <p className={`text-xs mt-1 ${fieldErrors.address ? 'text-error' : 'text-base-content/50'}`}>
                  {fieldErrors.address || 'Address will be auto-filled when you select a location on the map'}
                </p>
              </div>
            </div>

            {/* Title */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Title <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  onBlur={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Spring Yard Sale, Moving Sale, etc."
                  maxLength={200}
                  required
                  className={`input input-bordered w-full ${
                    fieldErrors.title ? 'input-error' : ''
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className={`text-xs ${fieldErrors.title ? 'text-error' : 'text-base-content/50'}`}>
                    {fieldErrors.title || `${formData.title.length}/200 characters`}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Description <span className="text-error">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  onBlur={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe what items you're selling, condition, etc."
                  rows={6}
                  maxLength={2000}
                  required
                  className={`textarea textarea-bordered w-full ${
                    fieldErrors.description ? 'textarea-error' : ''
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className={`text-xs ${fieldErrors.description ? 'text-error' : 'text-base-content/50'}`}>
                    {fieldErrors.description || `${formData.description.length}/2000 characters`}
                  </p>
                </div>
              </div>
            </div>

            {/* Sale Date & Time */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Sale Date & Time <span className="text-error">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.saleDate}
                  onChange={(e) => handleInputChange('saleDate', e.target.value)}
                  onBlur={(e) => handleInputChange('saleDate', e.target.value)}
                  min={getCurrentDateTimeLocal().split('T')[0] + 'T00:00'}
                  required
                  className={`input input-bordered w-full ${
                    fieldErrors.saleDate ? 'input-error' : ''
                  }`}
                />
                <p className={`text-xs mt-1 ${fieldErrors.saleDate ? 'text-error' : 'text-base-content/50'}`}>
                  {fieldErrors.saleDate || 'Sale date must be today or in the future'}
                </p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h3 className="text-lg font-semibold mb-4">Contact Information (Optional)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-base-content mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.contactInfo.phone}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        handleInputChange('contactInfo', { phone: formatted });
                      }}
                      onBlur={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        handleInputChange('contactInfo', { phone: formatted });
                      }}
                      placeholder="(555) 123-4567"
                      maxLength={14}
                      className={`input input-bordered w-full ${
                        fieldErrors.phone ? 'input-error' : ''
                      }`}
                    />
                    {fieldErrors.phone && (
                      <p className="text-xs text-error mt-1">{fieldErrors.phone}</p>
                    )}
                    {!fieldErrors.phone && formData.contactInfo.phone && (
                      <p className="text-xs text-base-content/50 mt-1">US phone format: (XXX) XXX-XXXX</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-base-content mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.contactInfo.email}
                      onChange={(e) => handleInputChange('contactInfo', { email: e.target.value })}
                      onBlur={(e) => handleInputChange('contactInfo', { email: e.target.value })}
                      placeholder="your@email.com"
                      className={`input input-bordered w-full ${
                        fieldErrors.email ? 'input-error' : ''
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="text-xs text-error mt-1">{fieldErrors.email}</p>
                    )}
                    {!fieldErrors.email && formData.contactInfo.email && (
                      <p className="text-xs text-base-content/50 mt-1">Default: Your account email (you can change it)</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Price Range */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Price Range (Optional)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-base-content/70 mb-1">
                      Minimum Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/70">$</span>
                      <input
                        type="text"
                        value={formData.priceRangeMin}
                        onChange={(e) => {
                          const formatted = formatPrice(e.target.value);
                          handleInputChange('priceRangeMin', formatted);
                        }}
                        onBlur={(e) => {
                          const formatted = formatPrice(e.target.value);
                          handleInputChange('priceRangeMin', formatted);
                        }}
                        placeholder="0"
                        className={`input input-bordered w-full pl-8 ${
                          fieldErrors.priceRangeMin ? 'input-error' : ''
                        }`}
                      />
                    </div>
                    {fieldErrors.priceRangeMin && (
                      <p className="text-xs text-error mt-1">{fieldErrors.priceRangeMin}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-base-content/70 mb-1">
                      Maximum Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/70">$</span>
                      <input
                        type="text"
                        value={formData.priceRangeMax}
                        onChange={(e) => {
                          const formatted = formatPrice(e.target.value);
                          handleInputChange('priceRangeMax', formatted);
                        }}
                        onBlur={(e) => {
                          const formatted = formatPrice(e.target.value);
                          handleInputChange('priceRangeMax', formatted);
                        }}
                        placeholder="100"
                        className={`input input-bordered w-full pl-8 ${
                          fieldErrors.priceRangeMax ? 'input-error' : ''
                        }`}
                      />
                    </div>
                    {fieldErrors.priceRangeMax && (
                      <p className="text-xs text-error mt-1">{fieldErrors.priceRangeMax}</p>
                    )}
                  </div>
                </div>
                {formData.priceRangeMin && formData.priceRangeMax && !fieldErrors.priceRangeMin && !fieldErrors.priceRangeMax && (
                  <p className="text-xs text-base-content/50 mt-2">
                    Range: {formData.priceRangeMin} - {formData.priceRangeMax}
                  </p>
                )}
              </div>
            </div>

            {/* Images */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Images (Optional, Max 4)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={selectedImages.length >= 4}
                  className="btn btn-outline mb-4"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Add Images ({selectedImages.length}/4)
                </button>
                
                {imagePreviewUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={index} className="relative">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 items-center">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Creating...
                  </>
                ) : (
                  'Create Yard Sale'
                )}
              </button>
              <Link
                href="/yardsales"
                className={`btn btn-outline ${submitting ? 'pointer-events-none opacity-50' : ''}`}
                onClick={(e) => {
                  if (submitting) {
                    e.preventDefault();
                  }
                }}
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

