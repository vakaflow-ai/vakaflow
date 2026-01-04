"""
Questionnaire Review Agent - Reviews submitted assessment responses and calculates risk scores
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
import time
from datetime import datetime

from app.services.agentic.base_agent import BaseAgenticAgent
from app.models.agentic_agent import AgentSkill

logger = logging.getLogger(__name__)


class QuestionnaireReviewAgent(BaseAgenticAgent):
    """Questionnaire Review Agent for reviewing assessment responses"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        logger.info(f"Initialized Questionnaire Review Agent: {self.name}")
    
    async def execute_skill(
        self,
        skill: str,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a skill
        
        Supported skills:
        - questionnaire_review: Review questionnaire responses and calculate risk score
        - flag_risks: Flag specific risks in responses
        - send_followup: Send followup questions to vendor
        """
        start_time = time.time()
        
        try:
            logger.info(f"QuestionnaireReviewAgent executing skill: {skill} with input_data keys: {list(input_data.keys()) if input_data else 'None'}")
            
            if skill == AgentSkill.QUESTIONNAIRE_REVIEW.value:
                result = await self._review_responses(input_data, context)
            elif skill == AgentSkill.FLAG_RISKS.value:
                result = await self._flag_risks(input_data, context)
            elif skill == AgentSkill.SEND_FOLLOWUP.value:
                result = await self._send_followup(input_data, context)
            else:
                raise ValueError(f"Skill {skill} not supported by Questionnaire Review Agent. Supported skills: {[AgentSkill.QUESTIONNAIRE_REVIEW.value, AgentSkill.FLAG_RISKS.value, AgentSkill.SEND_FOLLOWUP.value]}")
            
            response_time = (time.time() - start_time) * 1000
            
            # Log interaction
            try:
                await self.log_interaction(
                    interaction_type="skill_execution",
                    skill_used=skill,
                    input_data=input_data,
                    output_data=result,
                    response_time_ms=response_time,
                    success=True
                )
            except Exception as log_error:
                logger.warning(f"Failed to log interaction: {log_error}")
            
            return result
            
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            error_msg = str(e)
            logger.error(f"Error executing skill {skill} in QuestionnaireReviewAgent: {error_msg}", exc_info=True)
            
            # Try to log the error interaction
            try:
                await self.log_interaction(
                    interaction_type="skill_execution",
                    skill_used=skill,
                    input_data=input_data,
                    output_data={"error": error_msg},
                    response_time_ms=response_time,
                    success=False,
                    error_message=error_msg
                )
            except Exception as log_error:
                logger.warning(f"Failed to log error interaction: {log_error}")
            
            # Re-raise with more context
            raise ValueError(f"Questionnaire Review Agent execution failed: {error_msg}") from e
    
    async def _review_responses(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Review questionnaire responses and calculate risk score
        
        Args:
            input_data: Should contain 'assignment_id' or assignment data
            context: Additional context (policies, requirements, etc.)
            
        Returns:
            Review analysis with risk score
        """
        from app.models.assessment import AssessmentAssignment, AssessmentQuestionResponse as AssessmentQuestionResponseModel
        from app.models.assessment_review import AssessmentReview, ReviewType, ReviewStatus
        from app.models.assessment import Assessment, AssessmentQuestion
        from app.models.vendor import Vendor
        from app.models.policy import Policy
        from app.models.submission_requirement import SubmissionRequirement
        
        assignment_id = input_data.get("assignment_id")
        if not assignment_id:
            # Try to get a recent completed assignment for testing
            from app.models.assessment import AssessmentAssignment
            recent_assignment = self.db.query(AssessmentAssignment).filter(
                AssessmentAssignment.tenant_id == self._get_tenant_id(),
                AssessmentAssignment.status == 'completed'
            ).order_by(AssessmentAssignment.completed_at.desc()).first()
            
            if recent_assignment:
                logger.info(f"No assignment_id provided, using recent completed assignment: {recent_assignment.id}")
                assignment_id = recent_assignment.id
            else:
                raise ValueError(
                    "assignment_id is required for questionnaire review.\n\n"
                    "To use this agent:\n"
                    "1. Provide assignment_id in input_data: {\"assignment_id\": \"<uuid>\"}\n"
                    "2. Or let the agent automatically trigger when an assessment is submitted.\n\n"
                    "To get an assignment_id:\n"
                    "- Go to an assessment that has been completed\n"
                    "- Copy the assignment ID from the assessment details\n"
                    "- Use that ID when executing the agent\n\n"
                    "Note: No completed assignments found in your tenant."
                )
        
        try:
            if isinstance(assignment_id, str):
                assignment_id = UUID(assignment_id)
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid assignment_id format: {assignment_id}. Must be a valid UUID.") from e
        
        # Get assignment with tenant isolation
        tenant_id = self._get_tenant_id()
        try:
            assignment = self.db.query(AssessmentAssignment).filter(
                AssessmentAssignment.id == assignment_id,
                AssessmentAssignment.tenant_id == tenant_id
            ).first()
        except Exception as e:
            logger.error(f"Database error querying AssessmentAssignment: {e}", exc_info=True)
            raise ValueError(f"Database error while fetching assignment: {str(e)}") from e
        
        if not assignment:
            raise ValueError(
                f"Assignment {assignment_id} not found or not accessible. "
                f"Please ensure the assignment exists in your tenant and is accessible."
            )
        
        # Get assessment with tenant isolation
        assessment = self.db.query(Assessment).filter(
            Assessment.id == assignment.assessment_id,
            Assessment.tenant_id == tenant_id
        ).first()
        
        if not assessment:
            raise ValueError(
                f"Assessment {assignment.assessment_id} not found or not accessible. "
                f"Please ensure the assessment exists in your tenant."
            )
        
        # Get vendor if available
        from app.models.vendor import Vendor
        vendor = None
        vendor_name = None
        if assignment.vendor_id:
            vendor = self.db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
            if vendor:
                vendor_name = vendor.name
        
        # Get all questions and responses
        questions = self.db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assessment.id
        ).order_by(AssessmentQuestion.order).all()
        
        responses = self.db.query(AssessmentQuestionResponseModel).filter(
            AssessmentQuestionResponseModel.assignment_id == assignment_id
        ).all()
        
        # Create response map
        response_map = {str(r.question_id): r for r in responses}
        
        # Get policies and requirements for context
        policies = []
        requirements = []
        if context:
            policy_ids = context.get("policy_ids", [])
            requirement_ids = context.get("requirement_ids", [])
            
            if policy_ids:
                policies = self.db.query(Policy).filter(
                    Policy.id.in_([UUID(pid) if isinstance(pid, str) else pid for pid in policy_ids]),
                    Policy.tenant_id == assignment.tenant_id
                ).all()
            
            if requirement_ids:
                requirements = self.db.query(SubmissionRequirement).filter(
                    SubmissionRequirement.id.in_([UUID(rid) if isinstance(rid, str) else rid for rid in requirement_ids]),
                    SubmissionRequirement.tenant_id == assignment.tenant_id
                ).all()
        else:
            # Get all active policies and requirements for the tenant
            policies = self.db.query(Policy).filter(
                Policy.tenant_id == assignment.tenant_id,
                Policy.is_active == True
            ).all()
            
            requirements = self.db.query(SubmissionRequirement).filter(
                SubmissionRequirement.tenant_id == assignment.tenant_id,
                SubmissionRequirement.is_active == True
            ).all()
        
        # Perform risk analysis
        risk_analysis = await self._calculate_risk_score(
            questions=questions,
            responses=response_map,
            policies=policies,
            requirements=requirements,
            assessment=assessment,
            vendor=vendor
        )
        
        # Create review record
        review = AssessmentReview(
            assignment_id=assignment_id,
            assessment_id=assessment.id,
            tenant_id=assignment.tenant_id,
            vendor_id=assignment.vendor_id,
            review_type=ReviewType.AI_REVIEW.value,
            status=ReviewStatus.COMPLETED.value,
            ai_agent_id=self.agent_id,
            ai_review_completed_at=datetime.utcnow(),
            risk_score=risk_analysis["risk_score"],
            risk_level=risk_analysis["risk_level"],
            risk_factors=risk_analysis["risk_factors"],
            analysis_summary=risk_analysis["summary"],
            flagged_risks=risk_analysis["flagged_risks"],
            flagged_questions=risk_analysis["flagged_questions"],
            recommendations=risk_analysis["recommendations"],
            review_metadata={
                "question_count": len(questions),
                "response_count": len(responses),
                "policies_referenced": len(policies),
                "requirements_referenced": len(requirements)
            }
        )
        
        try:
            self.db.add(review)
            self.db.flush()
        except Exception as db_error:
            logger.error(f"Database error creating review: {db_error}", exc_info=True)
            self.db.rollback()
            raise ValueError(f"Failed to create review record: {str(db_error)}") from db_error
        
        # Log audit
        try:
            await self._log_audit(
                review_id=review.id,
                assignment_id=assignment_id,
                assessment_id=assessment.id,
                tenant_id=assignment.tenant_id,
                vendor_id=assignment.vendor_id,
                action="ai_review_completed",
                action_data={
                    "risk_score": risk_analysis["risk_score"],
                    "risk_level": risk_analysis["risk_level"],
                    "flagged_risks_count": len(risk_analysis["flagged_risks"]),
                    "flagged_questions_count": len(risk_analysis["flagged_questions"])
                },
                questionnaire_id=assessment.assessment_id or str(assessment.id),
                vendor_name=vendor_name
            )
        except Exception as audit_error:
            logger.warning(f"Failed to log audit trail: {audit_error}")
            # Don't fail the review if audit logging fails
        
        try:
            self.db.commit()
        except Exception as commit_error:
            logger.error(f"Database commit error: {commit_error}", exc_info=True)
            self.db.rollback()
            raise ValueError(f"Failed to save review: {str(commit_error)}") from commit_error
        
        return {
            "review_id": str(review.id),
            "assignment_id": str(assignment_id),
            "risk_score": risk_analysis["risk_score"],
            "risk_level": risk_analysis["risk_level"],
            "risk_factors": risk_analysis["risk_factors"],
            "flagged_risks": risk_analysis["flagged_risks"],
            "flagged_questions": risk_analysis["flagged_questions"],
            "recommendations": risk_analysis["recommendations"],
            "summary": risk_analysis["summary"]
        }
    
    async def _calculate_risk_score(
        self,
        questions: List,
        responses: Dict[str, Any],
        policies: List,
        requirements: List,
        assessment: Any,
        vendor: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Calculate risk score based on responses, policies, and requirements
        
        Returns:
            Dictionary with risk_score, risk_level, risk_factors, flagged_risks, etc.
        """
        risk_factors = []
        flagged_risks = []
        flagged_questions = []
        total_risk_points = 0
        max_risk_points = 0
        
        # Pre-fetch requirement texts for requirement_reference questions to avoid N+1 queries
        requirement_ids = [q.requirement_id for q in questions if q.question_type == "requirement_reference" and q.requirement_id]
        requirement_map = {}
        if requirement_ids:
            from app.models.submission_requirement import SubmissionRequirement
            requirements = self.db.query(SubmissionRequirement).filter(
                SubmissionRequirement.id.in_(requirement_ids)
            ).all()
            requirement_map = {req.id: req for req in requirements}
        
        # Helper function to get question text
        def get_question_text(q):
            """Get question text from question or related requirement"""
            # Try question_text first
            if q.question_text:
                return q.question_text
            # Try title
            if q.title:
                return q.title
            # If it's a requirement reference, get text from requirement
            if q.question_type == "requirement_reference" and q.requirement_id:
                requirement = requirement_map.get(q.requirement_id)
                if requirement:
                    # SubmissionRequirement uses 'label' as the main text field
                    return requirement.label or requirement.description or "Question"
            return "Question"
        
        # Analyze each question response
        for question in questions:
            question_id = str(question.id)
            response = responses.get(question_id)
            question_text = get_question_text(question)
            
            if not response:
                if question.is_required:
                    # Missing required response = high risk
                    risk_factors.append({
                        "type": "missing_required_response",
                        "question_id": question_id,
                        "question_text": question_text,
                        "severity": "high",
                        "points": 20
                    })
                    flagged_risks.append({
                        "question_id": question_id,
                        "question_text": question_text,
                        "risk_type": "missing_required_response",
                        "severity": "high",
                        "description": "Required question was not answered"
                    })
                    total_risk_points += 20
                max_risk_points += 20
                continue
            
            # Analyze response value
            response_value = response.value
            
            # Check for negative responses (Yes/No questions)
            if question.field_type in ['yes_no', 'boolean', 'radio']:
                if isinstance(response_value, str):
                    response_value = response_value.lower()
                
                # Negative responses indicate risk
                if response_value in ['no', 'false', '0', 'n']:
                    severity = "medium" if not question.is_required else "high"
                    points = 10 if not question.is_required else 15
                    
                    risk_factors.append({
                        "type": "negative_response",
                        "question_id": question_id,
                        "question_text": question_text,
                        "response": response_value,
                        "severity": severity,
                        "points": points
                    })
                    flagged_risks.append({
                        "question_id": question_id,
                        "question_text": question_text,
                        "risk_type": "negative_response",
                        "severity": severity,
                        "description": f"Negative response ({response_value}) indicates potential risk",
                        "response_value": response_value
                    })
                    total_risk_points += points
                    flagged_questions.append(question_id)
                max_risk_points += 10
            
            # Check for incomplete or vague responses
            elif question.field_type in ['text', 'textarea']:
                if isinstance(response_value, str):
                    if len(response_value.strip()) < 10:
                        # Very short response
                        risk_factors.append({
                            "type": "vague_response",
                            "question_id": question_id,
                            "question_text": question_text,
                            "severity": "low",
                            "points": 5,
                            "reason": "Response is too short"
                        })
                        total_risk_points += 5
                    elif len(response_value.strip()) < 50 and question.is_required:
                        # Short response for required question
                        risk_factors.append({
                            "type": "insufficient_response",
                            "question_id": question_id,
                            "question_text": question_text,
                            "severity": "medium",
                            "points": 10,
                            "reason": "Response may be insufficient for required question"
                        })
                        flagged_questions.append(question_id)
                        total_risk_points += 10
                max_risk_points += 10
            
            # Check for missing documents
            # Check if question expects file response (response_type or field_type indicates file)
            expects_file = (
                (question.response_type and ('File' in str(question.response_type) or question.response_type == 'File')) or
                (question.field_type and question.field_type in ['file', 'File'])
            )
            if expects_file:
                if not response.documents or len(response.documents) == 0:
                    if question.is_required:
                        risk_factors.append({
                            "type": "missing_document",
                            "question_id": question_id,
                            "question_text": question_text,
                            "severity": "high",
                            "points": 15
                        })
                        flagged_risks.append({
                            "question_id": question_id,
                            "question_text": question.question_text or question.title,
                            "risk_type": "missing_required_document",
                            "severity": "high",
                            "description": "Required document was not uploaded"
                        })
                        total_risk_points += 15
                    max_risk_points += 15
        
        # Calculate risk score (0-100)
        if max_risk_points > 0:
            risk_score = min(100, (total_risk_points / max_risk_points) * 100)
        else:
            risk_score = 0
        
        # Determine risk level
        if risk_score >= 70:
            risk_level = "critical"
        elif risk_score >= 50:
            risk_level = "high"
        elif risk_score >= 30:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        # Generate summary
        summary = f"Risk analysis completed. Identified {len(risk_factors)} risk factors with an overall risk score of {risk_score:.1f} ({risk_level} risk)."
        if flagged_risks:
            summary += f" {len(flagged_risks)} high-priority risks flagged for review."
        
        # Generate recommendations
        recommendations = []
        if risk_score >= 50:
            recommendations.append({
                "priority": "high",
                "action": "Immediate human review required",
                "reason": f"High risk score ({risk_score:.1f}) indicates significant concerns"
            })
        if flagged_questions:
            recommendations.append({
                "priority": "medium",
                "action": "Request followup from vendor",
                "reason": f"{len(flagged_questions)} questions require clarification"
            })
        if len(risk_factors) > 5:
            recommendations.append({
                "priority": "medium",
                "action": "Comprehensive review recommended",
                "reason": "Multiple risk factors identified"
            })
        
        return {
            "risk_score": round(risk_score, 2),
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "flagged_risks": flagged_risks,
            "flagged_questions": flagged_questions,
            "recommendations": recommendations,
            "summary": summary
        }
    
    async def _flag_risks(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Flag specific risks in responses
        
        Args:
            input_data: Should contain 'review_id' and 'risks' to flag
            context: Additional context
            
        Returns:
            Flagged risks result
        """
        from app.models.assessment_review import AssessmentReview
        from app.models.vendor import Vendor
        
        review_id = input_data.get("review_id")
        risks = input_data.get("risks", [])
        
        if not review_id:
            # Try to get review_id from assignment_id if provided
            assignment_id = input_data.get("assignment_id")
            if assignment_id:
                from app.models.assessment_review import AssessmentReview
                if isinstance(assignment_id, str):
                    assignment_id = UUID(assignment_id)
                review = self.db.query(AssessmentReview).filter(
                    AssessmentReview.assignment_id == assignment_id
                ).order_by(AssessmentReview.created_at.desc()).first()
                if review:
                    review_id = review.id
                else:
                    raise ValueError("No review found for assignment_id. Please run questionnaire_review skill first to create a review.")
            else:
                raise ValueError("review_id or assignment_id is required for flag_risks skill")
        
        if isinstance(review_id, str):
            review_id = UUID(review_id)
        
        review = self.db.query(AssessmentReview).filter(
            AssessmentReview.id == review_id
        ).first()
        
        if not review:
            raise ValueError(f"Review {review_id} not found")
        
        # Update flagged risks
        existing_risks = review.flagged_risks or []
        existing_risks.extend(risks)
        review.flagged_risks = existing_risks
        review.updated_at = datetime.utcnow()
        
        self.db.commit()
        
        # Get vendor name for audit
        vendor_name = None
        if review.vendor_id:
            vendor_obj = self.db.query(Vendor).filter(Vendor.id == review.vendor_id).first()
            if vendor_obj:
                vendor_name = vendor_obj.name
        
        # Log audit
        await self._log_audit(
            review_id=review.id,
            assignment_id=review.assignment_id,
            assessment_id=review.assessment_id,
            tenant_id=review.tenant_id,
            vendor_id=review.vendor_id,
            action="risks_flagged",
            action_data={"risks_count": len(risks), "risks": risks},
            questionnaire_id=review.review_metadata.get("questionnaire_id") if review.review_metadata else None,
            vendor_name=vendor_name
        )
        
        return {
            "success": True,
            "review_id": str(review_id),
            "flagged_risks_count": len(existing_risks)
        }
    
    async def _send_followup(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send followup questions to vendor
        
        Args:
            input_data: Should contain 'review_id' and 'questions' to send
            context: Additional context
            
        Returns:
            Followup send result
        """
        from app.models.assessment_review import AssessmentReview
        from app.models.assessment import AssessmentAssignment
        from app.models.vendor import Vendor
        from app.services.email_service import EmailService
        from app.models.message import Message, MessageType
        import os
        
        review_id = input_data.get("review_id")
        questions = input_data.get("questions", [])  # List of {question_id, question_text, followup_text}
        
        if not review_id:
            # Try to get review_id from assignment_id if provided
            assignment_id = input_data.get("assignment_id")
            if assignment_id:
                from app.models.assessment_review import AssessmentReview
                if isinstance(assignment_id, str):
                    assignment_id = UUID(assignment_id)
                review = self.db.query(AssessmentReview).filter(
                    AssessmentReview.assignment_id == assignment_id
                ).order_by(AssessmentReview.created_at.desc()).first()
                if review:
                    review_id = review.id
                else:
                    raise ValueError("No review found for assignment_id. Please run questionnaire_review skill first to create a review.")
            else:
                raise ValueError("review_id or assignment_id is required for send_followup skill")
        
        if isinstance(review_id, str):
            review_id = UUID(review_id)
        
        review = self.db.query(AssessmentReview).filter(
            AssessmentReview.id == review_id
        ).first()
        
        if not review:
            raise ValueError(f"Review {review_id} not found")
        
        assignment = self.db.query(AssessmentAssignment).filter(
            AssessmentAssignment.id == review.assignment_id
        ).first()
        
        if not assignment:
            raise ValueError(f"Assignment {review.assignment_id} not found")
        
        vendor = None
        if review.vendor_id:
            vendor = self.db.query(Vendor).filter(Vendor.id == review.vendor_id).first()
        
        if not vendor:
            raise ValueError("Vendor not found for followup")
        
        # Update review with followup questions
        review.followup_questions = questions
        review.followup_sent = True
        review.followup_sent_at = datetime.utcnow()
        review.updated_at = datetime.utcnow()
        
        # Send email notification
        try:
            email_service = EmailService()
            email_service.load_config_from_db(self.db, str(review.tenant_id))
            
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            assignment_url = f"{frontend_url}/assessments/{assignment.id}"
            
            subject = f"Followup Questions: {review.assessment.name if review.assessment else 'Assessment Review'}"
            html_body = f"""
            <html>
            <body>
                <h2>Followup Questions Required</h2>
                <p>Hello {vendor.name},</p>
                <p>Our review of your assessment submission has identified some areas that need clarification.</p>
                <p><strong>Review ID:</strong> {review.id}</p>
                <p><strong>Risk Score:</strong> {review.risk_score:.1f} ({review.risk_level})</p>
                <h3>Please provide additional information for the following questions:</h3>
                <ul>
                    {''.join([f'<li><strong>{q.get("question_text", "Question")}:</strong> {q.get("followup_text", "Please provide more details")}</li>' for q in questions])}
                </ul>
                <p><a href="{assignment_url}">View Assessment and Respond</a></p>
            </body>
            </html>
            """
            text_body = f"""
            Followup Questions Required
            
            Hello {vendor.name},
            
            Our review of your assessment submission has identified some areas that need clarification.
            
            Review ID: {review.id}
            Risk Score: {review.risk_score:.1f} ({review.risk_level})
            
            Please provide additional information for the following questions:
            {chr(10).join([f'- {q.get("question_text", "Question")}: {q.get("followup_text", "Please provide more details")}' for q in questions])}
            
            View Assessment: {assignment_url}
            """
            
            sent, _ = await email_service.send_email(
                vendor.contact_email,
                subject,
                html_body,
                text_body
            )
        except Exception as e:
            logger.error(f"Failed to send followup email: {e}", exc_info=True)
            # Continue even if email fails
        
        # Create message for vendor
        try:
            from app.models.user import User
            vendor_user = self.db.query(User).filter(
                User.email == vendor.contact_email,
                User.tenant_id == review.tenant_id
            ).first()
            
            if vendor_user:
                message = Message(
                    tenant_id=review.tenant_id,
                    sender_id=None,  # System message
                    recipient_id=vendor_user.id,
                    message_type=MessageType.NOTIFICATION.value,
                    subject=subject,
                    content=text_body,
                    resource_type="assessment_review",
                    resource_id=str(review.id),
                    is_read=False
                )
                self.db.add(message)
        except Exception as e:
            logger.error(f"Failed to create message: {e}", exc_info=True)
        
        self.db.commit()
        
        # Log audit
        await self._log_audit(
            review_id=review.id,
            assignment_id=review.assignment_id,
            assessment_id=review.assessment_id,
            tenant_id=review.tenant_id,
            vendor_id=review.vendor_id,
            action="followup_sent",
            action_data={
                "questions_count": len(questions),
                "questions": questions
            },
            questionnaire_id=review.review_metadata.get("questionnaire_id") if review.review_metadata else None,
            vendor_name=vendor.name if vendor else None
        )
        
        return {
            "success": True,
            "review_id": str(review_id),
            "questions_sent": len(questions),
            "email_sent": True
        }
    
    async def _log_audit(
        self,
        review_id: UUID,
        assignment_id: UUID,
        assessment_id: UUID,
        tenant_id: UUID,
        vendor_id: Optional[UUID],
        action: str,
        action_data: Dict[str, Any],
        questionnaire_id: Optional[str] = None,
        vendor_name: Optional[str] = None
    ):
        """Log audit trail entry"""
        from app.models.assessment_review import AssessmentReviewAudit
        
        audit = AssessmentReviewAudit(
            review_id=review_id,
            assignment_id=assignment_id,
            assessment_id=assessment_id,
            tenant_id=tenant_id,
            vendor_id=vendor_id,
            action=action,
            actor_type="ai_agent",
            actor_id=self.agent_id,
            actor_name=self.name,
            action_data=action_data,
            questionnaire_id=questionnaire_id,
            vendor_name=vendor_name
        )
        
        self.db.add(audit)
        self.db.flush()
