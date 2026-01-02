"""
Service for resolving tenant from email domain or SSO attributes
"""
from typing import Optional
from sqlalchemy.orm import Session
from app.models.tenant import Tenant
from app.models.integration import Integration, IntegrationType
import logging

logger = logging.getLogger(__name__)


def resolve_tenant_from_email_domain(db: Session, email: str) -> Optional[Tenant]:
    """
    Resolve tenant from email domain
    
    Args:
        db: Database session
        email: User email address
        
    Returns:
        Tenant if found, None otherwise
    """
    if "@" not in email:
        return None
    
    email_domain = email.lower().split("@")[1]
    
    # Find tenant by allowed email domains
    tenants = db.query(Tenant).filter(
        Tenant.status == "active"
    ).all()
    
    for tenant in tenants:
        if tenant.allowed_email_domains and email_domain in tenant.allowed_email_domains:
            return tenant
    
    return None


def resolve_tenant_from_integration(db: Session, integration_id: str) -> Optional[Tenant]:
    """
    Resolve tenant from SSO integration
    
    Args:
        db: Database session
        integration_id: SSO integration ID
        
    Returns:
        Tenant if found, None otherwise
    """
    from uuid import UUID
    
    try:
        integration = db.query(Integration).filter(
            Integration.id == UUID(integration_id),
            Integration.integration_type == IntegrationType.SSO.value
        ).first()
        
        if integration and integration.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == integration.tenant_id).first()
            return tenant
    except Exception as e:
        logger.error(f"Error resolving tenant from integration: {e}", exc_info=True)
    
    return None


def validate_email_domain_for_tenant(db: Session, email: str, tenant_id: str) -> bool:
    """
    Validate that email domain is allowed for the tenant
    
    Args:
        db: Database session
        email: User email address
        tenant_id: Tenant ID to validate against
        
    Returns:
        True if email domain is allowed, False otherwise
    """
    from uuid import UUID
    
    if "@" not in email:
        return False
    
    email_domain = email.lower().split("@")[1]
    
    tenant = db.query(Tenant).filter(Tenant.id == UUID(tenant_id)).first()
    
    if not tenant:
        return False
    
    # If no domain restrictions, allow all
    if not tenant.allowed_email_domains:
        return True
    
    # Check if domain is in allowed list
    return email_domain in tenant.allowed_email_domains

