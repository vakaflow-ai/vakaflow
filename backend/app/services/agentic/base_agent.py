"""
Base Agent Class for Agentic AI Agents
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class BaseAgenticAgent(ABC):
    """Base class for all agentic AI agents"""
    
    def __init__(
        self,
        agent_id: UUID,
        agent_type: str,
        name: str,
        skills: List[str],
        db_session=None,
        rag_service=None,
        llm_client=None
    ):
        """
        Initialize base agent
        
        Args:
            agent_id: Unique identifier for this agent instance
            agent_type: Type of agent (ai_grc, assessment, vendor, compliance_reviewer)
            name: Human-readable name
            skills: List of skills this agent has
            db_session: Database session
            rag_service: RAG service instance
            llm_client: LLM client instance
        """
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.name = name
        self.skills = skills
        self.db = db_session
        self.rag_service = rag_service
        self.llm_client = llm_client
        
        # Session management
        self.current_session_id: Optional[UUID] = None
        self.session_context: Dict[str, Any] = {}
        
        logger.info(f"Initialized {self.agent_type} agent: {name} (ID: {agent_id})")
    
    @abstractmethod
    async def execute_skill(
        self,
        skill: str,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a skill
        
        Args:
            skill: Skill to execute
            input_data: Input data for the skill
            context: Additional context
            
        Returns:
            Result of skill execution
        """
        pass
    
    async def start_session(
        self,
        context_id: str,
        context_type: str,
        user_id: Optional[UUID] = None
    ) -> UUID:
        """
        Start a new session
        
        Args:
            context_id: Context identifier (e.g., agent_id, onboarding_request_id)
            context_type: Type of context
            user_id: User who initiated the session
            
        Returns:
            Session ID
        """
        from app.models.agentic_agent import AgenticAgentSession
        from uuid import uuid4
        
        session = AgenticAgentSession(
            id=uuid4(),
            agent_id=self.agent_id,
            tenant_id=self._get_tenant_id(),
            context_id=context_id,
            context_type=context_type,
            initiated_by=user_id,
            status="active",
            started_at=datetime.utcnow()
        )
        
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        self.current_session_id = session.id
        self.session_context = {
            "context_id": context_id,
            "context_type": context_type,
            "started_at": session.started_at.isoformat()
        }
        
        logger.info(f"Started session {session.id} for agent {self.agent_id}")
        return session.id
    
    async def end_session(self, status: str = "completed"):
        """End current session"""
        if not self.current_session_id:
            return
        
        from app.models.agentic_agent import AgenticAgentSession
        
        session = self.db.query(AgenticAgentSession).filter(
            AgenticAgentSession.id == self.current_session_id
        ).first()
        
        if session:
            session.status = status
            session.completed_at = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"Ended session {session.id} with status {status}")
        
        self.current_session_id = None
        self.session_context = {}
    
    async def log_interaction(
        self,
        interaction_type: str,
        skill_used: Optional[str],
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        response_time_ms: float,
        success: bool = True,
        error_message: Optional[str] = None,
        rag_query: Optional[str] = None,
        rag_results: Optional[List[Dict]] = None,
        communication_type: Optional[str] = None,
        target_tenant_id: Optional[UUID] = None,
        agent_called: Optional[UUID] = None,
        mcp_protocol_used: bool = False
    ):
        """Log an interaction"""
        from app.models.agentic_agent import AgenticAgentInteraction
        from uuid import uuid4
        
        interaction = AgenticAgentInteraction(
            id=uuid4(),
            agent_id=self.agent_id,
            session_id=self.current_session_id,
            tenant_id=self._get_tenant_id(),
            interaction_type=interaction_type,
            skill_used=skill_used,
            input_data=input_data,
            output_data=output_data,
            response_time_ms=response_time_ms,
            success=success,
            error_message=error_message,
            rag_query=rag_query,
            rag_results=rag_results,
            communication_type=communication_type,
            target_tenant_id=target_tenant_id,
            agent_called=agent_called,
            mcp_protocol_used=mcp_protocol_used
        )
        
        self.db.add(interaction)
        self.db.commit()
    
    async def query_rag(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Query RAG knowledge base
        
        Args:
            query: Query string
            context: Additional context (e.g., agent_id)
            limit: Maximum number of results
            
        Returns:
            List of RAG results
        """
        if not self.rag_service:
            logger.warning("RAG service not available")
            return []
        
        try:
            agent_id = context.get("agent_id") if context else None
            results = await self.rag_service.search(
                query=query,
                agent_id=agent_id,
                limit=limit
            )
            return results
        except Exception as e:
            logger.error(f"RAG query failed: {e}")
            return []
    
    async def call_llm(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        context: Optional[List[Dict]] = None
    ) -> str:
        """
        Call LLM for generation
        
        Args:
            prompt: User prompt
            system_prompt: System prompt
            context: Context from RAG
            
        Returns:
            LLM response
        """
        if not self.llm_client:
            logger.warning("LLM client not available, returning placeholder")
            return "LLM client not configured"
        
        # This is a placeholder - implement actual LLM call
        # In production, use OpenAI, Anthropic, etc.
        try:
            # Example: return await self.llm_client.generate(prompt, system_prompt, context)
            return "LLM response placeholder"
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return f"Error: {str(e)}"
    
    async def call_other_agent(
        self,
        target_agent_id: UUID,
        skill: str,
        input_data: Dict[str, Any],
        communication_type: str = "internal",
        target_tenant_id: Optional[UUID] = None,
        use_mcp: bool = True
    ) -> Dict[str, Any]:
        """
        Call another agent (agent-to-agent communication)
        
        Supports two communication types:
        - **Internal**: Tenant-scoped, can only call agents from same tenant
        - **External**: Cross-tenant, can call agents from any tenant (no restriction)
        
        Args:
            target_agent_id: ID of agent to call
            skill: Skill to execute on target agent
            input_data: Input data
            communication_type: "internal" (tenant-scoped) or "external" (cross-tenant)
            target_tenant_id: Target tenant ID (required for external calls)
            use_mcp: Whether to use MCP protocol (for external calls)
            
        Returns:
            Response from target agent
            
        Raises:
            ValueError: If agent not found, doesn't have skill, or validation fails
        """
        from app.services.agentic.agent_registry import AgentRegistry
        from app.models.agentic_agent import AgenticAgent
        import time
        
        start_time = time.time()
        
        # Get current agent's tenant_id
        current_tenant_id = self._get_tenant_id()
        
        if communication_type == "internal":
            # Internal communication: Enforce tenant isolation
            target_agent_model = self.db.query(AgenticAgent).filter(
                AgenticAgent.id == target_agent_id,
                AgenticAgent.tenant_id == current_tenant_id
            ).first()
            
            if not target_agent_model:
                raise ValueError(
                    f"Agent {target_agent_id} not found or does not belong to your tenant"
                )
            
            # Get target agent instance (same tenant)
            registry = AgentRegistry(self.db)
            target_agent = await registry.get_agent(target_agent_id, current_tenant_id)
            
        elif communication_type == "external":
            # External communication: No tenant restriction, can pick data from any tenant
            if not target_tenant_id:
                raise ValueError("target_tenant_id is required for external communication")
            
            # Query agent from target tenant (no tenant restriction)
            target_agent_model = self.db.query(AgenticAgent).filter(
                AgenticAgent.id == target_agent_id,
                AgenticAgent.tenant_id == target_tenant_id
            ).first()
            
            if not target_agent_model:
                raise ValueError(
                    f"Agent {target_agent_id} not found in tenant {target_tenant_id}"
                )
            
            # Get target agent instance (different tenant - allow cross-tenant)
            registry = AgentRegistry(self.db)
            target_agent = await registry.get_agent(
                target_agent_id,
                target_tenant_id,
                allow_cross_tenant=True
            )
            
        else:
            raise ValueError(
                f"Invalid communication_type: {communication_type}. Must be 'internal' or 'external'"
            )
        
        if not target_agent:
            raise ValueError(f"Agent {target_agent_id} not found")
        
        if skill not in target_agent.skills:
            raise ValueError(f"Agent {target_agent_id} does not have skill {skill}")
        
        # Execute skill on target agent
        result = await target_agent.execute_skill(skill, input_data)
        
        response_time = (time.time() - start_time) * 1000
        
        # Log the agent-to-agent call
        await self.log_interaction(
            interaction_type="agent_call",
            skill_used=skill,
            input_data={
                "target_agent_id": str(target_agent_id),
                **input_data
            },
            output_data=result,
            response_time_ms=response_time,
            success=True,
            communication_type=communication_type,
            target_tenant_id=target_tenant_id,
            agent_called=target_agent_id,
            mcp_protocol_used=(use_mcp and communication_type == "external")
        )
        
        return result
    
    def _get_tenant_id(self) -> UUID:
        """Get tenant ID from agent"""
        from app.models.agentic_agent import AgenticAgent
        
        agent = self.db.query(AgenticAgent).filter(
            AgenticAgent.id == self.agent_id
        ).first()
        
        if agent:
            return agent.tenant_id
        
        raise ValueError("Agent not found in database")
    
    def has_skill(self, skill: str) -> bool:
        """Check if agent has a skill"""
        return skill in self.skills
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Get agent capabilities"""
        return {
            "agent_id": str(self.agent_id),
            "agent_type": self.agent_type,
            "name": self.name,
            "skills": self.skills,
            "rag_enabled": self.rag_service is not None,
            "llm_enabled": self.llm_client is not None
        }
