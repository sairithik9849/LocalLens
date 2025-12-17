'use client';

import { useState, useEffect } from 'react';

const WeatherPill = ({ zipcode, lat, lng }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (zipcode) {
          params.append('zipcode', zipcode);
        } else if (lat && lng) {
          params.append('lat', lat);
          params.append('lng', lng);
        } else {
          setError('No location provided');
          return;
        }

        const response = await fetch(`/api/weather?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch weather');
        }
        const data = await response.json();
        setWeather(data);
      } catch (err) {
        console.error('Weather fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (zipcode || (lat && lng)) {
      fetchWeather();
    }
  }, [zipcode, lat, lng]);

  if (loading) {
    return (
      <div className="bg-base-100 rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span className="text-sm text-base-content/70">Loading...</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-error/10 rounded-full px-4 py-2 shadow-lg">
        <span className="text-sm text-error">Weather unavailable</span>
      </div>
    );
  }

  const weatherIconUrl = `https://openweathermap.org/img/wn/${weather.current.icon}@2x.png`;

  return (
    <>
      <button
        onClick={() => setShowDetails(true)}
        className="bg-base-100 rounded-full px-4 py-2 shadow-lg hover:shadow-xl transition-shadow flex items-center gap-3 cursor-pointer"
      >
        <img 
          src={weatherIconUrl} 
          alt={weather.current.condition}
          className="w-10 h-10"
        />
        <div className="flex flex-col items-start">
          <span className="text-lg font-semibold text-base-content">
            {weather.current.temperature_f}°F | {weather.current.temperature_c}°C
          </span>
          <span className="text-xs text-base-content/60 capitalize">
            {weather.current.description}
          </span>
        </div>
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {showDetails && (
        <WeatherDetails
          weather={weather}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
};

const WeatherDetails = ({ weather, onClose }) => {
  const formatTime = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-base-100 border-b border-base-300 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-base-content">
              {weather.current.location}
            </h2>
            <p className="text-sm text-base-content/60">Weather Details</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-base-200 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6 text-base-content/70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Weather */}
        <div className="p-6 border-b border-base-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={`https://openweathermap.org/img/wn/${weather.current.icon}@2x.png`}
                alt={weather.current.condition}
                className="w-20 h-20"
              />
              <div>
                <div className="text-5xl font-bold text-base-content">
                  {weather.current.temperature_f}°F | {weather.current.temperature_c}°C
                </div>
                <div className="text-lg text-base-content/70 capitalize">
                  {weather.current.description}
                </div>
                <div className="text-sm text-base-content/60">
                  Feels like {weather.current.feelsLike_f}°F | {weather.current.feelsLike_c}°C
                </div>
              </div>
            </div>
          </div>

          {/* Weather Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Humidity</div>
              <div className="text-lg font-semibold text-base-content">
                {weather.current.humidity}%
              </div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Wind Speed</div>
              <div className="text-lg font-semibold text-base-content">
                {weather.current.windSpeed} mph
              </div>
            </div>
            {weather.current.visibility && (
              <div className="bg-base-200 rounded-lg p-3">
                <div className="text-xs text-base-content/60 mb-1">Visibility</div>
                <div className="text-lg font-semibold text-base-content">
                  {weather.current.visibility} mi
                </div>
              </div>
            )}
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Pressure</div>
              <div className="text-lg font-semibold text-base-content">
                {weather.current.pressure} hPa
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Forecast */}
        {weather.hourly && weather.hourly.length > 0 && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-base-content mb-4">
              Hourly Forecast
            </h3>
            <div className="space-y-2">
              {weather.hourly.map((hour, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-24 text-sm text-base-content/70">
                      {index === 0 ? 'Now' : formatTime(hour.time)}
                    </div>
                    <img
                      src={`https://openweathermap.org/img/wn/${hour.icon}.png`}
                      alt={hour.condition}
                      className="w-10 h-10"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-base-content capitalize">
                        {hour.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-base-content">
                        {hour.temperature}°F
                      </div>
                      <div className="text-xs text-base-content/60">
                        {hour.humidity}% • {hour.windSpeed} mph
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherPill;

