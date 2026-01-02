"""
Webhook management API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.webhook import Webhook, WebhookDelivery, WebhookEvent, WebhookStatus
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class WebhookCreate(BaseModel):
    """Webhook creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1)
    secret: Optional[str] = None
    events: List[str] = Field(..., min_items=1)
    headers: Optional[dict] = None
    timeout: int = Field(30, ge=1, le=300)
    description: Optional[str] = None


class WebhookResponse(BaseModel):
    """Webhook response schema"""
    id: str
    name: str
    url: str
    events: List[str]
    status: str
    success_count: int
    failure_count: int
    last_triggered_at: Optional[str]
    last_error: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.post("", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    webhook_data: WebhookCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a webhook (admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create webhooks"
        )
    
    # Validate events
    valid_events = [e.value for e in WebhookEvent]
    invalid_events = [e for e in webhook_data.events if e not in valid_events]
    if invalid_events:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid events: {invalid_events}"
        )
    
    # Create webhook
    webhook = Webhook(
        tenant_id=current_user.tenant_id,
        name=webhook_data.name,
        url=webhook_data.url,
        secret=webhook_data.secret,
        events=webhook_data.events,
        headers=webhook_data.headers,
        timeout=webhook_data.timeout,
        description=webhook_data.description,
        status=WebhookStatus.ACTIVE.value,
        created_by=current_user.id
    )
    
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="webhook",
        resource_id=str(webhook.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"name": webhook_data.name, "url": webhook_data.url}
    )
    
    return WebhookResponse(
        id=str(webhook.id),
        name=webhook.name,
        url=webhook.url,
        events=webhook.events,
        status=webhook.status,
        success_count=webhook.success_count,
        failure_count=webhook.failure_count,
        last_triggered_at=webhook.last_triggered_at.isoformat() if webhook.last_triggered_at else None,
        last_error=webhook.last_error,
        description=webhook.description,
        is_active=webhook.is_active,
        created_at=webhook.created_at.isoformat(),
        updated_at=webhook.updated_at.isoformat()
    )


@router.get("", response_model=List[WebhookResponse])
async def list_webhooks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List webhooks"""
    try:
        query = db.query(Webhook)
        
        # Filter by tenant
        if current_user.tenant_id:
            query = query.filter(Webhook.tenant_id == current_user.tenant_id)
        
        webhooks = query.order_by(Webhook.created_at.desc()).all()
        
        return [
            WebhookResponse(
                id=str(w.id),
                name=w.name,
                url=w.url,
                events=w.events or [],
                status=w.status,
                success_count=w.success_count or 0,
                failure_count=w.failure_count or 0,
                last_triggered_at=w.last_triggered_at.isoformat() if w.last_triggered_at else None,
                last_error=w.last_error,
                description=w.description,
                is_active=w.is_active if w.is_active is not None else True,
                created_at=w.created_at.isoformat() if w.created_at else datetime.utcnow().isoformat(),
                updated_at=w.updated_at.isoformat() if w.updated_at else datetime.utcnow().isoformat()
            )
            for w in webhooks
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list webhooks: {str(e)}"
        )


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get webhook details"""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    # Check permissions
    if current_user.tenant_id and webhook.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return WebhookResponse(
        id=str(webhook.id),
        name=webhook.name,
        url=webhook.url,
        events=webhook.events,
        status=webhook.status,
        success_count=webhook.success_count,
        failure_count=webhook.failure_count,
        last_triggered_at=webhook.last_triggered_at.isoformat() if webhook.last_triggered_at else None,
        last_error=webhook.last_error,
        description=webhook.description,
        is_active=webhook.is_active,
        created_at=webhook.created_at.isoformat(),
        updated_at=webhook.updated_at.isoformat()
    )


@router.get("/{webhook_id}/deliveries")
async def get_webhook_deliveries(
    webhook_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get webhook delivery history"""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    # Check permissions
    if current_user.tenant_id and webhook.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    deliveries = db.query(WebhookDelivery).filter(
        WebhookDelivery.webhook_id == webhook_id
    ).order_by(WebhookDelivery.attempted_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return [
        {
            "id": str(d.id),
            "event_type": d.event_type,
            "status_code": d.status_code,
            "error_message": d.error_message,
            "attempted_at": d.attempted_at.isoformat(),
            "completed_at": d.completed_at.isoformat() if d.completed_at else None,
            "duration_ms": d.duration_ms
        }
        for d in deliveries
    ]


@router.post("/{webhook_id}/activate")
async def activate_webhook(
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Activate a webhook"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can activate webhooks"
        )
    
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    webhook.status = WebhookStatus.ACTIVE.value
    webhook.is_active = True
    db.commit()
    
    return {"status": "activated"}


@router.post("/{webhook_id}/deactivate")
async def deactivate_webhook(
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deactivate a webhook"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can deactivate webhooks"
        )
    
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    webhook.status = WebhookStatus.INACTIVE.value
    webhook.is_active = False
    db.commit()
    
    return {"status": "deactivated"}


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a webhook"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete webhooks"
        )
    
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    db.delete(webhook)
    db.commit()
    
    return {"status": "deleted"}

