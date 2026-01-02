"""
Agent Registry - Manages agentic AI agents
"""
from typing import Dict, Optional, List
from uuid import UUID
import logging
from sqlalchemy.orm import Session

from app.models.agentic_agent import AgenticAgent, AgenticAgentType, AgentSkill
from app.services.rag_service import rag_service
from app.services.agentic.base_agent import BaseAgenticAgent
from app.services.agentic.ai_grc_agent import AiGrcAgent
from app.services.agentic.assessment_agent import AssessmentAgent
from app.services.agentic.vendor_agent import VendorAgent
from app.services.agentic.compliance_reviewer_agent import ComplianceReviewerAgent
from app.services.agentic.questionnaire_review_agent import QuestionnaireReviewAgent

logger = logging.getLogger(__name__)


class AgentRegistry:
    """Registry for managing agentic AI agents"""
    
    def __init__(self, db: Session):
        """
        Initialize agent registry
        
        Args:
            db: Database session
        """
        self.db = db
        self._agent_cache: Dict[UUID, BaseAgenticAgent] = {}
        self._rag_service = rag_service
        self._llm_client = None  # Will be initialized with actual LLM client
    
    async def get_agent(
        self,
        agent_id: UUID,
        tenant_id: UUID,
        allow_cross_tenant: bool = False
    ) -> Optional[BaseAgenticAgent]:
        """
        Get an agent instance
        
        Args:
            agent_id: Agent ID
            tenant_id: Tenant ID (required for tenant isolation)
            allow_cross_tenant: If True, allows getting agent from different tenant (for external calls)
            
        Returns:
            Agent instance or None
        """
        # Check cache first (but verify tenant_id matches if not cross-tenant)
        if agent_id in self._agent_cache:
            cached_agent = self._agent_cache[agent_id]
            # Verify tenant_id matches (unless cross-tenant allowed)
            if not allow_cross_tenant:
                cached_model = self.db.query(AgenticAgent).filter(
                    AgenticAgent.id == agent_id
                ).first()
                if cached_model and cached_model.tenant_id == tenant_id:
                    return cached_agent
                else:
                    # Tenant mismatch, remove from cache
                    del self._agent_cache[agent_id]
            else:
                # Cross-tenant allowed, return cached agent
                return cached_agent
        
        # Load from database
        query = self.db.query(AgenticAgent).filter(AgenticAgent.id == agent_id)
        
        if not allow_cross_tenant:
            # Internal: Enforce tenant filter
            query = query.filter(AgenticAgent.tenant_id == tenant_id)
        # External: No tenant filter (can access any tenant)
        
        agent_model = query.first()
        
        if not agent_model:
            return None
        
        # Create agent instance based on type
        agent_instance = self._create_agent_instance(agent_model)
        
        # Cache it
        self._agent_cache[agent_id] = agent_instance
        
        return agent_instance
    
    async def get_agents_by_type(
        self,
        agent_type: str,
        tenant_id: UUID,
        active_only: bool = True
    ) -> List[BaseAgenticAgent]:
        """
        Get agents by type (tenant-segregated)
        
        Args:
            agent_type: Type of agent
            tenant_id: Tenant ID (required for tenant isolation)
            active_only: Only return active agents
            
        Returns:
            List of agent instances
        """
        query = self.db.query(AgenticAgent).filter(
            AgenticAgent.agent_type == agent_type,
            AgenticAgent.tenant_id == tenant_id
        )
        
        if active_only:
            query = query.filter(AgenticAgent.status == "active")
        
        agent_models = query.all()
        
        agents = []
        for agent_model in agent_models:
            agent = await self.get_agent(agent_model.id, tenant_id)
            if agent:
                agents.append(agent)
        
        return agents
    
    async def get_agents_by_skill(
        self,
        skill: str,
        tenant_id: UUID,
        active_only: bool = True
    ) -> List[BaseAgenticAgent]:
        """
        Get agents that have a specific skill (tenant-segregated)
        
        Args:
            skill: Skill to search for
            tenant_id: Tenant ID (required for tenant isolation)
            active_only: Only return active agents
            
        Returns:
            List of agent instances
        """
        # Query agents that have this skill in their skills JSON array
        query = self.db.query(AgenticAgent).filter(
            AgenticAgent.tenant_id == tenant_id
        )
        
        if active_only:
            query = query.filter(AgenticAgent.status == "active")
        
        agent_models = query.all()
        
        agents = []
        for agent_model in agent_models:
            if skill in (agent_model.skills or []):
                agent = await self.get_agent(agent_model.id, tenant_id)
                if agent:
                    agents.append(agent)
        
        return agents
    
    def _create_agent_instance(self, agent_model: AgenticAgent) -> BaseAgenticAgent:
        """
        Create agent instance based on agent model
        
        Args:
            agent_model: Agent model from database
            
        Returns:
            Agent instance
        """
        skills = agent_model.skills or []
        
        if agent_model.agent_type == AgenticAgentType.AI_GRC.value:
            return AiGrcAgent(
                agent_id=agent_model.id,
                agent_type=agent_model.agent_type,
                name=agent_model.name,
                skills=skills,
                db_session=self.db,
                rag_service=self._rag_service,
                llm_client=self._llm_client
            )
        elif agent_model.agent_type == AgenticAgentType.ASSESSMENT.value:
            return AssessmentAgent(
                agent_id=agent_model.id,
                agent_type=agent_model.agent_type,
                name=agent_model.name,
                skills=skills,
                db_session=self.db,
                rag_service=self._rag_service,
                llm_client=self._llm_client
            )
        elif agent_model.agent_type == AgenticAgentType.VENDOR.value:
            return VendorAgent(
                agent_id=agent_model.id,
                agent_type=agent_model.agent_type,
                name=agent_model.name,
                skills=skills,
                db_session=self.db,
                rag_service=self._rag_service,
                llm_client=self._llm_client
            )
        elif agent_model.agent_type == AgenticAgentType.COMPLIANCE_REVIEWER.value:
            return ComplianceReviewerAgent(
                agent_id=agent_model.id,
                agent_type=agent_model.agent_type,
                name=agent_model.name,
                skills=skills,
                db_session=self.db,
                rag_service=self._rag_service,
                llm_client=self._llm_client
            )
        elif agent_model.agent_type == AgenticAgentType.QUESTIONNAIRE_REVIEWER.value:
            return QuestionnaireReviewAgent(
                agent_id=agent_model.id,
                agent_type=agent_model.agent_type,
                name=agent_model.name,
                skills=skills,
                db_session=self.db,
                rag_service=self._rag_service,
                llm_client=self._llm_client
            )
        else:
            raise ValueError(f"Unknown agent type: {agent_model.agent_type}")
    
    def clear_cache(self, agent_id: Optional[UUID] = None):
        """
        Clear agent cache
        
        Args:
            agent_id: Specific agent ID to clear, or None to clear all
        """
        if agent_id:
            self._agent_cache.pop(agent_id, None)
        else:
            self._agent_cache.clear()
