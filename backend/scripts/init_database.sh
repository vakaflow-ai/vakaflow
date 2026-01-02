#!/bin/bash
# Complete Database Initialization Script
# Syncs schema and seeds initial data

set -e

echo "=========================================="
echo "Database Initialization"
echo "=========================================="

cd "$(dirname "$0")/.."
source venv/bin/activate

echo ""
echo "📋 Step 1: Syncing database schema..."
python3 scripts/sync_schema.py

echo ""
echo "🌱 Step 2: Seeding initial data..."
python3 scripts/seed_database.py

echo ""
echo "=========================================="
echo "✅ Database initialization complete!"
echo "=========================================="

