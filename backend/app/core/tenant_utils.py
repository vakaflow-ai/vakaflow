"""
Tenant utility functions for platform admin default tenant handling
"""
from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session
from app.models.tenant import Tenant
from app.models.user import User
from app.core.config import PLATFORM_ADMIN_DEFAULT_TENANT_ID
import logging

logger = logging.getLogger(__name__)


def get_platform_admin_tenant_id(db: Session) -> Optional[UUID]:
    """
    Get or create the default tenant ID for platform admins.
    Returns the hardcoded platform admin default tenant ID.
    """
    try:
        tenant_uuid = UUID(PLATFORM_ADMIN_DEFAULT_TENANT_ID)
        
        # Check if tenant exists, create if not
        tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
        if not tenant:
            logger.info(f"Creating platform admin default tenant with ID: {PLATFORM_ADMIN_DEFAULT_TENANT_ID}")
            tenant = Tenant(
                id=tenant_uuid,
                name="Platform Admin Default Tenant",
                slug="platform-admin-default",
                status="active",
                contact_email="platform-admin@vaka.com",
                license_tier="enterprise",
                max_agents="unlimited",
                max_users="unlimited",
                onboarding_status="completed"
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            logger.info(f"✅ Created platform admin default tenant: {tenant.id}")
        
        return tenant_uuid
    except Exception as e:
        logger.error(f"Error getting platform admin default tenant: {e}")
        return None


def get_effective_tenant_id(user: User, db: Session) -> Optional[UUID]:
    """
    Get the effective tenant_id for a user.
    For platform admins without tenant_id, returns the default platform admin tenant_id.
    For all other users, returns their assigned tenant_id.
    """
    if user.tenant_id:
        return user.tenant_id
    
    # Platform admins without tenant_id use the default platform admin tenant
    if user.role.value == "platform_admin":
        return get_platform_admin_tenant_id(db)
    
    return None

