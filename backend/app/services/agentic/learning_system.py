"""
Learning System for Agentic AI Agents
Enables agents to learn from compliance data, questionnaires, and interactions
"""
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4
import logging
import hashlib
import json
from datetime import datetime, timedelta

from app.models.agentic_agent import AgenticAgentLearning, AgenticAgent, AgenticAgentInteraction
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)


class AgentLearningSystem:
    """Learning system for agentic AI agents"""
    
    def __init__(self, db_session):
        """
        Initialize learning system
        
        Args:
            db_session: Database session
        """
        self.db = db_session
        self.rag_service = rag_service
    
    async def learn_from_compliance_check(
        self,
        agent_id: UUID,
        compliance_data: Dict[str, Any],
        source_id: Optional[UUID] = None
    ) -> AgenticAgentLearning:
        """
        Learn from compliance check data
        
        Args:
            agent_id: Agent ID
            compliance_data: Compliance check data
            source_id: Source ID (e.g., agent_id being checked)
            
        Returns:
            Learning record
        """
        # Extract patterns from compliance data
        pattern = self._extract_compliance_pattern(compliance_data)
        
        # Create pattern signature for deduplication
        pattern_signature = self._generate_pattern_signature(pattern)
        
        # Check if pattern already exists
        existing = self.db.query(AgenticAgentLearning).filter(
            AgenticAgentLearning.agent_id == agent_id,
            AgenticAgentLearning.pattern_signature == pattern_signature
        ).first()
        
        if existing:
            # Update usage count
            existing.usage_count += 1
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            return existing
        
        # Create new learning record
        # Verify agent exists and get tenant_id
        agent = self.db.query(AgenticAgent).filter(AgenticAgent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Tenant isolation: learning data belongs to agent's tenant
        learning = AgenticAgentLearning(
            id=uuid4(),
            agent_id=agent_id,
            tenant_id=agent.tenant_id,  # Inherit tenant from agent
            learning_type="compliance_pattern",
            source_type="compliance_check",
            source_id=source_id,
            pattern_data=pattern,
            pattern_signature=pattern_signature,
            confidence_score=0.8,  # Initial confidence
            usage_count=1,
            success_count=0
        )
        
        self.db.add(learning)
        self.db.commit()
        self.db.refresh(learning)
        
        logger.info(f"Learned compliance pattern for agent {agent_id}")
        
        return learning
    
    async def learn_from_questionnaire(
        self,
        agent_id: UUID,
        questionnaire_data: Dict[str, Any],
        source_id: Optional[UUID] = None
    ) -> AgenticAgentLearning:
        """
        Learn from questionnaire responses
        
        Args:
            agent_id: Agent ID
            questionnaire_data: Questionnaire data
            source_id: Source ID
            
        Returns:
            Learning record
        """
        # Extract patterns from questionnaire
        pattern = self._extract_questionnaire_pattern(questionnaire_data)
        
        pattern_signature = self._generate_pattern_signature(pattern)
        
        # Check if pattern already exists
        existing = self.db.query(AgenticAgentLearning).filter(
            AgenticAgentLearning.agent_id == agent_id,
            AgenticAgentLearning.pattern_signature == pattern_signature
        ).first()
        
        if existing:
            existing.usage_count += 1
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            return existing
        
        # Verify agent exists and get tenant_id
        agent = self.db.query(AgenticAgent).filter(AgenticAgent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Tenant isolation: learning data belongs to agent's tenant
        learning = AgenticAgentLearning(
            id=uuid4(),
            agent_id=agent_id,
            tenant_id=agent.tenant_id,  # Inherit tenant from agent
            learning_type="questionnaire_pattern",
            source_type="questionnaire",
            source_id=source_id,
            pattern_data=pattern,
            pattern_signature=pattern_signature,
            confidence_score=0.7,
            usage_count=1,
            success_count=0
        )
        
        self.db.add(learning)
        self.db.commit()
        self.db.refresh(learning)
        
        logger.info(f"Learned questionnaire pattern for agent {agent_id}")
        
        return learning
    
    async def learn_from_interaction(
        self,
        agent_id: UUID,
        interaction_id: UUID,
        feedback_score: Optional[int] = None
    ) -> Optional[AgenticAgentLearning]:
        """
        Learn from agent interaction
        
        Args:
            agent_id: Agent ID
            interaction_id: Interaction ID
            feedback_score: Optional feedback score (1-5)
            
        Returns:
            Learning record if pattern extracted
        """
        interaction = self.db.query(AgenticAgentInteraction).filter(
            AgenticAgentInteraction.id == interaction_id,
            AgenticAgentInteraction.agent_id == agent_id
        ).first()
        
        if not interaction:
            return None
        
        # Extract patterns from successful interactions
        if interaction.success and feedback_score and feedback_score >= 4:
            pattern = self._extract_interaction_pattern(interaction)
            
            if pattern:
                pattern_signature = self._generate_pattern_signature(pattern)
                
                existing = self.db.query(AgenticAgentLearning).filter(
                    AgenticAgentLearning.agent_id == agent_id,
                    AgenticAgentLearning.pattern_signature == pattern_signature
                ).first()
                
                if existing:
                    existing.usage_count += 1
                    existing.success_count += 1
                    existing.confidence_score = min(1.0, existing.confidence_score + 0.05)
                    existing.updated_at = datetime.utcnow()
                    self.db.commit()
                    return existing
                
                agent = self.db.query(AgenticAgent).filter(AgenticAgent.id == agent_id).first()
                if agent:
                    learning = AgenticAgentLearning(
                        id=uuid4(),
                        agent_id=agent_id,
                        tenant_id=agent.tenant_id,
                        learning_type="workflow_pattern",
                        source_type="review",
                        source_id=interaction_id,
                        pattern_data=pattern,
                        pattern_signature=pattern_signature,
                        confidence_score=0.6,
                        usage_count=1,
                        success_count=1
                    )
                    
                    self.db.add(learning)
                    self.db.commit()
                    self.db.refresh(learning)
                    
                    logger.info(f"Learned interaction pattern for agent {agent_id}")
                    return learning
        
        return None
    
    async def apply_learned_patterns(
        self,
        agent_id: UUID,
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Apply learned patterns to current context
        
        Args:
            agent_id: Agent ID
            context: Current context
            
        Returns:
            List of applicable patterns
        """
        # Get recent, high-confidence patterns
        patterns = self.db.query(AgenticAgentLearning).filter(
            AgenticAgentLearning.agent_id == agent_id,
            AgenticAgentLearning.confidence_score >= 0.7,
            AgenticAgentLearning.validated == True
        ).order_by(
            AgenticAgentLearning.confidence_score.desc(),
            AgenticAgentLearning.usage_count.desc()
        ).limit(10).all()
        
        applicable_patterns = []
        for pattern in patterns:
            if self._pattern_matches_context(pattern.pattern_data, context):
                applicable_patterns.append({
                    "pattern_id": str(pattern.id),
                    "pattern_type": pattern.learning_type,
                    "pattern_data": pattern.pattern_data,
                    "confidence": pattern.confidence_score,
                    "usage_count": pattern.usage_count
                })
        
        return applicable_patterns
    
    async def update_rag_knowledge(
        self,
        agent_id: UUID,
        learning_data: Dict[str, Any]
    ):
        """
        Update RAG knowledge base with learned patterns
        
        Args:
            agent_id: Agent ID
            learning_data: Learning data to add to RAG
        """
        if not self.rag_service:
            logger.warning("RAG service not available")
            return
        
        try:
            # Convert learning data to document format
            document_content = json.dumps(learning_data, indent=2)
            
            # Ingest into RAG
            await self.rag_service.ingest_document(
                agent_id=str(agent_id),
                document_type="learned_pattern",
                content=document_content,
                metadata={
                    "learning_type": learning_data.get("type"),
                    "source": "agent_learning",
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
            logger.info(f"Updated RAG knowledge for agent {agent_id}")
        except Exception as e:
            logger.error(f"Failed to update RAG knowledge: {e}")
    
    def _extract_compliance_pattern(self, compliance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract pattern from compliance data"""
        return {
            "compliance_frameworks": compliance_data.get("frameworks", []),
            "compliance_score": compliance_data.get("score"),
            "risk_factors": compliance_data.get("risk_factors", []),
            "requirements_met": compliance_data.get("requirements_met", []),
            "requirements_missing": compliance_data.get("requirements_missing", [])
        }
    
    def _extract_questionnaire_pattern(self, questionnaire_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract pattern from questionnaire data"""
        return {
            "questionnaire_type": questionnaire_data.get("type"),
            "responses": questionnaire_data.get("responses", {}),
            "common_answers": questionnaire_data.get("common_answers", []),
            "risk_indicators": questionnaire_data.get("risk_indicators", [])
        }
    
    def _extract_interaction_pattern(self, interaction: AgenticAgentInteraction) -> Optional[Dict[str, Any]]:
        """Extract pattern from interaction"""
        if not interaction.input_data or not interaction.output_data:
            return None
        
        return {
            "skill_used": interaction.skill_used,
            "input_pattern": self._normalize_input(interaction.input_data),
            "output_pattern": self._normalize_output(interaction.output_data),
            "rag_context_used": interaction.rag_context_used
        }
    
    def _normalize_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize input data for pattern matching"""
        normalized = {}
        for key, value in input_data.items():
            if isinstance(value, (str, int, float, bool)):
                normalized[key] = value
            elif isinstance(value, dict):
                normalized[key] = "dict"
            elif isinstance(value, list):
                normalized[key] = "list"
        return normalized
    
    def _normalize_output(self, output_data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize output data for pattern matching"""
        return self._normalize_input(output_data)
    
    def _pattern_matches_context(
        self,
        pattern: Dict[str, Any],
        context: Dict[str, Any]
    ) -> bool:
        """Check if pattern matches context"""
        # Simple matching logic - can be enhanced
        pattern_keys = set(pattern.keys())
        context_keys = set(context.keys())
        
        # Check if pattern keys are present in context
        overlap = pattern_keys.intersection(context_keys)
        return len(overlap) >= len(pattern_keys) * 0.5  # 50% match threshold
    
    def _generate_pattern_signature(self, pattern: Dict[str, Any]) -> str:
        """Generate signature for pattern deduplication"""
        pattern_str = json.dumps(pattern, sort_keys=True)
        return hashlib.sha256(pattern_str.encode()).hexdigest()
