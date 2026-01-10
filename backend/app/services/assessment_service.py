"""
Service layer for assessment/evaluation business logic
Follows separation of concerns - business logic separated from API routes
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
# Use timedelta for date calculations (dateutil not available)
# from dateutil.relativedelta import relativedelta
from app.models.assessment import (
    Assessment, AssessmentQuestion, AssessmentSchedule, AssessmentAssignment,
    AssessmentQuestionResponse, AssessmentType, AssessmentStatus, ScheduleFrequency, QuestionType
)
from app.models.vendor import Vendor
from app.models.agent import Agent
from app.core.audit import audit_service, AuditAction
from app.services.business_rules_engine import BusinessRulesEngine
import logging

logger = logging.getLogger(__name__)


class AssessmentService:
    """Service for managing assessments and evaluations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_assessment(
        self,
        assessment_data: dict,
        tenant_id: UUID,
        created_by: UUID
    ) -> Assessment:
        """Create a new assessment
        
        Args:
            assessment_data: Assessment data dictionary
            tenant_id: Tenant UUID
            created_by: User UUID who created the assessment
        
        Returns:
            Created Assessment instance
        
        Raises:
            ValueError: If validation fails
            IntegrityError: If database constraint violation
        """
        # Validate assessment type
        if assessment_data.get('assessment_type') not in [e.value for e in AssessmentType]:
            raise ValueError(f"Invalid assessment type: {assessment_data.get('assessment_type')}")
        
        # Create a copy to avoid mutating the original dict
        assessment_dict = assessment_data.copy()
        
        # Extract owner_id to avoid duplicate keyword argument
        owner_id = assessment_dict.pop('owner_id', created_by)
        if isinstance(owner_id, str):
            owner_id = UUID(owner_id)
        
        # Remove fields that are passed explicitly
        assessment_dict.pop('tenant_id', None)
        assessment_dict.pop('created_by', None)
        assessment_dict.pop('is_active', None)
        assessment_dict.pop('assessment_id', None)  # Will be generated
        
        # Generate human-readable assessment_id if not provided
        # Format: ASS-{type}-{timestamp}-{random}
        import random
        import string
        from datetime import datetime
        assessment_type_short = assessment_dict.get('assessment_type', 'CUST')[:4].upper()
        timestamp = datetime.utcnow().strftime('%Y%m%d')
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        assessment_id = f"ASS-{assessment_type_short}-{timestamp}-{random_suffix}"
        
        # Ensure uniqueness
        existing = self.db.query(Assessment).filter(Assessment.assessment_id == assessment_id).first()
        if existing:
            # If exists, add more random characters
            assessment_id = f"{assessment_id}-{''.join(random.choices(string.ascii_uppercase + string.digits, k=2))}"
        
        assessment = Assessment(
            tenant_id=tenant_id,
            created_by=created_by,
            owner_id=owner_id,
            is_active=True,
            assessment_id=assessment_id,
            **assessment_dict
        )
        
        try:
            self.db.add(assessment)
            self.db.commit()
            self.db.refresh(assessment)

            # Auto-populate questions for the assessment based on type
            self._populate_assessment_questions(assessment, tenant_id)
            
            # Validate that assessment has at least one question
            question_count = self.db.query(AssessmentQuestion).filter(
                AssessmentQuestion.assessment_id == assessment.id,
                AssessmentQuestion.tenant_id == tenant_id
            ).count()
            
            if question_count == 0:
                # Rollback the assessment creation
                self.db.rollback()
                raise ValueError("Assessment must have at least one question. Please add questions from the question library or create custom questions before saving the assessment.")

            # Audit log
            audit_service.log_action(
                db=self.db,
                user_id=str(created_by),
                action=AuditAction.CREATE,
                resource_type="assessment",
                resource_id=str(assessment.id),
                tenant_id=str(tenant_id),
                details={"name": assessment.name, "assessment_type": assessment.assessment_type},
                ip_address=None,
                user_agent=None
            )

            return assessment
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error creating assessment: {e}")
            raise ValueError("Failed to create assessment due to database constraint violation")

    def _populate_assessment_questions(
        self,
        assessment: Assessment,
        tenant_id: UUID
    ) -> None:
        """Auto-populate assessment with questions based on assessment type

        Args:
            assessment: Assessment instance
            tenant_id: Tenant UUID
        """
        try:
            from app.models.question_library import QuestionLibrary

            # For all assessment types, populate from question library
            # Get both platform-wide (tenant_id = NULL) and tenant-specific questions
            platform_questions = self.db.query(QuestionLibrary).filter(
                QuestionLibrary.tenant_id.is_(None),
                QuestionLibrary.is_active == True
            ).all()
            
            tenant_questions = self.db.query(QuestionLibrary).filter(
                QuestionLibrary.tenant_id == tenant_id,
                QuestionLibrary.is_active == True
            ).all()
            
            all_questions = platform_questions + tenant_questions
            
            # Filter questions based on assessment type
            questions = []
            for q in all_questions:
                if not q.assessment_type:
                    continue
                
                # Normalize assessment_type to a list
                q_types = q.assessment_type
                if isinstance(q_types, str):
                    try:
                        import json
                        q_types = json.loads(q_types)
                    except (json.JSONDecodeError, ValueError):
                        q_types = [q_types]
                elif not isinstance(q_types, list):
                    q_types = [q_types] if q_types else []
                
                # Check if assessment type (case-insensitive) is in the question's assessment_type array
                q_types_lower = [str(t).lower() if t else "" for t in q_types]
                if assessment.assessment_type.lower() in q_types_lower:
                    questions.append(q)
            
            # If no questions found by assessment type, try to match by compliance frameworks
            # (This would require adding compliance_framework_ids to Assessment model)
            
            if questions:
                logger.info(f"Found {len(questions)} questions in library for {assessment.assessment_type} assessments (out of {len(all_questions)} total questions) for tenant {tenant_id}")
                logger.info(f"Populating {assessment.assessment_type} assessment {assessment.id} with {len(questions)} questions from library")
                
                for order, question in enumerate(questions):
                    # Map QuestionLibrary fields to AssessmentQuestion fields
                    assessment_question = AssessmentQuestion(
                        assessment_id=assessment.id,
                        tenant_id=tenant_id,
                        question_type="new_question",
                        question_text=question.question_text,
                        title=question.title if hasattr(question, 'title') else None,
                        description=question.description,
                        field_type=question.field_type,
                        response_type=question.response_type if hasattr(question, 'response_type') else None,
                        category=question.category if hasattr(question, 'category') else None,
                        is_required=question.is_required,
                        options=question.options,
                        validation_rules=question.validation_rules,
                        order=order
                    )
                    
                    self.db.add(assessment_question)
                    logger.debug(f"Added question '{question.question_text[:50]}...' to assessment")
                
                self.db.commit()
                logger.info(f"Successfully populated assessment {assessment.id} with {len(questions)} questions")
            else:
                logger.warning(
                    f"No questions found in library for {assessment.assessment_type} assessments. Assessment {assessment.id} created without questions. "
                    f"Tenant ID: {tenant_id}. Please add questions manually or ensure question library has questions for this assessment type."
                )

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to populate assessment {assessment.id} with questions: {e}")
            # Don't raise exception - assessment should still be created even if question population fails

    def update_assessment(
        self,
        assessment_id: UUID,
        update_data: dict,
        updated_by: UUID
    ) -> Assessment:
        """Update an existing assessment
        
        Args:
            assessment_id: Assessment UUID
            update_data: Dictionary of fields to update
            updated_by: User UUID who updated the assessment
        
        Returns:
            Updated Assessment instance
        
        Raises:
            ValueError: If assessment not found
        """
        assessment = self.db.query(Assessment).filter(
            Assessment.id == assessment_id
        ).first()
        
        if not assessment:
            raise ValueError(f"Assessment with ID {assessment_id} not found")
        
        # Update fields
        for key, value in update_data.items():
            if hasattr(assessment, key) and value is not None:
                setattr(assessment, key, value)
        
        # Set updated_by
        assessment.updated_by = updated_by
        
        assessment.updated_at = datetime.utcnow()
        
        try:
            self.db.commit()
            self.db.refresh(assessment)
            
            # Audit log
            audit_service.log_action(
                db=self.db,
                user_id=str(updated_by),
                action=AuditAction.UPDATE,
                resource_type="assessment",
                resource_id=str(assessment_id),
                tenant_id=str(assessment.tenant_id),
                details={"updated_fields": list(update_data.keys())},
                ip_address=None,
                user_agent=None
            )
            
            return assessment
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error updating assessment: {e}")
            raise ValueError("Failed to update assessment due to database constraint violation")
    
    def delete_assessment(
        self,
        assessment_id: UUID,
        deleted_by: UUID
    ) -> None:
        """Delete an assessment (soft delete by setting is_active=False)
        
        Args:
            assessment_id: Assessment UUID
            deleted_by: User UUID who deleted the assessment
        
        Raises:
            ValueError: If assessment not found
        """
        assessment = self.db.query(Assessment).filter(
            Assessment.id == assessment_id
        ).first()
        
        if not assessment:
            raise ValueError(f"Assessment with ID {assessment_id} not found")
        
        # Soft delete
        assessment.is_active = False
        assessment.status = AssessmentStatus.ARCHIVED.value
        
        try:
            self.db.commit()
            
            # Audit log
            audit_service.log_action(
                db=self.db,
                user_id=str(deleted_by),
                action=AuditAction.DELETE,
                resource_type="assessment",
                resource_id=str(assessment_id),
                tenant_id=str(assessment.tenant_id),
                details={"name": assessment.name, "assessment_type": assessment.assessment_type},
                ip_address=None,
                user_agent=None
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting assessment: {e}")
            raise ValueError("Failed to delete assessment")
    
    def add_question(
        self,
        assessment_id: UUID,
        question_data: dict,
        tenant_id: UUID
    ) -> AssessmentQuestion:
        """Add a question to an assessment
        
        Args:
            assessment_id: Assessment UUID
            question_data: Question data dictionary
            tenant_id: Tenant UUID
        
        Returns:
            Created AssessmentQuestion instance
        
        Raises:
            ValueError: If assessment not found or validation fails
        """
        assessment = self.db.query(Assessment).filter(
            Assessment.id == assessment_id
        ).first()
        
        if not assessment:
            raise ValueError(f"Assessment with ID {assessment_id} not found")
        
        # Get max order for this assessment
        max_order = self.db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assessment_id
        ).count()
        
        # Create a copy to avoid mutating the original dict
        question_dict = question_data.copy()
        
        # Extract order to avoid duplicate keyword argument
        order = question_dict.pop('order', max_order)
        
        # Remove fields that are passed explicitly
        question_dict.pop('assessment_id', None)
        question_dict.pop('tenant_id', None)
        
        question = AssessmentQuestion(
            assessment_id=assessment_id,
            tenant_id=tenant_id,
            order=order,
            **question_dict
        )
        
        try:
            self.db.add(question)
            self.db.commit()
            self.db.refresh(question)
            return question
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error adding question: {e}")
            raise ValueError("Failed to add question due to database constraint violation")
    
    def update_question(
        self,
        question_id: UUID,
        update_data: dict
    ) -> AssessmentQuestion:
        """Update an assessment question
        
        Args:
            question_id: Question UUID
            update_data: Dictionary of fields to update
        
        Returns:
            Updated AssessmentQuestion instance
        
        Raises:
            ValueError: If question not found
        """
        question = self.db.query(AssessmentQuestion).filter(
            AssessmentQuestion.id == question_id
        ).first()
        
        if not question:
            raise ValueError(f"Question with ID {question_id} not found")
        
        # Update fields
        for key, value in update_data.items():
            if hasattr(question, key) and value is not None:
                setattr(question, key, value)
        
        question.updated_at = datetime.utcnow()
        
        try:
            self.db.commit()
            self.db.refresh(question)
            return question
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error updating question: {e}")
            raise ValueError("Failed to update question due to database constraint violation")
    
    def delete_question(
        self,
        question_id: UUID
    ) -> None:
        """Delete an assessment question
        
        Args:
            question_id: Question UUID
        
        Raises:
            ValueError: If question not found or has existing responses
        """
        question = self.db.query(AssessmentQuestion).filter(
            AssessmentQuestion.id == question_id
        ).first()
        
        if not question:
            raise ValueError(f"Question with ID {question_id} not found")
        
        # Check if there are any responses to this question
        response_count = self.db.query(AssessmentQuestionResponse).filter(
            AssessmentQuestionResponse.question_id == question_id
        ).count()
        
        if response_count > 0:
            raise ValueError(
                f"Cannot delete question: {response_count} response(s) exist for this question. "
                "Please remove all responses before deleting the question."
            )
        
        try:
            self.db.delete(question)
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting question: {e}", exc_info=True)
            # Check if it's a foreign key constraint violation
            if "foreign key constraint" in str(e).lower() or "ForeignKeyViolation" in str(type(e).__name__):
                raise ValueError(
                    "Cannot delete question: It has associated responses. "
                    "Please remove all responses before deleting the question."
                )
            raise ValueError(f"Failed to delete question: {str(e)}")
    
    def reorder_questions(
        self,
        assessment_id: UUID,
        question_orders: List[Dict[str, Any]]  # [{"question_id": "...", "order": 0}, ...]
    ) -> None:
        """Reorder questions within an assessment
        
        Args:
            assessment_id: Assessment UUID
            question_orders: List of question_id and order pairs
        
        Raises:
            ValueError: If validation fails
        """
        for item in question_orders:
            question_id = UUID(item['question_id'])
            order = item['order']
            
            question = self.db.query(AssessmentQuestion).filter(
                AssessmentQuestion.id == question_id,
                AssessmentQuestion.assessment_id == assessment_id
            ).first()
            
            if question:
                question.order = order
        
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error reordering questions: {e}")
            raise ValueError("Failed to reorder questions")
    
    def create_schedule(
        self,
        assessment_id: UUID,
        schedule_data: dict,
        tenant_id: UUID,
        created_by: UUID
    ) -> AssessmentSchedule:
        """Create an assessment schedule
        
        Args:
            assessment_id: Assessment UUID
            schedule_data: Schedule data dictionary
            tenant_id: Tenant UUID
            created_by: User UUID who created the schedule
        
        Returns:
            Created AssessmentSchedule instance
        
        Raises:
            ValueError: If assessment not found or validation fails
        """
        assessment = self.db.query(Assessment).filter(
            Assessment.id == assessment_id
        ).first()
        
        if not assessment:
            raise ValueError(f"Assessment with ID {assessment_id} not found")
        
        schedule = AssessmentSchedule(
            assessment_id=assessment_id,
            tenant_id=tenant_id,
            created_by=created_by,
            **schedule_data
        )
        
        try:
            self.db.add(schedule)
            self.db.commit()
            self.db.refresh(schedule)
            
            # Audit log
            audit_service.log_action(
                db=self.db,
                user_id=str(created_by),
                action=AuditAction.CREATE,
                resource_type="assessment_schedule",
                resource_id=str(schedule.id),
                tenant_id=str(tenant_id),
                details={"assessment_id": str(assessment_id), "scheduled_date": schedule.scheduled_date.isoformat() if schedule.scheduled_date else None},
                ip_address=None,
                user_agent=None
            )
            
            return schedule
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error creating schedule: {e}")
            raise ValueError("Failed to create schedule due to database constraint violation")
    
    def calculate_next_scheduled_date(
        self,
        last_date: datetime,
        frequency: str,
        interval_months: Optional[int] = None
    ) -> datetime:
        """Calculate next scheduled date based on frequency
        
        Args:
            last_date: Last scheduled date
            frequency: ScheduleFrequency value
            interval_months: Custom interval in months (if frequency is CUSTOM)
        
        Returns:
            Next scheduled date
        """
        # Calculate days based on months (approximate: 30 days per month)
        if frequency == ScheduleFrequency.QUARTERLY.value:
            days = 90  # 3 months
        elif frequency == ScheduleFrequency.YEARLY.value:
            days = 365  # 12 months
        elif frequency == ScheduleFrequency.MONTHLY.value:
            days = 30  # 1 month
        elif frequency == ScheduleFrequency.BI_ANNUAL.value:
            days = 180  # 6 months
        elif frequency == ScheduleFrequency.CUSTOM.value and interval_months:
            days = interval_months * 30
        else:
            # Default to yearly if unknown
            days = 365
        
        return last_date + timedelta(days=days)
    
    def get_vendors_matching_rules(
        self,
        assessment: Assessment,
        last_schedule_id: Optional[UUID] = None
    ) -> List[Vendor]:
        """Get vendors that match assessment assignment rules
        
        Args:
            assessment: Assessment instance
            last_schedule_id: Optional last schedule ID to match vendors from
        
        Returns:
            List of matching Vendor instances
        """
        if not assessment.assignment_rules:
            return []
        
        rules = assessment.assignment_rules
        query = self.db.query(Vendor).filter(Vendor.tenant_id == assessment.tenant_id)
        
        # If last_schedule_id provided, get vendors from that schedule
        if last_schedule_id:
            last_schedule = self.db.query(AssessmentSchedule).filter(
                AssessmentSchedule.id == last_schedule_id
            ).first()
            
            if last_schedule and last_schedule.selected_vendor_ids:
                vendor_ids = [UUID(vid) for vid in last_schedule.selected_vendor_ids]
                return self.db.query(Vendor).filter(Vendor.id.in_(vendor_ids)).all()
        
        # Otherwise, apply assignment rules
        # Note: This is a simplified version - full implementation would need
        # to check vendor attributes, agent attributes, and master data tags
        # For now, return all vendors if no specific rules
        return query.all()
    
    def create_assignment(
        self,
        assessment_id: UUID,
        assignment_data: dict,
        tenant_id: UUID,
        assigned_by: UUID,
        schedule_id: Optional[UUID] = None
    ) -> AssessmentAssignment:
        """Create an assessment assignment to vendor/agent
        
        Args:
            assessment_id: Assessment UUID
            assignment_data: Assignment data dictionary
            tenant_id: Tenant UUID
            assigned_by: User UUID who assigned
            schedule_id: Optional schedule ID if part of scheduled assessment
        
        Returns:
            Created AssessmentAssignment instance
        
        Raises:
            ValueError: If validation fails
        """
        # Create a copy to avoid mutating the original dict
        assignment_dict = assignment_data.copy()
        
        # Convert string IDs to UUIDs if needed
        if assignment_dict.get('vendor_id'):
            assignment_dict['vendor_id'] = UUID(assignment_dict['vendor_id']) if isinstance(assignment_dict['vendor_id'], str) else assignment_dict['vendor_id']
        if assignment_dict.get('agent_id'):
            assignment_dict['agent_id'] = UUID(assignment_dict['agent_id']) if isinstance(assignment_dict['agent_id'], str) else assignment_dict['agent_id']
        
        # Extract status to avoid duplicate keyword argument
        status = assignment_dict.pop('status', 'pending')
        
        # Remove fields that are passed explicitly
        assignment_dict.pop('assessment_id', None)
        assignment_dict.pop('schedule_id', None)
        assignment_dict.pop('tenant_id', None)
        assignment_dict.pop('assigned_by', None)
        assignment_dict.pop('assigned_at', None)
        assignment_dict.pop('workflow_ticket_id', None)  # Will be generated
        
        # Generate workflow ticket ID when assignment is created (not just on completion)
        # This ensures ticket IDs are available for pending assignments in the inbox
        # Generate human-readable workflow ticket ID (e.g., ASMT-2026-017)
        workflow_ticket_id = None
        try:
            from app.core.ticket_id_generator import generate_assessment_ticket_id
            workflow_ticket_id = generate_assessment_ticket_id(self.db, tenant_id)
            logger.info(f"Generated workflow ticket ID {workflow_ticket_id} for new assignment")
        except Exception as e:
            logger.warning(f"Failed to generate workflow ticket ID for new assignment: {e}. Will retry on completion.")
            # Continue without ticket ID - it will be generated on completion as fallback
        
        assignment = AssessmentAssignment(
            assessment_id=assessment_id,
            schedule_id=schedule_id,
            tenant_id=tenant_id,
            assigned_by=assigned_by,
            assigned_at=datetime.utcnow(),
            status=status,
            workflow_ticket_id=workflow_ticket_id,  # Human-readable ticket ID (e.g., ASMT-2026-017)
            **assignment_dict
        )
        
        try:
            self.db.add(assignment)
            self.db.flush()  # Flush to get assignment.id before creating action items
            
            # Create action item for vendor users when assignment is created
            # This ensures vendors receive tasks for all assignments, including TPRM
            from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
            from app.models.user import UserRole, User
            from app.models.vendor import Vendor
            from datetime import timedelta
            
            # Find vendor users to assign the task to
            vendor_users = []
            if assignment.vendor_id:
                vendor = self.db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
                if vendor:
                    logger.info(f"🔍 Looking for vendor users for vendor {vendor.id} ({vendor.name}), contact_email: {vendor.contact_email}, tenant_id: {tenant_id}")
                    
                    if vendor.contact_email:
                        # Strategy 1: Find users with exact email match (case-insensitive)
                        vendor_users = self.db.query(User).filter(
                            User.tenant_id == tenant_id,
                            User.email.ilike(vendor.contact_email.lower()),
                            User.is_active == True
                        ).all()
                        logger.info(f"Strategy 1 (exact email match): Found {len(vendor_users)} vendor user(s) with email matching vendor contact_email {vendor.contact_email}")
                        if vendor_users:
                            for vu in vendor_users:
                                logger.info(f"  - Vendor user: {vu.email} (ID: {vu.id}), role: {vu.role.value if hasattr(vu.role, 'value') else vu.role}")
                        
                        # Strategy 2: If no exact match, try case-insensitive partial match
                        if not vendor_users:
                            vendor_users = self.db.query(User).filter(
                                User.tenant_id == tenant_id,
                                User.email.ilike(f"%{vendor.contact_email.lower()}%"),
                                User.is_active == True
                            ).all()
                            if vendor_users:
                                logger.info(f"Strategy 2 (partial email match): Found {len(vendor_users)} vendor user(s) with partial email match for {vendor.contact_email}")
                                for vu in vendor_users:
                                    logger.info(f"  - Vendor user: {vu.email} (ID: {vu.id}), role: {vu.role.value if hasattr(vu.role, 'value') else vu.role}")
                        
                        # Strategy 3: If still no match, find any active vendor users in the tenant
                        if not vendor_users:
                            all_vendor_users = self.db.query(User).filter(
                                User.tenant_id == tenant_id,
                                User.role == UserRole.VENDOR_USER,
                                User.is_active == True
                            ).all()
                            logger.info(f"Strategy 3 (any vendor user): Found {len(all_vendor_users)} total vendor user(s) in tenant {tenant_id}")
                            for vu in all_vendor_users:
                                logger.info(f"  - Vendor user: {vu.email} (ID: {vu.id})")
                            
                            if all_vendor_users:
                                vendor_users = all_vendor_users
                                logger.warning(f"⚠️ No vendor user found with email matching {vendor.contact_email} for assignment {assignment.id}. Will assign to all {len(vendor_users)} vendor user(s) in tenant.")
                            else:
                                logger.error(f"❌ No vendor users found in tenant {tenant_id} for assignment {assignment.id}. Action items will NOT be created. Vendor email: {vendor.contact_email}. Please create a vendor user account with email matching {vendor.contact_email} or any vendor user in tenant {tenant_id}.")
                    else:
                        logger.warning(f"Vendor {assignment.vendor_id} ({vendor.name}) has no contact_email for assignment {assignment.id}. Cannot create action items.")
                else:
                    logger.error(f"❌ Vendor {assignment.vendor_id} not found in database for assignment {assignment.id}")
            else:
                logger.info(f"Assignment {assignment.id} has no vendor_id. Skipping action item creation (may be agent-only assignment).")
            
            # Get assessment name for action item
            assessment = self.db.query(Assessment).filter(Assessment.id == assessment_id).first()
            assessment_name = assessment.name if assessment else "Assessment"
            
            # Create action items for vendor users
            if vendor_users:
                action_items_created = 0
                for vendor_user in vendor_users:
                    # Check if action item already exists to avoid duplicates
                    existing_action = self.db.query(ActionItem).filter(
                        ActionItem.source_type == "assessment_assignment",
                        ActionItem.source_id == assignment.id,
                        ActionItem.assigned_to == vendor_user.id,
                        ActionItem.status.in_([ActionItemStatus.PENDING.value, ActionItemStatus.IN_PROGRESS.value])
                    ).first()
                    
                    if existing_action:
                        logger.info(f"Action item already exists for vendor user {vendor_user.email} (ID: {vendor_user.id}) for assignment {assignment.id}. Skipping duplicate creation.")
                        continue
                    
                    action_item = ActionItem(
                        tenant_id=tenant_id,
                        assigned_to=vendor_user.id,
                        assigned_by=assigned_by,
                        assigned_at=datetime.utcnow(),  # Explicitly set to current UTC time
                        action_type=ActionItemType.ASSESSMENT.value,
                        title=f"Complete Assessment: {assessment_name}",
                        description=f"Assessment has been assigned to you. Please complete all questions by the due date." + (f" Due: {assignment.due_date.strftime('%Y-%m-%d')}" if assignment.due_date else ""),
                        status=ActionItemStatus.PENDING.value,
                        priority=ActionItemPriority.HIGH.value if assignment.due_date and assignment.due_date < datetime.utcnow() + timedelta(days=7) else ActionItemPriority.MEDIUM.value,
                        due_date=assignment.due_date,
                        source_type="assessment_assignment",
                        source_id=assignment.id,
                        action_url=f"/assessments/{assignment.id}",
                        item_metadata={
                            "assessment_id": str(assessment_id),
                            "assessment_name": assessment_name,
                            "assessment_type": assessment.assessment_type if assessment else None,
                            "assignment_id": str(assignment.id),
                            "vendor_id": str(assignment.vendor_id) if assignment.vendor_id else None,
                            "agent_id": str(assignment.agent_id) if assignment.agent_id else None,
                            "assignment_type": assignment.assignment_type,
                            "workflow_type": "assessment_assignment",
                            "workflow_ticket_id": assignment.workflow_ticket_id  # Human-readable ticket ID (e.g., ASMT-2026-017)
                        }
                    )
                    self.db.add(action_item)
                    action_items_created += 1
                    logger.info(f"✅ Created assessment action item for vendor user {vendor_user.email} (ID: {vendor_user.id}) for assignment {assignment.id} (type: {assignment.assignment_type})")
                
                if action_items_created > 0:
                    try:
                        self.db.commit()
                        logger.info(f"✅ Successfully created {action_items_created} action item(s) for assignment {assignment.id}")
                    except Exception as commit_error:
                        logger.error(f"❌ Failed to commit action items for assignment {assignment.id}: {commit_error}", exc_info=True)
                        self.db.rollback()
                        raise
                else:
                    logger.info(f"No new action items created for assignment {assignment.id} (all already exist)")
            else:
                logger.error(f"❌ No vendor users found for assignment {assignment.id}. Action items were NOT created. Vendor may need to be associated with a user account. Vendor ID: {assignment.vendor_id}, Vendor email: {vendor.contact_email if assignment.vendor_id and vendor else 'N/A'}")
            self.db.refresh(assignment)
            
            # Audit log
            audit_service.log_action(
                db=self.db,
                user_id=str(assigned_by),
                action=AuditAction.CREATE,
                resource_type="assessment_assignment",
                resource_id=str(assignment.id),
                tenant_id=str(tenant_id),
                details={
                    "assessment_id": str(assessment_id),
                    "vendor_id": str(assignment.vendor_id) if assignment.vendor_id else None,
                    "agent_id": str(assignment.agent_id) if assignment.agent_id else None,
                    "assignment_type": assignment.assignment_type
                },
                ip_address=None,
                user_agent=None
            )
            
            return assignment
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error creating assignment: {e}")
            raise ValueError("Failed to create assignment due to database constraint violation")
    
    def evaluate_assignment_rules(
        self,
        assessment: Assessment,
        vendor: Optional[Vendor] = None,
        agent: Optional[Agent] = None
    ) -> bool:
        """Evaluate if vendor/agent matches assessment assignment rules
        
        Args:
            assessment: Assessment instance
            vendor: Optional Vendor instance
            agent: Optional Agent instance
        
        Returns:
            True if matches rules, False otherwise
        """
        if not assessment.assignment_rules:
            return False
        
        rules = assessment.assignment_rules
        
        # Check apply_to - must match the context
        apply_to = rules.get('apply_to', [])
        if not apply_to:
            return False
        
        # Check vendor attributes
        if vendor and rules.get('vendor_attributes'):
            vendor_attrs = rules['vendor_attributes']
            # Check category
            if 'category' in vendor_attrs and vendor.category != vendor_attrs['category']:
                return False
            # Check type
            if 'type' in vendor_attrs and vendor.type != vendor_attrs['type']:
                return False
            # Check risk_level
            if 'risk_level' in vendor_attrs and getattr(vendor, 'risk_level', None) != vendor_attrs['risk_level']:
                return False
        
        # Check agent attributes
        if agent and rules.get('agent_attributes'):
            agent_attrs = rules['agent_attributes']
            # Check category
            if 'category' in agent_attrs and agent.category != agent_attrs['category']:
                return False
            # Check type
            if 'type' in agent_attrs and agent.type != agent_attrs['type']:
                return False
            # Check risk_level
            if 'risk_level' in agent_attrs and getattr(agent, 'risk_level', None) != agent_attrs['risk_level']:
                return False
            # Check department
            if 'department' in agent_attrs and getattr(agent, 'department', None) != agent_attrs['department']:
                return False
            # Check business_unit
            if 'business_unit' in agent_attrs and getattr(agent, 'business_unit', None) != agent_attrs['business_unit']:
                return False
        
        # Check master data tags (department, BU, etc.)
        if rules.get('master_data_tags'):
            master_tags = rules['master_data_tags']
            # Would need to check against master data lists - simplified for now
            if agent:
                if 'department' in master_tags and getattr(agent, 'department', None) not in master_tags.get('department', []):
                    return False
                if 'business_unit' in master_tags and getattr(agent, 'business_unit', None) not in master_tags.get('business_unit', []):
                    return False
        
        return True
    
    def auto_assign_assessments(
        self,
        vendor: Optional[Vendor] = None,
        agent: Optional[Agent] = None,
        assignment_type: str = 'agent_onboarding'
    ) -> List[AssessmentAssignment]:
        """Automatically assign assessments based on rules when vendor/agent is onboarded
        
        Args:
            vendor: Optional Vendor instance
            agent: Optional Agent instance
            assignment_type: Type of assignment (vendor_onboarding, agent_onboarding)
        
        Returns:
            List of created AssessmentAssignment instances
        """
        if not vendor and not agent:
            return []
        
        tenant_id = vendor.tenant_id if vendor else (agent.vendor.tenant_id if agent and agent.vendor else None)
        if not tenant_id:
            return []
        
        # Get all active assessments for this tenant
        assessments = self.db.query(Assessment).filter(
            Assessment.tenant_id == tenant_id,
            Assessment.is_active == True,
            Assessment.status.in_(['active', 'scheduled'])
        ).all()
        
        assignments = []
        for assessment in assessments:
            # Check if assessment should be assigned
            if not self.evaluate_assignment_rules(assessment, vendor=vendor, agent=agent):
                continue
            
            # Check apply_to
            rules = assessment.assignment_rules or {}
            apply_to = rules.get('apply_to', [])
            if assignment_type not in apply_to:
                continue
            
            # Check if already assigned
            existing = self.db.query(AssessmentAssignment).filter(
                AssessmentAssignment.assessment_id == assessment.id,
                AssessmentAssignment.tenant_id == tenant_id,
                AssessmentAssignment.status.in_(['pending', 'in_progress'])
            )
            
            if agent:
                existing = existing.filter(AssessmentAssignment.agent_id == agent.id)
            if vendor:
                existing = existing.filter(AssessmentAssignment.vendor_id == vendor.id)
            
            if existing.first():
                continue  # Already assigned
            
            # Evaluate business rules for assignment
            try:
                rules_engine = BusinessRulesEngine(self.db, tenant_id)
                context = {
                    "assessment": {
                        "id": str(assessment.id),
                        "name": assessment.name,
                        "assessment_type": assessment.assessment_type,
                        "status": assessment.status
                    },
                    "assignment_type": assignment_type
                }
                
                if agent:
                    context["agent"] = {
                        "id": str(agent.id),
                        "name": agent.name,
                        "type": agent.type,
                        "category": agent.category,
                        "department": getattr(agent, 'department', None),
                        "risk_score": agent.risk_score,
                        "compliance_score": agent.compliance_score
                    }
                
                if vendor:
                    context["vendor"] = {
                        "id": str(vendor.id),
                        "name": vendor.name,
                        "category": vendor.category,
                        "type": vendor.type
                    }
                
                # Evaluate assignment rules
                rule_results = rules_engine.evaluate_rules(
                    context=context,
                    entity_type="assessment",
                    screen="assessment_assignment",
                    rule_type="assignment"
                )
                
                # Execute automatic assignment actions
                if rule_results:
                    action_results = rules_engine.execute_actions(
                        rule_results,
                        context,
                        auto_execute=True
                    )
                    # Use rule-based assignment if available
                    for executed in action_results.get("executed", []):
                        if executed.get("action", {}).get("type") == "assign":
                            assignment_data = {
                                'assignment_type': assignment_type,
                                'status': 'pending',
                                'assigned_to': executed.get("action", {}).get("value")  # Rule-based assignment
                            }
                            if agent:
                                assignment_data['agent_id'] = agent.id
                            if vendor:
                                assignment_data['vendor_id'] = vendor.id
                            
                            assignment = self.create_assignment(
                                assessment_id=assessment.id,
                                assignment_data=assignment_data,
                                tenant_id=tenant_id,
                                assigned_by=assessment.owner_id,
                                schedule_id=None
                            )
                            assignments.append(assignment)
                            continue  # Skip default assignment
            except Exception as e:
                logger.warning(f"Error evaluating business rules for assessment assignment: {e}", exc_info=True)
                # Continue with default assignment
            
            # Default assignment (if no rule-based assignment was created)
            if not any(a.assessment_id == assessment.id for a in assignments):
                assignment_data = {
                    'assignment_type': assignment_type,
                    'status': 'pending',
                }
                if agent:
                    assignment_data['agent_id'] = agent.id
                if vendor:
                    assignment_data['vendor_id'] = vendor.id
                
                assignment = self.create_assignment(
                    assessment_id=assessment.id,
                    assignment_data=assignment_data,
                    tenant_id=tenant_id,
                    assigned_by=assessment.owner_id,
                    schedule_id=None
                )
                assignments.append(assignment)
        
        return assignments
