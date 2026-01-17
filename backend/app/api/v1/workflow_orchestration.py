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
import logging

logger = logging.getLogger(__name__)

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


@router.get("/status/{entity_type}/{entity_id}", response_model=Dict[str, Any])
async def get_workflow_status(
    entity_type: str,
    entity_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get workflow status for an entity (product, service, agent, vendor)
    
    Returns:
    - has_workflow: Whether a workflow exists for this entity
    - workflow_id: Workflow configuration ID
    - workflow_name: Workflow name
    - current_stage: Current workflow stage
    - current_stage_label: Human-readable stage label
    - progress_percentage: Progress percentage (0-100)
    - stages: List of workflow stages with status
    - status: Overall workflow status
    """
    from app.core.tenant_utils import get_effective_tenant_id
    from app.models.product import Product
    from app.models.service import Service
    from app.models.agent import Agent
    from app.models.vendor import Vendor
    
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    try:
        # Get entity
        entity = None
        entity_data = {}
        
        if entity_type == "product":
            entity = db.query(Product).filter(Product.id == entity_id).first()
            if entity:
                entity_data = {
                    "product_type": entity.product_type,
                    "category": entity.category,
                    "status": entity.status
                }
        elif entity_type == "service":
            entity = db.query(Service).filter(Service.id == entity_id).first()
            if entity:
                entity_data = {
                    "service_type": entity.service_type,
                    "category": entity.category,
                    "status": entity.status
                }
        elif entity_type == "agent":
            entity = db.query(Agent).filter(Agent.id == entity_id).first()
            if entity:
                entity_data = {
                    "type": entity.type,
                    "category": entity.category,
                    "status": entity.status
                }
        elif entity_type == "vendor":
            entity = db.query(Vendor).filter(Vendor.id == entity_id).first()
            if entity:
                entity_data = {
                    "status": entity.status
                }
        
        if not entity:
            return {
                "has_workflow": False,
                "error": f"{entity_type} not found"
            }
        
        # Check tenant access
        if hasattr(entity, 'tenant_id') and entity.tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Check if entity has workflow info in metadata first (fast path)
        workflow_id_from_metadata = None
        if hasattr(entity, 'extra_metadata') and entity.extra_metadata:
            workflow_id_from_metadata = entity.extra_metadata.get("workflow_id")
        
        # Get workflow for entity
        orchestration = WorkflowOrchestrationService(db, effective_tenant_id)
        
        # Determine request type based on entity type
        request_type_map = {
            "product": "product_qualification_workflow",
            "service": "service_qualification_workflow",
            "agent": "agent_onboarding_workflow",
            "vendor": "vendor_submission_workflow"
        }
        request_type = request_type_map.get(entity_type, f"{entity_type}_workflow")
        
        # Try to get workflow config - use metadata workflow_id if available for faster lookup
        workflow_config = None
        if workflow_id_from_metadata:
            try:
                from app.models.workflow_config import WorkflowConfiguration
                workflow_config = db.query(WorkflowConfiguration).filter(
                    WorkflowConfiguration.id == UUID(workflow_id_from_metadata),
                    WorkflowConfiguration.tenant_id == effective_tenant_id,
                    WorkflowConfiguration.status == "active"
                ).first()
            except Exception:
                pass  # Fall through to normal lookup
        
        # If not found via metadata, do normal lookup
        if not workflow_config:
            workflow_config = orchestration.get_workflow_for_entity(
                entity_type=entity_type,
                entity_data=entity_data,
                request_type=request_type
            )
        
        if not workflow_config:
            return {
                "has_workflow": False
            }
        
        # Get current stage from entity metadata or default to first stage
        current_stage = "new"
        if hasattr(entity, 'extra_metadata') and entity.extra_metadata:
            current_stage = entity.extra_metadata.get("workflow_stage", "new")
        elif hasattr(entity, 'workflow_stage'):
            current_stage = entity.workflow_stage or "new"
        
        # Calculate progress
        workflow_steps = workflow_config.workflow_steps or []
        if not isinstance(workflow_steps, list):
            workflow_steps = []
        
        total_steps = len(workflow_steps)
        current_step_index = 0
        
        # Find current step index - check both "stage" and "step_name" fields
        for i, step in enumerate(workflow_steps):
            if not isinstance(step, dict):
                continue
            step_stage = step.get("stage") or step.get("workflow_stage")
            if step_stage == current_stage:
                current_step_index = i
                break
        
        progress_percentage = int((current_step_index / total_steps * 100)) if total_steps > 0 else 0
        
        # Build stages list
        stages = []
        for i, step in enumerate(workflow_steps):
            if not isinstance(step, dict):
                continue
            step_stage = step.get("stage") or step.get("workflow_stage") or "new"
            step_label = step.get("step_name") or step.get("name") or step_stage.replace("_", " ").title()
            
            if step_stage == current_stage:
                stage_status = "current"
            elif i < current_step_index:
                stage_status = "completed"
            else:
                stage_status = "pending"
            
            stages.append({
                "stage": step_stage,
                "label": step_label,
                "status": stage_status
            })
        
        # Determine overall status
        status = current_stage
        if current_stage in ["approved", "closed"]:
            status = "approved"
        elif current_stage in ["rejected", "cancelled"]:
            status = "rejected"
        elif current_stage in ["pending_approval", "pending_review"]:
            status = "pending_review"
        elif current_stage in ["in_progress"]:
            status = "in_progress"
        elif current_stage in ["needs_revision"]:
            status = "needs_revision"
        else:
            status = "draft"
        
        return {
            "has_workflow": True,
            "workflow_id": str(workflow_config.id),
            "workflow_name": workflow_config.name,
            "current_stage": current_stage,
            "current_stage_label": stages[current_step_index]["label"] if stages else current_stage.replace("_", " ").title(),
            "progress_percentage": progress_percentage,
            "stages": stages,
            "status": status
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workflow status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get workflow status: {str(e)}"
        )

