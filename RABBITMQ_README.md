# RabbitMQ Geocoding Queue

## What is RabbitMQ doing?

RabbitMQ is handling **asynchronous geocoding requests** (converting ZIP codes to coordinates/city names). Instead of blocking API requests while waiting for geocoding APIs to respond, we queue the work and process it in the background.

## Why use it?

- **Non-blocking**: API returns immediately with a job ID (202 Accepted)
- **Rate limiting**: Prevents overwhelming geocoding APIs
- **Retry logic**: Automatically retries failed geocoding (3 attempts)
- **Deduplication**: Only one job per pincode+type combination
- **Resilience**: Jobs persist if worker crashes

## Architecture

```
User Request → API Endpoint → RabbitMQ Queue → Worker Process → Geocoding API → Redis Cache → User Response
```

1. **API receives request** → Publishes job to RabbitMQ queue
2. **Worker picks up job** → Processes geocoding (Google Maps or OpenStreetMap)
3. **Result stored in Redis** → Available for client polling
4. **Client polls status** → Gets result when ready

## Setup

### 1. Install RabbitMQ

**Windows (using Docker):**
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

**macOS:**
```bash
brew install rabbitmq
brew services start rabbitmq
```


### 2. Start the Worker

In a separate terminal, run:
```bash
npm run worker:geocoding
```

The worker will:
- Connect to RabbitMQ
- Listen for geocoding jobs
- Process them asynchronously
- Store results in Redis

### 3. Environment Variables (Optional)

Default connection: `localhost:5672` with username:guest/ password:guest credentials

To customize, set:
```env
RABBITMQ_URL=amqp://user:pass@host:5672
# OR
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
```

## Usage

### For Developers

The system **automatically uses RabbitMQ** when available. No code changes needed!

**API Endpoints:**
- `GET /api/geocoding/coords?pincode=07307` - Get coordinates
- `GET /api/geocoding/pincode-to-city?pincode=07307` - Get city name
- `GET /api/geocoding/status/{jobId}` - Check job status

**Fallback:** If RabbitMQ is unavailable, the system automatically falls back to direct (synchronous) geocoding.

### How It Works

1. **First request** for pincode `07307`:
   - Creates new RabbitMQ job
   - Returns job ID immediately
   - Worker processes in background

2. **Subsequent requests** for same pincode:
   - Reuses existing job (if in progress)
   - OR returns cached result (if completed)

3. **Client polling:**
   - Polls `/api/geocoding/status/{jobId}` every 1 second
   - Gets result when status is `completed`

## Monitoring

### Console Logs

Watch for these logs in your Next.js server (port 3000):

- `[API] 🐰 Using RabbitMQ for geocoding` - RabbitMQ is being used
- `[Queue] 📨 Published NEW job to RabbitMQ` - New job created
- `[Queue] ♻️  Reusing in-progress job` - Reusing existing job
- `[Queue] 💾 Cache hit` - Result found in cache (no RabbitMQ needed)
- `[API] 🔄 Using direct geocoding` - RabbitMQ unavailable, using fallback

### RabbitMQ Management UI

Access at: `http://localhost:15672`
- Username: `guest`
- Password: `guest`

View queues, messages, and connections in real-time.

## Queue Details

- **Queue Name**: `geocoding.requests`
- **Exchange**: `geocoding` (direct)
- **Message TTL**: 5 minutes
- **Max Retries**: 3 attempts with exponential backoff (1s, 2s, 4s)

## Cache Strategy

- **Pincode Cache**: 24 hours (immutable data)
- **Job Results**: 15 minutes (temporary)
- **In-Progress Tracking**: 5 minutes (auto-cleaned)

## Troubleshooting

### Worker won't start
- Check RabbitMQ is running: `docker ps` or `rabbitmqctl status`
- Check connection: Default is `localhost:5672`

### Jobs not processing
- Ensure worker is running: `npm run worker:geocoding`
- Check worker logs for errors
- Verify RabbitMQ connection in logs

### Too many duplicate jobs
- System automatically deduplicates (one job per pincode+type)
- Check logs for `♻️  Reusing in-progress job`

## Files

- `src/lib/rabbitmq.js` - RabbitMQ connection manager
- `src/lib/geocodingQueue.js` - Queue service and caching
- `src/workers/geocodingWorker.js` - Worker process
- `src/app/api/geocoding/coords/route.js` - Coordinates endpoint
- `src/app/api/geocoding/pincode-to-city/route.js` - City endpoint
- `src/app/api/geocoding/status/[jobId]/route.js` - Status endpoint

## Quick Start Checklist

- [ ] RabbitMQ installed and running
- [ ] Worker started: `npm run worker:geocoding`
- [ ] Next.js dev server running: `npm run dev`
- [ ] Check logs for `✅ RabbitMQ connected successfully`

That's it! The system handles everything automatically. 🚀

