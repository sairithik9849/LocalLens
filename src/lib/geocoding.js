/**
 * Geocoding utilities
 * Converts zipcode to coordinates using OpenStreetMap or Google Geocoding API
 */

import { getGoogleMapsApiKey } from './gistApiKey.js';

/**
 * Convert zipcode to coordinates using OpenStreetMap Nominatim (free, no API key)
 */
export async function zipcodeToCoords(zipcode) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=US&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'LocalLens/1.0', // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding API error');
    }

    const data = await response.json();
    
    if (data.length === 0) {
      throw new Error('Zipcode not found');
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: data[0].display_name,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

/**
 * Convert zipcode to coordinates using Google Geocoding API
 * Requires Google Maps API key
 */
export async function zipcodeToCoordsGoogle(zipcode, apiKey) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${zipcode}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error('Google Geocoding API error');
    }

    const data = await response.json();
    
    if (data.status !== 'OK' || data.results.length === 0) {
      throw new Error('Zipcode not found');
    }

    const location = data.results[0].geometry.location;
    
    return {
      lat: location.lat,
      lng: location.lng,
      address: data.results[0].formatted_address,
    };
  } catch (error) {
    console.error('Google Geocoding error:', error);
    throw error;
  }
}

/**
 * Extracts city name from OpenStreetMap address string
 * @param {string} displayName - Full address string from OpenStreetMap
 * @returns {string|null} City name or null if not found
 */
function extractCityFromOSM(displayName) {
  if (!displayName) return null;
  
  // OpenStreetMap format: "City, State ZIP, Country"
  // Try to extract city (first part before comma)
  const parts = displayName.split(',');
  if (parts.length >= 1) {
    return parts[0].trim();
  }
  return null;
}

/**
 * Extracts city name from Google Geocoding address components
 * @param {Array} addressComponents - Address components array from Google API
 * @returns {string|null} City name or null if not found
 */
function extractCityFromGoogle(addressComponents) {
  if (!addressComponents || !Array.isArray(addressComponents)) {
    return null;
  }
  
  // Look for locality (city) or administrative_area_level_2 (county/city)
  for (const component of addressComponents) {
    if (component.types.includes('locality')) {
      return component.long_name;
    }
    if (component.types.includes('administrative_area_level_2')) {
      return component.long_name;
    }
  }
  
  return null;
}

/**
 * Converts pincode to city name
 * @param {string} pincode - US ZIP code
 * @param {string|null} apiKey - Optional Google Maps API key (if not provided, uses OpenStreetMap)
 * @returns {Promise<string|null>} City name or null if not found
 */
export async function pincodeToCity(pincode, apiKey = null) {
  if (!pincode) {
    return null;
  }
  
  // Remove dash from pincode for geocoding (use 5-digit format)
  const zip5 = pincode.replace(/-/g, '').slice(0, 5);
  
  try {
    // Try Google Geocoding API first if API key is available
    if (apiKey) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${zip5}&key=${apiKey}`
        );
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'OK' && data.results.length > 0) {
            const city = extractCityFromGoogle(data.results[0].address_components);
            if (city) {
              return city;
            }
            // Fallback: try to extract from formatted_address
            const addressParts = data.results[0].formatted_address.split(',');
            if (addressParts.length >= 1) {
              return addressParts[0].trim();
            }
          }
        }
      } catch (googleError) {
        console.warn('Google Geocoding failed, trying OpenStreetMap:', googleError);
      }
    }
    
    // Fallback to OpenStreetMap (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zip5}&country=US&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'LocalLens/1.0', // Required by Nominatim
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Geocoding API error');
    }
    
    const data = await response.json();
    
    if (data.length === 0) {
      return null;
    }
    
    // Extract city from OpenStreetMap response
    const city = extractCityFromOSM(data[0].display_name);
    return city;
    
  } catch (error) {
    console.error('Error getting city from pincode:', error);
    return null;
  }
}

/**
 * Converts pincode to city name (with automatic API key fetching)
 * @param {string} pincode - US ZIP code
 * @returns {Promise<string|null>} City name or null if not found
 */
export async function pincodeToCityAuto(pincode) {
  try {
    // Try to get Google Maps API key from Gist
    const apiKey = await getGoogleMapsApiKey();
    return await pincodeToCity(pincode, apiKey || null);
  } catch (error) {
    // If API key fetch fails, use OpenStreetMap
    return await pincodeToCity(pincode, null);
  }
}

