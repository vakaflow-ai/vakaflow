#!/bin/bash
# Quick script to check backend health

echo "🔍 Checking backend status..."

# Check if process is running
if lsof -i :8000 > /dev/null 2>&1; then
    echo "✅ Backend process is running on port 8000"
    PID=$(lsof -ti :8000)
    echo "   PID: $PID"
else
    echo "❌ No process found on port 8000"
    echo "   Backend is not running!"
    exit 1
fi

# Try to connect to health endpoint
echo ""
echo "🔍 Testing backend connectivity..."

if command -v curl > /dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>&1)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Backend is responding (HTTP 200)"
        curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8000/health
    elif [ "$HTTP_CODE" = "000" ]; then
        echo "❌ Backend is not responding (connection refused)"
        echo "   The process is running but not accepting connections"
    else
        echo "⚠️  Backend returned HTTP $HTTP_CODE"
    fi
else
    echo "⚠️  curl not available, skipping connectivity test"
fi

# Check API docs endpoint
echo ""
echo "🔍 Testing API docs endpoint..."
if command -v curl > /dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/docs 2>&1)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ API docs accessible"
    else
        echo "⚠️  API docs returned HTTP $HTTP_CODE"
    fi
fi

echo ""
echo "📝 To restart backend:"
echo "   cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
