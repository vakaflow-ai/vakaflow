"""
SSO Settings API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.models.integration import Integration, IntegrationType, IntegrationStatus
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction

router = APIRouter(prefix="/sso-settings", tags=["sso-settings"])


class SSOConfig(BaseModel):
    """SSO configuration schema"""
    type: str = Field(..., pattern="^(saml|oidc)$", description="SSO type: saml or oidc")
    provider: str = Field(..., description="SSO provider: azure_entra_id, google, okta, ping, or custom")
    name: str = Field(..., min_length=1, max_length=255, description="SSO integration name")
    
    # SAML Settings
    saml_entity_id: Optional[str] = None
    saml_sso_url: Optional[str] = None
    saml_x509_cert: Optional[str] = None
    saml_private_key: Optional[str] = None
    
    # OIDC Settings
    oidc_client_id: Optional[str] = None
    oidc_client_secret: Optional[str] = None
    oidc_authorization_url: Optional[str] = None
    oidc_token_url: Optional[str] = None
    oidc_userinfo_url: Optional[str] = None
    oidc_issuer: Optional[str] = None
    
    # Azure Entra ID specific
    azure_tenant_id: Optional[str] = None
    
    # Google specific
    google_domain: Optional[str] = None
    
    # Attribute Mapping
    attribute_mapping: Optional[Dict[str, str]] = Field(
        default_factory=lambda: {
            "email": "email",
            "first_name": "givenName",
            "last_name": "surname",
            "name": "name",
            "department": "department"
        }
    )
    
    # User Sync Configuration
    sync_enabled: bool = Field(default=True, description="Enable automatic user sync")
    sync_schedule: Optional[str] = Field(None, description="Cron expression for sync schedule")
    allowed_fields: List[str] = Field(
        default_factory=lambda: ["email", "first_name", "last_name", "department"],
        description="Fields allowed to be synced from SSO"
    )


class SSOConfigResponse(BaseModel):
    """SSO configuration response schema"""
    type: str
    provider: str
    name: str
    saml_entity_id: Optional[str]
    saml_sso_url: Optional[str]
    oidc_client_id: Optional[str]
    oidc_authorization_url: Optional[str]
    attribute_mapping: Dict[str, str]
    sync_enabled: bool
    sync_schedule: Optional[str]
    allowed_fields: List[str]
    is_configured: bool
    integration_id: Optional[str] = None
    azure_tenant_id: Optional[str] = None
    google_domain: Optional[str] = None


@router.get("", response_model=SSOConfigResponse)
async def get_sso_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get SSO settings (admin only)"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view SSO settings"
        )
    
    # Get SSO integration from database
    integration = db.query(Integration).filter(
        Integration.integration_type == IntegrationType.SSO.value,
        Integration.tenant_id == current_user.tenant_id
    ).first()
    
    if integration and integration.config:
        config = integration.config
        return SSOConfigResponse(
            type=config.get("type", "saml"),
            provider=config.get("provider", "custom"),
            name=integration.name,
            saml_entity_id=config.get("saml_settings", {}).get("sp", {}).get("entityId") if config.get("type") == "saml" else None,
            saml_sso_url=config.get("saml_settings", {}).get("idp", {}).get("singleSignOnService", {}).get("url") if config.get("type") == "saml" else None,
            oidc_client_id=config.get("oidc", {}).get("client_id") if config.get("type") == "oidc" else None,
            oidc_authorization_url=config.get("oidc", {}).get("authorization_url") if config.get("type") == "oidc" else None,
            attribute_mapping=config.get("attribute_mapping", {}),
            sync_enabled=config.get("sync_enabled", True),
            sync_schedule=config.get("sync_schedule"),
            allowed_fields=config.get("allowed_fields", ["email", "first_name", "last_name", "department"]),
            is_configured=True,
            integration_id=str(integration.id),
            azure_tenant_id=config.get("azure_tenant_id"),
            google_domain=config.get("google_domain")
        )
    
    return SSOConfigResponse(
        type="saml",
        provider="custom",
        name="",
        saml_entity_id=None,
        saml_sso_url=None,
        oidc_client_id=None,
        oidc_authorization_url=None,
        attribute_mapping={},
        sync_enabled=True,
        sync_schedule=None,
        allowed_fields=["email", "first_name", "last_name", "department"],
        is_configured=False,
        integration_id=None,
        azure_tenant_id=None,
        google_domain=None
    )


@router.post("", response_model=SSOConfigResponse)
async def update_sso_settings(
    config: SSOConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update SSO settings (admin only)"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update SSO settings"
        )
    
    # Build config dict based on type
    config_dict: Dict[str, Any] = {
        "type": config.type,
        "provider": config.provider,
        "attribute_mapping": config.attribute_mapping or {},
        "sync_enabled": config.sync_enabled,
        "sync_schedule": config.sync_schedule,
        "allowed_fields": config.allowed_fields
    }
    
    # Add provider-specific settings
    if config.provider == "azure_entra_id" and config.azure_tenant_id:
        config_dict["azure_tenant_id"] = config.azure_tenant_id
    elif config.provider == "google" and config.google_domain:
        config_dict["google_domain"] = config.google_domain
    
    if config.type == "saml":
        # Get frontend URL from request or use default
        from fastapi import Request
        import os
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        
        config_dict["saml_settings"] = {
            "sp": {
                "entityId": config.saml_entity_id or f"urn:vaka:{current_user.tenant_id}",
                "assertionConsumerService": {
                    "url": f"{frontend_url}/api/v1/sso/callback"
                }
            },
            "idp": {
                "singleSignOnService": {
                    "url": config.saml_sso_url or ""
                },
                "x509cert": config.saml_x509_cert or ""
            }
        }
        if config.saml_private_key:
            config_dict["saml_settings"]["sp"]["privateKey"] = config.saml_private_key
    elif config.type == "oidc":
        config_dict["oidc"] = {
            "client_id": config.oidc_client_id or "",
            "client_secret": config.oidc_client_secret or "",
            "authorization_url": config.oidc_authorization_url or "",
            "token_url": config.oidc_token_url or "",
            "userinfo_url": config.oidc_userinfo_url or "",
            "issuer": config.oidc_issuer or ""
        }
    
    # Check if SSO integration exists
    integration = db.query(Integration).filter(
        Integration.integration_type == IntegrationType.SSO.value,
        Integration.tenant_id == current_user.tenant_id
    ).first()
    
    if integration:
        # Update existing
        integration.name = config.name
        integration.config = config_dict
        integration.status = IntegrationStatus.ACTIVE.value
        integration.is_active = True
    else:
        # Create new
        integration = Integration(
            tenant_id=current_user.tenant_id,
            name=config.name,
            integration_type=IntegrationType.SSO.value,
            config=config_dict,
            description="SSO authentication configuration",
            status=IntegrationStatus.ACTIVE.value,
            is_active=True,
            created_by=current_user.id
        )
        db.add(integration)
    
    db.commit()
    db.refresh(integration)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE if integration else AuditAction.CREATE,
        resource_type="sso_settings",
        resource_id=str(integration.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"sso_type": config.type}
    )
    
    return SSOConfigResponse(
        type=config.type,
        provider=config.provider,
        name=config.name,
        saml_entity_id=config.saml_entity_id,
        saml_sso_url=config.saml_sso_url,
        oidc_client_id=config.oidc_client_id,
        oidc_authorization_url=config.oidc_authorization_url,
        attribute_mapping=config.attribute_mapping or {},
        sync_enabled=config.sync_enabled,
        sync_schedule=config.sync_schedule,
        allowed_fields=config.allowed_fields,
        is_configured=True,
        integration_id=str(integration.id),
        azure_tenant_id=config.azure_tenant_id,
        google_domain=config.google_domain
    )

