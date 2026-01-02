"""
Admin API endpoints for managing API tokens and SCIM configuration
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.api_gateway import APIToken, SCIMConfiguration, APIGatewayRequestLog, APITokenStatus
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
import logging
import secrets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api-tokens", tags=["api-token-management"])


# Request/Response models
class APITokenCreate(BaseModel):
    """Create API token request"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    scopes: List[str] = Field(..., min_items=1)
    permissions: Optional[Dict[str, Any]] = None
    rate_limit_per_minute: int = Field(60, ge=1, le=10000)
    rate_limit_per_hour: int = Field(1000, ge=1, le=100000)
    rate_limit_per_day: int = Field(10000, ge=1, le=1000000)
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)  # None = never expires


class APITokenResponse(BaseModel):
    """API token response (without sensitive data)"""
    id: str
    name: str
    description: Optional[str]
    token_prefix: str
    scopes: List[str]
    permissions: Optional[Dict[str, Any]]
    rate_limit_per_minute: int
    rate_limit_per_hour: int
    rate_limit_per_day: int
    status: str
    expires_at: Optional[str]
    last_used_at: Optional[str]
    last_used_ip: Optional[str]
    request_count: int
    created_at: str
    created_by: str


class APITokenCreateResponse(BaseModel):
    """Response when creating a new token (includes the token itself)"""
    id: str
    name: str
    token: str  # Only shown once!
    token_prefix: str
    scopes: List[str]
    expires_at: Optional[str]
    created_at: str
    warning: str = "⚠️ Save this token now. You won't be able to see it again!"


class SCIMConfigCreate(BaseModel):
    """Create/Update SCIM configuration"""
    enabled: bool = True
    bearer_token: str = Field(..., min_length=16)
    auto_provision_users: bool = True
    auto_update_users: bool = True
    auto_deactivate_users: bool = True
    field_mappings: Optional[Dict[str, str]] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None


class SCIMConfigResponse(BaseModel):
    """SCIM configuration response"""
    id: str
    tenant_id: str
    enabled: bool
    base_url: str
    auto_provision_users: bool
    auto_update_users: bool
    auto_deactivate_users: bool
    field_mappings: Optional[Dict[str, str]]
    webhook_url: Optional[str]
    last_sync_at: Optional[str]
    sync_status: Optional[str]
    last_error: Optional[str]
    created_at: str
    updated_at: str


@router.post("", response_model=APITokenCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_token(
    token_data: APITokenCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new API token (admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create API tokens"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a tenant"
        )
    
    # Generate token
    token, token_hash, token_prefix = APIToken.generate_token()
    
    # Calculate expiration
    expires_at = None
    if token_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=token_data.expires_in_days)
    
    # Create token record
    api_token = APIToken(
        tenant_id=effective_tenant_id,
        name=token_data.name,
        token_hash=token_hash,
        token_prefix=token_prefix,
        scopes=token_data.scopes,
        permissions=token_data.permissions,
        rate_limit_per_minute=token_data.rate_limit_per_minute,
        rate_limit_per_hour=token_data.rate_limit_per_hour,
        rate_limit_per_day=token_data.rate_limit_per_day,
        expires_at=expires_at,
        description=token_data.description,
        created_by=current_user.id
    )
    
    db.add(api_token)
    db.commit()
    db.refresh(api_token)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="api_token",
        resource_id=str(api_token.id),
        tenant_id=str(effective_tenant_id),
        details={"name": token_data.name, "scopes": token_data.scopes}
    )
    
    return APITokenCreateResponse(
        id=str(api_token.id),
        name=api_token.name,
        token=token,  # Only time this is returned!
        token_prefix=api_token.token_prefix,
        scopes=api_token.scopes,
        expires_at=api_token.expires_at.isoformat() if api_token.expires_at else None,
        created_at=api_token.created_at.isoformat()
    )


@router.get("", response_model=List[APITokenResponse])
async def list_api_tokens(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List API tokens (admin only)"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list API tokens"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    query = db.query(APIToken).filter(APIToken.tenant_id == effective_tenant_id)
    
    tokens = query.order_by(APIToken.created_at.desc()).all()
    
    return [
        APITokenResponse(
            id=str(token.id),
            name=token.name,
            description=token.description,
            token_prefix=token.token_prefix,
            scopes=token.scopes,
            permissions=token.permissions,
            rate_limit_per_minute=token.rate_limit_per_minute,
            rate_limit_per_hour=token.rate_limit_per_hour,
            rate_limit_per_day=token.rate_limit_per_day,
            status=token.status,
            expires_at=token.expires_at.isoformat() if token.expires_at else None,
            last_used_at=token.last_used_at.isoformat() if token.last_used_at else None,
            last_used_ip=token.last_used_ip,
            request_count=token.request_count,
            created_at=token.created_at.isoformat(),
            created_by=str(token.created_by)
        )
        for token in tokens
    ]


@router.post("/{token_id}/revoke", status_code=status.HTTP_200_OK)
async def revoke_api_token(
    token_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke an API token (admin only)"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can revoke API tokens"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    token = db.query(APIToken).filter(
        APIToken.id == token_id,
        APIToken.tenant_id == effective_tenant_id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API token not found"
        )
    
    token.status = APITokenStatus.REVOKED.value
    token.revoked_at = datetime.utcnow()
    token.revoked_by = current_user.id
    db.commit()
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.DELETE,
        resource_type="api_token",
        resource_id=str(token.id),
        tenant_id=str(effective_tenant_id),
        details={"name": token.name}
    )
    
    return {"message": "API token revoked successfully"}


@router.get("/{token_id}/usage", response_model=Dict[str, Any])
async def get_token_usage(
    token_id: UUID,
    days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get API token usage statistics"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view token usage"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    token = db.query(APIToken).filter(
        APIToken.id == token_id,
        APIToken.tenant_id == effective_tenant_id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API token not found"
        )
    
    # Get request logs
    start_date = datetime.utcnow() - timedelta(days=days)
    logs = db.query(APIGatewayRequestLog).filter(
        APIGatewayRequestLog.api_token_id == token_id,
        APIGatewayRequestLog.requested_at >= start_date
    ).all()
    
    # Calculate statistics
    total_requests = len(logs)
    successful_requests = len([l for l in logs if l.status_code and 200 <= l.status_code < 300])
    failed_requests = total_requests - successful_requests
    rate_limit_hits = len([l for l in logs if l.rate_limit_hit])
    
    avg_response_time = 0
    if logs:
        response_times = [l.response_time_ms for l in logs if l.response_time_ms]
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
    
    # Group by endpoint
    endpoint_counts = {}
    for log in logs:
        endpoint_counts[log.path] = endpoint_counts.get(log.path, 0) + 1
    
    return {
        "token_id": str(token_id),
        "period_days": days,
        "total_requests": total_requests,
        "successful_requests": successful_requests,
        "failed_requests": failed_requests,
        "rate_limit_hits": rate_limit_hits,
        "average_response_time_ms": round(avg_response_time, 2),
        "endpoint_usage": endpoint_counts,
        "last_used_at": token.last_used_at.isoformat() if token.last_used_at else None
    }


# SCIM Configuration Management
@router.post("/scim/config", response_model=SCIMConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_scim_config(
    scim_data: SCIMConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update SCIM configuration (admin only)"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can configure SCIM"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a tenant"
        )
    
    # Check if config exists
    existing = db.query(SCIMConfiguration).filter(
        SCIMConfiguration.tenant_id == effective_tenant_id
    ).first()
    
    # Get base URL from request
    from fastapi import Request
    # We'll need to pass request or get it from context
    base_url = f"https://api.vaka.com/api/v1/scim/v2"  # TODO: Get from settings
    
    # Hash bearer token before storing
    from app.core.security import get_password_hash
    bearer_token_hash = get_password_hash(scim_data.bearer_token)
    
    if existing:
        # Update existing
        existing.enabled = scim_data.enabled
        existing.bearer_token_hash = bearer_token_hash
        existing.bearer_token = None  # Clear plain text token
        existing.auto_provision_users = scim_data.auto_provision_users
        existing.auto_update_users = scim_data.auto_update_users
        existing.auto_deactivate_users = scim_data.auto_deactivate_users
        existing.field_mappings = scim_data.field_mappings
        existing.webhook_url = scim_data.webhook_url
        existing.webhook_secret = scim_data.webhook_secret  # TODO: Hash this too
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        
        scim_config = existing
    else:
        # Create new
        scim_config = SCIMConfiguration(
            tenant_id=effective_tenant_id,
            enabled=scim_data.enabled,
            base_url=base_url,
            bearer_token_hash=bearer_token_hash,
            bearer_token=None,  # Don't store plain text
            auto_provision_users=scim_data.auto_provision_users,
            auto_update_users=scim_data.auto_update_users,
            auto_deactivate_users=scim_data.auto_deactivate_users,
            field_mappings=scim_data.field_mappings,
            webhook_url=scim_data.webhook_url,
            webhook_secret=scim_data.webhook_secret,  # TODO: Hash this too
            created_by=current_user.id
        )
        db.add(scim_config)
        db.commit()
        db.refresh(scim_config)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE if not existing else AuditAction.UPDATE,
        resource_type="scim_config",
        resource_id=str(scim_config.id),
        tenant_id=str(effective_tenant_id)
    )
    
    return SCIMConfigResponse(
        id=str(scim_config.id),
        tenant_id=str(scim_config.tenant_id),
        enabled=scim_config.enabled,
        base_url=scim_config.base_url,
        auto_provision_users=scim_config.auto_provision_users,
        auto_update_users=scim_config.auto_update_users,
        auto_deactivate_users=scim_config.auto_deactivate_users,
        field_mappings=scim_config.field_mappings,
        webhook_url=scim_config.webhook_url,
        last_sync_at=scim_config.last_sync_at.isoformat() if scim_config.last_sync_at else None,
        sync_status=scim_config.sync_status,
        last_error=scim_config.last_error,
        created_at=scim_config.created_at.isoformat(),
        updated_at=scim_config.updated_at.isoformat()
    )


@router.get("/scim/config", response_model=SCIMConfigResponse)
async def get_scim_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get SCIM configuration (admin only)"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view SCIM configuration"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    scim_config = db.query(SCIMConfiguration).filter(
        SCIMConfiguration.tenant_id == effective_tenant_id
    ).first()
    
    if not scim_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCIM configuration not found"
        )
    
    return SCIMConfigResponse(
        id=str(scim_config.id),
        tenant_id=str(scim_config.tenant_id),
        enabled=scim_config.enabled,
        base_url=scim_config.base_url,
        auto_provision_users=scim_config.auto_provision_users,
        auto_update_users=scim_config.auto_update_users,
        auto_deactivate_users=scim_config.auto_deactivate_users,
        field_mappings=scim_config.field_mappings,
        webhook_url=scim_config.webhook_url,
        last_sync_at=scim_config.last_sync_at.isoformat() if scim_config.last_sync_at else None,
        sync_status=scim_config.sync_status,
        last_error=scim_config.last_error,
        created_at=scim_config.created_at.isoformat(),
        updated_at=scim_config.updated_at.isoformat()
    )

