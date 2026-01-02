"""
Seed Default Entity Permissions
Creates default entity-level permissions for approver roles and other standard roles

This ensures that approvers, reviewers, and other roles have baseline permissions
for viewing and editing entities at different workflow stages.
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.entity_field import EntityPermission
from app.models.tenant import Tenant
from uuid import UUID
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Default role permissions for different entities
DEFAULT_ENTITY_PERMISSIONS = {
    "agents": {
        "tenant_admin": {"view": True, "edit": True},
        "platform_admin": {"view": True, "edit": True},
        "policy_admin": {"view": True, "edit": True},
        "integration_admin": {"view": True, "edit": True},
        "user_admin": {"view": True, "edit": True},
        "security_reviewer": {"view": True, "edit": True},  # Can edit during review
        "compliance_reviewer": {"view": True, "edit": True},  # Can edit during review
        "technical_reviewer": {"view": True, "edit": True},  # Can edit during review
        "business_reviewer": {"view": True, "edit": True},  # Can edit during review
        "approver": {"view": True, "edit": True},  # Can approve/reject
        "vendor_coordinator": {"view": True, "edit": True},  # Can view/edit all agents from their vendor
        "vendor_user": {"view": True, "edit": False},  # Can view but not edit after submission
        "end_user": {"view": True, "edit": False},
    },
    "vendors": {
        "tenant_admin": {"view": True, "edit": True},
        "platform_admin": {"view": True, "edit": True},
        "policy_admin": {"view": True, "edit": True},
        "integration_admin": {"view": True, "edit": True},
        "user_admin": {"view": True, "edit": True},
        "security_reviewer": {"view": True, "edit": False},
        "compliance_reviewer": {"view": True, "edit": False},
        "technical_reviewer": {"view": True, "edit": False},
        "business_reviewer": {"view": True, "edit": False},
        "approver": {"view": True, "edit": False},
        "vendor_coordinator": {"view": True, "edit": True},  # Can edit their own vendor
        "vendor_user": {"view": True, "edit": True},  # Can edit their own vendor
        "end_user": {"view": True, "edit": False},
    },
    "assessments": {
        "tenant_admin": {"view": True, "edit": True},
        "platform_admin": {"view": True, "edit": True},
        "policy_admin": {"view": True, "edit": True},
        "security_reviewer": {"view": True, "edit": True},
        "compliance_reviewer": {"view": True, "edit": True},
        "vendor_coordinator": {"view": True, "edit": False},
        "vendor_user": {"view": True, "edit": False},
        "end_user": {"view": True, "edit": False},
    },
    "users": {
        "tenant_admin": {"view": True, "edit": True},
        "platform_admin": {"view": True, "edit": True},
        "user_admin": {"view": True, "edit": True},
        "vendor_coordinator": {"view": True, "edit": True},  # Can view/edit vendor users in their vendor
        "vendor_user": {"view": False, "edit": False},  # Can't view other users
        "end_user": {"view": False, "edit": False},  # Can't view other users
    },
}


def create_default_entity_permissions_for_tenant(
    db: Session,
    tenant_id: UUID,
    created_by: UUID = None
):
    """
    Create default entity-level permissions for a tenant
    
    Args:
        db: Database session
        tenant_id: Tenant ID
        created_by: User ID who creates the permissions (optional)
    """
    permissions_created = 0
    
    for entity_name, role_permissions in DEFAULT_ENTITY_PERMISSIONS.items():
        # Check if permission already exists
        existing = db.query(EntityPermission).filter(
            EntityPermission.tenant_id == tenant_id,
            EntityPermission.entity_name == entity_name
        ).first()
        
        if existing:
            # Update existing permissions (merge with defaults)
            updated = False
            for role, perms in role_permissions.items():
                if role not in existing.role_permissions:
                    existing.role_permissions[role] = perms
                    updated = True
            
            if updated:
                db.commit()
                logger.info(f"Updated entity permissions for {entity_name}")
            else:
                logger.info(f"Entity permissions already exist for {entity_name}, skipping")
            continue
        
        # Create new permission
        entity_label = entity_name.replace("_", " ").title()
        
        permission = EntityPermission(
            tenant_id=tenant_id,
            entity_name=entity_name,
            entity_label=entity_label,
            entity_category="core" if entity_name in ["agents", "vendors", "users"] else "compliance",
            role_permissions=role_permissions,
            enforce_tenant_isolation=True,
            is_active=True,
            created_by=created_by
        )
        
        db.add(permission)
        permissions_created += 1
        logger.info(f"Created entity permissions for {entity_name}")
    
    db.commit()
    logger.info(f"Created {permissions_created} entity permission sets for tenant {tenant_id}")
    
    return permissions_created


def seed_default_entity_permissions_for_all_tenants():
    """Seed default entity permissions for all tenants"""
    db: Session = SessionLocal()
    
    try:
        tenants = db.query(Tenant).all()
        total_created = 0
        
        for tenant in tenants:
            logger.info(f"Seeding entity permissions for tenant: {tenant.id}")
            created = create_default_entity_permissions_for_tenant(db, tenant.id)
            total_created += created
        
        logger.info(f"Total entity permission sets created: {total_created}")
        return {"tenants_processed": len(tenants), "permissions_created": total_created}
        
    except Exception as e:
        logger.error(f"Error seeding entity permissions: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


def seed_default_entity_permissions_for_tenant_id(tenant_id: str):
    """Seed default entity permissions for a specific tenant"""
    db: Session = SessionLocal()
    
    try:
        tenant_uuid = UUID(tenant_id)
        created = create_default_entity_permissions_for_tenant(db, tenant_uuid)
        return {"permissions_created": created}
    except Exception as e:
        logger.error(f"Error seeding entity permissions: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed default entity-level permissions")
    parser.add_argument("--tenant-id", type=str, help="Specific tenant ID to seed (optional)")
    args = parser.parse_args()
    
    if args.tenant_id:
        logger.info(f"Seeding entity permissions for tenant: {args.tenant_id}")
        result = seed_default_entity_permissions_for_tenant_id(args.tenant_id)
        logger.info(f"Result: {result}")
    else:
        logger.info("Seeding entity permissions for all tenants...")
        result = seed_default_entity_permissions_for_all_tenants()
        logger.info(f"Result: {result}")

