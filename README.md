# LocalLens - Neighborhood Intelligence Platform

**LocalLens** is a comprehensive neighborhood intelligence platform that transforms raw neighborhood data into clear, interactive insights. The platform helps users make informed decisions about where to live, work, and invest by providing data-driven insights into local neighborhoods, including rent trends, crime rates, business activity, and community events.

## 🎯 Project Overview

LocalLens is a full-stack web application built with Next.js that combines geospatial data visualization, social networking features, and real-time community engagement. Users can explore their neighborhoods through interactive maps, participate in community discussions, report local incidents, organize events, and connect with neighbors.

## ✨ Key Features

### 🗺️ Interactive Maps & Visualization
- **Google Maps Integration**: Interactive map interface with custom markers and overlays
- **Real-time Data**: View incidents, events, and yard sales on an interactive map
- **Weather Integration**: Current weather information for neighborhoods


### 👥 Social & Community Features
- **Social Feed**: Create posts, share updates, and engage with neighbors
- **Comments & Interactions**: Like, comment, and reply to posts
- **Friend System**: Connect with neighbors, send friend requests, and chat
- **Event Management**: Create and RSVP to local community events
- **Yard Sales**: Post and discover yard sales in your neighborhood

### 🛡️ Security & Moderation
- **Firebase Authentication**: Secure user authentication with email/password and social login
- **Role-Based Access Control**: Admin and user roles with appropriate permissions
- **Content Moderation**: Report inappropriate content with admin review system
- **User Banning**: Admin tools to ban users and manage community safety

### 🚀 Performance & Scalability
- **Asynchronous Geocoding**: RabbitMQ message queue for non-blocking geocoding operations
- **Redis Caching**: Fast data retrieval with intelligent caching strategies
- **Background Workers**: Separate worker processes for heavy computations
- **Optimized API Routes**: Efficient Next.js API routes with proper error handling

## 🛠️ Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **Tailwind CSS 4** - Utility-first CSS framework
- **DaisyUI** - Component library built on Tailwind
- **@react-google-maps/api** - Google Maps integration

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **MongoDB** - NoSQL database for data storage
- **Mongoose** - MongoDB object modeling
- **Firebase Authentication** - User authentication
- **Firebase Admin SDK** - Server-side Firebase operations

### Infrastructure & Services
- **RabbitMQ** - Message queue for asynchronous geocoding
- **Redis** - In-memory data store for caching
- **Google Maps API** - Geocoding and mapping services
- **OpenStreetMap** - Fallback geocoding service


## 🚀 Getting Started

### Installation

Must have **Redis** and **RabbitMQ** installed locally.

**Note**: For detailed RabbitMQ setup instructions, see [RABBITMQ_README.md](./RABBITMQ_README.md).

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CS554-FinalProject
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

   **Note**: This project uses a Gist-based configuration system for all environment variables and sensitive credentials. No local `.env` file is needed. See `src/firebase/fetchEnvFromGist.js` for implementation details.

### Running the Application

1. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

2. **Start the geocoding worker**
   
   In a separate terminal:
   ```bash
   npm run worker:geocoding
   ```

3. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
npm start
```

## 🏗️ Architecture Overview

### Frontend Architecture
- **Next.js App Router**: File-based routing with server and client components
- **Client Components**: Interactive UI with React hooks and state management
- **Server Components**: Server-side rendering for better performance
- **API Routes**: RESTful endpoints for data operations

### Backend Architecture
- **MongoDB**: Primary data store for users, posts, incidents, events, etc.
- **Mongoose ODM**: Schema definitions and data validation
- **Firebase Auth**: Authentication and user management
- **Redis Cache**: Caching layer for frequently accessed data
- **RabbitMQ**: Message queue for asynchronous geocoding operations

### Data Flow

1. **User Authentication**: Firebase handles authentication, user data synced to MongoDB
2. **Geocoding Requests**: 
   - Request → RabbitMQ Queue → Worker Process → Geocoding API → Redis Cache → Response
   - Falls back to synchronous geocoding if RabbitMQ unavailable
3. **Data Retrieval**: 
   - Check Redis cache → MongoDB query → Return data → Cache result
4. **Real-time Updates**: Client-side polling and state management for live updates

## 📡 Key API Endpoints

### Authentication
- `POST /api/auth/logout` - User logout

### User Management
- `GET /api/users/profile?uid={uid}` - Get user profile
- `POST /api/users/sync` - Sync Firebase user to MongoDB

### Social Feed
- `GET /api/posts` - Get all posts (paginated)
- `POST /api/posts` - Create new post
- `GET /api/posts/[postId]` - Get specific post
- `POST /api/posts/[postId]/like` - Like/unlike post
- `POST /api/posts/[postId]/comment` - Add comment

### Incidents
- `GET /api/incidents` - Get incidents for user's area
- `POST /api/incidents` - Report new incident
- `GET /api/incidents/[id]` - Get specific incident
- `PUT /api/incidents/[id]` - Update incident
- `DELETE /api/incidents/[id]` - Delete incident

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create event
- `GET /api/events/[id]` - Get specific event
- `POST /api/events/[id]/rsvp` - RSVP to event

### Geocoding
- `GET /api/geocoding/coords?pincode={pincode}` - Get coordinates (async with RabbitMQ)
- `GET /api/geocoding/pincode-to-city?pincode={pincode}` - Get city name
- `GET /api/geocoding/status/[jobId]` - Check geocoding job status

### Map Data
- `GET /api/map/incidents` - Get incidents for map view
- `GET /api/map/events` - Get events for map view

### Admin
- `GET /api/admin` - Admin dashboard data
- `POST /api/report/[id]` - Report content
- `GET /api/reports` - Get all reports (admin)

## 🔐 Security Features

- **Firebase Authentication**: Secure user authentication
- **JWT Token Verification**: Server-side token validation
- **Role-Based Access Control**: Admin and user permissions
- **Input Sanitization**: Protection against XSS attacks
- **Content Moderation**: Report and review system
- **User Banning**: Admin tools for community management

## 🧪 Development

### Code Structure
- **Components**: Reusable React components in `src/app/components/`
- **Hooks**: Custom React hooks in `src/hooks/`
- **Utilities**: Helper functions in `src/lib/`
- **Models**: Mongoose schemas in `src/models/`

### Best Practices
- Server-side validation for all API routes
- Client-side and server-side error handling
- Proper loading states and user feedback
- Responsive design with Tailwind CSS
- Accessibility considerations

## 📝 Notes

- **Geocoding**: The system uses RabbitMQ for asynchronous geocoding to prevent blocking API requests. If RabbitMQ is unavailable, it automatically falls back to synchronous geocoding.
- **Caching**: Redis is used extensively for caching geocoding results, user profiles, and frequently accessed data.
- **Environment Configuration**: All environment variables and sensitive credentials (Firebase, MongoDB Atlas, Google Maps API, etc.) are automatically fetched from a Gist file at runtime. No local environment setup is required. See `src/firebase/fetchEnvFromGist.js` for implementation details.
- **Database**: MongoDB Atlas (cloud) is used - no local database setup or seeding required.

## 🤝 Contributing

This is a final project for CS554. For questions or issues, please contact the development team.

## 📄 License

This project is part of a course assignment at Stevens Institute of Technology.

---

**Built with ❤️ by the Async Avengers team**
