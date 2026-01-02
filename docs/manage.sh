#!/bin/bash

# VAKA Platform Service Manager
# Usage: ./manage.sh [start|stop|restart|status]

# Don't exit on error - we want to handle errors gracefully
set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

BACKEND_PORT=8000
FRONTEND_PORT=3000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PID files
BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/.frontend.pid"

# Function to find process using a port
find_port_process() {
    local port=$1
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        lsof -ti:$port 2>/dev/null || echo ""
    else
        # Linux
        lsof -ti:$port 2>/dev/null || echo ""
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local service_name=$2
    local pids=$(find_port_process $port)
    
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Killing existing process(es) on port $port ($service_name)...${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}Port $port released${NC}"
    fi
}

# Function to check if process is running
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# Function to start backend
start_backend() {
    if is_running "$BACKEND_PID_FILE"; then
        echo -e "${YELLOW}Backend is already running (PID: $(cat $BACKEND_PID_FILE))${NC}"
        return
    fi
    
    echo -e "${BLUE}Starting backend...${NC}"
    kill_port $BACKEND_PORT "backend"
    
    cd "$BACKEND_DIR"
    
    # Check if venv exists
    if [ ! -d "venv" ]; then
        echo -e "${RED}Virtual environment not found. Creating...${NC}"
        python3 -m venv venv
    fi
    
    # Activate venv and install dependencies if needed
    if [ ! -f "venv/bin/activate" ]; then
        echo -e "${RED}Virtual environment activation script not found${NC}"
        return 1
    fi
    
    source venv/bin/activate
    
    # Check if dependencies are installed
    if ! python3 -c "import uvicorn" 2>/dev/null; then
        echo -e "${YELLOW}Installing backend dependencies...${NC}"
        pip install -q -r requirements.txt || {
            echo -e "${RED}Failed to install dependencies${NC}"
            return 1
        }
    fi
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}Creating .env file...${NC}"
        cat > .env << EOF
ENVIRONMENT=development
DEBUG=True
DATABASE_URL=postgresql://vaka_user:vaka_password@127.0.0.1:5432/vaka
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
OPENAI_API_KEY=
SECRET_KEY=dev-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
MAX_UPLOAD_SIZE=52428800
EOF
    fi
    
    # Check database connection
    echo -e "${BLUE}Checking database connection...${NC}"
    python3 << 'PYEOF'
import sys
import os
sys.path.insert(0, os.getcwd())
try:
    from app.core.database import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    print('Database connection OK')
except Exception as e:
    print(f'Database connection failed: {e}')
    sys.exit(1)
PYEOF
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Database connection failed. Make sure PostgreSQL is running.${NC}"
        echo -e "${YELLOW}  Start with: docker-compose up -d postgres${NC}"
        return 1
    fi
    
    # Run migrations
    echo -e "${BLUE}Running database migrations...${NC}"
    alembic upgrade head 2>&1 | grep -E "(INFO|ERROR|Successfully|Running)" || {
        echo -e "${YELLOW}Migration check completed${NC}"
    }
    
    # Ensure schema is synced
    echo -e "${BLUE}Syncing database schema...${NC}"
    if [ -f "scripts/sync_schema.py" ]; then
        python3 scripts/sync_schema.py 2>&1 | tail -3 || true
    else
        echo -e "${YELLOW}Schema sync script not found, skipping...${NC}"
    fi
    
    # Start backend server with proper environment
    echo -e "${GREEN}Starting backend server on port $BACKEND_PORT...${NC}"
    
    # Use a wrapper script to ensure venv is activated
    cat > "$SCRIPT_DIR/.start_backend.sh" << 'EOF'
#!/bin/bash
cd "$1"
source venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port $2 --reload
EOF
    chmod +x "$SCRIPT_DIR/.start_backend.sh"
    
    nohup bash "$SCRIPT_DIR/.start_backend.sh" "$BACKEND_DIR" "$BACKEND_PORT" > "$SCRIPT_DIR/.backend.log" 2>&1 &
    local backend_pid=$!
    echo $backend_pid > "$BACKEND_PID_FILE"
    
    # Wait and verify it started
    sleep 3
    if ps -p "$backend_pid" > /dev/null 2>&1; then
        # Check if server is responding
        sleep 2
        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1 || curl -s http://localhost:$BACKEND_PORT/api/docs > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend started successfully (PID: $backend_pid)${NC}"
            echo -e "${BLUE}  Backend URL: http://localhost:$BACKEND_PORT${NC}"
            echo -e "${BLUE}  API Docs: http://localhost:$BACKEND_PORT/api/docs${NC}"
        else
            echo -e "${YELLOW}⚠ Backend process started but not responding yet (PID: $backend_pid)${NC}"
            echo -e "${BLUE}  Check logs: tail -f $SCRIPT_DIR/.backend.log${NC}"
        fi
    else
        echo -e "${RED}✗ Backend failed to start. Check .backend.log:${NC}"
        tail -20 "$SCRIPT_DIR/.backend.log" 2>&1 | head -10
        return 1
    fi
}

# Function to start frontend
start_frontend() {
    if is_running "$FRONTEND_PID_FILE"; then
        echo -e "${YELLOW}Frontend is already running (PID: $(cat $FRONTEND_PID_FILE))${NC}"
        return
    fi
    
    echo -e "${BLUE}Starting frontend...${NC}"
    kill_port $FRONTEND_PORT "frontend"
    
    cd "$FRONTEND_DIR"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        npm install
    fi
    
    # Start frontend server
    echo -e "${GREEN}Starting frontend server on port $FRONTEND_PORT...${NC}"
    nohup npm run dev > "$SCRIPT_DIR/.frontend.log" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
    
    # Wait a bit and check if it started
    sleep 3
    if is_running "$FRONTEND_PID_FILE"; then
        echo -e "${GREEN}✓ Frontend started successfully (PID: $(cat $FRONTEND_PID_FILE))${NC}"
        echo -e "${BLUE}  Frontend URL: http://localhost:$FRONTEND_PORT${NC}"
    else
        echo -e "${RED}✗ Frontend failed to start. Check .frontend.log${NC}"
        return 1
    fi
}

# Function to stop backend
stop_backend() {
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping backend (PID: $pid)...${NC}"
            kill "$pid" 2>/dev/null || true
            sleep 1
            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    # Also kill any process on the port
    kill_port $BACKEND_PORT "backend"
    echo -e "${GREEN}✓ Backend stopped${NC}"
}

# Function to stop frontend
stop_frontend() {
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping frontend (PID: $pid)...${NC}"
            kill "$pid" 2>/dev/null || true
            sleep 1
            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    # Also kill any process on the port
    kill_port $FRONTEND_PORT "frontend"
    echo -e "${GREEN}✓ Frontend stopped${NC}"
}

# Function to show status
show_status() {
    echo -e "${BLUE}=== VAKA Platform Status ===${NC}"
    echo ""
    
    # Backend status
    if is_running "$BACKEND_PID_FILE"; then
        local pid=$(cat "$BACKEND_PID_FILE")
        echo -e "${GREEN}Backend:${NC} Running (PID: $pid)"
        echo -e "  URL: http://localhost:$BACKEND_PORT"
        echo -e "  API Docs: http://localhost:$BACKEND_PORT/api/docs"
    else
        echo -e "${RED}Backend:${NC} Stopped"
    fi
    
    echo ""
    
    # Frontend status
    if is_running "$FRONTEND_PID_FILE"; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        echo -e "${GREEN}Frontend:${NC} Running (PID: $pid)"
        echo -e "  URL: http://localhost:$FRONTEND_PORT"
    else
        echo -e "${RED}Frontend:${NC} Stopped"
    fi
    
    echo ""
    
    # Infrastructure status
    echo -e "${BLUE}Infrastructure:${NC}"
    if docker ps | grep -q vaka_postgres; then
        echo -e "  ${GREEN}PostgreSQL:${NC} Running"
    else
        echo -e "  ${RED}PostgreSQL:${NC} Stopped"
    fi
    
    if docker ps | grep -q vaka_redis; then
        echo -e "  ${GREEN}Redis:${NC} Running"
    else
        echo -e "  ${RED}Redis:${NC} Stopped"
    fi
    
    if docker ps | grep -q vaka_qdrant; then
        echo -e "  ${GREEN}Qdrant:${NC} Running"
    else
        echo -e "  ${RED}Qdrant:${NC} Stopped"
    fi
}

# Main script logic
case "${1:-}" in
    start)
        echo -e "${BLUE}=== Starting VAKA Platform ===${NC}"
        echo ""
        
        # Start infrastructure if not running
        if ! docker ps | grep -q vaka_postgres; then
            echo -e "${BLUE}Starting infrastructure...${NC}"
            docker-compose up -d postgres redis qdrant
            echo -e "${GREEN}Waiting for services to be ready...${NC}"
            sleep 5
        fi
        
        start_backend
        echo ""
        start_frontend
        echo ""
        echo -e "${GREEN}=== Platform Started ===${NC}"
        echo ""
        show_status
        ;;
    
    stop)
        echo -e "${BLUE}=== Stopping VAKA Platform ===${NC}"
        echo ""
        stop_backend
        stop_frontend
        echo ""
        echo -e "${GREEN}=== Platform Stopped ===${NC}"
        ;;
    
    restart)
        echo -e "${BLUE}=== Restarting VAKA Platform ===${NC}"
        echo ""
        
        # Ensure infrastructure is running
        if ! docker ps | grep -q vaka_postgres; then
            echo -e "${BLUE}Starting infrastructure...${NC}"
            docker-compose up -d postgres redis qdrant 2>&1 | grep -E "(Starting|Created|Up)" || true
            echo -e "${GREEN}Waiting for services to be ready...${NC}"
            sleep 5
        fi
        
        stop_backend
        stop_frontend
        sleep 2
        
        start_backend
        if [ $? -ne 0 ]; then
            echo -e "${RED}Backend restart failed. Check logs: tail -f .backend.log${NC}"
            exit 1
        fi
        
        echo ""
        start_frontend
        if [ $? -ne 0 ]; then
            echo -e "${RED}Frontend restart failed. Check logs: tail -f .frontend.log${NC}"
            exit 1
        fi
        
        echo ""
        echo -e "${GREEN}=== Platform Restarted ===${NC}"
        echo ""
        show_status
        ;;
    
    status)
        show_status
        ;;
    
    logs)
        if [ "$2" == "backend" ]; then
            tail -f "$SCRIPT_DIR/.backend.log"
        elif [ "$2" == "frontend" ]; then
            tail -f "$SCRIPT_DIR/.frontend.log"
        else
            echo "Usage: $0 logs [backend|frontend]"
        fi
        ;;
    
    *)
        echo "VAKA Platform Service Manager"
        echo ""
        echo "Usage: $0 [start|stop|restart|status|logs]"
        echo ""
        echo "Commands:"
        echo "  start    - Start backend and frontend services"
        echo "  stop     - Stop backend and frontend services"
        echo "  restart  - Restart backend and frontend services"
        echo "  status   - Show status of all services"
        echo "  logs     - Show logs (backend|frontend)"
        echo ""
        exit 1
        ;;
esac

