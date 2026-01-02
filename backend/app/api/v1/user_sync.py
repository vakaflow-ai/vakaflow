"""
User sync endpoints for pulling users from identity providers
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.integration import Integration, IntegrationType
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/user-sync", tags=["user-sync"])


class UserSyncRequest(BaseModel):
    """User sync request"""
    integration_id: UUID
    sync_type: str = "full"  # full or incremental


class UserSyncResponse(BaseModel):
    """User sync response"""
    status: str
    users_synced: int
    users_created: int
    users_updated: int
    users_deactivated: int
    errors: List[str] = []


async def sync_users_from_azure(integration: Integration, db: Session) -> UserSyncResponse:
    """Sync users from Azure Entra ID"""
    try:
        config = integration.config
        # This would use Microsoft Graph API to fetch users
        # For now, return a placeholder response
        logger.info(f"Syncing users from Azure Entra ID for integration {integration.id}")
        
        # TODO: Implement actual Azure AD user sync using Microsoft Graph API
        # Example:
        # - Use client_id, client_secret, tenant_id from config
        # - Authenticate with Microsoft Graph
        # - Fetch users from /users endpoint
        # - Create/update users in VAKA database
        
        return UserSyncResponse(
            status="success",
            users_synced=0,
            users_created=0,
            users_updated=0,
            users_deactivated=0,
            errors=["Azure AD sync not yet implemented"]
        )
    except Exception as e:
        logger.error(f"Error syncing users from Azure: {e}", exc_info=True)
        return UserSyncResponse(
            status="error",
            users_synced=0,
            users_created=0,
            users_updated=0,
            users_deactivated=0,
            errors=[str(e)]
        )


async def sync_users_from_google(integration: Integration, db: Session) -> UserSyncResponse:
    """Sync users from Google Workspace"""
    try:
        config = integration.config
        logger.info(f"Syncing users from Google Workspace for integration {integration.id}")
        
        # TODO: Implement actual Google Workspace user sync using Admin SDK
        # Example:
        # - Use OAuth credentials from config
        # - Authenticate with Google Admin SDK
        # - Fetch users from Directory API
        # - Create/update users in VAKA database
        
        return UserSyncResponse(
            status="success",
            users_synced=0,
            users_created=0,
            users_updated=0,
            users_deactivated=0,
            errors=["Google Workspace sync not yet implemented"]
        )
    except Exception as e:
        logger.error(f"Error syncing users from Google: {e}", exc_info=True)
        return UserSyncResponse(
            status="error",
            users_synced=0,
            users_created=0,
            users_updated=0,
            users_deactivated=0,
            errors=[str(e)]
        )


async def sync_users_from_okta(integration: Integration, db: Session) -> UserSyncResponse:
    """Sync users from OKTA"""
    try:
        config = integration.config
        logger.info(f"Syncing users from OKTA for integration {integration.id}")
        
        # TODO: Implement actual OKTA user sync using OKTA API
        # Example:
        # - Use API token or OAuth from config
        # - Authenticate with OKTA API
        # - Fetch users from /api/v1/users endpoint
        # - Create/update users in VAKA database
        
        return UserSyncResponse(
            status="success",
            users_synced=0,
            users_created=0,
            users_updated=0,
            users_deactivated=0,
            errors=["OKTA sync not yet implemented"]
        )
    except Exception as e:
        logger.error(f"Error syncing users from OKTA: {e}", exc_info=True)
        return UserSyncResponse(
            status="error",
            users_synced=0,
            users_created=0,
            users_updated=0,
            users_deactivated=0,
            errors=[str(e)]
        )


@router.post("/sync", response_model=UserSyncResponse)
async def sync_users(
    sync_request: UserSyncRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sync users from identity provider (admin only)"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can sync users"
        )
    
    # Get integration
    integration = db.query(Integration).filter(
        Integration.id == sync_request.integration_id,
        Integration.integration_type == IntegrationType.SSO.value,
        Integration.tenant_id == current_user.tenant_id
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSO integration not found"
        )
    
    config = integration.config
    provider = config.get("provider", "custom")
    
    # Route to appropriate sync function
    if provider == "azure_entra_id":
        result = await sync_users_from_azure(integration, db)
    elif provider == "google":
        result = await sync_users_from_google(integration, db)
    elif provider == "okta":
        result = await sync_users_from_okta(integration, db)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User sync not supported for provider: {provider}"
        )
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="user_sync",
        resource_id=str(sync_request.integration_id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={
            "provider": provider,
            "users_synced": result.users_synced,
            "users_created": result.users_created,
            "users_updated": result.users_updated
        }
    )
    
    return result


@router.get("/status/{integration_id}", response_model=Dict[str, Any])
async def get_sync_status(
    integration_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user sync status for an integration"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view sync status"
        )
    
    integration = db.query(Integration).filter(
        Integration.id == integration_id,
        Integration.tenant_id == current_user.tenant_id
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Get sync status from integration config or last sync time
    config = integration.config
    last_sync = integration.last_sync_at
    
    return {
        "integration_id": str(integration_id),
        "provider": config.get("provider", "custom"),
        "sync_enabled": config.get("sync_enabled", False),
        "last_sync_at": last_sync.isoformat() if last_sync else None,
        "sync_schedule": config.get("sync_schedule"),
        "status": "active" if integration.status == "active" else "inactive"
    }

