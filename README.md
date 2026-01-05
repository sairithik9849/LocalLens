# LocalLens – Neighborhood Insights Platform

LocalLens is a hyper-local social app built with Next.js that lets neighbors share posts, events, incidents, and yard sales on an interactive map backed by MongoDB, Firebase Auth, Redis caching, and RabbitMQ jobs. It emphasizes fast geocoding, neighborhood-scoped content, and a lightweight moderation/admin flow.

## What’s Inside
- Framework: Next.js 16, React 19, API routes, App Router
- Auth: Firebase client + Admin SDK
- Data: MongoDB via Mongoose, Redis cache
- Messaging/Workers: RabbitMQ, geocoding worker
- Maps/Geo: Google Maps JS + Geocoding (with OpenStreetMap fallback)
- UI/Styling: Tailwind CSS 4, DaisyUI, React Modal
- Ops: Docker/Docker Compose for app + MongoDB + Redis

## Local Setup (Node)
1) Prereqs: Node 18+, npm, MongoDB and Redis instances (local or remote). RabbitMQ recommended for queue-backed geocoding.
2) Install deps: `npm install`
3) Run web app: `npm run dev`
4) (Optional) Run geocoding worker for queued jobs: `npm run worker:geocoding`

### Using Docker Compose
```bash
docker-compose -f docker-compose.dev.yml up --build
```
The compose file brings up the app, MongoDB, and Redis. If you need RabbitMQ, add a service or run it separately and update the env values.

## How It Works
- Auth: Firebase client SDK handles user sessions; Admin SDK backs secure server checks.
- Data flow: Next.js API routes persist users, posts, events, incidents, replies, and yard sales in MongoDB.
- Geocoding: Google Maps API (with OpenStreetMap fallback) resolves ZIP codes; results can be queued through RabbitMQ and cached in Redis.
- Map UX: Posts/events/incidents render as map markers with filters; weather and location helpers reuse the Google key.
- Admin/Moderation: Admin routes support bans, reports, and content review; a geocoding worker consumes queued location jobs.

## Notes on Secrets
The code can fall back to GitHub Gist-based secrets. For your own deployment, supply `.env.local` values directly or point those files at your own Gist URLs.
