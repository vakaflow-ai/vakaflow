"""
MCP (Model Context Protocol) Server Implementation
Enables communication between agents and external platforms
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
import json
import httpx
from datetime import datetime

from app.models.agentic_agent import MCPConnection
from app.services.agentic.agent_registry import AgentRegistry

logger = logging.getLogger(__name__)


class MCPServer:
    """MCP Server for agent communication"""
    
    def __init__(self, db_session):
        """
        Initialize MCP Server
        
        Args:
            db_session: Database session
        """
        self.db = db_session
        self.registry = AgentRegistry(db_session)
    
    async def handle_mcp_request(
        self,
        connection_id: UUID,
        request_type: str,
        payload: Dict[str, Any],
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Handle MCP request from external platform
        
        Args:
            connection_id: MCP connection ID
            request_type: Type of request (skill_execution, agent_query, etc.)
            payload: Request payload
            tenant_id: Tenant ID
            
        Returns:
            Response data
        """
        # Get MCP connection
        connection = self.db.query(MCPConnection).filter(
            MCPConnection.id == connection_id,
            MCPConnection.tenant_id == tenant_id,
            MCPConnection.enabled == True
        ).first()
        
        if not connection:
            raise ValueError(f"MCP connection {connection_id} not found or disabled")
        
        # Route request based on type
        if request_type == "skill_execution":
            return await self._handle_skill_execution(connection, payload, tenant_id)
        elif request_type == "agent_query":
            return await self._handle_agent_query(connection, payload, tenant_id)
        elif request_type == "agent_list":
            return await self._handle_agent_list(connection, payload, tenant_id)
        else:
            raise ValueError(f"Unknown request type: {request_type}")
    
    async def _handle_skill_execution(
        self,
        connection: MCPConnection,
        payload: Dict[str, Any],
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Handle skill execution request
        
        Args:
            connection: MCP connection
            payload: Request payload
            tenant_id: Tenant ID
            
        Returns:
            Execution results
        """
        agent_type = payload.get("agent_type")
        skill = payload.get("skill")
        input_data = payload.get("input_data", {})
        
        if not agent_type or not skill:
            raise ValueError("agent_type and skill are required")
        
        # Get agent by type (tenant-segregated)
        agents = await self.registry.get_agents_by_type(agent_type, tenant_id)
        
        if not agents:
            raise ValueError(f"No active {agent_type} agents found")
        
        # Use first available agent
        agent = agents[0]
        
        if not agent.has_skill(skill):
            raise ValueError(f"Agent {agent.name} does not have skill {skill}")
        
        # Execute skill
        result = await agent.execute_skill(skill, input_data)
        
        # Update connection usage
        connection.total_requests += 1
        connection.last_used_at = datetime.utcnow()
        self.db.commit()
        
        return {
            "success": True,
            "agent_id": str(agent.agent_id),
            "agent_name": agent.name,
            "skill": skill,
            "result": result
        }
    
    async def _handle_agent_query(
        self,
        connection: MCPConnection,
        payload: Dict[str, Any],
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Handle agent query request
        
        Args:
            connection: MCP connection
            payload: Request payload
            tenant_id: Tenant ID
            
        Returns:
            Query results
        """
        query = payload.get("query")
        agent_type = payload.get("agent_type")
        skill_filter = payload.get("skill")
        
        if not query:
            raise ValueError("query is required")
        
        # Get relevant agents (tenant-segregated)
        if skill_filter:
            agents = await self.registry.get_agents_by_skill(skill_filter, tenant_id)
        elif agent_type:
            agents = await self.registry.get_agents_by_type(agent_type, tenant_id)
        else:
            # Get all agents for tenant
            from app.models.agentic_agent import AgenticAgent
            agent_models = self.db.query(AgenticAgent).filter(
                AgenticAgent.tenant_id == tenant_id,
                AgenticAgent.status == "active"
            ).all()
            agents = []
            for agent_model in agent_models:
                agent = await self.registry.get_agent(agent_model.id, tenant_id)
                if agent:
                    agents.append(agent)
        
        # Return agent capabilities
        return {
            "success": True,
            "agents": [agent.get_capabilities() for agent in agents],
            "query": query
        }
    
    async def _handle_agent_list(
        self,
        connection: MCPConnection,
        payload: Dict[str, Any],
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Handle agent list request
        
        Args:
            connection: MCP connection
            payload: Request payload
            tenant_id: Tenant ID
            
        Returns:
            List of agents
        """
        agent_type = payload.get("agent_type")
        skill_filter = payload.get("skill")
        
        if skill_filter:
            agents = await self.registry.get_agents_by_skill(skill_filter, tenant_id)
        elif agent_type:
            agents = await self.registry.get_agents_by_type(agent_type, tenant_id)
        else:
            from app.models.agentic_agent import AgenticAgent
            agent_models = self.db.query(AgenticAgent).filter(
                AgenticAgent.tenant_id == tenant_id,
                AgenticAgent.status == "active"
            ).all()
            agents = []
            for agent_model in agent_models:
                agent = await self.registry.get_agent(agent_model.id, tenant_id)
                if agent:
                    agents.append(agent)
        
        return {
            "success": True,
            "agents": [agent.get_capabilities() for agent in agents],
            "count": len(agents)
        }
    
    async def send_mcp_request(
        self,
        connection_id: UUID,
        request_type: str,
        payload: Dict[str, Any],
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Send MCP request to external platform
        
        Args:
            connection_id: MCP connection ID
            request_type: Type of request
            payload: Request payload
            tenant_id: Tenant ID
            
        Returns:
            Response from external platform
        """
        connection = self.db.query(MCPConnection).filter(
            MCPConnection.id == connection_id,
            MCPConnection.tenant_id == tenant_id,
            MCPConnection.enabled == True
        ).first()
        
        if not connection:
            raise ValueError(f"MCP connection {connection_id} not found")
        
        # Prepare request
        request_data = {
            "type": request_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat(),
            "tenant_id": str(tenant_id)
        }
        
        # Send request to external platform
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{connection.mcp_server_url}/mcp/request",
                    json=request_data,
                    headers={
                        "Authorization": f"Bearer {connection.api_key}",
                        "Content-Type": "application/json"
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"MCP request failed: {e}")
                raise


class MCPClient:
    """MCP Client for making requests to external platforms"""
    
    def __init__(self, connection: MCPConnection):
        """
        Initialize MCP Client
        
        Args:
            connection: MCP connection
        """
        self.connection = connection
        self.base_url = connection.mcp_server_url
        self.api_key = connection.api_key
    
    async def execute_skill(
        self,
        agent_type: str,
        skill: str,
        input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a skill on external platform
        
        Args:
            agent_type: Type of agent
            skill: Skill to execute
            input_data: Input data
            
        Returns:
            Execution results
        """
        request_data = {
            "type": "skill_execution",
            "payload": {
                "agent_type": agent_type,
                "skill": skill,
                "input_data": input_data
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/mcp/request",
                    json=request_data,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"MCP skill execution failed: {e}")
                raise
