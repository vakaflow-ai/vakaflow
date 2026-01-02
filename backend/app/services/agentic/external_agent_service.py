"""
External Agent Service - Handles cross-tenant agent communication
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging

from app.models.agentic_agent import AgenticAgent, AgenticAgentType
from app.services.agentic.agent_registry import AgentRegistry

logger = logging.getLogger(__name__)


class ExternalAgentService:
    """Service for external (cross-tenant) agent communication"""
    
    def __init__(self, db_session):
        """
        Initialize external agent service
        
        Args:
            db_session: Database session
        """
        self.db = db_session
        self.registry = AgentRegistry(db_session)
    
    async def discover_external_agents(
        self,
        agent_type: Optional[str] = None,
        skill: Optional[str] = None,
        exclude_tenant_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """
        Discover agents across all tenants (for external communication)
        
        Args:
            agent_type: Filter by agent type
            skill: Filter by skill
            exclude_tenant_id: Exclude agents from this tenant (optional)
            
        Returns:
            List of external agents with tenant information
        """
        query = self.db.query(AgenticAgent).filter(
            AgenticAgent.status == "active"
        )
        
        if agent_type:
            query = query.filter(AgenticAgent.agent_type == agent_type)
        
        if exclude_tenant_id:
            query = query.filter(AgenticAgent.tenant_id != exclude_tenant_id)
        
        agent_models = query.all()
        
        agents = []
        for agent_model in agent_models:
            # Filter by skill if specified
            if skill and skill not in (agent_model.skills or []):
                continue
            
            agents.append({
                "id": str(agent_model.id),
                "name": agent_model.name,
                "agent_type": agent_model.agent_type,
                "description": agent_model.description,
                "tenant_id": str(agent_model.tenant_id),
                "skills": agent_model.skills or [],
                "capabilities": agent_model.capabilities or {},
                "is_available": True
            })
        
        return agents
    
    async def call_external_agent(
        self,
        source_agent_id: UUID,
        source_tenant_id: UUID,
        target_agent_id: UUID,
        target_tenant_id: UUID,
        skill: str,
        input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Call an external agent (cross-tenant communication)
        
        Args:
            source_agent_id: Source agent ID
            source_tenant_id: Source tenant ID
            target_agent_id: Target agent ID
            target_tenant_id: Target tenant ID
            skill: Skill to execute
            input_data: Input data
            
        Returns:
            Execution result
        """
        # Verify source agent exists
        source_agent = self.db.query(AgenticAgent).filter(
            AgenticAgent.id == source_agent_id,
            AgenticAgent.tenant_id == source_tenant_id
        ).first()
        
        if not source_agent:
            raise ValueError(f"Source agent {source_agent_id} not found")
        
        # Get target agent (cross-tenant, no restriction)
        target_agent = await self.registry.get_agent(
            target_agent_id,
            target_tenant_id,
            allow_cross_tenant=True
        )
        
        if not target_agent:
            raise ValueError(f"Target agent {target_agent_id} not found in tenant {target_tenant_id}")
        
        if skill not in target_agent.skills:
            raise ValueError(f"Target agent does not have skill: {skill}")
        
        # Execute skill on target agent
        result = await target_agent.execute_skill(skill, input_data)
        
        logger.info(
            f"External agent call: {source_agent_id} ({source_tenant_id}) -> "
            f"{target_agent_id} ({target_tenant_id}) - skill: {skill}"
        )
        
        return result
    
    async def get_tenant_agents(
        self,
        tenant_id: UUID,
        agent_type: Optional[str] = None,
        skill: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get agents from a specific tenant (for external discovery)
        
        Args:
            tenant_id: Tenant ID
            agent_type: Filter by agent type
            skill: Filter by skill
            
        Returns:
            List of agents from the tenant
        """
        query = self.db.query(AgenticAgent).filter(
            AgenticAgent.tenant_id == tenant_id,
            AgenticAgent.status == "active"
        )
        
        if agent_type:
            query = query.filter(AgenticAgent.agent_type == agent_type)
        
        agent_models = query.all()
        
        agents = []
        for agent_model in agent_models:
            if skill and skill not in (agent_model.skills or []):
                continue
            
            agents.append({
                "id": str(agent_model.id),
                "name": agent_model.name,
                "agent_type": agent_model.agent_type,
                "description": agent_model.description,
                "tenant_id": str(tenant_id),
                "skills": agent_model.skills or [],
                "capabilities": agent_model.capabilities or {}
            })
        
        return agents
