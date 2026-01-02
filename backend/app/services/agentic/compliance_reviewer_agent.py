"""
Compliance Reviewer Agent - Handles compliance review workflows
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
import time

from app.services.agentic.base_agent import BaseAgenticAgent
from app.models.agentic_agent import AgentSkill

logger = logging.getLogger(__name__)


class ComplianceReviewerAgent(BaseAgenticAgent):
    """Compliance Reviewer Agent for compliance review workflows"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        logger.info(f"Initialized Compliance Reviewer Agent: {self.name}")
    
    async def execute_skill(
        self,
        skill: str,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a skill
        
        Supported skills:
        - compliance_review: General compliance review
        - onboarding: Compliance review for onboarding
        - offboarding: Compliance review for offboarding
        """
        start_time = time.time()
        
        try:
            if skill == "compliance_review":
                result = await self._compliance_review(input_data, context)
            elif skill == AgentSkill.ONBOARDING.value:
                result = await self._onboarding_compliance_review(input_data, context)
            elif skill == AgentSkill.OFFBOARDING.value:
                result = await self._offboarding_compliance_review(input_data, context)
            else:
                raise ValueError(f"Skill {skill} not supported by Compliance Reviewer Agent")
            
            response_time = (time.time() - start_time) * 1000
            
            await self.log_interaction(
                interaction_type="skill_execution",
                skill_used=skill,
                input_data=input_data,
                output_data=result,
                response_time_ms=response_time,
                success=True
            )
            
            return result
            
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            logger.error(f"Error executing skill {skill}: {e}")
            
            await self.log_interaction(
                interaction_type="skill_execution",
                skill_used=skill,
                input_data=input_data,
                output_data={"error": str(e)},
                response_time_ms=response_time,
                success=False,
                error_message=str(e)
            )
            
            raise
    
    async def _compliance_review(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        General compliance review with framework support
        
        Args:
            input_data: Review data (should contain 'agent_id' and optionally 'framework_id' or 'framework_name')
            context: Additional context
            
        Returns:
            Compliance review results with detailed analysis
        """
        from app.models.agent import Agent
        from app.models.compliance_framework import ComplianceFramework, AgentFrameworkLink
        from app.services.compliance_service import ComplianceService
        from app.services.requirement_matching_service import RequirementMatchingService
        from uuid import UUID as UUIDType
        
        agent_id = input_data.get("agent_id")
        framework_id = input_data.get("framework_id")
        framework_name = input_data.get("framework_name")
        
        if not agent_id:
            raise ValueError("agent_id is required")
        
        agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Get applicable frameworks
        requirement_matcher = RequirementMatchingService()
        from app.models.agent import AgentMetadata
        metadata = self.db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent.id).first()
        applicable_frameworks = requirement_matcher.get_applicable_frameworks(
            self.db, agent, metadata
        )
        
        # If specific framework requested, filter to that one
        selected_framework = None
        if framework_id:
            try:
                framework_uuid = UUIDType(framework_id) if isinstance(framework_id, str) else framework_id
                selected_framework = self.db.query(ComplianceFramework).filter(
                    ComplianceFramework.id == framework_uuid
                ).first()
            except (ValueError, TypeError):
                pass
        elif framework_name:
            selected_framework = self.db.query(ComplianceFramework).filter(
                ComplianceFramework.name.ilike(f"%{framework_name}%")
            ).first()
        
        # If no specific framework, use all applicable frameworks
        frameworks_to_review = [selected_framework] if selected_framework else applicable_frameworks
        
        if not frameworks_to_review:
            frameworks_to_review = [None]  # General review
        
        # Query RAG for compliance requirements
        framework_names = [f.name for f in frameworks_to_review if f] or ["general"]
        rag_query = f"compliance requirements {', '.join(framework_names)} for {agent.type} {agent.category}"
        rag_results = await self.query_rag(rag_query, context={"agent_id": str(agent_id)})
        
        # Use compliance service for comprehensive check
        compliance_service = ComplianceService()
        compliance_result = await compliance_service.check_agent_compliance(
            self.db,
            str(agent_id),
            str(agent.tenant_id) if hasattr(agent, 'tenant_id') else None
        )
        
        # Get framework-specific compliance checks
        framework_reviews = []
        for framework in frameworks_to_review:
            if framework:
                # Check if agent is linked to this framework
                framework_link = self.db.query(AgentFrameworkLink).filter(
                    AgentFrameworkLink.agent_id == agent.id,
                    AgentFrameworkLink.framework_id == framework.id
                ).first()
                
                # Get framework rules and risks
                from app.models.compliance_framework import FrameworkRule, FrameworkRisk
                rules = self.db.query(FrameworkRule).filter(
                    FrameworkRule.framework_id == framework.id
                ).all()
                
                risks = self.db.query(FrameworkRisk).filter(
                    FrameworkRisk.framework_id == framework.id
                ).all()
                
                framework_reviews.append({
                    "framework_id": str(framework.id),
                    "framework_name": framework.name,
                    "framework_type": framework.framework_type,
                    "is_linked": framework_link is not None,
                    "rules_count": len(rules),
                    "risks_count": len(risks),
                    "compliance_status": framework_link.compliance_status if framework_link else "NOT_ASSESSED"
                })
        
        # Generate detailed compliance review using LLM
        review_prompt = f"""
        Conduct comprehensive compliance review for agent: {agent.name}
        Agent Type: {agent.type}
        Agent Category: {agent.category}
        Frameworks: {', '.join([f.name for f in frameworks_to_review if f]) or 'General'}
        Current Compliance Score: {agent.compliance_score or 0}
        
        Based on RAG context and compliance checks, provide:
        1. Overall compliance status (COMPLIANT/NON_COMPLIANT/PARTIAL)
        2. Framework-specific compliance status
        3. Detailed compliance gaps with severity
        4. Remediation recommendations with priority
        5. Risk assessment with impact analysis
        6. Next steps for compliance improvement
        """
        
        llm_review = await self.call_llm(
            prompt=review_prompt,
            system_prompt="You are a compliance review expert specializing in AI governance, risk, and compliance.",
            context=rag_results
        )
        
        # Calculate overall compliance status
        compliance_score = agent.compliance_score or 0
        if compliance_score >= 90:
            overall_status = "COMPLIANT"
        elif compliance_score >= 70:
            overall_status = "PARTIAL"
        else:
            overall_status = "NON_COMPLIANT"
        
        # Extract gaps and recommendations from compliance result
        gaps = compliance_result.get("gaps", [])
        recommendations = compliance_result.get("recommendations", [])
        
        return {
            "agent_id": str(agent_id),
            "agent_name": agent.name,
            "agent_type": agent.type,
            "agent_category": agent.category,
            "frameworks_reviewed": framework_reviews,
            "overall_compliance_status": overall_status,
            "compliance_score": compliance_score,
            "compliance_result": compliance_result,
            "gaps": gaps,
            "recommendations": recommendations,
            "rag_context": rag_results[:3],
            "llm_review": llm_review,
            "next_steps": [
                "Address high-priority compliance gaps",
                "Update security and compliance documentation",
                "Schedule follow-up compliance review",
                "Implement remediation recommendations"
            ],
            "review_timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
    
    async def _onboarding_compliance_review(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Compliance review for onboarding
        
        Args:
            input_data: Onboarding review data
            context: Additional context
            
        Returns:
            Onboarding compliance review results
        """
        from app.models.agent import Agent
        from app.models.workflow_config import OnboardingRequest
        
        agent_id = input_data.get("agent_id")
        if not agent_id:
            raise ValueError("agent_id is required")
        
        agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        onboarding_request = self.db.query(OnboardingRequest).filter(
            OnboardingRequest.agent_id == agent_id,
            OnboardingRequest.status.in_(["pending", "in_review"])
        ).first()
        
        # Query RAG for onboarding compliance requirements
        rag_query = f"onboarding compliance requirements security data protection {agent.type}"
        rag_results = await self.query_rag(rag_query, context={"agent_id": str(agent_id)})
        
        # Compliance checklist for onboarding
        compliance_checklist = {
            "data_protection": "PENDING",
            "security_assessment": "PENDING",
            "access_controls": "PENDING",
            "audit_logging": "PENDING",
            "incident_response": "PENDING"
        }
        
        return {
            "agent_id": str(agent_id),
            "agent_name": agent.name,
            "onboarding_request_id": str(onboarding_request.id) if onboarding_request else None,
            "compliance_checklist": compliance_checklist,
            "rag_context": rag_results[:3],
            "status": "in_review",
            "next_steps": [
                "Complete security assessment",
                "Review data protection measures",
                "Verify access controls"
            ]
        }
    
    async def _offboarding_compliance_review(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Compliance review for offboarding
        
        Args:
            input_data: Offboarding review data
            context: Additional context
            
        Returns:
            Offboarding compliance review results
        """
        from app.models.agent import Agent
        from app.models.offboarding import OffboardingRequest as OffboardingRequestModel
        
        agent_id = input_data.get("agent_id")
        if not agent_id:
            raise ValueError("agent_id is required")
        
        agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        offboarding_request = self.db.query(OffboardingRequestModel).filter(
            OffboardingRequest.agent_id == agent_id,
            OffboardingRequest.status.in_(["pending", "in_progress"])
        ).first()
        
        # Query RAG for offboarding compliance requirements
        rag_query = f"offboarding compliance requirements data retention deletion {agent.type}"
        rag_results = await self.query_rag(rag_query, context={"agent_id": str(agent_id)})
        
        # Compliance checklist for offboarding
        compliance_checklist = {
            "data_deletion": "PENDING",
            "access_revocation": "PENDING",
            "audit_trail": "PENDING",
            "documentation_archive": "PENDING",
            "compliance_verification": "PENDING"
        }
        
        return {
            "agent_id": str(agent_id),
            "agent_name": agent.name,
            "offboarding_request_id": str(offboarding_request.id) if offboarding_request else None,
            "compliance_checklist": compliance_checklist,
            "rag_context": rag_results[:3],
            "status": "in_review",
            "next_steps": [
                "Verify data deletion",
                "Confirm access revocation",
                "Archive compliance documentation"
            ]
        }
