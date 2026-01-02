"""
API endpoints for Agentic AI Agents
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
import logging

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
from app.models.agentic_agent import (
    AgenticAgent,
    AgenticAgentType,
    AgentSkill,
    AgenticAgentStatus,
    AgenticAgentSession,
    AgenticAgentInteraction,
    MCPConnection
)
from app.services.agentic.agent_registry import AgentRegistry
from app.services.agentic.mcp_server import MCPServer
from app.services.agentic.learning_system import AgentLearningSystem

router = APIRouter(prefix="/agentic-agents", tags=["Agentic AI Agents"])


# Pydantic models
class AgenticAgentCreate(BaseModel):
    name: str
    agent_type: str
    description: Optional[str] = None
    skills: List[str] = []
    capabilities: Optional[dict] = {}
    configuration: Optional[dict] = {}
    rag_enabled: bool = True
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    mcp_enabled: bool = True


class AgenticAgentResponse(BaseModel):
    id: str
    name: str
    agent_type: str
    description: Optional[str]
    status: str
    skills: List[str]
    capabilities: Optional[dict]
    total_interactions: int
    success_rate: float
    last_used_at: Optional[str]
    
    class Config:
        from_attributes = True


class SkillExecutionRequest(BaseModel):
    skill: str
    input_data: dict
    context: Optional[dict] = {}


class SkillExecutionResponse(BaseModel):
    success: bool
    result: dict
    response_time_ms: float


class SessionCreateRequest(BaseModel):
    context_id: str
    context_type: str


class MCPConnectionCreate(BaseModel):
    connection_name: str
    platform_name: str
    mcp_server_url: str
    api_key: str
    configuration: Optional[dict] = {}
    supported_skills: Optional[List[str]] = []
    supported_agents: Optional[List[str]] = []


@router.post("", response_model=AgenticAgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agentic_agent(
    agent_data: AgenticAgentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new agentic AI agent"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Validate agent type
    if agent_data.agent_type not in [t.value for t in AgenticAgentType]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid agent type. Must be one of: {[t.value for t in AgenticAgentType]}"
        )
    
    # Create agent
    agent = AgenticAgent(
        tenant_id=effective_tenant_id,
        name=agent_data.name,
        agent_type=agent_data.agent_type,
        description=agent_data.description,
        skills=agent_data.skills,
        capabilities=agent_data.capabilities,
        configuration=agent_data.configuration,
        rag_enabled=agent_data.rag_enabled,
        llm_provider=agent_data.llm_provider,
        llm_model=agent_data.llm_model,
        mcp_enabled=agent_data.mcp_enabled,
        status=AgenticAgentStatus.ACTIVE.value,
        created_by=current_user.id
    )
    
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    return agent


@router.get("", response_model=List[AgenticAgentResponse])
async def list_agentic_agents(
    agent_type: Optional[str] = None,
    skill: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List agentic AI agents"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    query = db.query(AgenticAgent).filter(
        AgenticAgent.tenant_id == effective_tenant_id
    )
    
    if agent_type:
        query = query.filter(AgenticAgent.agent_type == agent_type)
    
    if skill:
        # Filter agents that have this skill
        agents = query.all()
        filtered = [a for a in agents if skill in (a.skills or [])]
        return filtered
    
    agents = query.all()
    return agents


@router.get("/{agent_id}", response_model=AgenticAgentResponse)
async def get_agentic_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get agentic AI agent by ID"""
    agent = db.query(AgenticAgent).filter(
        AgenticAgent.id == agent_id,
        AgenticAgent.tenant_id == current_user.tenant_id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    return agent


@router.post("/{agent_id}/execute-skill", response_model=SkillExecutionResponse)
async def execute_skill(
    agent_id: UUID,
    request: SkillExecutionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute a skill on an agentic agent"""
    import time
    
    start_time = time.time()
    
    # Get agent with tenant isolation
    registry = AgentRegistry(db)
    agent = await registry.get_agent(agent_id, current_user.tenant_id)
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check if agent has skill
    if not agent.has_skill(request.skill):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent does not have skill: {request.skill}"
        )
    
    # Execute skill
    try:
        logger.info(f"Executing skill {request.skill} on agent {agent_id} with input_data keys: {list(request.input_data.keys()) if request.input_data else 'None'}")
        result = await agent.execute_skill(
            request.skill,
            request.input_data,
            request.context
        )
        
        response_time = (time.time() - start_time) * 1000
        
        return SkillExecutionResponse(
            success=True,
            result=result,
            response_time_ms=response_time
        )
    except ValueError as e:
        # ValueError from agent execution (e.g., missing assignment_id)
        response_time = (time.time() - start_time) * 1000
        error_msg = str(e)
        logger.error(f"Agent execution ValueError: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent execution failed: {error_msg}"
        )
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        error_msg = str(e)
        error_type = type(e).__name__
        logger.error(f"Agent execution error ({error_type}): {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Skill execution failed: {error_msg}"
        )


@router.post("/{agent_id}/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    agent_id: UUID,
    request: SessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new session for an agent"""
    registry = AgentRegistry(db)
    agent = await registry.get_agent(agent_id, current_user.tenant_id)
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    session_id = await agent.start_session(
        request.context_id,
        request.context_type,
        current_user.id
    )
    
    return {"session_id": str(session_id), "status": "active"}


@router.post("/mcp/connections", status_code=status.HTTP_201_CREATED)
async def create_mcp_connection(
    connection_data: MCPConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create MCP connection for external platform"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    connection = MCPConnection(
        tenant_id=effective_tenant_id,
        connection_name=connection_data.connection_name,
        platform_name=connection_data.platform_name,
        mcp_server_url=connection_data.mcp_server_url,
        api_key=connection_data.api_key,
        configuration=connection_data.configuration,
        supported_skills=connection_data.supported_skills,
        supported_agents=connection_data.supported_agents,
        enabled=True,
        created_by=current_user.id
    )
    
    db.add(connection)
    db.commit()
    db.refresh(connection)
    
    return {
        "id": str(connection.id),
        "connection_name": connection.connection_name,
        "platform_name": connection.platform_name,
        "status": "active"
    }


@router.post("/mcp/{connection_id}/request")
async def handle_mcp_request(
    connection_id: UUID,
    request_type: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle MCP request from external platform"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    mcp_server = MCPServer(db)
    
    try:
        result = await mcp_server.handle_mcp_request(
            connection_id,
            request_type,
            payload,
            current_user.tenant_id
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MCP request failed: {str(e)}"
        )


@router.post("/{agent_id}/learn")
async def trigger_learning(
    agent_id: UUID,
    learning_type: str,
    source_data: dict,
    source_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger learning for an agent"""
    agent = db.query(AgenticAgent).filter(
        AgenticAgent.id == agent_id,
        AgenticAgent.tenant_id == current_user.tenant_id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    learning_system = AgentLearningSystem(db)
    
    try:
        if learning_type == "compliance":
            learning = await learning_system.learn_from_compliance_check(
                agent_id,
                source_data,
                source_id
            )
        elif learning_type == "questionnaire":
            learning = await learning_system.learn_from_questionnaire(
                agent_id,
                source_data,
                source_id
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown learning type: {learning_type}"
            )
        
        return {
            "success": True,
            "learning_id": str(learning.id),
            "pattern_type": learning.learning_type
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Learning failed: {str(e)}"
        )
