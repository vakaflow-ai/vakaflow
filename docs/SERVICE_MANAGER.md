# 🚀 Service Manager Guide

## Quick Commands

```bash
# Start both backend and frontend
./manage.sh start

# Stop both services
./manage.sh stop

# Restart both services
./manage.sh restart

# Check status
./manage.sh status

# View logs
./manage.sh logs backend
./manage.sh logs frontend
```

## Features

✅ **Automatic Port Management**
- Kills any existing processes on ports 8000 (backend) and 3000 (frontend)
- Releases ports before starting services

✅ **Process Management**
- Tracks process IDs in `.backend.pid` and `.frontend.pid`
- Graceful shutdown with force kill fallback

✅ **Infrastructure Check**
- Automatically starts Docker services (PostgreSQL, Redis, Qdrant) if not running
- Waits for services to be ready before starting backend

✅ **Auto-Setup**
- Creates virtual environment if missing
- Creates `.env` file if missing
- Runs database migrations automatically
- Installs frontend dependencies if needed

✅ **Status Monitoring**
- Shows running status of all services
- Displays URLs and PIDs
- Checks infrastructure status

## Service URLs

- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/docs
- **Frontend**: http://localhost:3000

## Logs

- Backend logs: `.backend.log`
- Frontend logs: `.frontend.log`

## Troubleshooting

**Port already in use:**
- The script automatically kills processes on ports 8000 and 3000
- If issues persist, manually kill: `lsof -ti:8000 | xargs kill -9`

**Services won't start:**
- Check logs: `./manage.sh logs backend` or `./manage.sh logs frontend`
- Verify infrastructure: `docker-compose ps`
- Check database connection in `.env`

**Database connection errors:**
- Ensure PostgreSQL is running: `docker-compose ps`
- Check `.env` DATABASE_URL is correct
- Try restarting: `./manage.sh restart`

---

**That's it! Use `./manage.sh start` to get everything running! 🎉**

