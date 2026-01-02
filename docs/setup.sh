#!/bin/bash

echo "🚀 Setting up VAKA Agent Platform..."

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

# Start infrastructure
echo "🐳 Starting infrastructure (PostgreSQL, Redis, Qdrant)..."
docker-compose up -d postgres redis qdrant

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Setup backend
echo "🐍 Setting up backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚠️  Please edit backend/.env with your API keys"
fi

# Setup frontend
echo "⚛️  Setting up frontend..."
cd ../frontend
npm install

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your API keys (OpenAI, etc.)"
echo "2. Run migrations: cd backend && source venv/bin/activate && alembic upgrade head"
echo "3. Start backend: cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
echo "4. Start frontend: cd frontend && npm run dev"
echo ""
echo "Visit http://localhost:3000"

