# LocalLens - Docker Setup Guide

Complete Docker containerization of the LocalLens social networking application.

---

## 📋 Prerequisites

Before running the application, ensure you have:

- **Docker Desktop** installed and running
  - Download: https://www.docker.com/products/docker-desktop
  - Minimum 4GB RAM allocated to Docker
  - Windows: WSL 2 enabled
- **Git** (to clone the repository)

---

## 🚀 Quick Start (3 Steps)

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd async-avengers-cs554-final-project
```

### Step 2: Create Environment File

```bash
# Copy the example file
cp .env.example .env
```

The `.env` file is already configured with:
- Firebase credentials
- Google Maps API key
- MongoDB Atlas connection (cloud database)

**No changes needed - ready to run!**

### Step 3: Start Docker Containers

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**That's it!** The application will start in 2-3 minutes.

---

## 🌐 Access the Application

Once containers are running, access:

| Service | URL | Purpose |
|---------|-----|---------|
| **LocalLens App** | http://localhost:3000 | Main application |
| **RabbitMQ Management** | http://localhost:15672 | Message queue UI (guest/guest) |

---

## 📊 Verify Everything is Running

```bash
# Check running containers (should see 5)
docker ps

# Expected output:
# locallens-app         (Port 3000)
# locallens-worker      (Background)
# locallens-mongodb     (Port 27017)
# locallens-redis       (Port 6379)
# locallens-rabbitmq    (Ports 5672, 15672)
```

---

## 🏗️ Architecture

The application runs as a 5-container stack:

```
┌─────────────────────────────────────┐
│   LocalLens Docker Architecture     │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐    ┌──────────┐     │
│  │ Next.js  │────│ MongoDB  │     │
│  │   App    │    │  (Local  │     │
│  │  :3000   │    │ or Atlas)│     │
│  └────┬─────┘    └──────────┘     │
│       │                             │
│       │  ┌──────────┐              │
│       ├──│  Redis   │              │
│       │  │  Cache   │              │
│       │  └──────────┘              │
│       │                             │
│       │  ┌──────────┐              │
│       └──│ RabbitMQ │              │
│          │  Queue   │              │
│          └─────┬────┘              │
│                │                    │
│         ┌──────▼──────┐            │
│         │  Geocoding  │            │
│         │   Worker    │            │
│         └─────────────┘            │
└─────────────────────────────────────┘
```

---

## 🧪 Testing the Application

1. **Open browser:** http://localhost:3000

2. **Sign in with Google** (Firebase Auth)

3. **Test features:**
   - Create a post
   - Upload images
   - Like/comment on posts
   - Search for friends
   - Send messages
   - View location-based content

4. **Monitor RabbitMQ:**
   - Go to http://localhost:15672
   - Login: `guest` / `guest`
   - See geocoding jobs being processed

---

## 📝 Useful Commands

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f app
docker-compose -f docker-compose.dev.yml logs -f worker
```

### Stop Application

```bash
# Stop all containers
docker-compose -f docker-compose.dev.yml down

# Stop and remove all data
docker-compose -f docker-compose.dev.yml down -v
```

### Restart Services

```bash
# Restart specific service
docker-compose -f docker-compose.dev.yml restart app

# Restart all services
docker-compose -f docker-compose.dev.yml restart
```

### Rebuild After Code Changes

```bash
# Rebuild and restart
docker-compose -f docker-compose.dev.yml up -d --build
```

---

## 🔍 Troubleshooting

### Issue: Port Already in Use

```bash
# Check what's using port 3000
# Windows:
netstat -ano | findstr :3000

# Mac/Linux:
lsof -i :3000

# Solution: Stop the process or change port in docker-compose.dev.yml
```

### Issue: Docker Desktop Not Running

**Error:** `Cannot connect to Docker daemon`

**Solution:** 
1. Start Docker Desktop
2. Wait for Docker icon to turn green
3. Try command again

### Issue: Containers Won't Start

```bash
# View error logs
docker-compose -f docker-compose.dev.yml logs

# Clean rebuild
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d --build
```

### Issue: Application Shows Error Page

```bash
# Check app logs for errors
docker-compose -f docker-compose.dev.yml logs app

# Common fix: Restart app container
docker-compose -f docker-compose.dev.yml restart app
```

---

## 🗂️ File Structure

```
async-avengers-cs554-final-project/
├── Dockerfile.dev              # Development container config
├── docker-compose.dev.yml      # Multi-container orchestration
├── .dockerignore              # Files excluded from build
├── .env                       # Environment variables
├── package.json               # Node.js dependencies
├── src/                       # Application source code
│   ├── app/                   # Next.js pages
│   ├── components/            # React components
│   ├── lib/                   # Utilities (MongoDB, Redis, RabbitMQ)
│   └── workers/               # Background job processors
└── public/                    # Static assets
```

---

## 🔧 Configuration

### Environment Variables

The `.env` file contains:

- **Firebase:** Authentication and storage
- **Google Maps API:** Location services
- **MongoDB URI:** Database connection (Atlas or local)
- **RabbitMQ:** Message queue settings

**Default:** Uses MongoDB Atlas (cloud) - no local database needed.

### Switching to Local MongoDB

Edit `.env` and change:

```bash
# FROM:
MONGODB_URI=mongodb+srv://local_lens_admin:...@local-lens-db...

# TO:
MONGODB_URI=mongodb://mongodb:27017/locallens-data
```

Then restart:
```bash
docker-compose -f docker-compose.dev.yml restart app worker
```

---

## 📊 System Requirements

- **OS:** Windows 10/11, macOS, Linux
- **RAM:** 4GB minimum, 8GB recommended
- **Disk:** 2GB free space for images
- **Docker Desktop:** Latest version

---

## ✅ Success Indicators

When everything is working correctly:

1. ✅ `docker ps` shows 5 running containers
2. ✅ http://localhost:3000 loads the application
3. ✅ No error messages in `docker-compose logs`
4. ✅ Can sign in with Google account
5. ✅ Posts and features work normally

---

## 🛑 Clean Shutdown

To properly stop the application:

```bash
# Stop all containers (preserves data)
docker-compose -f docker-compose.dev.yml down

# Stop and remove all data (fresh start)
docker-compose -f docker-compose.dev.yml down -v
```

---

## 📞 Support

If you encounter issues:

1. Check the **Troubleshooting** section above
2. View logs: `docker-compose -f docker-compose.dev.yml logs`
3. Try clean rebuild: `docker-compose down -v && docker-compose up -d --build`

---

## 🎓 For Grading

This Docker setup demonstrates:

- ✅ **Complete containerization** of full-stack application
- ✅ **Multi-container orchestration** with Docker Compose
- ✅ **Service isolation** (app, database, cache, queue, worker)
- ✅ **Production-ready architecture** with proper networking
- ✅ **Easy reproducibility** for team development
- ✅ **Scalable design** ready for cloud deployment

---

**Total Setup Time:** 5 minutes  
**One Command to Run:** `docker-compose -f docker-compose.dev.yml up -d`

---

## 📄 License

CS 554 - Web Programming II - Final Project  
Stevens Institute of Technology - Fall 2024  
Team: Async Avengers