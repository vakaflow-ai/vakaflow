#!/usr/bin/env python3
"""
Complete Database Initialization Script
1. Syncs schema (creates all tables)
2. Seeds initial data
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sync_schema import sync_schema
from seed_database import seed_database
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_database():
    """Initialize database: sync schema and seed data"""
    logger.info("=" * 60)
    logger.info("Database Initialization")
    logger.info("=" * 60)
    
    # Step 1: Sync schema
    logger.info("\n📋 Step 1: Syncing database schema...")
    if not sync_schema():
        logger.error("❌ Schema sync failed")
        return False
    
    # Step 2: Seed data
    logger.info("\n🌱 Step 2: Seeding initial data...")
    if not seed_database():
        logger.error("❌ Database seeding failed")
        return False
    
    logger.info("\n" + "=" * 60)
    logger.info("✅ Database initialization complete!")
    logger.info("=" * 60)
    return True


if __name__ == "__main__":
    try:
        success = init_database()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"❌ Initialization failed: {e}", exc_info=True)
        sys.exit(1)

