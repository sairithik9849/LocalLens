# LocalLens – Neighborhood Insights Platform

**Group Name:** Async Avengers  

**Group Members:**  
- Sairithik Komuravelly — CWID: 20029694  
- Akshay Kumar Talur Narasimmulu — CWID: 20032052  
- Anik Doshi — CWID: 20034825  
- Deming Tracy — CWID: 10479551  

---

## 1. Project Overview & Vision

**LocalLens** is a dynamic web application designed to provide users with data-driven insights into local neighborhoods. In an age where information is abundant but fragmented, the platform aggregates and visualizes key community trends, empowering users to make informed decisions about where to live, open a business, or invest.

By consolidating data such as rent fluctuations, crime rates, new business openings, and local reviews, LocalLens transforms raw data into a clear, interactive, and intuitive experience.

### Vision
LocalLens aims to become a **one-stop platform for neighborhood intelligence**. Users will be able to:
- Explore an interactive neighborhood map
- View trend-based heatmaps
- Analyze historical data through intuitive visualizations

Whether for families seeking safe communities, renters comparing housing costs, or entrepreneurs scouting new locations, LocalLens provides actionable neighborhood insights.

---

## 2. Course Technologies

The application will be built using the following core technologies covered in the course:

### a. Next.js
Next.js serves as the primary full-stack framework:
- Server-side rendered React frontend for fast, SEO-friendly performance
- Built-in API routes for backend logic
- Handles data fetching, request processing, and external API communication

### b. Firebase Authentication
Firebase Authentication manages secure user access:
- Email/password authentication
- Social login support (e.g., Google)
- Session management and user identity

This enables user-specific features such as:
- Saving favorite neighborhoods
- Personalized dashboards
- Posting reviews and local content securely

### c. Redis
Redis is used as a high-speed, in-memory caching layer:
- Cache expensive Google Maps API responses (e.g., geocoding)
- Store pre-aggregated neighborhood trend data
- Improve performance and scalability for frequent queries

---

## 3. Independent Technologies

The following technologies operate independently from the Node.js runtime and support persistence, scalability, and deployment.

### a. Docker
Docker and Docker Compose are used to containerize the entire stack:
- Next.js application
- MongoDB database
- Redis cache

Benefits include:
- Consistent development environments
- Simplified setup for all team members
- Easier deployment to cloud infrastructure

### b. RabbitMQ
RabbitMQ acts as an asynchronous message broker:
- Queues posts, alerts, and notifications
- Ensures reliable and scalable message delivery
- Prevents server overload during high traffic

---

## 4. Key Feature Implementation

### Data Aggregation & Storage
- Scheduled backend jobs or serverless functions
- Fetch data from third-party APIs (crime data, real estate prices, Google Places)
- Normalize and store data in MongoDB

### Interactive Map & Heatmap Visualization
- Built with Next.js and Google Maps JavaScript API (or Leaflet)
- Displays neighborhood heatmaps for:
  - Rent trends
  - Crime density
- Shows pins for user-generated content such as:
  - Events
  - Yard sales
  - Crime reports

### Hyper-Local Content & Community Features
- Neighborhood-based access control
- Users can only view and post content within their registered area
- Features include:
  - Local events with RSVP support
  - Yard sale listings with image uploads
  - Neighborhood-specific crime reports

### Historical Data Analysis & Charts
- Users select neighborhoods to view historical trends
- Data served via Next.js API routes from MongoDB
- Interactive visualizations rendered using Chart.js

### Secure Authentication & Content Moderation
- User management via Firebase Authentication
- Role-based access control (user, moderator, admin)
- Content moderation workflow:
  - Users can flag inappropriate content
  - Moderators review and remove flagged content
  - Admin dashboard for oversight

### Real-Time Communication & Notifications
- Neighborhood-based real-time chatrooms using Socket.io
- Instant notifications for:
  - Crime alerts
  - New events
  - New messages
- Push notifications delivered using:
  - Firebase Cloud Messaging
  - Service Workers

---
