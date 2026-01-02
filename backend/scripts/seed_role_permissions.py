"""
Seed Role Permissions
Creates default role permissions including menu permissions for all roles
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.services.role_permission_service import RolePermissionService
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_role_permissions():
    """Seed default role permissions including menu permissions"""
    db = SessionLocal()
    try:
        logger.info("Starting role permissions seeding...")
        counts = await RolePermissionService.seed_default_permissions(db)
        logger.info(f"✅ Permission seeding completed:")
        logger.info(f"   - Created: {counts['created']} permissions")
        logger.info(f"   - Updated: {counts['updated']} permissions")
        logger.info(f"   - Total: {counts['total']} permissions processed")
        return counts
    except Exception as e:
        logger.error(f"❌ Error seeding role permissions: {e}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(seed_role_permissions())

