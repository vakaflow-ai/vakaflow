"""
Integration management API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.integration import Integration, IntegrationType, IntegrationStatus, IntegrationEvent
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction

router = APIRouter(prefix="/integrations", tags=["integrations"])


class IntegrationCreate(BaseModel):
    """Integration creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    integration_type: str = Field(..., pattern="^(sso|servicenow|jira|slack|teams|compliance_tool|security_tool|webhook|smtp)$")
    config: Dict[str, Any]
    description: Optional[str] = None


class IntegrationResponse(BaseModel):
    """Integration response schema"""
    id: str
    name: str
    integration_type: str
    status: str
    health_status: Optional[str]
    last_sync_at: Optional[str]
    last_error: Optional[str]
    error_count: int
    description: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.post("", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    integration_data: IntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an integration (admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create integrations"
        )
    
    # Create integration
    integration = Integration(
        tenant_id=current_user.tenant_id,
        name=integration_data.name,
        integration_type=integration_data.integration_type,
        config=integration_data.config,
        description=integration_data.description,
        status=IntegrationStatus.CONFIGURING.value,
        created_by=current_user.id
    )
    
    db.add(integration)
    db.commit()
    db.refresh(integration)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="integration",
        resource_id=str(integration.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"integration_type": integration_data.integration_type}
    )
    
    return IntegrationResponse(
        id=str(integration.id),
        name=integration.name,
        integration_type=integration.integration_type,
        status=integration.status,
        health_status=integration.health_status,
        last_sync_at=integration.last_sync_at.isoformat() if integration.last_sync_at else None,
        last_error=integration.last_error,
        error_count=integration.error_count,
        description=integration.description,
        is_active=integration.is_active,
        created_at=integration.created_at.isoformat(),
        updated_at=integration.updated_at.isoformat()
    )


@router.get("", response_model=List[IntegrationResponse])
async def list_integrations(
    integration_type: Optional[str] = None,
    tenant_id: Optional[UUID] = Query(None, description="Filter by tenant_id (platform_admin only)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List integrations (tenant-isolated, platform_admin can see all)"""
    try:
        query = db.query(Integration)
        
        # Tenant isolation: platform_admin can see all, others only their tenant
        if current_user.role.value == "platform_admin":
            # Platform admin can filter by tenant_id if provided
            if tenant_id:
                query = query.filter(Integration.tenant_id == tenant_id)
            # Otherwise, show all integrations
        else:
            # Non-platform-admin users can only see their tenant's integrations
            if current_user.tenant_id:
                query = query.filter(Integration.tenant_id == current_user.tenant_id)
            else:
                # User has no tenant_id, return empty
                return []
        
        # Filter by type
        if integration_type:
            query = query.filter(Integration.integration_type == integration_type)
        
        integrations = query.order_by(Integration.created_at.desc()).all()
        
        return [
            IntegrationResponse(
                id=str(i.id),
                name=i.name,
                integration_type=i.integration_type,
                status=i.status,
                health_status=i.health_status,
                last_sync_at=i.last_sync_at.isoformat() if i.last_sync_at else None,
                last_error=i.last_error,
                error_count=i.error_count or 0,
                description=i.description,
                is_active=i.is_active if i.is_active is not None else True,
                created_at=i.created_at.isoformat() if i.created_at else datetime.utcnow().isoformat(),
                updated_at=i.updated_at.isoformat() if i.updated_at else datetime.utcnow().isoformat()
            )
            for i in integrations
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list integrations: {str(e)}"
        )


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(
    integration_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get integration details (tenant-isolated, platform_admin can access all)"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Tenant isolation: platform_admin can access all, others only their tenant
    if current_user.role.value != "platform_admin":
        if current_user.tenant_id and integration.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Integration belongs to a different tenant"
            )
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User has no tenant"
            )
    
    return IntegrationResponse(
        id=str(integration.id),
        name=integration.name,
        integration_type=integration.integration_type,
        status=integration.status,
        health_status=integration.health_status,
        last_sync_at=integration.last_sync_at.isoformat() if integration.last_sync_at else None,
        last_error=integration.last_error,
        error_count=integration.error_count,
        description=integration.description,
        is_active=integration.is_active,
        created_at=integration.created_at.isoformat(),
        updated_at=integration.updated_at.isoformat()
    )


@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: UUID,
    integration_data: IntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an integration (admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update integrations"
        )
    
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Tenant isolation: platform_admin can update all, others only their tenant
    if current_user.role.value != "platform_admin":
        if current_user.tenant_id and integration.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Integration belongs to a different tenant"
            )
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User has no tenant"
            )
    
    # Update integration
    integration.name = integration_data.name
    integration.integration_type = integration_data.integration_type
    integration.config = integration_data.config
    integration.description = integration_data.description
    integration.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(integration)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="integration",
        resource_id=str(integration.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"integration_type": integration_data.integration_type}
    )
    
    return IntegrationResponse(
        id=str(integration.id),
        name=integration.name,
        integration_type=integration.integration_type,
        status=integration.status,
        health_status=integration.health_status,
        last_sync_at=integration.last_sync_at.isoformat() if integration.last_sync_at else None,
        last_error=integration.last_error,
        error_count=integration.error_count,
        description=integration.description,
        is_active=integration.is_active,
        created_at=integration.created_at.isoformat(),
        updated_at=integration.updated_at.isoformat()
    )


@router.get("/{integration_id}/config", response_model=Dict[str, Any])
async def get_integration_config(
    integration_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get integration configuration (admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view integration configuration"
        )
    
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Tenant isolation: platform_admin can access all, others only their tenant
    if current_user.role.value != "platform_admin":
        if current_user.tenant_id and integration.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Integration belongs to a different tenant"
            )
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User has no tenant"
            )
    
    # Return only the configuration, not the full integration object
    return integration.config if integration.config else {}


@router.post("/{integration_id}/test")
async def test_integration(
    integration_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test integration connection (tenant-isolated, platform_admin can test all)"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Tenant isolation: platform_admin can test all, others only their tenant
    if current_user.role.value != "platform_admin":
        if current_user.tenant_id and integration.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Integration belongs to a different tenant"
            )
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User has no tenant"
            )
    
    # Test connection using integration service
    from app.services.integration_service import IntegrationService
    try:
        result = await IntegrationService.test_integration(db, str(integration.id))
        if result:
            return {"status": "success", "message": "Connection test successful"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Connection test failed"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Integration test failed: {str(e)}"
        )


@router.post("/{integration_id}/activate")
async def activate_integration(
    integration_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Activate an integration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can activate integrations"
        )
    
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Tenant isolation: platform_admin can activate all, others only their tenant
    if current_user.role.value != "platform_admin":
        if current_user.tenant_id and integration.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Integration belongs to a different tenant"
            )
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User has no tenant"
            )
    
    integration.status = IntegrationStatus.ACTIVE.value
    integration.is_active = True
    integration.health_status = "healthy"
    db.commit()
    
    return {"status": "activated"}


@router.post("/{integration_id}/deactivate")
async def deactivate_integration(
    integration_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deactivate an integration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can deactivate integrations"
        )
    
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Tenant isolation: platform_admin can deactivate all, others only their tenant
    if current_user.role.value != "platform_admin":
        if current_user.tenant_id and integration.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Integration belongs to a different tenant"
            )
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User has no tenant"
            )
    
    integration.status = IntegrationStatus.INACTIVE.value
    integration.is_active = False
    db.commit()
    
    return {"status": "deactivated"}


@router.get("/{integration_id}/events")
async def get_integration_events(
    integration_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get integration events/logs (tenant-isolated, platform_admin can see all logs)"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Tenant isolation: platform_admin can see all logs, others only their tenant's logs
    if current_user.role.value != "platform_admin":
        if current_user.tenant_id and integration.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Integration belongs to a different tenant"
            )
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User has no tenant"
            )
    
    # Query events with tenant isolation
    query = db.query(IntegrationEvent).filter(
        IntegrationEvent.integration_id == integration_id
    )
    
    # Additional tenant filter on events (if tenant_id is set on events)
    if current_user.role.value != "platform_admin" and current_user.tenant_id:
        query = query.filter(IntegrationEvent.tenant_id == current_user.tenant_id)
    
    events = query.order_by(IntegrationEvent.occurred_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "resource_type": e.resource_type,
            "resource_id": str(e.resource_id) if e.resource_id else None,
            "status_code": e.status_code,
            "error_message": e.error_message,
            "occurred_at": e.occurred_at.isoformat()
        }
        for e in events
    ]

