"""
Service layer for assessment template business logic
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, cast, func
from sqlalchemy.dialects.postgresql import JSONB
import json
from app.models.assessment_template import AssessmentTemplate, TemplateApplicability
from app.models.assessment import Assessment, AssessmentQuestion, AssessmentType, AssessmentStatus
from app.models.tenant import Tenant
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)


class AssessmentTemplateService:
    """Service for managing assessment templates"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_applicable_templates(self, tenant_id: UUID) -> List[AssessmentTemplate]:
        """Get templates applicable to tenant's industry
        
        Args:
            tenant_id: Tenant UUID
            
        Returns:
            List of applicable templates
        """
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return []
        
        # Safely get industry - handle case where column doesn't exist yet (before migration)
        try:
            tenant_industry = getattr(tenant, 'industry', None)
        except Exception:
            tenant_industry = None
        
        # Query templates that apply to this industry
        query = self.db.query(AssessmentTemplate).filter(
            AssessmentTemplate.is_active == True
        )
        
        if tenant_industry:
            # Templates that apply to all industries or specifically to this industry
            # Use PostgreSQL JSONB @> operator for JSON array containment
            # Cast JSON to JSONB and use @> operator with proper JSONB literals
            all_industries_jsonb = func.cast(json.dumps(["all"]), JSONB)
            tenant_industry_jsonb = func.cast(json.dumps([tenant_industry]), JSONB)
            query = query.filter(
                or_(
                    cast(AssessmentTemplate.applicable_industries, JSONB).op('@>')(all_industries_jsonb),
                    cast(AssessmentTemplate.applicable_industries, JSONB).op('@>')(tenant_industry_jsonb)
                )
            )
        else:
            # If tenant has no industry set, only show templates that apply to all
            all_industries_jsonb = func.cast(json.dumps(["all"]), JSONB)
            query = query.filter(
                cast(AssessmentTemplate.applicable_industries, JSONB).op('@>')(all_industries_jsonb)
            )
        
        return query.order_by(AssessmentTemplate.name).all()
    
    def instantiate_template(
        self,
        template_id: UUID,
        tenant_id: UUID,
        owner_id: UUID,
        created_by: UUID,
        assessment_name: Optional[str] = None
    ) -> Assessment:
        """Instantiate a template as a new assessment
        
        Args:
            template_id: Template UUID
            tenant_id: Tenant UUID
            owner_id: Owner user UUID
            created_by: User UUID who is creating the assessment
            assessment_name: Optional custom name (defaults to template name)
            
        Returns:
            Created Assessment instance with questions
            
        Raises:
            ValueError: If template not found or validation fails
        """
        template = self.db.query(AssessmentTemplate).filter(
            AssessmentTemplate.id == template_id,
            AssessmentTemplate.is_active == True
        ).first()
        
        if not template:
            raise ValueError(f"Template with ID {template_id} not found")
        
        # Verify template is applicable to tenant's industry
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            # Safely get industry - handle case where column doesn't exist yet (before migration)
            try:
                tenant_industry = getattr(tenant, 'industry', None)
            except Exception:
                tenant_industry = None
            
            if tenant_industry:
                if "all" not in template.applicable_industries and tenant_industry not in template.applicable_industries:
                    raise ValueError(f"Template '{template.name}' is not applicable to industry '{tenant_industry}'")
        
        # Create assessment from template
        assessment_name = assessment_name or template.name
        assessment = Assessment(
            tenant_id=tenant_id,
            name=assessment_name,
            assessment_type=template.assessment_type,
            description=template.description,
            status=template.default_status or AssessmentStatus.DRAFT.value,
            owner_id=owner_id,
            created_by=created_by,
            schedule_enabled=bool(template.default_schedule_frequency),
            schedule_frequency=template.default_schedule_frequency,
            is_active=True
        )
        
        try:
            self.db.add(assessment)
            self.db.flush()  # Get assessment ID
            
            # Create questions from template
            if template.questions:
                for idx, question_data in enumerate(template.questions):
                    question = AssessmentQuestion(
                        assessment_id=assessment.id,
                        tenant_id=tenant_id,
                        question_type=question_data.get("question_type", "new_question"),
                        question_text=question_data.get("question_text"),
                        field_type=question_data.get("field_type"),
                        is_required=question_data.get("is_required", False),
                        options=question_data.get("options"),
                        validation_rules=question_data.get("validation_rules"),
                        requirement_id=UUID(question_data["requirement_id"]) if question_data.get("requirement_id") else None,
                        order=question_data.get("order", idx),
                        section=question_data.get("section"),
                        is_reusable=question_data.get("is_reusable", False)
                    )
                    self.db.add(question)
            
            self.db.commit()
            self.db.refresh(assessment)
            
            # Audit log
            audit_service.log_action(
                db=self.db,
                user_id=str(created_by),
                action=AuditAction.CREATE,
                resource_type="assessment",
                resource_id=str(assessment.id),
                tenant_id=str(tenant_id),
                details={
                    "name": assessment.name,
                    "assessment_type": assessment.assessment_type,
                    "template_id": str(template_id),
                    "template_name": template.name
                },
                ip_address=None,
                user_agent=None
            )
            
            return assessment
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error instantiating template: {e}")
            raise ValueError("Failed to instantiate template due to database constraint violation")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error instantiating template: {e}", exc_info=True)
            raise ValueError(f"Failed to instantiate template: {str(e)}")
