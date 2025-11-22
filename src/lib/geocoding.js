/**
 * Geocoding utilities
 * Converts zipcode to coordinates using OpenStreetMap or Google Geocoding API
 */

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

