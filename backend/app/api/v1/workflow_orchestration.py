"""
Generic Workflow Orchestration API
Provides endpoints for workflow orchestration with automatic view generation
"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import Dict, Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.workflow_orchestration import WorkflowOrchestrationService

router = APIRouter()


class ViewStructureRequest(BaseModel):
    """Request for generating view structure"""
    entity_name: str = Field(..., description="Entity name (e.g., 'agents', 'vendors')")
    request_type: str = Field(..., description="Request type (e.g., 'agent_onboarding_workflow')")
    workflow_stage: str = Field(..., description="Workflow stage (e.g., 'new', 'pending_approval')")
    entity_id: Optional[str] = Field(None, description="Entity ID (e.g., agent ID) - required for generating connection diagrams")
    agent_type: Optional[str] = None
    agent_category: Optional[str] = None


class TransitionRequest(BaseModel):
    """Request for workflow stage transition"""
    entity_type: str = Field(..., description="Entity type (e.g., 'agent', 'vendor')")
    entity_id: str = Field(..., description="Entity ID")
    entity_data: Dict[str, Any] = Field(..., description="Entity data")
    request_type: str = Field(..., description="Request type")
    current_stage: str = Field(..., description="Current workflow stage")
    target_stage: str = Field(..., description="Target workflow stage")
    transition_data: Optional[Dict[str, Any]] = None


@router.post("/view-structure", response_model=Dict[str, Any])
async def generate_view_structure(
    request: ViewStructureRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate view structure (tabs/sections) automatically from layout + permissions
    
    This endpoint automatically generates the view structure based on:
    - Layout configuration for the workflow stage
    - Hierarchical permissions (Entity → Field → Layout)
    - User's role
    
    No hardcoding required - everything is configuration-driven!
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    try:
        orchestration = WorkflowOrchestrationService(db, effective_tenant_id)
        
        entity_id = UUID(request.entity_id) if request.entity_id else None
        
        view_structure = orchestration.generate_view_structure(
            entity_name=request.entity_name,
            request_type=request.request_type,
            workflow_stage=request.workflow_stage,
            user_role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
            agent_type=request.agent_type,
            agent_category=request.agent_category,
            entity_id=entity_id
        )
        
        return view_structure
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate view structure: {str(e)}"
        )


@router.post("/transition", response_model=Dict[str, Any])
async def transition_workflow_stage(
    request: TransitionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Transition entity to a new workflow stage
    
    This orchestrates the entire transition:
    1. Evaluate business rules
    2. Validate transition
    3. Update entity state
    4. Send email notifications
    5. Schedule reminders
    6. Return new view structure
    
    All configured in workflow stages - no hardcoding!
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    try:
        orchestration = WorkflowOrchestrationService(db, effective_tenant_id)
        
        result = orchestration.transition_to_stage(
            entity_type=request.entity_type,
            entity_id=UUID(request.entity_id),
            entity_data=request.entity_data,
            request_type=request.request_type,
            current_stage=request.current_stage,
            target_stage=request.target_stage,
            user=current_user,
            transition_data=request.transition_data
        )
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to transition workflow stage: {str(e)}"
        )


@router.post("/evaluate-rules", response_model=Dict[str, Any])
async def evaluate_stage_rules(
    entity_type: str = Body(..., description="Entity type"),
    entity_id: str = Body(..., description="Entity ID"),
    entity_data: Dict[str, Any] = Body(..., description="Entity data"),
    request_type: str = Body(..., description="Request type"),
    workflow_stage: str = Body(..., description="Workflow stage"),
    auto_execute: bool = Body(True, description="Auto-execute actions"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Evaluate business rules for a workflow stage
    
    Rules are evaluated based on:
    - Entity type and data
    - Workflow stage
    - User context
    
    Actions are executed automatically if auto_execute=True
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    try:
        orchestration = WorkflowOrchestrationService(db, effective_tenant_id)
        
        result = orchestration.evaluate_business_rules_for_stage(
            entity_type=entity_type,
            entity_id=UUID(entity_id),
            entity_data=entity_data,
            request_type=request_type,
            workflow_stage=workflow_stage,
            user=current_user,
            auto_execute=auto_execute
        )
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate rules: {str(e)}"
        )

