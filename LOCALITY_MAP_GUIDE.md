# Locality Map Feature - Implementation Guide

## Overview
Building a visual locality map that displays weather, alerts/events, trends (rent prices, crime density), and supports filtering by tags. The map centers on the user's zipcode from the database.

---

## 🛠️ Tech Stack Recommendations

### Core Dependencies Needed:
1. **Map Library**: 
   - `react-leaflet` + `leaflet` (free, open-source)
   - OR `@react-google-maps/api` (Google Maps - requires API key)
   - OR `mapbox-gl` + `react-map-gl` (Mapbox - requires API key)

2. **Data Fetching**:
   - `axios` or native `fetch` for API calls

3. **State Management**:
   - React hooks (`useState`, `useEffect`, `useContext`)
   - Optional: `zustand` or `jotai` for global state

4. **UI Components**:
   - Tailwind CSS (already installed)
   - `lucide-react` or `react-icons` for icons

5. **Database/API**:
   - You'll need to set up API routes in Next.js (`/app/api/`)
   - Database client (MongoDB, PostgreSQL, etc. - depends on your team's choice)

---

## 📋 Architecture Overview

```
┌─────────────────────────────────────────┐
│         Map Page Component              │
│  ┌───────────────────────────────────┐  │
│  │      Map Container (Leaflet)      │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Weather Markers/Layers     │  │  │
│  │  │  Alert/Event Markers        │  │  │
│  │  │  Trend Heatmaps             │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │      Filter Sidebar               │  │
│  │  - Tag filters                    │  │
│  │  - Layer toggles                  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         API Routes (/app/api/)          │
│  - /api/user/zipcode                    │
│  - /api/map/weather                     │
│  - /api/map/alerts                      │
│  - /api/map/events                      │
│  - /api/map/trends                      │
└─────────────────────────────────────────┘
```

---

## 🚀 Step-by-Step Implementation Plan

### Phase 1: Setup & Dependencies

1. **Install Map Library** (Choose one):
   ```bash
   # Option 1: Leaflet (Free, no API key needed)
   npm install react-leaflet leaflet
   
   # Option 2: Google Maps (Requires API key)
   npm install @react-google-maps/api
   
   # Option 3: Mapbox (Requires API key)
   npm install mapbox-gl react-map-gl
   ```

2. **Install Additional Utilities**:
   ```bash
   npm install axios lucide-react
   ```

3. **Add Leaflet CSS** (if using Leaflet):
   - Import in your layout or map component: `import 'leaflet/dist/leaflet.css'`

### Phase 2: Database Integration

1. **Create API Route to Get User Zipcode**:
   - `/app/api/user/zipcode/route.js`
   - Fetch user's zipcode from database
   - Return zipcode or coordinates

2. **Zipcode to Coordinates Conversion**:
   - Use a geocoding service (Google Geocoding API, OpenStreetMap Nominatim, etc.)
   - Store lat/lng or convert on-the-fly

### Phase 3: Map Component Structure

1. **Create Map Page**:
   - `/app/map/page.js` - Main map page
   - `/app/components/MapContainer.js` - Map wrapper component
   - `/app/components/MapLayers.js` - Weather, alerts, trends layers
   - `/app/components/MapFilters.js` - Filter sidebar

2. **Map Initialization**:
   - Fetch user zipcode on page load
   - Convert zipcode to coordinates
   - Center map on user's location
   - Set appropriate zoom level

### Phase 4: Data Layers

#### A. Weather Layer
- **API Options**:
  - OpenWeatherMap API (free tier available)
  - Weather.gov API (US only, free)
  - Visual Crossing (free tier)
- **Implementation**:
  - Fetch weather data for zipcode area
  - Display as markers or overlay
  - Show temperature, conditions, icons

#### B. Alerts & Events Layer
- **Data Source**:
  - Your database (alerts/events table)
  - External APIs (FEMA, local government APIs)
- **Implementation**:
  - Fetch alerts/events for the area
  - Display as markers with icons
  - Click to show details

#### C. Trends Layer
- **Rent Prices**:
  - Zillow API (requires API key)
  - RentSpider API
  - Or scrape/aggregate data
- **Crime Density**:
  - FBI Crime Data API
  - Local police department APIs
  - Or aggregate from your database
- **Implementation**:
  - Display as heatmaps or choropleth layers
  - Color-coded by intensity

### Phase 5: Filtering System

1. **Tag-Based Filtering**:
   - Create filter state management
   - Filter markers/layers by selected tags
   - Update map when filters change

2. **Layer Toggles**:
   - Toggle weather on/off
   - Toggle alerts on/off
   - Toggle events on/off
   - Toggle trends on/off

### Phase 6: UI/UX Polish

1. **Sidebar/Controls**:
   - Filter panel
   - Layer toggles
   - Search/zoom controls

2. **Markers & Popups**:
   - Custom marker icons
   - Info popups on click
   - Styling with Tailwind

---

## 📁 Recommended File Structure

```
src/
├── app/
│   ├── map/
│   │   └── page.js                    # Main map page
│   ├── api/
│   │   ├── user/
│   │   │   └── zipcode/
│   │   │       └── route.js           # Get user zipcode
│   │   └── map/
│   │       ├── weather/
│   │       │   └── route.js           # Weather data API
│   │       ├── alerts/
│   │       │   └── route.js           # Alerts data API
│   │       ├── events/
│   │       │   └── route.js           # Events data API
│   │       └── trends/
│   │           └── route.js           # Trends data API
│   └── components/
│       ├── MapContainer.js            # Main map wrapper
│       ├── MapLayers.js               # Weather, alerts, trends layers
│       ├── MapFilters.js              # Filter sidebar
│       ├── WeatherLayer.js            # Weather-specific layer
│       ├── AlertsLayer.js             # Alerts layer
│       ├── EventsLayer.js             # Events layer
│       └── TrendsLayer.js             # Trends heatmap layer
└── lib/
    ├── geocoding.js                   # Zipcode to coordinates
    └── mapUtils.js                    # Map utility functions
```

---

## 🔑 Key Implementation Details

### 1. Getting User Zipcode
```javascript
// In your map page or component
const fetchUserZipcode = async () => {
  const response = await fetch('/api/user/zipcode');
  const data = await response.json();
  return data.zipcode;
};
```

### 2. Converting Zipcode to Coordinates
```javascript
// Using OpenStreetMap Nominatim (free, no API key)
const zipcodeToCoords = async (zipcode) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&format=json&limit=1`
  );
  const data = await response.json();
  if (data.length > 0) {
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  }
  return null;
};
```

### 3. Map Component Structure (Leaflet Example)
```javascript
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

export default function MapContainer({ center, zoom }) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100vh', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {/* Add your layers here */}
    </MapContainer>
  );
}
```

### 4. Filter State Management
```javascript
const [filters, setFilters] = useState({
  tags: [],
  showWeather: true,
  showAlerts: true,
  showEvents: true,
  showTrends: false,
});
```

---

## 🎯 Next Steps

1. **Decide on Map Library**: Choose Leaflet (free) or Google Maps/Mapbox (requires API keys)
2. **Set Up Database Connection**: Coordinate with your team on database setup
3. **Create API Routes**: Start with user zipcode endpoint
4. **Build Basic Map**: Get map rendering with user's location
5. **Add Layers One by One**: Start with weather, then alerts, then trends
6. **Implement Filtering**: Add tag-based and layer filtering
7. **Polish UI**: Style with Tailwind, add animations, improve UX

---

## 📚 Useful Resources

- **Leaflet Docs**: https://react-leaflet.js.org/
- **Google Maps React**: https://github.com/JustFly1984/react-google-maps-api
- **Mapbox React**: https://visgl.github.io/react-map-gl/
- **OpenWeatherMap API**: https://openweathermap.org/api
- **OpenStreetMap Nominatim**: https://nominatim.org/release-docs/develop/api/Overview/

---

## ⚠️ Important Considerations

1. **API Keys**: Some services require API keys (Google Maps, Mapbox, Weather APIs)
2. **Rate Limits**: Be mindful of API rate limits, consider caching
3. **Performance**: Large datasets may need pagination or clustering
4. **Mobile Responsiveness**: Ensure map works well on mobile devices
5. **Error Handling**: Handle cases where zipcode is invalid or data is unavailable

---

## 🤝 Integration Points

- **User Authentication**: Ensure user is logged in to get zipcode
- **Database Schema**: Coordinate with team on alerts/events/trends data structure
- **Tag System**: Understand how tags are structured in your database
- **Styling**: Match your team's design system/theme

