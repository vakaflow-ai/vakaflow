#!/bin/bash

# Quick script to check if backend is running

echo "🔍 Checking backend status..."
echo ""

# Check if port 8000 is in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Port 8000 is in use"
else
    echo "❌ Port 8000 is NOT in use - backend is not running"
    echo ""
    echo "To start the backend:"
    echo "  cd backend"
    echo "  source venv/bin/activate"
    echo "  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    exit 1
fi

# Try to connect to health endpoint
echo ""
echo "🔍 Testing backend connectivity..."
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "✅ Backend health check passed"
    echo ""
    echo "Backend is running at: http://localhost:8000"
    echo "API Docs: http://localhost:8000/api/docs"
elif curl -s http://localhost:8000/api/docs >/dev/null 2>&1; then
    echo "✅ Backend is responding (API docs accessible)"
    echo ""
    echo "Backend is running at: http://localhost:8000"
    echo "API Docs: http://localhost:8000/api/docs"
else
    echo "❌ Backend is not responding"
    echo ""
    echo "The backend process may be running but not responding."
    echo "Check backend logs for errors:"
    echo "  - If using manage.sh: tail -f .backend.log"
    echo "  - If running manually: Check the terminal where uvicorn is running"
    exit 1
fi

echo ""
echo "✅ Backend is running and accessible!"
