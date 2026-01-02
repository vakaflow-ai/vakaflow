#!/bin/bash
# Initialize database - run this once

echo "Initializing database..."

# Wait for postgres to be ready
until docker exec vaka_postgres pg_isready -U vaka_user > /dev/null 2>&1; do
  echo "Waiting for postgres..."
  sleep 1
done

echo "Database is ready!"
echo "Running migrations..."

cd "$(dirname "$0")"
source venv/bin/activate
alembic upgrade head

echo "✅ Database initialized!"

