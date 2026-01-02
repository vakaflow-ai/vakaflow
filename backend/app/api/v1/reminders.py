"""
Workflow Reminders API
Endpoints for managing workflow reminders
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.reminder_service import ReminderService
from app.models.workflow_reminder import WorkflowReminder

router = APIRouter()


class ReminderScheduleRequest(BaseModel):
    """Request to schedule reminders"""
    entity_type: str = Field(..., description="Entity type (e.g., 'agent', 'vendor')")
    entity_id: str = Field(..., description="Entity ID")
    request_type: str = Field(..., description="Request type")
    workflow_stage: str = Field(..., description="Workflow stage")
    reminder_days: List[int] = Field(..., description="Days after stage entry to send reminders")
    recipients: List[str] = Field(..., description="Recipient configs (e.g., ['user', 'next_approver'])")


@router.post("/schedule", response_model=List[dict])
async def schedule_reminders(
    request: ReminderScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule reminders for a workflow stage"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    try:
        service = ReminderService(db, effective_tenant_id)
        
        reminders = service.schedule_reminders(
            entity_type=request.entity_type,
            entity_id=UUID(request.entity_id),
            request_type=request.request_type,
            workflow_stage=request.workflow_stage,
            reminder_days=request.reminder_days,
            recipients=request.recipients,
            scheduled_by=current_user.id
        )
        
        return [
            {
                "id": str(r.id),
                "reminder_days": r.reminder_days,
                "reminder_date": r.reminder_date.isoformat(),
                "is_sent": r.is_sent
            }
            for r in reminders
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to schedule reminders: {str(e)}"
        )


@router.post("/process-due", response_model=dict)
async def process_due_reminders(
    background_tasks: BackgroundTasks,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process all due reminders (admin only)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Only allow tenant_admin or platform_admin
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    try:
        service = ReminderService(db, effective_tenant_id)
        
        # Process in background
        async def process_reminders():
            return await service.process_due_reminders(limit)
        
        background_tasks.add_task(process_reminders)
        
        return {"message": "Processing reminders in background", "limit": limit}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process reminders: {str(e)}"
        )


@router.delete("/cancel", response_model=dict)
async def cancel_reminders(
    entity_type: str,
    entity_id: str,
    workflow_stage: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel pending reminders for an entity"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    try:
        service = ReminderService(db, effective_tenant_id)
        
        count = service.cancel_reminders(
            entity_type=entity_type,
            entity_id=UUID(entity_id),
            workflow_stage=workflow_stage
        )
        
        return {"cancelled": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel reminders: {str(e)}"
        )


@router.get("/entity/{entity_type}/{entity_id}", response_model=List[dict])
async def get_entity_reminders(
    entity_type: str,
    entity_id: str,
    workflow_stage: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get reminders for an entity"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    try:
        query = db.query(WorkflowReminder).filter(
            WorkflowReminder.tenant_id == effective_tenant_id,
            WorkflowReminder.entity_type == entity_type,
            WorkflowReminder.entity_id == UUID(entity_id)
        )
        
        if workflow_stage:
            query = query.filter(WorkflowReminder.workflow_stage == workflow_stage)
        
        reminders = query.order_by(WorkflowReminder.reminder_date).all()
        
        return [
            {
                "id": str(r.id),
                "request_type": r.request_type,
                "workflow_stage": r.workflow_stage,
                "reminder_days": r.reminder_days,
                "reminder_date": r.reminder_date.isoformat(),
                "recipients": r.recipients,
                "is_sent": r.is_sent,
                "sent_at": r.sent_at.isoformat() if r.sent_at else None,
                "send_attempts": r.send_attempts,
                "last_error": r.last_error
            }
            for r in reminders
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reminders: {str(e)}"
        )

