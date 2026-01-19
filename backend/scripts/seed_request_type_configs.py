"""
Seed script for default request type configurations
Creates default visibility configurations for common request types
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.request_type_config import RequestTypeConfig, RequestTypeTenantMapping, VisibilityScope
from app.models.tenant import Tenant
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Default request type configurations
DEFAULT_REQUEST_TYPE_CONFIGS = [
    {
        "request_type": "agent_onboarding_workflow",
        "display_name": "Agent Onboarding",
        "visibility_scope": VisibilityScope.BOTH,
        "description": "Onboard new AI agents for qualification and compliance assessment",
        "icon_class": "Bot",
        "internal_portal_order": 1,
        "external_portal_order": 1,
        "allowed_roles": ["tenant_admin", "platform_admin", "vendor_user"],
        "show_tenant_name": True
    },
    {
        "request_type": "vendor_submission_workflow",
        "display_name": "Vendor Submission",
        "visibility_scope": VisibilityScope.EXTERNAL,
        "description": "Submit vendor information and documentation",
        "icon_class": "Building2",
        "internal_portal_order": 2,
        "external_portal_order": 2,
        "allowed_roles": ["tenant_admin", "platform_admin", "vendor_user"],
        "show_tenant_name": True
    },
    {
        "request_type": "assessment_workflow",
        "display_name": "Assessment",
        "visibility_scope": VisibilityScope.INTERNAL,
        "description": "Conduct security and compliance assessments",
        "icon_class": "ClipboardCheck",
        "internal_portal_order": 3,
        "external_portal_order": None,
        "allowed_roles": ["tenant_admin", "platform_admin", "security_reviewer", "compliance_reviewer"],
        "show_tenant_name": False
    },
    {
        "request_type": "product_onboarding_workflow",
        "display_name": "Product Onboarding",
        "visibility_scope": VisibilityScope.BOTH,
        "description": "Onboard software, hardware, or SaaS products",
        "icon_class": "Package",
        "internal_portal_order": 4,
        "external_portal_order": 3,
        "allowed_roles": ["tenant_admin", "platform_admin", "vendor_user"],
        "show_tenant_name": True
    },
    {
        "request_type": "service_onboarding_workflow",
        "display_name": "Service Onboarding",
        "visibility_scope": VisibilityScope.BOTH,
        "description": "Onboard consulting, support, or managed services",
        "icon_class": "Briefcase",
        "internal_portal_order": 5,
        "external_portal_order": 4,
        "allowed_roles": ["tenant_admin", "platform_admin", "vendor_user"],
        "show_tenant_name": True
    }
]


def seed_request_type_configs(db: Session, tenant_id: str = None):
    """
    Seed default request type configurations for a tenant
    
    Args:
        db: Database session
        tenant_id: Specific tenant ID to seed (if None, seeds for all tenants)
    """
    try:
        # Get tenants to seed
        if tenant_id:
            tenants = db.query(Tenant).filter(Tenant.id == tenant_id).all()
        else:
            tenants = db.query(Tenant).all()
        
        if not tenants:
            logger.warning("No tenants found to seed request type configurations")
            return {"created": 0, "updated": 0, "skipped": 0}
        
        stats = {"created": 0, "updated": 0, "skipped": 0}
        
        for tenant in tenants:
            logger.info(f"Seeding request type configurations for tenant: {tenant.name} ({tenant.id})")
            
            for config_data in DEFAULT_REQUEST_TYPE_CONFIGS:
                # Check if config already exists
                existing_config = db.query(RequestTypeConfig).filter(
                    RequestTypeConfig.tenant_id == tenant.id,
                    RequestTypeConfig.request_type == config_data["request_type"]
                ).first()
                
                if existing_config:
                    logger.debug(f"Request type config already exists for {config_data['request_type']} in tenant {tenant.name}")
                    stats["skipped"] += 1
                    continue
                
                # Create new config
                config = RequestTypeConfig(
                    tenant_id=tenant.id,
                    request_type=config_data["request_type"],
                    display_name=config_data["display_name"],
                    visibility_scope=config_data["visibility_scope"],
                    is_enabled=True,
                    show_tenant_name=config_data["show_tenant_name"],
                    internal_portal_order=config_data["internal_portal_order"],
                    external_portal_order=config_data["external_portal_order"],
                    allowed_roles=config_data["allowed_roles"],
                    description=config_data["description"],
                    icon_class=config_data["icon_class"],
                    is_active=True,
                    is_default=(config_data["request_type"] == "agent_onboarding_workflow"),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                db.add(config)
                stats["created"] += 1
                logger.debug(f"Created request type config: {config_data['display_name']} for tenant {tenant.name}")
            
            db.commit()
        
        logger.info(f"Request type configurations seeding completed: {stats}")
        return stats
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed request type configurations: {e}", exc_info=True)
        raise


def seed_on_startup():
    """Seed request type configurations on application startup"""
    db = SessionLocal()
    try:
        logger.info("Starting request type configurations seeding...")
        stats = seed_request_type_configs(db)
        if stats["created"] > 0:
            logger.info(f"Successfully seeded {stats['created']} request type configurations")
        else:
            logger.info("No new request type configurations needed")
    except Exception as e:
        logger.error(f"Failed to seed request type configurations on startup: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    # Run standalone seeding
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        tenant_id = sys.argv[1] if len(sys.argv) > 1 else None
        stats = seed_request_type_configs(db, tenant_id)
        print(f"Seeding completed: {stats}")
    except Exception as e:
        print(f"Seeding failed: {e}")
        sys.exit(1)
    finally:
        db.close()