import { NextResponse } from 'next/server';
import { getGoogleMapsApiKey } from '@/lib/gistApiKey';

/**
 * Weather API Route
 * Fetches weather data from Google Weather API
 * 
 * Query params:
 * - zipcode: ZIP code to get weather for
 * - lat: Latitude (optional, used if zipcode not provided)
 * - lng: Longitude (optional, used if zipcode not provided)
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const zipcode = searchParams.get('zipcode');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Get Google Maps API key (same key used for Weather API)
    let apiKey;
    try {
      apiKey = await getGoogleMapsApiKey();
    } catch (error) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your Gist.' },
        { status: 500 }
      );
    }

    // First, get coordinates if zipcode is provided
    let coordinates = { 
      lat: lat ? parseFloat(lat) : null, 
      lng: lng ? parseFloat(lng) : null 
    };
    
    if (zipcode && (!coordinates.lat || !coordinates.lng)) {
      // Geocode zipcode to get coordinates
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${zipcode}&key=${apiKey}`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.status !== 'OK' || !geocodeData.results[0]) {
        return NextResponse.json(
          { error: 'Invalid zipcode' },
          { status: 400 }
        );
      }
      
      const location = geocodeData.results[0].geometry.location;
      coordinates = {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng)
      };
    } else if (!coordinates.lat || !coordinates.lng) {
      return NextResponse.json(
        { error: 'Either zipcode or lat/lng must be provided' },
        { status: 400 }
      );
    }

    // Fetch weather data from Google Weather API
    // Try GET request first (since URL works when tested directly)
    const weatherUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${coordinates.lat}&location.longitude=${coordinates.lng}`;
    
    let weatherResponse = await fetch(weatherUrl, {
      method: 'GET',
    });
    
    // If GET returns 404/405, try POST with JSON body
    if (!weatherResponse.ok && (weatherResponse.status === 404 || weatherResponse.status === 405)) {
      const postUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;
      const requestBody = {
        location: {
          latitude: parseFloat(coordinates.lat),
          longitude: parseFloat(coordinates.lng)
        }
      };
      
      weatherResponse = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    }
    
    if (!weatherResponse.ok) {
      const errorData = await weatherResponse.json().catch(() => ({}));
      throw new Error(`Weather API error: ${weatherResponse.statusText}. ${errorData.error?.message || ''}`);
    }
    
    const weatherData = await weatherResponse.json();

    // Google Weather API response structure is at root level
    // temperature: { degrees: 7.9, unit: "CELSIUS" }
    // feelsLikeTemperature: { degrees: 7.9, unit: "CELSIUS" }
    // weatherCondition: { description: { text: "Mostly sunny" }, type: "MOSTLY_CLEAR", iconBaseUri: "..." }
    // relativeHumidity: 46 (already a percentage)
    // wind: { speed: { value: 2, unit: "KILOMETERS_PER_HOUR" } }
    // visibility: { distance: 16, unit: "KILOMETERS" }
    // airPressure: { meanSeaLevelMillibars: 1022.15 }
    
    // Temperature in Celsius
    const tempC = weatherData.temperature?.degrees || null;
    const tempF = tempC !== null ? Math.round((tempC * 9/5) + 32) : null;
    
    // Feels like temperature in Celsius
    const feelsLikeC = weatherData.feelsLikeTemperature?.degrees || tempC;
    const feelsLikeF = feelsLikeC !== null ? Math.round((feelsLikeC * 9/5) + 32) : null;
    
    // Wind speed - convert from km/h to mph
    const windSpeedKmh = weatherData.wind?.speed?.value || 0;
    const windSpeedMph = Math.round(windSpeedKmh * 0.621371); // km/h to mph
    
    // Humidity - already a percentage (0-100)
    const humidity = weatherData.relativeHumidity !== undefined 
      ? Math.round(weatherData.relativeHumidity) 
      : null;
    
    // Visibility - convert from km to miles
    const visibilityKm = weatherData.visibility?.distance || null;
    const visibility = visibilityKm !== null 
      ? (visibilityKm * 0.621371).toFixed(1) // km to miles
      : null;
    
    // Pressure in millibars (hPa)
    const pressure = weatherData.airPressure?.meanSeaLevelMillibars || null;
    
    // Condition and description
    const condition = weatherData.weatherCondition?.type || 'Unknown';
    const description = weatherData.weatherCondition?.description?.text || condition || 'Unknown';
    
    // Icon - Google provides iconBaseUri, but we'll use OpenWeatherMap format for compatibility
    // The iconBaseUri from Google is like: "https://maps.gstatic.com/weather/v1/mostly_sunny"
    // We'll map the condition type to OpenWeatherMap icon codes for consistency
    const icon = getWeatherIcon(condition);
    
    const formattedData = {
      current: {
        temperature_c: tempC,
        temperature_f: tempF,
        feelsLike_c: feelsLikeC,
        feelsLike_f: feelsLikeF,
        condition: condition,
        description: description,
        icon: icon,
        humidity: humidity,
        windSpeed: windSpeedMph,
        visibility: visibility,
        pressure: pressure,
        location: zipcode || `${coordinates.lat},${coordinates.lng}`,
      },
      hourly: [], // Google Weather API current conditions - hourly forecast would need separate call
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Weather API error:', error);
    
    // Fallback: Return error with helpful message
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch weather data',
        note: 'Make sure Google Weather API is enabled in your Google Cloud Console'
      },
      { status: 500 }
    );
  }
}

// Helper function to map Google Weather condition types to icon codes
// Google uses types like: MOSTLY_CLEAR, PARTLY_CLOUDY, CLOUDY, RAIN, etc.
function getWeatherIcon(condition) {
  if (!condition) return '01d';
  
  const conditionUpper = condition.toUpperCase();
  const iconMap = {
    'CLEAR': '01d',
    'MOSTLY_CLEAR': '01d',
    'PARTLY_CLOUDY': '02d',
    'MOSTLY_CLOUDY': '03d',
    'CLOUDY': '04d',
    'OVERCAST': '04d',
    'RAIN': '10d',
    'SHOWERS': '09d',
    'THUNDERSTORM': '11d',
    'THUNDERSTORMS': '11d',
    'SNOW': '13d',
    'FOG': '50d',
    'MIST': '50d',
    'HAZE': '50d',
    'WINDY': '50d',
  };
  
  return iconMap[conditionUpper] || '01d';
}

