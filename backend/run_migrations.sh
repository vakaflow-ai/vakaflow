#!/bin/bash
# Run database migrations

cd "$(dirname "$0")"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Run migrations
echo "Running database migrations..."
alembic upgrade head

echo "✅ Migrations completed!"
