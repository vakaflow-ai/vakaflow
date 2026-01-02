"""
Studio API - Agent collection and flow building
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.agentic_flow import (
    AgenticFlow, FlowExecution, FlowStatus, FlowExecutionStatus
)
from app.services.studio_service import StudioService
from app.services.flow_execution_service import FlowExecutionService
from app.core.audit import audit_service, AuditAction
from datetime import datetime
import logging
import asyncio
from sqlalchemy import or_

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/studio", tags=["Studio"])


# Pydantic models
class StudioAgentResponse(BaseModel):
    id: str
    name: str
    agent_type: str
    description: Optional[str] = None
    source: str  # vaka, external, marketplace
    source_agent_id: Optional[str] = None
    mcp_connection_id: Optional[str] = None
    mcp_connection_name: Optional[str] = None
    platform_name: Optional[str] = None
    skills: List[str]
    capabilities: Optional[dict] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    icon_url: Optional[str] = None
    is_available: bool
    is_featured: bool
    usage_count: int
    last_used_at: Optional[str] = None
    # Master data attributes
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
    department: Optional[str] = None
    organization: Optional[str] = None
    master_data_attributes: Optional[dict] = None


class AgenticFlowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    flow_definition: dict
    tags: Optional[List[str]] = []
    is_template: bool = False
    max_concurrent_executions: int = 10
    timeout_seconds: Optional[int] = None
    retry_on_failure: bool = False
    retry_count: int = 0
    context_id_template: Optional[str] = None  # Template or fixed value for context_id
    context_type_default: Optional[str] = None  # Default context type


class AgenticFlowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    status: str
    is_template: bool
    tags: Optional[List[str]]
    flow_definition: dict
    context_id_template: Optional[str] = None
    context_type_default: Optional[str] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class FlowExecutionRequest(BaseModel):
    context_id: Optional[str] = None
    context_type: Optional[str] = None
    trigger_data: Optional[dict] = {}


@router.get("/agents", response_model=List[StudioAgentResponse])
async def get_studio_agents(
    agent_type: Optional[str] = None,
    skill: Optional[str] = None,
    source: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all agents available in Studio (VAKA + external)
    
    Returns collection of agents from:
    - VAKA (built-in agents)
    - External platforms (via MCP)
    - Marketplace (future)
    """
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access agents"
        )
    
    tenant_id = effective_tenant_id
    
    studio_service = StudioService(db)
    agents = await studio_service.get_studio_agents(
        tenant_id=tenant_id,
        agent_type=agent_type,
        skill=skill,
        source=source,
        category=category
    )
    
    return agents


@router.get("/agents/{agent_id}", response_model=StudioAgentResponse)
async def get_studio_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single agent by ID"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access agents"
        )
    
    tenant_id = effective_tenant_id
    
    studio_service = StudioService(db)
    agent = await studio_service.get_studio_agent(
        tenant_id=tenant_id,
        agent_id=agent_id
    )
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found"
        )
    
    return agent


class AgentUpdateRequest(BaseModel):
    """Request model for updating agent settings"""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    icon_url: Optional[str] = None
    is_available: Optional[bool] = None
    is_featured: Optional[bool] = None
    capabilities: Optional[dict] = None
    # Master data attributes
    owner_id: Optional[str] = None
    department: Optional[str] = None
    organization: Optional[str] = None
    master_data_attributes: Optional[dict] = None


@router.patch("/agents/{agent_id}", response_model=StudioAgentResponse)
async def update_studio_agent(
    agent_id: str,
    updates: AgentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update agent settings (business info and properties)"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Convert to dict - use exclude_none=False to include null values (for clearing fields)
    # But exclude_unset=True to only include fields that were explicitly provided
    update_dict = updates.dict(exclude_unset=True, exclude_none=False)
    logger.info(f"Updating agent {agent_id} with fields: {list(update_dict.keys())}")
    logger.debug(f"Update data: {update_dict}")
    
    studio_service = StudioService(db)
    
    try:
        updated_agent = await studio_service.update_studio_agent(
            tenant_id=effective_tenant_id,
            agent_id=agent_id,
            updates=update_dict
        )
        
        if not updated_agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent {agent_id} not found"
            )
        
        logger.info(f"Successfully updated agent {agent_id}")
        return updated_agent
    except ValueError as e:
        logger.error(f"Validation error updating agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error updating agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update agent: {str(e)}"
        )


class AgentExecutionRequest(BaseModel):
    """Request model for agent execution"""
    source: str
    skill: str
    input_data: dict
    mcp_connection_id: Optional[UUID] = None


@router.post("/agents/{agent_id}/execute")
async def execute_studio_agent(
    agent_id: str,
    request: AgentExecutionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute an agent skill from Studio"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    studio_service = StudioService(db)
    
    try:
        result = await studio_service.execute_agent_in_studio(
            tenant_id=effective_tenant_id,
            agent_id=agent_id,
            source=request.source,
            skill=request.skill,
            input_data=request.input_data,
            mcp_connection_id=request.mcp_connection_id
        )
        return {"success": True, "result": result}
    except ValueError as e:
        logger.error(f"Agent execution validation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent execution validation failed: {str(e)}"
        )
    except KeyError as e:
        logger.error(f"Agent execution missing required field: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required field: {str(e)}"
        )
    except Exception as e:
        error_type = type(e).__name__
        error_message = str(e)
        logger.error(
            f"Agent execution failed: {error_type}: {error_message}",
            exc_info=True,
            extra={
                "agent_id": agent_id,
                "skill": request.skill,
                "source": request.source,
                "error_type": error_type
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent execution failed: {error_message}"
        )


@router.post("/flows", response_model=AgenticFlowResponse, status_code=status.HTTP_201_CREATED)
async def create_flow(
    flow_data: AgenticFlowCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new agentic AI flow"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    flow = AgenticFlow(
        tenant_id=effective_tenant_id,
        name=flow_data.name,
        description=flow_data.description,
        category=flow_data.category,
        flow_definition=flow_data.flow_definition,
        tags=flow_data.tags,
        is_template=flow_data.is_template,
        status=FlowStatus.DRAFT.value,
        max_concurrent_executions=flow_data.max_concurrent_executions,
        timeout_seconds=flow_data.timeout_seconds,
        retry_on_failure=flow_data.retry_on_failure,
        retry_count=flow_data.retry_count,
        context_id_template=flow_data.context_id_template,
        context_type_default=flow_data.context_type_default,
        created_by=current_user.id
    )
    
    db.add(flow)
    db.commit()
    db.refresh(flow)
    
    # Convert to response model with proper serialization
    return AgenticFlowResponse(
        id=str(flow.id),
        name=flow.name,
        description=flow.description,
        category=flow.category,
        status=flow.status,
        is_template=flow.is_template,
        tags=flow.tags or [],
        flow_definition=flow.flow_definition,
        created_at=flow.created_at.isoformat() if flow.created_at else "",
        updated_at=flow.updated_at.isoformat() if flow.updated_at else ""
    )


@router.get("/flows", response_model=List[AgenticFlowResponse])
async def list_flows(
    category: Optional[str] = None,
    status: Optional[str] = None,
    is_template: Optional[bool] = None,
    include_shared: bool = False,  # Include shared templates from other tenants
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List agentic AI flows"""
    # Tenant isolation - ALL users (including platform_admin) must filter by tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access flows"
        )
    
    # Include tenant's own flows
    tenant_flows = db.query(AgenticFlow).filter(
        AgenticFlow.tenant_id == effective_tenant_id
    )
    
    # Include shared flows if requested
    if include_shared:
        shared_flows = db.query(AgenticFlow).filter(
            AgenticFlow.is_shared == True,
            AgenticFlow.tenant_id != effective_tenant_id,
            or_(
                AgenticFlow.shared_with_tenants.is_(None),  # Shared with all
                AgenticFlow.shared_with_tenants.contains([str(effective_tenant_id)])  # Shared with this tenant
            )
        )
        query = tenant_flows.union(shared_flows)
    else:
        query = tenant_flows
    
    # Filter by version (only current versions)
    query = query.filter(AgenticFlow.is_current_version == True)
    
    if category:
        query = query.filter(AgenticFlow.category == category)
    
    if status:
        query = query.filter(AgenticFlow.status == status)
    
    if is_template is not None:
        query = query.filter(AgenticFlow.is_template == is_template)
    
    flows = query.order_by(AgenticFlow.created_at.desc()).all()
    # Convert to response models with proper serialization
    return [
        AgenticFlowResponse(
            id=str(flow.id),
            name=flow.name,
            description=flow.description,
            category=flow.category,
            status=flow.status,
            is_template=flow.is_template,
            tags=flow.tags or [],
            flow_definition=flow.flow_definition,
            context_id_template=flow.context_id_template,
            context_type_default=flow.context_type_default,
            created_at=flow.created_at.isoformat() if flow.created_at else "",
            updated_at=flow.updated_at.isoformat() if flow.updated_at else ""
        )
        for flow in flows
    ]


@router.get("/flows/templates", response_model=List[AgenticFlowResponse])
async def list_flow_templates(
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List available flow templates"""
    # All authenticated users can view templates
    query = db.query(AgenticFlow).filter(
        AgenticFlow.is_template == True,
        AgenticFlow.status == FlowStatus.ACTIVE.value  # Only show active templates
    )
    
    # Filter by tenant (show tenant's templates and platform-wide templates)
    if current_user.tenant_id:
        from sqlalchemy import or_
        query = query.filter(
            or_(
                AgenticFlow.tenant_id == effective_tenant_id,
                AgenticFlow.tenant_id.is_(None)  # Platform-wide templates
            )
        )
    
    if category:
        query = query.filter(AgenticFlow.category == category)
    
    if search:
        query = query.filter(
            or_(
                AgenticFlow.name.ilike(f"%{search}%"),
                AgenticFlow.description.ilike(f"%{search}%")
            )
        )
    
    templates = query.order_by(AgenticFlow.created_at.desc()).all()
    
    return [
        AgenticFlowResponse(
            id=str(template.id),
            name=template.name,
            description=template.description,
            category=template.category,
            status=template.status,
            is_template=template.is_template,
            tags=template.tags or [],
            flow_definition=template.flow_definition,
            context_id_template=template.context_id_template,
            context_type_default=template.context_type_default,
            created_at=template.created_at.isoformat() if template.created_at else "",
            updated_at=template.updated_at.isoformat() if template.updated_at else ""
        )
        for template in templates
    ]


@router.post("/flows/{flow_id}/share", response_model=dict)
async def share_flow(
    flow_id: UUID,
    shared_with_tenants: Optional[List[UUID]] = None,  # None = share with all tenants
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Share a flow with other tenants"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Only tenant admins and platform admins can share flows
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can share flows"
        )
    
    flow = db.query(AgenticFlow).filter(
        AgenticFlow.id == flow_id,
        AgenticFlow.tenant_id == current_user.tenant_id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    # Update sharing settings
    flow.is_shared = True
    if shared_with_tenants:
        flow.shared_with_tenants = [str(tid) for tid in shared_with_tenants]
    else:
        flow.shared_with_tenants = None  # Share with all tenants
    
    flow.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="agentic_flow",
        resource_id=str(flow_id),
        tenant_id=str(effective_tenant_id),
        details={
            "action": "share_flow",
            "shared_with_tenants": flow.shared_with_tenants,
            "shared_with_all": shared_with_tenants is None
        }
    )
    
    return {
        "message": "Flow shared successfully",
        "flow_id": str(flow_id),
        "is_shared": flow.is_shared,
        "shared_with_tenants": flow.shared_with_tenants
    }


@router.post("/flows/{flow_id}/unshare", response_model=dict)
async def unshare_flow(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stop sharing a flow with other tenants"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Only tenant admins and platform admins can unshare flows
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can unshare flows"
        )
    
    flow = db.query(AgenticFlow).filter(
        AgenticFlow.id == flow_id,
        AgenticFlow.tenant_id == current_user.tenant_id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    # Update sharing settings
    flow.is_shared = False
    flow.shared_with_tenants = None
    flow.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="agentic_flow",
        resource_id=str(flow_id),
        tenant_id=str(effective_tenant_id),
        details={"action": "unshare_flow"}
    )
    
    return {
        "message": "Flow unshared successfully",
        "flow_id": str(flow_id),
        "is_shared": False
    }


@router.post("/flows/templates/{template_id}/instantiate", response_model=AgenticFlowResponse, status_code=status.HTTP_201_CREATED)
async def instantiate_flow_from_template(
    template_id: UUID,
    name: Optional[str] = None,
    description: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new flow from a template"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Get template (can be from any tenant if shared or platform-wide)
    template = db.query(AgenticFlow).filter(
        AgenticFlow.id == template_id,
        AgenticFlow.is_template == True
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    # Check access (tenant's own template, shared template, or platform-wide template)
    if template.tenant_id and template.tenant_id != current_user.tenant_id:
        # Check if template is shared
        if not template.is_shared:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Template not accessible"
            )
        # Check if shared with this tenant
        if template.shared_with_tenants and str(effective_tenant_id) not in template.shared_with_tenants:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Template not shared with your tenant"
            )
    
    # Create new flow from template
    new_flow = AgenticFlow(
        tenant_id=effective_tenant_id,
        name=name or f"{template.name} (Copy)",
        description=description or template.description,
        category=template.category,
        flow_definition=template.flow_definition,  # Copy flow definition
        tags=template.tags.copy() if template.tags else [],
        is_template=False,  # New flow is not a template
        status=FlowStatus.DRAFT.value,  # Start as draft
        max_concurrent_executions=template.max_concurrent_executions,
        timeout_seconds=template.timeout_seconds,
        retry_on_failure=template.retry_on_failure,
        retry_count=template.retry_count,
        context_id_template=template.context_id_template,
        context_type_default=template.context_type_default,
        version=1,  # New flow starts at version 1
        is_current_version=True,
        created_by=current_user.id
    )
    
    db.add(new_flow)
    db.commit()
    db.refresh(new_flow)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="agentic_flow",
        resource_id=str(new_flow.id),
        tenant_id=str(effective_tenant_id),
        details={
            "created_from_template": str(template_id),
            "template_name": template.name
        }
    )
    
    return AgenticFlowResponse(
        id=str(new_flow.id),
        name=new_flow.name,
        description=new_flow.description,
        category=new_flow.category,
        status=new_flow.status,
        is_template=new_flow.is_template,
        tags=new_flow.tags or [],
        flow_definition=new_flow.flow_definition,
        context_id_template=new_flow.context_id_template,
        context_type_default=new_flow.context_type_default,
        created_at=new_flow.created_at.isoformat() if new_flow.created_at else "",
        updated_at=new_flow.updated_at.isoformat() if new_flow.updated_at else ""
    )


class FlowUpdateRequest(BaseModel):
    """Request model for updating flow settings"""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    is_template: Optional[bool] = None
    flow_definition: Optional[dict] = None  # Allow updating flow definition (nodes, edges)
    max_concurrent_executions: Optional[int] = None
    timeout_seconds: Optional[int] = None
    retry_on_failure: Optional[bool] = None
    retry_count: Optional[int] = None
    context_id_template: Optional[str] = None  # Template or fixed value for context_id
    context_type_default: Optional[str] = None  # Default context type
    create_new_version: Optional[bool] = False  # If True, create a new version instead of updating current


@router.patch("/flows/{flow_id}", response_model=AgenticFlowResponse)
async def update_flow(
    flow_id: UUID,
    updates: FlowUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update flow settings"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    flow = db.query(AgenticFlow).filter(
        AgenticFlow.id == flow_id,
        AgenticFlow.tenant_id == current_user.tenant_id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flow {flow_id} not found"
        )
    
    # Update fields
    update_dict = updates.dict(exclude_unset=True)
    create_new_version = update_dict.pop('create_new_version', False)
    
    if create_new_version:
        # Create a new version of the flow
        # Mark current version as not current
        flow.is_current_version = False
        
        # Create new version
        new_version = AgenticFlow(
            tenant_id=flow.tenant_id,
            name=update_dict.get('name', flow.name),
            description=update_dict.get('description', flow.description),
            category=update_dict.get('category', flow.category),
            flow_definition=update_dict.get('flow_definition', flow.flow_definition),
            tags=update_dict.get('tags', flow.tags),
            is_template=update_dict.get('is_template', flow.is_template),
            status=update_dict.get('status', flow.status),
            max_concurrent_executions=update_dict.get('max_concurrent_executions', flow.max_concurrent_executions),
            timeout_seconds=update_dict.get('timeout_seconds', flow.timeout_seconds),
            retry_on_failure=update_dict.get('retry_on_failure', flow.retry_on_failure),
            retry_count=update_dict.get('retry_count', flow.retry_count),
            context_id_template=update_dict.get('context_id_template', flow.context_id_template),
            context_type_default=update_dict.get('context_type_default', flow.context_type_default),
            version=flow.version + 1,
            parent_flow_id=flow.parent_flow_id or flow.id,  # First version points to itself
            is_current_version=True,
            is_shared=flow.is_shared,
            shared_with_tenants=flow.shared_with_tenants,
            created_by=current_user.id
        )
        
        db.add(new_version)
        db.commit()
        db.refresh(new_version)
        flow = new_version
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.CREATE,
            resource_type="agentic_flow",
            resource_id=str(new_version.id),
            tenant_id=str(effective_tenant_id),
            details={
                "action": "create_version",
                "parent_flow_id": str(new_version.parent_flow_id or new_version.id),
                "version": new_version.version
            }
        )
    else:
        # Update existing flow
        for key, value in update_dict.items():
            if hasattr(flow, key):
                setattr(flow, key, value)
        
        # If flow_definition is being updated, ensure all node properties are preserved
        if 'flow_definition' in update_dict and update_dict['flow_definition']:
            flow_def = update_dict['flow_definition']
            if 'nodes' in flow_def:
                # Log node properties to ensure customAttributes, name, etc. are preserved
                for node in flow_def['nodes']:
                    logger.debug(
                        f"Updating node {node.get('id')} with properties: "
                        f"name={node.get('name')}, "
                        f"customAttributes={bool(node.get('customAttributes'))}, "
                        f"agenticConfig={bool(node.get('agenticConfig'))}"
                    )
        
        flow.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(flow)
    
    return {
        "id": str(flow.id),
        "name": flow.name,
        "description": flow.description,
        "category": flow.category,
        "status": flow.status,
        "is_template": flow.is_template,
        "tags": flow.tags,
        "flow_definition": flow.flow_definition,
        "context_id_template": flow.context_id_template,
        "context_type_default": flow.context_type_default,
        "created_at": flow.created_at.isoformat(),
        "updated_at": flow.updated_at.isoformat()
    }


@router.delete("/flows/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a flow"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    flow = db.query(AgenticFlow).filter(
        AgenticFlow.id == flow_id,
        AgenticFlow.tenant_id == current_user.tenant_id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flow {flow_id} not found"
        )
    
    # Delete flow (cascade will delete executions and node executions)
    db.delete(flow)
    db.commit()
    
    return None


@router.get("/flows/{flow_id}", response_model=AgenticFlowResponse)
async def get_flow(
    flow_id: UUID,
    version: Optional[int] = None,  # Get specific version (default: current)
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get agentic AI flow by ID"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Build query
    query = db.query(AgenticFlow).filter(AgenticFlow.id == flow_id)
    
    # If version specified, get that version; otherwise get current version
    if version:
        query = query.filter(AgenticFlow.version == version)
    else:
        query = query.filter(AgenticFlow.is_current_version == True)
    
    flow = query.first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    # Check access (tenant's own flow or shared flow)
    if flow.tenant_id != current_user.tenant_id:
        if not flow.is_shared:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Flow not accessible"
            )
        # Check if shared with this tenant
        if flow.shared_with_tenants and str(current_user.tenant_id) not in flow.shared_with_tenants:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Flow not shared with your tenant"
            )
    
    # Convert to response model with proper serialization
    return AgenticFlowResponse(
        id=str(flow.id),
        name=flow.name,
        description=flow.description,
        category=flow.category,
        status=flow.status,
        is_template=flow.is_template,
        tags=flow.tags or [],
        flow_definition=flow.flow_definition,
        context_id_template=flow.context_id_template,
        context_type_default=flow.context_type_default,
        created_at=flow.created_at.isoformat() if flow.created_at else "",
        updated_at=flow.updated_at.isoformat() if flow.updated_at else ""
    )


@router.get("/flows/{flow_id}/versions", response_model=List[dict])
async def list_flow_versions(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all versions of a flow"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Get the flow to check access
    flow = db.query(AgenticFlow).filter(AgenticFlow.id == flow_id).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    # Check access
    if flow.tenant_id != current_user.tenant_id:
        if not flow.is_shared:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Flow not accessible"
            )
    
    # Get parent flow ID (first version's ID)
    parent_flow_id = flow.parent_flow_id or flow.id
    
    # Get all versions
    versions = db.query(AgenticFlow).filter(
        or_(
            AgenticFlow.id == parent_flow_id,
            AgenticFlow.parent_flow_id == parent_flow_id
        )
    ).order_by(AgenticFlow.version.desc()).all()
    
    return [
        {
            "id": str(v.id),
            "version": v.version,
            "name": v.name,
            "is_current_version": v.is_current_version,
            "created_at": v.created_at.isoformat() if v.created_at else "",
            "updated_at": v.updated_at.isoformat() if v.updated_at else "",
            "created_by": str(v.created_by) if v.created_by else None
        }
        for v in versions
    ]


@router.post("/flows/{flow_id}/restore-version", response_model=AgenticFlowResponse)
async def restore_flow_version(
    flow_id: UUID,
    version: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restore a specific version of a flow (creates new version from old one)"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Get the flow to check access
    current_flow = db.query(AgenticFlow).filter(
        AgenticFlow.id == flow_id,
        AgenticFlow.is_current_version == True
    ).first()
    
    if not current_flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    # Check access
    if current_flow.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only flow owner can restore versions"
        )
    
    # Get parent flow ID
    parent_flow_id = current_flow.parent_flow_id or current_flow.id
    
    # Get the version to restore
    version_flow = db.query(AgenticFlow).filter(
        or_(
            AgenticFlow.id == parent_flow_id,
            AgenticFlow.parent_flow_id == parent_flow_id
        ),
        AgenticFlow.version == version
    ).first()
    
    if not version_flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version} not found"
        )
    
    # Mark current version as not current
    current_flow.is_current_version = False
    
    # Create new version from the restored version
    new_version = AgenticFlow(
        tenant_id=current_flow.tenant_id,
        name=version_flow.name,
        description=version_flow.description,
        category=version_flow.category,
        flow_definition=version_flow.flow_definition,
        tags=version_flow.tags.copy() if version_flow.tags else [],
        is_template=version_flow.is_template,
        status=version_flow.status,
        max_concurrent_executions=version_flow.max_concurrent_executions,
        timeout_seconds=version_flow.timeout_seconds,
        retry_on_failure=version_flow.retry_on_failure,
        retry_count=version_flow.retry_count,
        context_id_template=version_flow.context_id_template,
        context_type_default=version_flow.context_type_default,
        version=current_flow.version + 1,
        parent_flow_id=parent_flow_id,
        is_current_version=True,
        is_shared=current_flow.is_shared,
        shared_with_tenants=current_flow.shared_with_tenants,
        created_by=current_user.id
    )
    
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="agentic_flow",
        resource_id=str(new_version.id),
        tenant_id=str(effective_tenant_id),
        details={
            "action": "restore_version",
            "restored_from_version": version,
            "new_version": new_version.version
        }
    )
    
    return AgenticFlowResponse(
        id=str(new_version.id),
        name=new_version.name,
        description=new_version.description,
        category=new_version.category,
        status=new_version.status,
        is_template=new_version.is_template,
        tags=new_version.tags or [],
        flow_definition=new_version.flow_definition,
        context_id_template=new_version.context_id_template,
        context_type_default=new_version.context_type_default,
        created_at=new_version.created_at.isoformat() if new_version.created_at else "",
        updated_at=new_version.updated_at.isoformat() if new_version.updated_at else ""
    )


@router.post("/flows/{flow_id}/execute", status_code=status.HTTP_201_CREATED)
async def execute_flow(
    flow_id: UUID,
    execution_request: FlowExecutionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute an agentic AI flow (asynchronous - returns immediately)"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Get flow to check for configured context
    flow = db.query(AgenticFlow).filter(
        AgenticFlow.id == flow_id,
        AgenticFlow.tenant_id == current_user.tenant_id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    # Use flow's configured context if execution request doesn't provide it
    context_id = execution_request.context_id or flow.context_id_template
    context_type = execution_request.context_type or flow.context_type_default
    
    # Build trigger_data with context_id if available
    trigger_data = execution_request.trigger_data or {}
    if context_id and 'context_id' not in trigger_data:
        trigger_data['context_id'] = context_id
    
    flow_execution_service = FlowExecutionService(db)
    
    try:
        # Create execution record synchronously (quick operation)
        from app.models.agentic_flow import FlowExecution
        from uuid import uuid4
        from datetime import datetime
        
        execution = FlowExecution(
            id=uuid4(),
            flow_id=flow_id,
            tenant_id=effective_tenant_id,
            context_id=context_id,
            context_type=context_type,
            status=FlowExecutionStatus.PENDING.value,
            trigger_data=trigger_data,
            triggered_by=current_user.id,
            execution_data={},
            started_at=datetime.utcnow()
        )
        
        db.add(execution)
        db.commit()
        db.refresh(execution)
        
        # Start execution in background (non-blocking)
        async def run_flow_execution():
            """Background task to execute the flow"""
            try:
                # Create a new database session for background task
                from app.core.database import SessionLocal
                background_db = SessionLocal()
                try:
                    background_service = FlowExecutionService(background_db)
                    await background_service.execute_flow(
                        flow_id=flow_id,
                        tenant_id=effective_tenant_id,
                        context_id=context_id,
                        context_type=context_type,
                        trigger_data=trigger_data,
                        triggered_by=current_user.id,
                        execution_id=execution.id  # Use existing execution
                    )
                finally:
                    background_db.close()
            except Exception as e:
                error_type = type(e).__name__
                error_message = str(e)
                logger.error(
                    f"Background flow execution failed: {error_type}: {error_message}",
                    exc_info=True,
                    extra={
                        "execution_id": str(execution.id),
                        "flow_id": str(flow_id),
                        "error_type": error_type
                    }
                )
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Update execution status to failed
                try:
                    from app.core.database import SessionLocal
                    error_db = SessionLocal()
                    try:
                        failed_execution = error_db.query(FlowExecution).filter(
                            FlowExecution.id == execution.id
                        ).first()
                        if failed_execution:
                            failed_execution.status = FlowExecutionStatus.FAILED.value
                            # Provide more detailed error message
                            if isinstance(e, ValueError):
                                failed_execution.error_message = f"Validation error: {error_message}"
                            elif isinstance(e, KeyError):
                                failed_execution.error_message = f"Missing required field: {error_message}"
                            else:
                                failed_execution.error_message = f"Execution error: {error_message}"
                            failed_execution.completed_at = datetime.utcnow()
                            error_db.commit()
                    finally:
                        error_db.close()
                except Exception as db_error:
                    logger.error(f"Failed to update execution status: {db_error}", exc_info=True)
        
        # Add background task (FastAPI will execute it after response is sent)
        background_tasks.add_task(run_flow_execution)
        
        # Return immediately with execution ID
        return {
            "execution_id": str(execution.id),
            "status": execution.status,
            "flow_id": str(flow_id),
            "message": "Flow execution started. Check execution status for progress."
        }
    except ValueError as e:
        logger.error(f"Flow execution validation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}"
        )
    except KeyError as e:
        logger.error(f"Flow execution missing required field: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required field: {str(e)}"
        )
    except Exception as e:
        error_type = type(e).__name__
        error_message = str(e)
        logger.error(
            f"Flow execution setup failed: {error_type}: {error_message}",
            exc_info=True,
            extra={
                "flow_id": str(flow_id),
                "error_type": error_type
            }
        )
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Flow execution setup failed: {error_message}"
        )


@router.get("/flows/{flow_id}/executions", response_model=List[dict])
async def list_flow_executions(
    flow_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by execution status"),
    start_date: Optional[str] = Query(None, description="Start date filter (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date filter (ISO format)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List executions for a flow with filtering"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Verify flow belongs to tenant
    flow = db.query(AgenticFlow).filter(
        AgenticFlow.id == flow_id,
        AgenticFlow.tenant_id == current_user.tenant_id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    from app.models.agentic_flow import FlowExecution, FlowNodeExecution
    from datetime import datetime
    
    query = db.query(FlowExecution).filter(
        FlowExecution.flow_id == flow_id,
        FlowExecution.tenant_id == effective_tenant_id
    )
    
    # Apply filters
    if status:
        query = query.filter(FlowExecution.status == status)
    
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(FlowExecution.created_at >= start_dt)
        except ValueError:
            pass
    
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(FlowExecution.created_at <= end_dt)
        except ValueError:
            pass
    
    executions = query.order_by(FlowExecution.created_at.desc()).limit(limit).all()
    
    result = []
    for exec in executions:
        # Get node executions count (for summary)
        node_executions = db.query(FlowNodeExecution).filter(
            FlowNodeExecution.execution_id == exec.id
        ).all()
        
        result.append({
            "id": str(exec.id),
            "flow_id": str(exec.flow_id),
            "status": exec.status,
            "current_node_id": exec.current_node_id,
            "context_id": exec.context_id,
            "context_type": exec.context_type,
            "error_message": exec.error_message,
            "started_at": exec.started_at.isoformat() if exec.started_at else None,
            "completed_at": exec.completed_at.isoformat() if exec.completed_at else None,
            "duration_seconds": exec.duration_seconds,
            "created_at": exec.created_at.isoformat() if exec.created_at else None,
            "summary": {
                "total_nodes": len(node_executions),
                "completed_nodes": len([ne for ne in node_executions if ne.status == FlowExecutionStatus.COMPLETED.value]),
                "failed_nodes": len([ne for ne in node_executions if ne.status == FlowExecutionStatus.FAILED.value])
            }
        })
    
    return result


@router.get("/executions/{execution_id}", response_model=dict)
async def get_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution details with full history"""
    try:
        from app.core.tenant_utils import get_effective_tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant"
            )
        
        from app.models.agentic_flow import FlowExecution, FlowNodeExecution
        from app.models.user import User as UserModel
        
        execution = db.query(FlowExecution).filter(
            FlowExecution.id == execution_id,
            FlowExecution.tenant_id == effective_tenant_id
        ).first()
        
        if not execution:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution not found"
            )
        
        # Get flow details
        flow = db.query(AgenticFlow).filter(AgenticFlow.id == execution.flow_id).first()
        
        # Get triggered by user
        triggered_by_user = None
        if execution.triggered_by:
            triggered_by_user = db.query(UserModel).filter(UserModel.id == execution.triggered_by).first()
        
        # Get node executions with full details
        node_executions = db.query(FlowNodeExecution).filter(
            FlowNodeExecution.execution_id == execution.id
        ).order_by(FlowNodeExecution.created_at).all()
        
        return {
        "id": str(execution.id),
        "flow_id": str(execution.flow_id),
        "flow_name": flow.name if flow else None,
        "status": execution.status,
        "current_node_id": execution.current_node_id,
        "context_id": execution.context_id,
        "context_type": execution.context_type,
        "result": execution.result,
        "error_message": execution.error_message,
        "execution_data": execution.execution_data,
        "trigger_data": execution.trigger_data,
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
        "duration_seconds": execution.duration_seconds,
        "created_at": execution.created_at.isoformat() if execution.created_at else None,
        "updated_at": execution.updated_at.isoformat() if execution.updated_at else None,
        "triggered_by": {
            "id": str(execution.triggered_by) if execution.triggered_by else None,
            "email": triggered_by_user.email if triggered_by_user else None,
            "name": triggered_by_user.name if triggered_by_user else None
        } if execution.triggered_by else None,
        "node_executions": [
            {
                "id": str(ne.id),
                "node_id": ne.node_id,
                "status": ne.status,
                "skill_used": ne.skill_used,
                "agent_id": str(ne.agent_id) if ne.agent_id else None,
                "interaction_id": str(ne.interaction_id) if ne.interaction_id else None,
                "input_data": ne.input_data,
                "output_data": ne.output_data,
                "error_message": ne.error_message,
                "started_at": ne.started_at.isoformat() if ne.started_at else None,
                "completed_at": ne.completed_at.isoformat() if ne.completed_at else None,
                "duration_ms": ne.duration_ms,
                "retry_attempt": getattr(ne, 'retry_attempt', 0),
                "created_at": ne.created_at.isoformat() if ne.created_at else None
            }
            for ne in node_executions
        ],
        "summary": {
            "total_nodes": len(node_executions),
            "completed_nodes": len([ne for ne in node_executions if ne.status == FlowExecutionStatus.COMPLETED.value]),
            "failed_nodes": len([ne for ne in node_executions if ne.status == FlowExecutionStatus.FAILED.value]),
            "pending_nodes": len([ne for ne in node_executions if ne.status == FlowExecutionStatus.PENDING.value]),
            "running_nodes": len([ne for ne in node_executions if ne.status == FlowExecutionStatus.RUNNING.value])
        }
        }
    except HTTPException:
        raise
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Execution query validation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}"
        )
    except Exception as e:
        error_type = type(e).__name__
        error_message = str(e)
        logger.error(
            f"Error getting execution {execution_id}: {error_type}: {error_message}",
            exc_info=True,
            extra={
                "execution_id": str(execution_id),
                "error_type": error_type
            }
        )
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get execution: {error_message}"
        )


@router.post("/executions/{execution_id}/retry")
async def retry_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retry a failed flow execution"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    from app.models.agentic_flow import FlowExecution, AgenticFlow
    
    execution = db.query(FlowExecution).filter(
        FlowExecution.id == execution_id,
        FlowExecution.tenant_id == effective_tenant_id
    ).first()
    
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found"
        )
    
    # Only allow retry of failed executions
    if execution.status != FlowExecutionStatus.FAILED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry execution with status: {execution.status}"
        )
    
    # Get flow
    flow = db.query(AgenticFlow).filter(AgenticFlow.id == execution.flow_id).first()
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    # Create new execution from failed one
    flow_execution_service = FlowExecutionService(db)
    
    try:
        new_execution = await flow_execution_service.execute_flow(
            flow_id=execution.flow_id,
            tenant_id=execution.tenant_id,
            context_id=execution.context_id,
            context_type=execution.context_type,
            trigger_data=execution.trigger_data,
            triggered_by=current_user.id
        )
        
        return {
            "message": "Execution retried successfully",
            "new_execution_id": str(new_execution.id),
            "status": new_execution.status
        }
    except ValueError as e:
        logger.error(f"Retry execution validation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}"
        )
    except Exception as e:
        error_type = type(e).__name__
        error_message = str(e)
        logger.error(
            f"Failed to retry execution: {error_type}: {error_message}",
            exc_info=True,
            extra={
                "execution_id": str(execution_id),
                "error_type": error_type
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry execution: {error_message}"
        )


@router.patch("/flows/{flow_id}/activate")
async def activate_flow(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Activate a flow (change status to active)"""
    flow = db.query(AgenticFlow).filter(
        AgenticFlow.id == flow_id,
        AgenticFlow.tenant_id == current_user.tenant_id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    flow.status = FlowStatus.ACTIVE.value
    db.commit()
    
    return {"status": "active", "message": "Flow activated"}
