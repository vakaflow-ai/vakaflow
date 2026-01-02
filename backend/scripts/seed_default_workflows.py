#!/usr/bin/env python3
"""
Script to seed default workflow configurations for all existing tenants
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.services.workflow_seeder import seed_default_workflows_for_all_tenants
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Seed default workflows for all tenants"""
    db = SessionLocal()
    try:
        logger.info("Starting to seed default workflows for all tenants...")
        created_count = seed_default_workflows_for_all_tenants(db)
        logger.info(f"✅ Successfully seeded default workflows for {created_count} tenants")
    except Exception as e:
        logger.error(f"❌ Error seeding workflows: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

