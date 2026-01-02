#!/bin/bash
# Script to restart the backend server
echo "🔄 Restarting backend server..."

# Find and kill existing uvicorn process
pkill -f "uvicorn app.main:app" || true

# Wait a moment
sleep 2

# Start backend server
cd /Users/vikasc/vaka/backend
source venv/bin/activate
echo "✅ Starting backend server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &

echo "✅ Backend server restarted"
echo "📝 Note: The server is running in the background. Check logs for status."

