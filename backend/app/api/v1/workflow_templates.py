"""
Workflow Templates API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.core.tenant_utils import get_effective_tenant_id
from app.services.workflow_templates import WorkflowTemplatesService
from app.models.workflow_config import WorkflowConfiguration
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow-templates", tags=["workflow-templates"])


class WorkflowTemplateResponse(BaseModel):
    """Workflow template response schema"""
    id: str
    name: str
    description: str
    category: str
    entity_types: List[str]


class WorkflowTemplateCreate(BaseModel):
    """Workflow template creation schema"""
    template_name: str
    customizations: Optional[Dict[str, Any]] = None


@router.get("", response_model=List[WorkflowTemplateResponse])
async def list_workflow_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all available workflow templates"""
    templates = WorkflowTemplatesService.list_available_templates()
    return templates


@router.post("", response_model=Dict[str, Any])
async def create_workflow_from_template(
    template_data: WorkflowTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a workflow configuration from a template"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to create workflows"
            )
        
        workflow = WorkflowTemplatesService.create_workflow_from_template(
            template_name=template_data.template_name,
            tenant_id=effective_tenant_id,
            created_by=current_user.id,
            db=db,
            customizations=template_data.customizations
        )
        
        return {
            "id": str(workflow.id),
            "name": workflow.name,
            "description": workflow.description,
            "status": workflow.status,
            "message": f"Workflow created successfully from template {template_data.template_name}"
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating workflow from template: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create workflow from template"
        )
