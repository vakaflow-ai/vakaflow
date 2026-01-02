"""
Workflow actions API - approve, reject, forward, comments
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.workflow_config import OnboardingRequest
from app.models.workflow_stage import WorkflowStageAction, WorkflowActionType, WorkflowAuditTrail
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow-actions", tags=["workflow-actions"])


class ForwardRequest(BaseModel):
    """Forward workflow request"""
    forwarded_to: UUID = Field(..., description="User ID to forward to")
    comments: Optional[str] = None


class CommentRequest(BaseModel):
    """Add comment to workflow"""
    comments: str = Field(..., min_length=1)
    step_number: Optional[int] = None


class WorkflowActionResponse(BaseModel):
    """Workflow action response"""
    id: str
    action_type: str
    performed_by: str
    performed_at: str
    comments: Optional[str]
    forwarded_to: Optional[str]
    step_number: int
    
    class Config:
        from_attributes = True


@router.post("/onboarding-requests/{request_id}/forward", response_model=WorkflowActionResponse)
async def forward_workflow(
    request_id: UUID,
    forward_data: ForwardRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    http_request: Request = None
):
    """Forward workflow to another user"""
    # Get onboarding request
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.id == request_id
    ).first()
    
    if not onboarding_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding request not found"
        )
    
    # Check permissions - user must be assigned to this request or be admin
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    is_admin = user_role in ["tenant_admin", "platform_admin"]
    
    if not is_admin and onboarding_request.assigned_to != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only forward requests assigned to you"
        )
    
    # Verify forwarded_to user exists
    forwarded_user = db.query(User).filter(User.id == forward_data.forwarded_to).first()
    if not forwarded_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User to forward to not found"
        )
    
    # Get current step
    current_step = onboarding_request.current_step or 0
    
    # Create workflow action
    action = WorkflowStageAction(
        onboarding_request_id=request_id,
        workflow_config_id=onboarding_request.workflow_config_id,
        step_number=current_step,
        action_type=WorkflowActionType.FORWARD,
        performed_by=current_user.id,
        comments=forward_data.comments,
        forwarded_to=forward_data.forwarded_to
    )
    db.add(action)
    
    # Update onboarding request
    onboarding_request.assigned_to = forward_data.forwarded_to
    db.commit()
    db.refresh(action)
    
    # Audit trail
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.WORKFLOW_FORWARDED,
        resource_type="onboarding_request",
        resource_id=str(request_id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={
            "forwarded_to": str(forward_data.forwarded_to),
            "step_number": current_step,
            "comments": forward_data.comments
        },
        ip_address=http_request.client.host if http_request and http_request.client else None,
        user_agent=http_request.headers.get("user-agent") if http_request else None
    )
    
    # Create workflow audit trail entry
    audit_trail = WorkflowAuditTrail(
        tenant_id=current_user.tenant_id,
        onboarding_request_id=request_id,
        agent_id=onboarding_request.agent_id,
        user_id=current_user.id,
        action="forward",
        workflow_config_id=onboarding_request.workflow_config_id,
        step_number=current_step,
        action_details={
            "forwarded_to": str(forward_data.forwarded_to),
            "forwarded_to_name": forwarded_user.name if forwarded_user else None
        },
        comments=forward_data.comments,
        previous_status=onboarding_request.status,
        new_status=onboarding_request.status,
        ip_address=http_request.client.host if http_request and http_request.client else None,
        user_agent=http_request.headers.get("user-agent") if http_request else None
    )
    db.add(audit_trail)
    db.commit()
    
    return WorkflowActionResponse(
        id=str(action.id),
        action_type=action.action_type.value,
        performed_by=str(action.performed_by),
        performed_at=action.performed_at.isoformat(),
        comments=action.comments,
        forwarded_to=str(action.forwarded_to) if action.forwarded_to else None,
        step_number=action.step_number
    )


@router.post("/onboarding-requests/{request_id}/comment", response_model=WorkflowActionResponse)
async def add_workflow_comment(
    request_id: UUID,
    comment_data: CommentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    http_request: Request = None
):
    """Add comment to workflow"""
    # Get onboarding request
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.id == request_id
    ).first()
    
    if not onboarding_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding request not found"
        )
    
    # Get current step
    current_step = comment_data.step_number or onboarding_request.current_step or 0
    
    # Create workflow action
    action = WorkflowStageAction(
        onboarding_request_id=request_id,
        workflow_config_id=onboarding_request.workflow_config_id,
        step_number=current_step,
        action_type=WorkflowActionType.COMMENT,
        performed_by=current_user.id,
        comments=comment_data.comments
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    
    # Audit trail
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.WORKFLOW_COMMENT,
        resource_type="onboarding_request",
        resource_id=str(request_id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={
            "step_number": current_step,
            "comments": comment_data.comments
        },
        ip_address=http_request.client.host if http_request and http_request.client else None,
        user_agent=http_request.headers.get("user-agent") if http_request else None
    )
    
    # Create workflow audit trail entry
    audit_trail = WorkflowAuditTrail(
        tenant_id=current_user.tenant_id,
        onboarding_request_id=request_id,
        agent_id=onboarding_request.agent_id,
        user_id=current_user.id,
        action="comment",
        workflow_config_id=onboarding_request.workflow_config_id,
        step_number=current_step,
        action_details={},
        comments=comment_data.comments,
        previous_status=onboarding_request.status,
        new_status=onboarding_request.status,
        ip_address=http_request.client.host if http_request and http_request.client else None,
        user_agent=http_request.headers.get("user-agent") if http_request else None
    )
    db.add(audit_trail)
    db.commit()
    
    return WorkflowActionResponse(
        id=str(action.id),
        action_type=action.action_type.value,
        performed_by=str(action.performed_by),
        performed_at=action.performed_at.isoformat(),
        comments=action.comments,
        forwarded_to=None,
        step_number=action.step_number
    )


@router.get("/onboarding-requests/{request_id}/actions", response_model=list[WorkflowActionResponse])
async def get_workflow_actions(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all actions for a workflow"""
    # Get onboarding request
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.id == request_id
    ).first()
    
    if not onboarding_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding request not found"
        )
    
    # Check permissions
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    is_admin = user_role in ["tenant_admin", "platform_admin"]
    
    if not is_admin and onboarding_request.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get all actions
    actions = db.query(WorkflowStageAction).filter(
        WorkflowStageAction.onboarding_request_id == request_id
    ).order_by(WorkflowStageAction.performed_at.desc()).all()
    
    return [
        WorkflowActionResponse(
            id=str(action.id),
            action_type=action.action_type.value,
            performed_by=str(action.performed_by),
            performed_at=action.performed_at.isoformat(),
            comments=action.comments,
            forwarded_to=str(action.forwarded_to) if action.forwarded_to else None,
            step_number=action.step_number
        )
        for action in actions
    ]


@router.get("/onboarding-requests/{request_id}/audit-trail")
async def get_workflow_audit_trail(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive audit trail for a workflow"""
    # Get onboarding request
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.id == request_id
    ).first()
    
    if not onboarding_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding request not found"
        )
    
    # Check permissions
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    is_admin = user_role in ["tenant_admin", "platform_admin"]
    
    if not is_admin and onboarding_request.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get audit trail
    audit_trails = db.query(WorkflowAuditTrail).filter(
        WorkflowAuditTrail.onboarding_request_id == request_id
    ).order_by(WorkflowAuditTrail.created_at.desc()).all()
    
    return [
        {
            "id": str(trail.id),
            "user_id": str(trail.user_id),
            "action": trail.action,
            "step_number": trail.step_number,
            "step_name": trail.step_name,
            "comments": trail.comments,
            "action_details": trail.action_details,
            "previous_status": trail.previous_status,
            "new_status": trail.new_status,
            "created_at": trail.created_at.isoformat(),
            "ip_address": trail.ip_address,
            "user_agent": trail.user_agent
        }
        for trail in audit_trails
    ]

