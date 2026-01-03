"""
API endpoint to get stage settings for current workflow step
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.models.workflow_config import OnboardingRequest, WorkflowConfiguration
from app.api.v1.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow-stage-settings", tags=["workflow-stage-settings"])


class StageSettingsResponse(BaseModel):
    """Stage settings response"""
    visible_fields: Optional[List[str]] = None
    email_notifications: Optional[Dict[str, Any]] = None
    layout_id: Optional[str] = None  # Form layout ID for approver screen tabs
    step_number: int
    step_name: str
    step_type: str


@router.get("/agent/{agent_id}", response_model=StageSettingsResponse)
async def get_stage_settings_for_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get stage settings for the current workflow step of an agent"""
    # Get onboarding request
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.agent_id == agent_id
    ).order_by(OnboardingRequest.created_at.desc()).first()
    
    if not onboarding_request:
        # Return default (show all fields)
        return StageSettingsResponse(
            visible_fields=None,
            email_notifications=None,
            layout_id=None,
            step_number=0,
            step_name="No Workflow",
            step_type="review"
        )
    
    # Check permissions
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    is_admin = user_role in ["tenant_admin", "platform_admin"]
    
    if not is_admin and onboarding_request.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get workflow config
    workflow_config = None
    if onboarding_request.workflow_config_id:
        workflow_config = db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.id == onboarding_request.workflow_config_id
        ).first()
    
    if not workflow_config or not workflow_config.workflow_steps:
        # Return default
        return StageSettingsResponse(
            visible_fields=None,
            email_notifications=None,
            layout_id=None,
            step_number=onboarding_request.current_step or 0,
            step_name="Unknown Step",
            step_type="review"
        )
    
    # Parse workflow_steps if it's a JSON string
    steps = workflow_config.workflow_steps
    if isinstance(steps, str):
        import json
        try:
            steps = json.loads(steps)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse workflow_steps JSON for agent {agent_id}: {steps}")
            steps = []
    
    if not isinstance(steps, list) or len(steps) == 0:
        # Return default
        return StageSettingsResponse(
            visible_fields=None,
            email_notifications=None,
            layout_id=None,
            step_number=onboarding_request.current_step or 0,
            step_name="Unknown Step",
            step_type="review"
        )
    
    # Find current step
    current_step_number = onboarding_request.current_step or 0
    current_step = None
    
    for step in steps:
        if step.get("step_number") == current_step_number:
            current_step = step
            break
    
    if not current_step:
        # Return default
        return StageSettingsResponse(
            visible_fields=None,
            email_notifications=None,
            layout_id=None,
            step_number=current_step_number,
            step_name="Unknown Step",
            step_type="review"
        )
    
    # Extract stage settings
    stage_settings = current_step.get("stage_settings", {})
    
    # Extract layout_id and convert to string if it's a UUID
    layout_id = stage_settings.get("layout_id")
    if layout_id:
        # Convert UUID to string if needed
        if isinstance(layout_id, UUID):
            layout_id = str(layout_id)
        elif not isinstance(layout_id, str):
            layout_id = str(layout_id)
    
    logger.info(f"Stage settings for agent {agent_id}, step {current_step_number}: layout_id={layout_id}")
    
    return StageSettingsResponse(
        visible_fields=stage_settings.get("visible_fields"),
        email_notifications=stage_settings.get("email_notifications"),
        layout_id=layout_id,  # IMPORTANT: Include layout_id from stage_settings (as string)
        step_number=current_step_number,
        step_name=current_step.get("step_name", "Unknown Step"),
        step_type=current_step.get("step_type", "review")
    )

