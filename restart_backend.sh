#!/bin/bash
# Script to restart the backend server

echo "🛑 Stopping existing backend process..."

# Find and kill existing uvicorn process
PID=$(lsof -ti :8000 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "   Found process on port 8000 (PID: $PID)"
    kill $PID 2>/dev/null
    sleep 2
    
    # Force kill if still running
    if kill -0 $PID 2>/dev/null; then
        echo "   Force killing process..."
        kill -9 $PID 2>/dev/null
        sleep 1
    fi
else
    echo "   No process found on port 8000"
fi

echo ""
echo "🚀 Starting backend server..."

cd backend

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "❌ Virtual environment not found. Please create it first:"
    echo "   cd backend && python3 -m venv venv && source venv/bin/activate"
    exit 1
fi

# Check if dependencies are installed
if ! python3 -c "import uvicorn" 2>/dev/null; then
    echo "❌ Dependencies not installed. Installing..."
    pip install -r requirements.txt
fi

# Start backend
echo "   Starting uvicorn on port 8000..."
echo "   Backend will be available at: http://localhost:8000"
echo "   API docs: http://localhost:8000/api/docs"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
