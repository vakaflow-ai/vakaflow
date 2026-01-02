"""
AI GRC Agent - Handles AI Governance, Risk, and Compliance operations
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
import time
import os

from app.services.agentic.base_agent import BaseAgenticAgent
from app.models.agentic_agent import AgentSkill

logger = logging.getLogger(__name__)


class AiGrcAgent(BaseAgenticAgent):
    """AI GRC Agent for real-time GRC operations"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        logger.info(f"Initialized AI GRC Agent: {self.name}")
    
    async def execute_skill(
        self,
        skill: str,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a skill
        
        Supported skills:
        - realtime_risk_analysis: Real-time risk analysis for AI agents
        - tprm: Third Party Risk Management
        - ai_agent_onboarding: AI agent onboarding
        """
        start_time = time.time()
        
        try:
            if skill == AgentSkill.REALTIME_RISK_ANALYSIS.value:
                result = await self._realtime_risk_analysis(input_data, context)
            elif skill == AgentSkill.TPRM.value:
                result = await self._tprm_analysis(input_data, context)
            elif skill == AgentSkill.AI_AGENT_ONBOARDING.value:
                result = await self._ai_agent_onboarding(input_data, context)
            elif skill == AgentSkill.OFFBOARDING.value:
                result = await self._agent_offboarding(input_data, context)
            else:
                raise ValueError(f"Skill {skill} not supported by AI GRC Agent")
            
            response_time = (time.time() - start_time) * 1000
            
            # Log interaction
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
    
    async def _realtime_risk_analysis(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform real-time risk analysis for an AI agent
        
        Args:
            input_data: Should contain 'agent_id' or agent data
            context: Additional context
            
        Returns:
            Risk analysis results
        """
        from app.models.agent import Agent
        from app.services.predictive_analytics import PredictiveAnalyticsService
        
        agent_id = input_data.get("agent_id")
        if not agent_id:
            raise ValueError(f"agent_id is required for risk analysis. Received input_data: {input_data}")
        
        # Convert string UUID to UUID object if needed
        if isinstance(agent_id, str):
            try:
                agent_id = UUID(agent_id)
            except (ValueError, TypeError):
                raise ValueError(f"Invalid agent_id format: {agent_id}. Must be a valid UUID string.")
        
        # Get agent from database
        agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Query RAG for risk-related information
        rag_query = f"risk assessment security compliance for {agent.name} {agent.type}"
        rag_results = await self.query_rag(rag_query, context={"agent_id": str(agent_id)})
        
        # Use predictive analytics service
        risk_prediction = await PredictiveAnalyticsService.predict_risk_level(
            self.db,
            str(agent_id)
        )
        
        # Get compliance score
        compliance_score = agent.compliance_score or 0
        risk_score = agent.risk_score or 0
        
        # Generate LLM analysis
        analysis_prompt = f"""
        Analyze the risk profile for AI agent: {agent.name}
        - Type: {agent.type}
        - Compliance Score: {compliance_score}
        - Risk Score: {risk_score}
        - Risk Prediction: {risk_prediction}
        
        Based on the RAG context and risk data, provide:
        1. Overall risk level (LOW/MEDIUM/HIGH/CRITICAL)
        2. Key risk factors
        3. Immediate actions required
        4. Compliance gaps
        """
        
        llm_analysis = await self.call_llm(
            prompt=analysis_prompt,
            system_prompt="You are an AI GRC expert analyzing risk for AI agents.",
            context=rag_results
        )
        
        return {
            "agent_id": str(agent_id),
            "agent_name": agent.name,
            "risk_level": risk_prediction.get("risk_level", "UNKNOWN"),
            "risk_score": risk_score,
            "compliance_score": compliance_score,
            "risk_factors": risk_prediction.get("risk_factors", []),
            "rag_context": rag_results[:3],  # Top 3 results
            "llm_analysis": llm_analysis,
            "timestamp": time.time(),
            "realtime": True
        }
    
    async def _tprm_analysis(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Third Party Risk Management analysis
        
        Args:
            input_data: Should contain vendor/agent information
            context: Additional context
            
        Returns:
            TPRM analysis results
        """
        from app.models.agent import Agent
        from app.models.vendor import Vendor
        
        agent_id = input_data.get("agent_id")
        vendor_id = input_data.get("vendor_id")
        
        if not agent_id and not vendor_id:
            raise ValueError(
                "TPRM analysis requires either 'agent_id' (Agent.id - vendor's agent) or 'vendor_id' (Vendor.id) "
                "in input_data. Please provide one of these when executing the TPRM skill from Studio."
            )
        
        # Get vendor information
        if vendor_id:
            vendor = self.db.query(Vendor).filter(Vendor.id == vendor_id).first()
            if not vendor:
                raise ValueError(f"Vendor {vendor_id} not found")
        elif agent_id:
            agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
            if not agent:
                raise ValueError(f"Agent {agent_id} not found")
            vendor_id = agent.vendor_id
            vendor = self.db.query(Vendor).filter(Vendor.id == vendor_id).first()
        
        # Query RAG for TPRM requirements and criteria
        rag_query = f"third party risk management vendor {vendor.name} security compliance requirements questionnaire"
        rag_results = await self.query_rag(rag_query)
        
        # Fetch TPRM requirements from database (if available)
        from app.models.submission_requirement import SubmissionRequirement
        # Get tenant_id from context, vendor, or agent
        tenant_id = None
        if context and context.get("tenant_id"):
            tenant_id = UUID(context["tenant_id"]) if isinstance(context["tenant_id"], str) else context["tenant_id"]
        elif vendor:
            tenant_id = vendor.tenant_id
        elif agent_id:
            agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
            if agent:
                tenant_id = agent.tenant_id
        else:
            # Fallback to agent's tenant_id
            tenant_id = self._get_tenant_id()
        
        tprm_requirements = []
        if tenant_id:
            tprm_requirements = self.db.query(SubmissionRequirement).filter(
                SubmissionRequirement.questionnaire_type == "TPRM- Questionnaire",
                SubmissionRequirement.tenant_id == tenant_id
            ).all()
        
        # Check if questionnaire should be sent
        send_questionnaire = input_data.get("send_questionnaire", False)
        questionnaire_sent = False
        assessment_assignment_id = None
        email_sent = False
        email_error_reason = None
        
        assignment = None  # Initialize assignment variable
        if send_questionnaire:
            # Create assessment assignment for vendor
            from app.services.assessment_service import AssessmentService
            from app.models.assessment import Assessment, AssessmentType, AssessmentStatus
            
            # Find or create TPRM assessment
            # First try: name contains TPRM, status active, and is_active=True
            assessment = self.db.query(Assessment).filter(
                Assessment.name.ilike("%TPRM%"),
                Assessment.tenant_id == tenant_id,
                Assessment.status == AssessmentStatus.ACTIVE.value,
                Assessment.is_active == True
            ).first()
            
            if not assessment:
                # Second try: assessment_type is TPRM, status active, and is_active=True
                assessment = self.db.query(Assessment).filter(
                    Assessment.assessment_type == AssessmentType.TPRM.value,
                    Assessment.tenant_id == tenant_id,
                    Assessment.status == AssessmentStatus.ACTIVE.value,
                    Assessment.is_active == True
                ).first()
            
            if not assessment:
                # Third try: assessment_type is TPRM and is_active=True (ignore status)
                assessment = self.db.query(Assessment).filter(
                    Assessment.assessment_type == AssessmentType.TPRM.value,
                    Assessment.tenant_id == tenant_id,
                    Assessment.is_active == True
                ).order_by(Assessment.created_at.desc()).first()
            
            if not assessment:
                # Fourth try: name contains TPRM and is_active=True (ignore status)
                assessment = self.db.query(Assessment).filter(
                    Assessment.name.ilike("%TPRM%"),
                    Assessment.tenant_id == tenant_id,
                    Assessment.is_active == True
                ).order_by(Assessment.created_at.desc()).first()
            
            # Log what we found for debugging
            if assessment:
                logger.info(f"Found TPRM assessment: id={assessment.id}, name={assessment.name}, type={assessment.assessment_type}, status={assessment.status}, is_active={assessment.is_active}")
            else:
                # Log all TPRM assessments for this tenant to help debug
                all_tprm = self.db.query(Assessment).filter(
                    Assessment.tenant_id == tenant_id
                ).filter(
                    (Assessment.name.ilike("%TPRM%")) | (Assessment.assessment_type == AssessmentType.TPRM.value)
                ).all()
                logger.warning(f"No active TPRM assessment found for tenant {tenant_id}. Found {len(all_tprm)} TPRM-related assessments:")
                for a in all_tprm:
                    logger.warning(f"  - id={a.id}, name={a.name}, type={a.assessment_type}, status={a.status}, is_active={a.is_active}")
            
            if assessment:
                assessment_service = AssessmentService(self.db)
                try:
                    # Get a system user or use assessment owner as assigned_by
                    assigned_by_user_id = assessment.owner_id
                    if context and context.get("triggered_by"):
                        assigned_by_user_id = UUID(context["triggered_by"]) if isinstance(context["triggered_by"], str) else context["triggered_by"]
                    
                    assignment = assessment_service.create_assignment(
                        assessment_id=assessment.id,
                        assignment_data={
                            "assignment_type": "tprm_review",
                            "status": "pending",
                            "vendor_id": vendor_id
                        },
                        tenant_id=tenant_id,
                        assigned_by=assigned_by_user_id,
                        schedule_id=None
                    )
                    assessment_assignment_id = str(assignment.id)
                    questionnaire_sent = True
                    logger.info(f"Created TPRM assessment assignment {assignment.id} for vendor {vendor_id}")
                    
                    # Send email notification to vendor using integration system
                    email_sent = False
                    email_error_reason = None
                    if vendor and vendor.contact_email:
                        try:
                            from app.services.agentic.agentic_action_service import AgenticActionService
                            
                            # Use AgenticActionService to send email via integration system
                            action_service = AgenticActionService(self.db, tenant_id)
                            
                            # Build email configuration
                            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
                            assessment_url = f"{frontend_url}/assessments/{assignment.id}"
                            
                            email_config = {
                                "enabled": True,
                                "send_on": "after",
                                "recipients": [
                                    {
                                        "type": "custom",
                                        "value": vendor.contact_email
                                    }
                                ],
                                "subject": f"TPRM Questionnaire Assignment: {assessment.name}",
                                "body_template": f"""
                                <html>
                                <body>
                                    <h2>TPRM Questionnaire Assignment</h2>
                                    <p>Dear {vendor.name},</p>
                                    <p>You have been assigned a Third-Party Risk Management (TPRM) questionnaire.</p>
                                    <p><strong>Assessment:</strong> {assessment.name}</p>
                                    <p><strong>Due Date:</strong> {assignment.due_date.strftime('%Y-%m-%d') if assignment.due_date else 'Not specified'}</p>
                                    <p><a href="{assessment_url}">Complete Questionnaire</a></p>
                                    <p>If you have any questions, please contact your account manager.</p>
                                </body>
                                </html>
                                """
                            }
                            
                            # Build execution result for email template variables
                            execution_result = {
                                "vendor_name": vendor.name,
                                "vendor_email": vendor.contact_email,
                                "assessment_name": assessment.name,
                                "assessment_url": assessment_url,
                                "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
                                "questionnaire_sent": True,
                                "assessment_assignment_id": str(assignment.id)
                            }
                            
                            # Send email via integration system
                            email_result = await action_service.execute_email_action(
                                email_config,
                                execution_result=execution_result,
                                context={
                                    "vendor_id": str(vendor_id),
                                    "assessment_id": str(assessment.id),
                                    "assignment_id": str(assignment.id)
                                }
                            )
                            
                            if email_result.get("sent"):
                                email_sent = True
                                logger.info(f"✅ Sent TPRM questionnaire notification email to {vendor.contact_email} via integration system")
                            else:
                                # Get error reason from result - check reason field first, then check results for errors
                                email_error_reason = email_result.get('reason')
                                if not email_error_reason and email_result.get("results"):
                                    # Extract error from first failed result
                                    for result in email_result.get("results", []):
                                        if result.get("error"):
                                            email_error_reason = result.get("error")
                                            break
                                        elif not result.get("sent"):
                                            email_error_reason = result.get("reason", "Email sending failed")
                                            break
                                
                                if not email_error_reason:
                                    email_error_reason = "Email sending failed. Please check SMTP configuration in /integrations page."
                                
                                logger.warning(f"❌ Failed to send email notification to {vendor.contact_email}: {email_error_reason}")
                                # Log detailed error information
                                if email_result.get("results"):
                                    for result in email_result.get("results", []):
                                        if result.get("error"):
                                            logger.error(f"Email error details for {result.get('recipient', 'unknown')}: {result.get('error')}")
                                logger.warning(f"Email result: {email_result}")
                        except Exception as email_error:
                            email_error_reason = f"Email service error: {str(email_error)}"
                            logger.error(f"Failed to send email notification via integration system: {email_error}", exc_info=True)
                            # Don't fail the assignment creation if email fails
                    else:
                        email_error_reason = "Vendor email not available"
                except Exception as e:
                    logger.error(f"Failed to create assessment assignment: {e}", exc_info=True)
            else:
                logger.warning(f"No active TPRM assessment found for tenant {tenant_id}. Please create a TPRM assessment first.")
        
        # Analyze vendor risk based on available data
        # In production, this would integrate with TPRM systems and consider questionnaire responses
        
        # Build result with integration-ready data
        result = {
            "vendor_id": str(vendor_id),
            "vendor_name": vendor.name if vendor else "Unknown",
            "vendor_email": vendor.contact_email if vendor else None,
            "tprm_score": 75,  # Placeholder - would be calculated from questionnaire responses
            "risk_categories": {
                "security": "MEDIUM",
                "compliance": "LOW",
                "financial": "LOW",
                "operational": "MEDIUM"
            },
            "rag_context": rag_results[:3],
            "requirements_fetched": len(tprm_requirements),
            "questionnaire_sent": questionnaire_sent,
            "email_sent": email_sent if send_questionnaire else None,
            "email_error": email_error_reason if (send_questionnaire and not email_sent) else None,
            "assessment_assignment_id": assessment_assignment_id,
            "assessment_name": assessment.name if assessment else None,
            "assessment_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/assessments/{assessment_assignment_id}" if assessment_assignment_id else None,
            "due_date": assignment.due_date.isoformat() if (questionnaire_sent and assignment and assignment.due_date) else None,
            "recommendations": [
                "Conduct annual security assessment",
                "Review data processing agreements",
                "Monitor compliance certifications"
            ],
            "next_steps": [
                "Questionnaire assignment created" if questionnaire_sent else "Questionnaire can be sent by setting send_questionnaire=true",
                "Email notification sent to vendor" if (questionnaire_sent and email_sent) else (
                    f"Email notification not sent: {email_error_reason}. Please configure SMTP in /integrations page." if email_error_reason else "Email notification will be sent to vendor"
                ),
                "Wait for vendor responses",
                "Review responses and update TPRM score"
            ] if send_questionnaire else [
                "To send questionnaire, set send_questionnaire=true in input_data",
                "Questionnaire will be created and assigned to vendor",
                "Email notification will be sent automatically to vendor's email (requires SMTP configuration in /integrations page)"
            ],
            "error": "No active TPRM assessment found. Please create a TPRM assessment in Assessment Management first." if (send_questionnaire and not questionnaire_sent) else None,
            "warning": "No active TPRM assessment found. Please create a TPRM assessment in Assessment Management to send questionnaires." if (send_questionnaire and not questionnaire_sent) else None,
            "requires_tprm_assessment": send_questionnaire and not questionnaire_sent,
            "debug_info": {
                "send_questionnaire_requested": send_questionnaire,
                "assessment_found": assessment is not None if send_questionnaire else None,
                "tenant_id": str(tenant_id) if tenant_id else None
            } if send_questionnaire else None
        }
        
        return result
    
    async def _ai_agent_onboarding(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        AI Agent onboarding workflow
        
        Args:
            input_data: Agent onboarding data
            context: Additional context
            
        Returns:
            Onboarding results
        """
        from app.models.agent import Agent
        from app.models.workflow_config import OnboardingRequest
        
        agent_id = input_data.get("agent_id")
        if not agent_id:
            raise ValueError("agent_id is required for onboarding")
        
        agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Query RAG for onboarding requirements
        rag_query = f"onboarding requirements for AI agent {agent.type} {agent.category}"
        rag_results = await self.query_rag(rag_query, context={"agent_id": str(agent_id)})
        
        # Check existing onboarding request
        onboarding_request = self.db.query(OnboardingRequest).filter(
            OnboardingRequest.agent_id == agent_id,
            OnboardingRequest.status.in_(["pending", "in_review"])
        ).first()
        
        # Generate onboarding checklist
        checklist = [
            "Security assessment completed",
            "Compliance review initiated",
            "Risk assessment in progress",
            "Technical review assigned",
            "Business review pending"
        ]
        
        return {
            "agent_id": str(agent_id),
            "agent_name": agent.name,
            "onboarding_status": onboarding_request.status if onboarding_request else "not_started",
            "onboarding_request_id": str(onboarding_request.id) if onboarding_request else None,
            "checklist": checklist,
            "rag_context": rag_results[:3],
            "next_steps": [
                "Complete security assessment",
                "Submit compliance documentation",
                "Schedule technical review"
            ]
        }
    
    async def _agent_offboarding(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        AI Agent offboarding workflow
        
        Args:
            input_data: Agent offboarding data (should contain 'agent_id' and optionally 'reason', 'reason_details', 'target_date', 'replacement_agent_id')
            context: Additional context
            
        Returns:
            Offboarding results including offboarding request creation, impact analysis, and knowledge extraction
        """
        from app.models.agent import Agent, AgentStatus
        from app.models.offboarding import OffboardingRequest, OffboardingStatus, OffboardingReason
        from uuid import UUID as UUIDType
        
        agent_id = input_data.get("agent_id")
        reason = input_data.get("reason", "other")
        reason_details = input_data.get("reason_details")
        target_date = input_data.get("target_date")
        replacement_agent_id = input_data.get("replacement_agent_id")
        
        if not agent_id:
            raise ValueError("agent_id is required for offboarding")
        
        # Validate agent_id is UUID
        try:
            agent_uuid = UUIDType(agent_id) if isinstance(agent_id, str) else agent_id
        except (ValueError, TypeError):
            raise ValueError(f"Invalid agent_id format: {agent_id}")
        
        agent = self.db.query(Agent).filter(Agent.id == agent_uuid).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Validate reason
        valid_reasons = [r.value for r in OffboardingReason]
        if reason not in valid_reasons:
            raise ValueError(f"Invalid reason. Must be one of: {', '.join(valid_reasons)}")
        
        # Query RAG for offboarding requirements
        rag_query = f"offboarding requirements for AI agent {agent.type} {agent.category} knowledge transfer data retention"
        rag_results = await self.query_rag(rag_query, context={"agent_id": str(agent_id)})
        
        # Check existing offboarding request
        existing_request = self.db.query(OffboardingRequest).filter(
            OffboardingRequest.agent_id == agent_uuid,
            OffboardingRequest.status.in_([OffboardingStatus.INITIATED.value, OffboardingStatus.IN_PROGRESS.value])
        ).first()
        
        if existing_request:
            return {
                "agent_id": str(agent_id),
                "agent_name": agent.name,
                "offboarding_status": existing_request.status,
                "offboarding_request_id": str(existing_request.id),
                "message": "Offboarding request already exists",
                "impact_analysis": existing_request.impact_analysis,
                "dependency_mapping": existing_request.dependency_mapping,
                "knowledge_extracted": existing_request.knowledge_extracted,
                "rag_context": rag_results[:3],
                "next_steps": [
                    "Review existing offboarding request",
                    "Continue with impact analysis if not done",
                    "Extract knowledge if not done",
                    "Complete offboarding process"
                ]
            }
        
        # Create offboarding request
        offboarding_request = OffboardingRequest(
            agent_id=agent_uuid,
            tenant_id=self.tenant_id,
            requested_by=input_data.get("requested_by"),  # Should be set from context
            reason=reason,
            reason_details=reason_details,
            target_date=target_date,
            replacement_agent_id=UUIDType(replacement_agent_id) if replacement_agent_id else None,
            status=OffboardingStatus.INITIATED.value
        )
        
        self.db.add(offboarding_request)
        self.db.commit()
        self.db.refresh(offboarding_request)
        
        # Perform impact analysis
        impact_analysis = {
            "affected_systems": [],
            "dependencies": [],
            "users_affected": 0,
            "risk_level": "medium",
            "estimated_effort": "medium",
            "analysis_date": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Query for dependencies (assessments, workflows, etc.)
        from app.models.assessment import AssessmentAssignment
        from app.models.agentic_flow import AgenticFlow
        
        # Find assessments using this agent
        assessments = self.db.query(AssessmentAssignment).filter(
            AssessmentAssignment.agent_id == agent_uuid
        ).all()
        
        # Find flows using this agent
        flows = self.db.query(AgenticFlow).filter(
            AgenticFlow.tenant_id == self.tenant_id
        ).all()
        
        agent_flows = []
        for flow in flows:
            flow_def = flow.flow_definition or {}
            nodes = flow_def.get("nodes", [])
            for node in nodes:
                if node.get("agent_id") == str(agent_uuid):
                    agent_flows.append({
                        "flow_id": str(flow.id),
                        "flow_name": flow.name
                    })
                    break
        
        impact_analysis["affected_systems"] = [
            f"Assessment: {a.id}" for a in assessments[:5]
        ]
        impact_analysis["dependencies"] = agent_flows[:5]
        impact_analysis["users_affected"] = len(assessments)
        
        # Update request with impact analysis
        offboarding_request.impact_analysis = impact_analysis
        offboarding_request.status = OffboardingStatus.IN_PROGRESS.value
        self.db.commit()
        
        # Generate offboarding checklist
        checklist = {
            "impact_analysis": "COMPLETED",
            "knowledge_extraction": "PENDING",
            "data_retrieval": "PENDING",
            "access_revocation": "PENDING",
            "documentation_archive": "PENDING",
            "final_review": "PENDING"
        }
        
        return {
            "agent_id": str(agent_id),
            "agent_name": agent.name,
            "offboarding_status": offboarding_request.status,
            "offboarding_request_id": str(offboarding_request.id),
            "reason": reason,
            "reason_details": reason_details,
            "target_date": target_date.isoformat() if target_date else None,
            "replacement_agent_id": str(replacement_agent_id) if replacement_agent_id else None,
            "impact_analysis": impact_analysis,
            "dependency_mapping": {
                "assessments_count": len(assessments),
                "flows_count": len(agent_flows),
                "affected_flows": agent_flows
            },
            "checklist": checklist,
            "rag_context": rag_results[:3],
            "next_steps": [
                "Review impact analysis",
                "Extract knowledge from agent",
                "Retrieve agent data",
                "Revoke system access",
                "Archive documentation",
                "Complete final review"
            ]
        }
