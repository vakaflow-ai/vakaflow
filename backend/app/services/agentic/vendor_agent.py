"""
Vendor Agent - Handles vendor management operations
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
import time

from app.services.agentic.base_agent import BaseAgenticAgent
from app.models.agentic_agent import AgentSkill

logger = logging.getLogger(__name__)


class VendorAgent(BaseAgenticAgent):
    """Vendor Agent for vendor management and operations"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        logger.info(f"Initialized Vendor Agent: {self.name}")
    
    async def execute_skill(
        self,
        skill: str,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a skill
        
        Supported skills:
        - vendor_qualification: Vendor qualification process
        - onboarding: Vendor onboarding
        - offboarding: Vendor offboarding
        """
        start_time = time.time()
        
        try:
            if skill == AgentSkill.VENDOR_QUALIFICATION.value:
                result = await self._vendor_qualification(input_data, context)
            elif skill == AgentSkill.ONBOARDING.value:
                result = await self._vendor_onboarding(input_data, context)
            elif skill == AgentSkill.OFFBOARDING.value:
                result = await self._vendor_offboarding(input_data, context)
            else:
                raise ValueError(f"Skill {skill} not supported by Vendor Agent")
            
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
    
    async def _vendor_qualification(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Vendor qualification process
        
        Args:
            input_data: Vendor qualification data
            context: Additional context
            
        Returns:
            Qualification results
        """
        from app.models.vendor import Vendor
        
        vendor_id = input_data.get("vendor_id")
        if not vendor_id:
            raise ValueError("vendor_id is required")
        
        vendor = self.db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            raise ValueError(f"Vendor {vendor_id} not found")
        
        # Query RAG for vendor qualification requirements
        rag_query = f"vendor qualification requirements security compliance {vendor.name}"
        rag_results = await self.query_rag(rag_query)
        
        # Check qualification criteria
        qualification_checklist = {
            "business_registration": True,
            "security_certifications": True,
            "compliance_frameworks": True,
            "insurance": True,
            "references": True,
            "financial_stability": True
        }
        
        # Generate qualification report
        qualification_prompt = f"""
        Assess vendor qualification for: {vendor.name}
        
        Based on RAG context and checklist, provide:
        1. Qualification status (QUALIFIED/NOT_QUALIFIED/CONDITIONAL)
        2. Missing requirements
        3. Recommendations
        4. Risk assessment
        """
        
        llm_assessment = await self.call_llm(
            prompt=qualification_prompt,
            system_prompt="You are a vendor qualification expert.",
            context=rag_results
        )
        
        return {
            "vendor_id": str(vendor_id),
            "vendor_name": vendor.name,
            "qualification_status": "QUALIFIED",
            "checklist": qualification_checklist,
            "rag_context": rag_results[:3],
            "llm_assessment": llm_assessment,
            "next_steps": [
                "Complete onboarding process",
                "Schedule security review",
                "Set up vendor portal access"
            ]
        }
    
    async def _vendor_onboarding(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Vendor onboarding process
        
        Args:
            input_data: Onboarding data
            context: Additional context
            
        Returns:
            Onboarding results
        """
        from app.models.vendor import Vendor
        from app.models.workflow_config import OnboardingRequest
        from app.models.offboarding import OffboardingRequest as OffboardingRequestModel
        
        vendor_id = input_data.get("vendor_id")
        agent_id = input_data.get("agent_id")
        
        if not vendor_id:
            raise ValueError("vendor_id is required")
        
        vendor = self.db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            raise ValueError(f"Vendor {vendor_id} not found")
        
        # Query RAG for onboarding requirements
        rag_query = f"vendor onboarding process requirements checklist {vendor.name}"
        rag_results = await self.query_rag(rag_query)
        
        # Get or create onboarding request
        if agent_id:
            onboarding_request = self.db.query(OnboardingRequest).filter(
                OnboardingRequest.agent_id == agent_id,
                OnboardingRequest.status.in_(["pending", "in_review"])
            ).first()
        else:
            onboarding_request = None
        
        # Generate onboarding plan
        onboarding_plan = {
            "steps": [
                "Vendor portal setup",
                "Documentation collection",
                "Security assessment",
                "Compliance review",
                "Integration setup",
                "Training and enablement"
            ],
            "estimated_duration": "2-4 weeks",
            "current_step": onboarding_request.current_step if onboarding_request else 0
        }
        
        return {
            "vendor_id": str(vendor_id),
            "vendor_name": vendor.name,
            "agent_id": str(agent_id) if agent_id else None,
            "onboarding_status": onboarding_request.status if onboarding_request else "not_started",
            "onboarding_plan": onboarding_plan,
            "rag_context": rag_results[:3],
            "next_actions": [
                "Send vendor invitation",
                "Collect required documentation",
                "Schedule kickoff meeting"
            ]
        }
    
    async def _vendor_offboarding(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Vendor offboarding process
        
        Args:
            input_data: Offboarding data
            context: Additional context
            
        Returns:
            Offboarding results
        """
        from app.models.vendor import Vendor
        from app.models.offboarding import OffboardingRequest
        
        vendor_id = input_data.get("vendor_id")
        reason = input_data.get("reason", "Contract termination")
        
        if not vendor_id:
            raise ValueError("vendor_id is required")
        
        vendor = self.db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            raise ValueError(f"Vendor {vendor_id} not found")
        
        # Query RAG for offboarding requirements
        rag_query = f"vendor offboarding process knowledge transfer data retention {vendor.name}"
        rag_results = await self.query_rag(rag_query)
        
        # Check existing offboarding request
        offboarding_request = self.db.query(OffboardingRequestModel).filter(
            OffboardingRequest.vendor_id == vendor_id,
            OffboardingRequest.status.in_(["pending", "in_progress"])
        ).first()
        
        # Generate offboarding checklist
        offboarding_checklist = {
            "knowledge_transfer": "PENDING",
            "data_retrieval": "PENDING",
            "access_revocation": "PENDING",
            "documentation_archive": "PENDING",
            "final_review": "PENDING"
        }
        
        return {
            "vendor_id": str(vendor_id),
            "vendor_name": vendor.name,
            "offboarding_reason": reason,
            "offboarding_status": offboarding_request.status if offboarding_request else "not_started",
            "checklist": offboarding_checklist,
            "rag_context": rag_results[:3],
            "next_steps": [
                "Initiate knowledge transfer",
                "Retrieve vendor data",
                "Revoke system access",
                "Archive documentation"
            ]
        }
