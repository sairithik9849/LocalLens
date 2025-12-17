'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/app/components/AdvancedMarker';
import { useGoogleMapsLoader } from '@/lib/useGoogleMapsLoader';

// Static libraries array to prevent LoadScript reload
const libraries = ['places', 'marker'];

// Helper function to get current date/time in local timezone for datetime-local input
const getCurrentDateTimeLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Convert date to local datetime-local format
const dateToLocalDateTime = (date) => {
  if (!date) return getCurrentDateTimeLocal();
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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
  
  if (isNaN(date.getTime())) {
    return 'Invalid date and time format';
  }
  
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
    return '';
  }
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length !== 10) {
    return 'Phone number must be exactly 10 digits (e.g., (555) 123-4567)';
  }
  return '';
};

const validateEmail = (value) => {
  if (!value || value.trim() === '') {
    return '';
  }
  const trimmed = value.trim();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address';
  }
  if (trimmed.length > 254) {
    return 'Email address is too long';
  }
  return '';
};

const validatePrice = (value, isMin = true) => {
  if (!value || value.trim() === '') {
    return '';
  }
  const cleaned = value.replace(/[$,\s]/g, '');
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

// Format phone number as user types
const formatPhoneNumber = (value) => {
  const digitsOnly = value.replace(/\D/g, '');
  const limited = digitsOnly.slice(0, 10);
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
};

// Format price with $ prefix
const formatPrice = (value) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  return `$${cleaned}`;
};

export default function EditYardSaleModal({ yardSale, isOpen, onClose, onSave, user }) {
  const { apiKey, isGoogleMapsLoaded, isLoadingKey } = useGoogleMapsLoader(libraries);
  const mapRef = useRef(null);
  const fileInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
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
  const [mapCenter, setMapCenter] = useState({ lat: 40.748817, lng: -74.044502 });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Initialize form data when yard sale changes or modal opens
  useEffect(() => {
    if (yardSale && isOpen) {
      // Parse price range if it exists (format: $5-$50 or $5+ or Up to $50)
      let priceMin = '';
      let priceMax = '';
      if (yardSale.priceRange) {
        const range = yardSale.priceRange;
        if (range.includes('-')) {
          const parts = range.split('-');
          priceMin = parts[0].replace(/[^0-9.]/g, '');
          priceMax = parts[1].replace(/[^0-9.]/g, '');
        } else if (range.includes('+')) {
          priceMin = range.replace(/[^0-9.]/g, '');
        } else if (range.includes('Up to')) {
          priceMax = range.replace(/[^0-9.]/g, '');
        }
      }

      setFormData({
        location: {
          lat: yardSale.location?.lat || null,
          lng: yardSale.location?.lng || null
        },
        title: yardSale.title || '',
        description: yardSale.description || '',
        saleDate: dateToLocalDateTime(yardSale.saleDate),
        saleTime: yardSale.saleTime || '',
        address: yardSale.address || '',
        contactInfo: {
          phone: yardSale.contactInfo?.phone ? formatPhoneNumber(yardSale.contactInfo.phone) : '',
          email: yardSale.contactInfo?.email || ''
        },
        priceRangeMin: priceMin ? `$${priceMin}` : '',
        priceRangeMax: priceMax ? `$${priceMax}` : '',
        images: yardSale.images || []
      });
      
      setSelectedLocation({
        lat: yardSale.location?.lat || null,
        lng: yardSale.location?.lng || null
      });
      
      if (yardSale.location?.lat && yardSale.location?.lng) {
        setMapCenter({
          lat: yardSale.location.lat,
          lng: yardSale.location.lng
        });
      }

      // Set existing images as previews
      if (yardSale.images && yardSale.images.length > 0) {
        setImagePreviewUrls(yardSale.images);
        setSelectedImages([]); // No new files selected yet
      } else {
        setImagePreviewUrls([]);
        setSelectedImages([]);
      }

      setError('');
      setFieldErrors({
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
    }
  }, [yardSale, isOpen]);

  const handleMapClick = async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSelectedLocation({ lat, lng });
    setFormData(prev => ({
      ...prev,
      location: { lat, lng }
    }));
    
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
      }
    } catch (error) {
      console.error('Error getting address:', error);
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    // imagePreviewUrls already includes existing images, so we only need to check total
    if (files.length + imagePreviewUrls.length > 4) {
      alert('Maximum 4 images allowed');
      return;
    }

    setSelectedImages([...selectedImages, ...files]);
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setImagePreviewUrls([...imagePreviewUrls, ...newPreviewUrls]);
  };

  const removeImage = (index) => {
    // Check if it's an existing image (base64 string) or a new preview (blob URL)
    const isExistingImage = index < formData.images.length;
    
    if (isExistingImage) {
      // Remove existing image from formData.images
      const newImages = formData.images.filter((_, i) => i !== index);
      const newPreviews = imagePreviewUrls.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, images: newImages }));
      setImagePreviewUrls(newPreviews);
    } else {
      // Remove new preview (blob URL needs to be revoked)
      const adjustedIndex = index - formData.images.length;
      const newImages = selectedImages.filter((_, i) => i !== adjustedIndex);
      const newPreviews = imagePreviewUrls.filter((_, i) => i !== index);
      URL.revokeObjectURL(imagePreviewUrls[index]);
      setSelectedImages(newImages);
      setImagePreviewUrls(newPreviews);
    }
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

  const handleInputChange = (field, value) => {
    if (field === 'contactInfo') {
      const contactField = Object.keys(value)[0];
      const contactValue = value[contactField];
      
      setFormData(prev => ({
        ...prev,
        contactInfo: { ...prev.contactInfo, ...value }
      }));

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
        return;
      } else if (field === 'priceRangeMax') {
        error = validatePrice(value, false);
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
        return;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('You must be logged in to edit a yard sale');
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

    if (titleError || descriptionError || dateError || addressError || phoneError || emailError || priceMinError || priceMaxError || priceRangeError) {
      setError('Please fix all validation errors before submitting');
      return;
    }

    setSubmitting(true);

    try {
      // Convert new images to base64
      let newImageBase64Array = [];
      if (selectedImages.length > 0) {
        newImageBase64Array = await convertImagesToBase64(selectedImages);
      }

      // Combine existing images with new ones
      const allImages = [...formData.images, ...newImageBase64Array];

      // Get Firebase ID token
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

      // Format phone number
      const formattedPhone = formData.contactInfo.phone ? formData.contactInfo.phone.replace(/\D/g, '') : '';

      const response = await fetch(`/api/yardsales/${yardSale._id}`, {
        method: 'PATCH',
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
          images: allImages
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update yard sale');
        setSubmitting(false);
        return;
      }

      // Call onSave callback with updated yard sale
      onSave(data.yardSale);
      onClose();
    } catch (error) {
      console.error('Error updating yard sale:', error);
      setError('Failed to update yard sale. Please try again.');
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const mapOptions = {
    disableDefaultUI: false,
    clickableIcons: true,
    scrollwheel: true,
    mapId: 'DEMO_MAP_ID',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4">
      <div className="card bg-base-100 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-base-content">Edit Yard Sale</h2>
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="alert alert-error mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Selection */}
            <div className="card bg-base-200 shadow">
              <div className="card-body">
                <h3 className="text-lg font-semibold mb-4 text-base-content">Yard Sale Location</h3>
                
                <div className="mb-4">
                  <p className="text-sm text-base-content/70 mb-2">
                    Click on the map to update the location (must be within your pincode)
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
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">
                Address <span className="text-error">*</span>
                {loadingAddress && <span className="text-xs text-base-content/50 ml-2">(Loading...)</span>}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                onBlur={(e) => handleInputChange('address', e.target.value)}
                placeholder="Street address"
                required
                className={`input input-bordered w-full ${
                  fieldErrors.address ? 'input-error' : ''
                }`}
              />
              <p className={`text-xs mt-1 ${fieldErrors.address ? 'text-error' : 'text-base-content/50'}`}>
                {fieldErrors.address || 'Address will be auto-filled when you select a location on the map'}
              </p>
            </div>

            {/* Title */}
            <div>
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
              <p className={`text-xs mt-1 ${fieldErrors.title ? 'text-error' : 'text-base-content/50'}`}>
                {fieldErrors.title || `${formData.title.length}/200 characters`}
              </p>
            </div>

            {/* Description */}
            <div>
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
              <p className={`text-xs mt-1 ${fieldErrors.description ? 'text-error' : 'text-base-content/50'}`}>
                {fieldErrors.description || `${formData.description.length}/2000 characters`}
              </p>
            </div>

            {/* Sale Date & Time */}
            <div>
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

            {/* Contact Info */}
            <div className="card bg-base-200 shadow">
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
                  </div>
                </div>
              </div>
            </div>

            {/* Price Range */}
            <div className="card bg-base-200 shadow">
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
              </div>
            </div>

            {/* Images */}
            <div className="card bg-base-200 shadow">
              <div className="card-body">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Images (Max 4)
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
                  disabled={imagePreviewUrls.length >= 4}
                  className="btn btn-outline btn-sm mb-4"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Add Images ({imagePreviewUrls.length}/4)
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

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

