"""
External Agent API - Cross-tenant agent communication
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.services.agentic.external_agent_service import ExternalAgentService
from app.services.agentic.agent_registry import AgentRegistry

router = APIRouter(prefix="/external-agents", tags=["External Agents"])


class ExternalAgentCallRequest(BaseModel):
    target_agent_id: UUID
    target_tenant_id: UUID
    skill: str
    input_data: dict
    communication_type: str = "external"  # "internal" or "external"


class ExternalAgentResponse(BaseModel):
    id: str
    name: str
    agent_type: str
    description: Optional[str]
    tenant_id: str
    skills: List[str]
    capabilities: Optional[dict]
    is_available: bool


@router.get("/discover", response_model=List[ExternalAgentResponse])
async def discover_external_agents(
    agent_type: Optional[str] = None,
    skill: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Discover agents across all tenants (for external communication)
    No tenant restriction - can discover agents from any tenant
    """
    external_service = ExternalAgentService(db)
    
    agents = await external_service.discover_external_agents(
        agent_type=agent_type,
        skill=skill,
        exclude_tenant_id=effective_tenant_id  # Optionally exclude own tenant
    )
    
    return agents


@router.get("/tenants/{tenant_id}/agents", response_model=List[ExternalAgentResponse])
async def get_tenant_agents(
    tenant_id: UUID,
    agent_type: Optional[str] = None,
    skill: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get agents from a specific tenant (for external discovery)
    Tenant isolation - users can only access agents from their own tenant
    """
    # Tenant isolation - ALL users (including platform_admin) must be in the same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access agents"
        )
    
    # Users can only access agents from their own tenant
    if tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Can only access agents from your own tenant"
        )
    
    external_service = ExternalAgentService(db)
    
    agents = await external_service.get_tenant_agents(
        tenant_id=tenant_id,
        agent_type=agent_type,
        skill=skill
    )
    
    return agents


@router.post("/call")
async def call_external_agent(
    request: ExternalAgentCallRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Call an external agent (cross-tenant communication)
    No tenant restriction - can call agents from any tenant
    """
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # For now, we'll use a source agent from the current tenant
    # In production, you might want to specify which agent is making the call
    from app.models.agentic_agent import AgenticAgent
    
    # Get first available agent from current tenant (or use a specific agent)
    source_agent_model = db.query(AgenticAgent).filter(
        AgenticAgent.tenant_id == effective_tenant_id,
        AgenticAgent.status == "active"
    ).first()
    
    if not source_agent_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No source agent found in your tenant"
        )
    
    external_service = ExternalAgentService(db)
    
    try:
        result = await external_service.call_external_agent(
            source_agent_id=source_agent_model.id,
            source_tenant_id=effective_tenant_id,
            target_agent_id=request.target_agent_id,
            target_tenant_id=request.target_tenant_id,
            skill=request.skill,
            input_data=request.input_data
        )
        
        return {
            "success": True,
            "result": result,
            "source_agent_id": str(source_agent_model.id),
            "target_agent_id": str(request.target_agent_id),
            "communication_type": "external"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"External agent call failed: {str(e)}"
        )


@router.post("/agents/{agent_id}/call-external")
async def call_external_from_agent(
    agent_id: UUID,
    request: ExternalAgentCallRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Call an external agent from a specific agent (cross-tenant communication)
    """
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Get source agent
    registry = AgentRegistry(db)
    source_agent = await registry.get_agent(agent_id, current_user.tenant_id)
    
    if not source_agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source agent not found"
        )
    
    # Call external agent using base agent's call_other_agent method
    try:
        result = await source_agent.call_other_agent(
            target_agent_id=request.target_agent_id,
            skill=request.skill,
            input_data=request.input_data,
            communication_type="external",
            target_tenant_id=request.target_tenant_id
        )
        
        return {
            "success": True,
            "result": result,
            "source_agent_id": str(agent_id),
            "target_agent_id": str(request.target_agent_id),
            "communication_type": "external"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"External agent call failed: {str(e)}"
        )
