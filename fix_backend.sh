#!/bin/bash
# Script to diagnose and fix backend connection issues

echo "🔍 Backend Connection Diagnostic"
echo "=================================="
echo ""

# Step 1: Check if port is in use
echo "1. Checking port 8000..."
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID=$(lsof -ti :8000)
    echo "   ✅ Port 8000 is in use by PID: $PID"
    
    # Check if it's uvicorn
    if ps -p $PID > /dev/null 2>&1; then
        CMD=$(ps -p $PID -o command= | head -1)
        if echo "$CMD" | grep -q "uvicorn"; then
            echo "   ✅ Process is uvicorn"
        else
            echo "   ⚠️  Process is not uvicorn: $CMD"
        fi
    fi
else
    echo "   ❌ Port 8000 is NOT in use"
    echo "   Backend is not running!"
fi

echo ""
echo "2. Testing backend connectivity..."

# Try to connect to health endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8000/health 2>&1)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Backend is responding (HTTP 200)"
    curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || echo "   Response received"
elif [ "$HTTP_CODE" = "000" ] || [ -z "$HTTP_CODE" ]; then
    echo "   ❌ Backend is NOT responding (connection timeout/refused)"
    echo "   The process may be stuck or not properly initialized"
    echo ""
    echo "   🔧 Solution: Restart the backend"
    echo ""
    read -p "   Do you want to restart the backend now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "   🛑 Stopping existing backend..."
        if [ ! -z "$PID" ]; then
            kill $PID 2>/dev/null
            sleep 2
            if kill -0 $PID 2>/dev/null; then
                kill -9 $PID 2>/dev/null
            fi
        fi
        
        echo "   🚀 Starting backend..."
        cd backend
        if [ -d "venv" ]; then
            source venv/bin/activate
            nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > ../backend.log 2>&1 &
            NEW_PID=$!
            echo "   ✅ Backend started (PID: $NEW_PID)"
            echo "   Waiting 3 seconds for startup..."
            sleep 3
            
            # Test again
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8000/health 2>&1)
            if [ "$HTTP_CODE" = "200" ]; then
                echo "   ✅ Backend is now responding!"
                echo "   Backend URL: http://localhost:8000"
                echo "   API Docs: http://localhost:8000/api/docs"
            else
                echo "   ⚠️  Backend started but not responding yet"
                echo "   Check logs: tail -f backend.log"
            fi
        else
            echo "   ❌ Virtual environment not found"
            echo "   Please run: cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
        fi
    fi
else
    echo "   ⚠️  Backend returned HTTP $HTTP_CODE"
fi

echo ""
echo "3. Checking Docker services..."
if command -v docker-compose > /dev/null 2>&1; then
    cd /Users/vikasc/vaka
    docker-compose ps 2>/dev/null | grep -E "(postgres|redis|qdrant)" | while read line; do
        if echo "$line" | grep -q "Up"; then
            echo "   ✅ $(echo $line | awk '{print $1}') is running"
        else
            echo "   ⚠️  $(echo $line | awk '{print $1}') is not running"
        fi
    done
else
    echo "   ⚠️  docker-compose not found"
fi

echo ""
echo "=================================="
echo "Diagnostic complete!"
