"""
API endpoints for Assessment/Evaluation management
Supports TPRM, Vendor Qualification, Risk Assessment, AI-Vendor Qualification, etc.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, ProgrammingError, OperationalError
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.assessment import (
    Assessment, AssessmentQuestion, AssessmentSchedule, AssessmentAssignment, 
    AssessmentQuestionResponse as AssessmentQuestionResponseModel,
    AssessmentType, AssessmentStatus, ScheduleFrequency, QuestionType
)
from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
from app.api.v1.auth import get_current_user
from app.api.v1.submission_requirements import require_requirement_management_permission
from app.services.assessment_service import AssessmentService
from app.services.assessment_template_service import AssessmentTemplateService
from app.models.assessment_template import AssessmentTemplate
from app.services.compliance_calculation_service import ComplianceCalculationService
from app.core.audit import audit_service, AuditAction
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assessments", tags=["assessments"])
template_router = APIRouter(prefix="/assessment-templates", tags=["assessment-templates"])


# Compliance Calculation Schemas
class ComplianceCalculationResponse(BaseModel):
    assignment_id: str
    calculated_at: str
    frameworks: Dict[str, Any]
    
    class Config:
        from_attributes = True


@router.get("/assignments/{assignment_id}/compliance", response_model=ComplianceCalculationResponse)
async def calculate_assignment_compliance(
    assignment_id: UUID,
    framework_id: Optional[UUID] = Query(None, description="Optional: Calculate for specific framework only"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate compliance scores for an assessment assignment
    Real-time calculation based on question responses and pass/fail criteria
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Get assignment and verify tenant access
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Calculate compliance
    try:
        service = ComplianceCalculationService(db)
        result = service.calculate_compliance_for_assignment(
            assignment_id=assignment_id,
            framework_id=framework_id
        )
        return result
    except Exception as e:
        logger.error(f"Error calculating compliance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating compliance: {str(e)}"
        )


# Import from shared utility to avoid circular imports
from app.core.ticket_id_generator import generate_assessment_ticket_id as _generate_assessment_ticket_id


# Pydantic Schemas
class AssessmentQuestionCreate(BaseModel):
    question_type: str = Field(..., description="new_question or requirement_reference")
    title: Optional[str] = None
    question_text: Optional[str] = None
    description: Optional[str] = None
    field_type: Optional[str] = None
    response_type: Optional[str] = None
    category: Optional[str] = None
    is_required: bool = False
    options: Optional[List[Dict[str, Any]]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    requirement_id: Optional[str] = None  # If question_type is requirement_reference
    order: int = 0
    section: Optional[str] = None
    is_reusable: bool = False
    reusable_question_id: Optional[str] = None


class AssessmentQuestionUpdate(BaseModel):
    title: Optional[str] = None
    question_text: Optional[str] = None
    description: Optional[str] = None
    field_type: Optional[str] = None
    response_type: Optional[str] = None
    category: Optional[str] = None
    is_required: Optional[bool] = None
    options: Optional[List[Dict[str, Any]]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    requirement_id: Optional[str] = None
    order: Optional[int] = None
    section: Optional[str] = None
    is_reusable: Optional[bool] = None


class AssessmentCreate(BaseModel):
    name: str = Field(..., max_length=255)
    assessment_type: str = Field(..., description="tprm, vendor_qualification, risk_assessment, etc.")
    description: Optional[str] = None
    business_purpose: Optional[str] = None
    status: str = Field(default="draft", description="draft, active, archived, scheduled")
    owner_id: str
    team_ids: Optional[List[str]] = None
    assignment_rules: Optional[Dict[str, Any]] = None
    schedule_enabled: bool = False
    schedule_frequency: Optional[str] = None
    schedule_interval_months: Optional[int] = None


class AssessmentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    business_purpose: Optional[str] = None
    status: Optional[str] = None
    owner_id: Optional[str] = None
    team_ids: Optional[List[str]] = None
    assignment_rules: Optional[Dict[str, Any]] = None
    schedule_enabled: Optional[bool] = None
    schedule_frequency: Optional[str] = None
    schedule_interval_months: Optional[int] = None
    last_scheduled_date: Optional[datetime] = None
    next_scheduled_date: Optional[datetime] = None


class AssessmentScheduleCreate(BaseModel):
    scheduled_date: datetime
    due_date: Optional[datetime] = None
    frequency: str
    selected_vendor_ids: Optional[List[str]] = None


class AssessmentScheduleUpdate(BaseModel):
    scheduled_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    triggered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AssessmentAssignmentCreate(BaseModel):
    vendor_id: Optional[str] = None
    agent_id: Optional[str] = None
    assignment_type: str = Field(..., description="vendor_onboarding, agent_onboarding, scheduled")
    due_date: Optional[datetime] = None


class OwnerInfo(BaseModel):
    id: str
    name: str
    email: str

class AssessmentResponse(BaseModel):
    id: str
    tenant_id: str
    assessment_id: Optional[str] = None  # Human-readable assessment ID
    name: str
    assessment_type: str
    description: Optional[str]
    business_purpose: Optional[str] = None
    status: str
    owner_id: str
    owner: Optional[OwnerInfo] = None  # Owner details
    team_ids: Optional[List[str]]
    assignment_rules: Optional[Dict[str, Any]]
    schedule_enabled: bool
    schedule_frequency: Optional[str]
    schedule_interval_months: Optional[int]
    last_scheduled_date: Optional[str]
    next_scheduled_date: Optional[str]
    created_by: str
    updated_by: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class AssessmentQuestionResponse(BaseModel):
    id: str
    assessment_id: str
    question_type: str
    title: Optional[str] = None
    question_text: Optional[str]
    description: Optional[str] = None
    field_type: Optional[str]
    response_type: Optional[str] = None
    category: Optional[str] = None
    is_required: bool
    options: Optional[List[Dict[str, Any]]]
    validation_rules: Optional[Dict[str, Any]]
    requirement_id: Optional[str]
    order: int
    section: Optional[str]
    is_reusable: bool
    reusable_question_id: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


def _build_assessment_response(assessment: Assessment, db: Optional[Session] = None) -> AssessmentResponse:
    """Helper function to build AssessmentResponse from Assessment"""
    # Load owner details if db session is provided
    owner_info = None
    if db:
        from app.models.user import User
        owner = db.query(User).filter(User.id == assessment.owner_id).first()
        if owner:
            owner_info = OwnerInfo(
                id=str(owner.id),
                name=owner.name,
                email=owner.email
            )
    
    return AssessmentResponse(
        id=str(assessment.id),
        tenant_id=str(assessment.tenant_id),
        assessment_id=getattr(assessment, 'assessment_id', None),
        name=assessment.name,
        assessment_type=assessment.assessment_type,
        description=assessment.description,
        business_purpose=getattr(assessment, 'business_purpose', None),
        status=assessment.status,
        owner_id=str(assessment.owner_id),
        owner=owner_info,
        team_ids=assessment.team_ids,
        assignment_rules=assessment.assignment_rules,
        schedule_enabled=assessment.schedule_enabled,
        schedule_frequency=assessment.schedule_frequency,
        schedule_interval_months=assessment.schedule_interval_months,
        last_scheduled_date=assessment.last_scheduled_date.isoformat() if assessment.last_scheduled_date else None,
        next_scheduled_date=assessment.next_scheduled_date.isoformat() if assessment.next_scheduled_date else None,
        created_by=str(assessment.created_by),
        updated_by=str(assessment.updated_by) if hasattr(assessment, 'updated_by') and assessment.updated_by else None,
        is_active=assessment.is_active,
        created_at=assessment.created_at.isoformat(),
        updated_at=assessment.updated_at.isoformat()
    )


@router.get("", response_model=List[AssessmentResponse])
async def list_assessments(
    assessment_type: Optional[str] = Query(None, description="Filter by assessment type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    is_active: Optional[bool] = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List assessments for current tenant"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    query = db.query(Assessment).filter(
        Assessment.tenant_id == effective_tenant_id
    )
    
    if assessment_type:
        query = query.filter(Assessment.assessment_type == assessment_type)
    if status:
        query = query.filter(Assessment.status == status)
    if is_active is not None:
        query = query.filter(Assessment.is_active == is_active)
    
    try:
        assessments = query.order_by(
            Assessment.assessment_type,
            Assessment.name,
            Assessment.created_at.desc()
        ).all()
        
        return [_build_assessment_response(a, db) for a in assessments]
    except (ProgrammingError, OperationalError) as e:
        db.rollback()
        logger.error(f"Database error listing assessments: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching assessments"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error listing assessments: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching assessments"
        )


@router.post("", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    assessment_data: AssessmentCreate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Create a new assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    service = AssessmentService(db)
    
    # Convert Pydantic model to dict
    assessment_dict = assessment_data.dict(exclude_unset=True)
    # Convert owner_id to UUID (will be handled by service, but ensure it's UUID type)
    if 'owner_id' in assessment_dict:
        assessment_dict['owner_id'] = UUID(assessment_dict['owner_id'])
    if assessment_dict.get('team_ids'):
        assessment_dict['team_ids'] = [str(UUID(tid)) for tid in assessment_dict['team_ids']]
    
    try:
        assessment = service.create_assessment(
            assessment_data=assessment_dict,
            tenant_id=effective_tenant_id,
            created_by=current_user.id
        )
        
        return _build_assessment_response(assessment, db)
    except ValueError as e:
        logger.warning(f"Validation error creating assessment: {e}", extra={
            "user_id": str(current_user.id),
            "tenant_id": str(effective_tenant_id)
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error creating assessment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create assessment due to database constraint violation"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating assessment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the assessment"
        )


@router.get("/upcoming", response_model=List[Dict[str, Any]])
async def get_upcoming_assessments(
    days_ahead: int = Query(30, description="Number of days ahead to look"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get upcoming scheduled assessments for dashboard"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    from datetime import timedelta
    cutoff_date = datetime.utcnow() + timedelta(days=days_ahead)
    
    schedules = db.query(AssessmentSchedule).join(Assessment).filter(
        Assessment.tenant_id == effective_tenant_id,
        Assessment.is_active == True,
        AssessmentSchedule.scheduled_date >= datetime.utcnow(),
        AssessmentSchedule.scheduled_date <= cutoff_date,
        AssessmentSchedule.status.in_(['pending', 'scheduled'])
    ).order_by(AssessmentSchedule.scheduled_date).all()
    
    return [
        {
            "schedule_id": str(s.id),
            "assessment_id": str(s.assessment_id),
            "assessment_name": s.assessment.name,
            "assessment_type": s.assessment.assessment_type,
            "scheduled_date": s.scheduled_date.isoformat(),
            "due_date": s.due_date.isoformat() if s.due_date else None,
            "frequency": s.frequency,
            "vendor_count": len(s.selected_vendor_ids) if s.selected_vendor_ids else 0,
        }
        for s in schedules
    ]





@router.get("/{assessment_id}", response_model=AssessmentResponse)
async def get_assessment(
    assessment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )

    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()

    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )

    return _build_assessment_response(assessment, db)


@router.patch("/{assessment_id}", response_model=AssessmentResponse)
async def update_assessment(
    assessment_id: UUID,
    update_data: AssessmentUpdate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Update an assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    service = AssessmentService(db)
    
    # Convert Pydantic model to dict, excluding None values
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    if 'owner_id' in update_dict:
        update_dict['owner_id'] = UUID(update_dict['owner_id'])
    if 'team_ids' in update_dict:
        update_dict['team_ids'] = [str(UUID(tid)) for tid in update_dict['team_ids']]
    
    try:
        updated_assessment = service.update_assessment(
            assessment_id=assessment_id,
            update_data=update_dict,
            updated_by=current_user.id
        )
        
        return _build_assessment_response(updated_assessment, db)
    except ValueError as e:
        logger.warning(f"Validation error updating assessment: {e}", extra={
            "user_id": str(current_user.id),
            "assessment_id": str(assessment_id)
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating assessment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the assessment"
        )


@router.delete("/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assessment(
    assessment_id: UUID,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Delete an assessment (soft delete)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    service = AssessmentService(db)
    
    try:
        service.delete_assessment(
            assessment_id=assessment_id,
            deleted_by=current_user.id
        )
    except ValueError as e:
        logger.warning(f"Validation error deleting assessment: {e}", extra={
            "user_id": str(current_user.id),
            "assessment_id": str(assessment_id)
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error deleting assessment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the assessment"
        )


# Question Management Endpoints
@router.get("/{assessment_id}/questions", response_model=List[AssessmentQuestionResponse])
async def list_assessment_questions(
    assessment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List questions for an assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    # IMPORTANT: Filter by both assessment_id AND tenant_id for tenant isolation
    # Use assessment.tenant_id to ensure we get questions that belong to the assessment's tenant
    questions = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.assessment_id == assessment_id,
        AssessmentQuestion.tenant_id == assessment.tenant_id  # Use assessment's tenant_id
    ).order_by(AssessmentQuestion.order).all()
    
    # If no questions found, try without tenant filter (for backward compatibility)
    if len(questions) == 0:
        logger.warning(
            f"No questions found for assessment {assessment_id} with tenant filter (tenant: {assessment.tenant_id}). "
            f"Trying without tenant filter for backward compatibility."
        )
        all_questions = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assessment_id
        ).order_by(AssessmentQuestion.order).all()
        
        if len(all_questions) > 0:
            # Found questions without tenant filter - likely old data with mismatched tenant_ids
            # Use these questions but log a warning
            logger.warning(
                f"Found {len(all_questions)} questions for assessment {assessment_id} without tenant filter. "
                f"Assessment tenant: {assessment.tenant_id}, Effective tenant: {effective_tenant_id}. "
                f"Using these questions but tenant isolation may be compromised. "
                f"Consider updating question tenant_ids to match assessment tenant_id."
            )
            questions = all_questions
        else:
            logger.warning(
                f"No questions found for assessment {assessment_id} at all. "
                f"Assessment type: {assessment.assessment_type}, Tenant: {assessment.tenant_id}. "
                f"Questions may need to be added manually or populated from question library."
            )
    
    return [
        AssessmentQuestionResponse(
            id=str(q.id),
            assessment_id=str(q.assessment_id),
            question_type=q.question_type,
            title=getattr(q, 'title', None),
            question_text=q.question_text,
            description=getattr(q, 'description', None),
            field_type=q.field_type,
            response_type=getattr(q, 'response_type', None),
            category=getattr(q, 'category', None),
            is_required=q.is_required,
            options=q.options,
            validation_rules=q.validation_rules,
            requirement_id=str(q.requirement_id) if q.requirement_id else None,
            order=q.order,
            section=q.section,
            is_reusable=q.is_reusable,
            reusable_question_id=str(q.reusable_question_id) if q.reusable_question_id else None,
            created_at=q.created_at.isoformat(),
            updated_at=q.updated_at.isoformat()
        )
        for q in questions
    ]


@router.post("/{assessment_id}/populate-questions", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def populate_questions_from_library(
    assessment_id: UUID,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Populate assessment with questions from question library based on assessment type"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    # Check if assessment already has questions
    existing_count = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.assessment_id == assessment_id,
        AssessmentQuestion.tenant_id == effective_tenant_id
    ).count()
    
    if existing_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Assessment already has {existing_count} questions. Please add questions manually or remove existing questions first."
        )
    
    # Use AssessmentService to populate questions
    service = AssessmentService(db)
    try:
        # Log assessment details for debugging
        logger.info(f"Populating questions for assessment {assessment_id}: type={assessment.assessment_type}, tenant={effective_tenant_id}")
        
        # Check question library first
        from app.models.question_library import QuestionLibrary
        all_library_questions = db.query(QuestionLibrary).filter(
            QuestionLibrary.tenant_id == effective_tenant_id,
            QuestionLibrary.is_active == True
        ).count()
        logger.info(f"Found {all_library_questions} active questions in library for tenant {effective_tenant_id}")
        
        service._populate_assessment_questions(assessment, effective_tenant_id)
        
        # Check how many questions were added (with fallback for tenant mismatch)
        new_count = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assessment_id,
            AssessmentQuestion.tenant_id == effective_tenant_id
        ).count()
        
        # Fallback: check without tenant filter
        if new_count == 0:
            new_count = db.query(AssessmentQuestion).filter(
                AssessmentQuestion.assessment_id == assessment_id
            ).count()
            if new_count > 0:
                logger.warning(f"Found {new_count} questions without tenant filter - possible tenant mismatch")
        
        if new_count == 0:
            # Check if questions exist in library for this assessment type
            tprm_questions = db.query(QuestionLibrary).filter(
                QuestionLibrary.tenant_id == effective_tenant_id,
                QuestionLibrary.is_active == True
            ).all()
            
            # Count TPRM questions
            tprm_count = 0
            for q in tprm_questions:
                q_types = q.assessment_type
                if isinstance(q_types, str):
                    try:
                        import json
                        q_types = json.loads(q_types)
                    except:
                        q_types = [q_types]
                elif not isinstance(q_types, list):
                    q_types = [q_types] if q_types else []
                
                q_types_lower = [str(t).lower() if t else "" for t in q_types]
                if "tprm" in q_types_lower:
                    tprm_count += 1
            
            return {
                "success": False,
                "message": f"No questions found in question library for this assessment type. Found {tprm_count} TPRM questions in library (out of {len(tprm_questions)} total). Please ensure questions have 'tprm' in their assessment_type field.",
                "questions_added": 0,
                "library_tprm_count": tprm_count,
                "library_total_count": len(tprm_questions)
            }
        
        return {
            "success": True,
            "message": f"Successfully populated assessment with {new_count} questions from question library",
            "questions_added": new_count
        }
    except Exception as e:
        logger.error(f"Error populating questions for assessment {assessment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to populate questions: {str(e)}"
        )


@router.post("/{assessment_id}/questions", response_model=AssessmentQuestionResponse, status_code=status.HTTP_201_CREATED)
async def add_question(
    assessment_id: UUID,
    question_data: AssessmentQuestionCreate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Add a question to an assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    service = AssessmentService(db)
    
    question_dict = question_data.dict()
    if question_dict.get('requirement_id'):
        question_dict['requirement_id'] = UUID(question_dict['requirement_id'])
    if question_dict.get('reusable_question_id'):
        question_dict['reusable_question_id'] = UUID(question_dict['reusable_question_id'])
    
    try:
        question = service.add_question(
            assessment_id=assessment_id,
            question_data=question_dict,
            tenant_id=effective_tenant_id
        )
        
        return AssessmentQuestionResponse(
            id=str(question.id),
            assessment_id=str(question.assessment_id),
            question_type=question.question_type,
            title=getattr(question, 'title', None),
            question_text=question.question_text,
            description=getattr(question, 'description', None),
            field_type=question.field_type,
            response_type=getattr(question, 'response_type', None),
            category=getattr(question, 'category', None),
            is_required=question.is_required,
            options=question.options,
            validation_rules=question.validation_rules,
            requirement_id=str(question.requirement_id) if question.requirement_id else None,
            order=question.order,
            section=question.section,
            is_reusable=question.is_reusable,
            reusable_question_id=str(question.reusable_question_id) if question.reusable_question_id else None,
            created_at=question.created_at.isoformat(),
            updated_at=question.updated_at.isoformat()
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while adding the question"
        )


@router.patch("/questions/{question_id}", response_model=AssessmentQuestionResponse)
async def update_question(
    question_id: UUID,
    update_data: AssessmentQuestionUpdate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Update an assessment question"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    question = db.query(AssessmentQuestion).join(Assessment).filter(
        AssessmentQuestion.id == question_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    service = AssessmentService(db)
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    if 'requirement_id' in update_dict and update_dict['requirement_id']:
        update_dict['requirement_id'] = UUID(update_dict['requirement_id'])
    if 'reusable_question_id' in update_dict and update_dict['reusable_question_id']:
        update_dict['reusable_question_id'] = UUID(update_dict['reusable_question_id'])
    
    try:
        updated_question = service.update_question(
            question_id=question_id,
            update_data=update_dict
        )
        
        return AssessmentQuestionResponse(
            id=str(updated_question.id),
            assessment_id=str(updated_question.assessment_id),
            question_type=updated_question.question_type,
            question_text=updated_question.question_text,
            field_type=updated_question.field_type,
            is_required=updated_question.is_required,
            options=updated_question.options,
            validation_rules=updated_question.validation_rules,
            requirement_id=str(updated_question.requirement_id) if updated_question.requirement_id else None,
            order=updated_question.order,
            section=updated_question.section,
            is_reusable=updated_question.is_reusable,
            reusable_question_id=str(updated_question.reusable_question_id) if updated_question.reusable_question_id else None,
            created_at=updated_question.created_at.isoformat(),
            updated_at=updated_question.updated_at.isoformat()
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the question"
        )


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: UUID,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Delete an assessment question"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    question = db.query(AssessmentQuestion).join(Assessment).filter(
        AssessmentQuestion.id == question_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    service = AssessmentService(db)
    
    try:
        service.delete_question(question_id=question_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the question"
        )


@router.post("/{assessment_id}/questions/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_questions(
    assessment_id: UUID,
    question_orders: List[Dict[str, Any]],
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Reorder questions within an assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    service = AssessmentService(db)
    
    try:
        service.reorder_questions(
            assessment_id=assessment_id,
            question_orders=question_orders
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error reordering questions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while reordering questions"
        )


# Schedule Management Endpoints
class AssessmentScheduleResponse(BaseModel):
    id: str
    assessment_id: str
    tenant_id: str
    scheduled_date: str
    due_date: Optional[str]
    frequency: str
    selected_vendor_ids: Optional[List[str]]
    status: str
    triggered_at: Optional[str]
    completed_at: Optional[str]
    created_by: str
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.get("/{assessment_id}/schedules", response_model=List[AssessmentScheduleResponse])
async def list_assessment_schedules(
    assessment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List schedules for an assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    schedules = db.query(AssessmentSchedule).filter(
        AssessmentSchedule.assessment_id == assessment_id
    ).order_by(AssessmentSchedule.scheduled_date.desc()).all()
    
    return [
        AssessmentScheduleResponse(
            id=str(s.id),
            assessment_id=str(s.assessment_id),
            tenant_id=str(s.tenant_id),
            scheduled_date=s.scheduled_date.isoformat(),
            due_date=s.due_date.isoformat() if s.due_date else None,
            frequency=s.frequency,
            selected_vendor_ids=s.selected_vendor_ids,
            status=s.status,
            triggered_at=s.triggered_at.isoformat() if s.triggered_at else None,
            completed_at=s.completed_at.isoformat() if s.completed_at else None,
            created_by=str(s.created_by),
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat()
        )
        for s in schedules
    ]


@router.post("/{assessment_id}/schedules", response_model=AssessmentScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    assessment_id: UUID,
    schedule_data: AssessmentScheduleCreate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Create a schedule for an assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    service = AssessmentService(db)
    
    schedule_dict = schedule_data.dict()
    
    try:
        schedule = service.create_schedule(
            assessment_id=assessment_id,
            schedule_data=schedule_dict,
            tenant_id=effective_tenant_id,
            created_by=current_user.id
        )
        
        return AssessmentScheduleResponse(
            id=str(schedule.id),
            assessment_id=str(schedule.assessment_id),
            tenant_id=str(schedule.tenant_id),
            scheduled_date=schedule.scheduled_date.isoformat(),
            due_date=schedule.due_date.isoformat() if schedule.due_date else None,
            frequency=schedule.frequency,
            selected_vendor_ids=schedule.selected_vendor_ids,
            status=schedule.status,
            triggered_at=schedule.triggered_at.isoformat() if schedule.triggered_at else None,
            completed_at=schedule.completed_at.isoformat() if schedule.completed_at else None,
            created_by=str(schedule.created_by),
            created_at=schedule.created_at.isoformat(),
            updated_at=schedule.updated_at.isoformat()
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating schedule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the schedule"
        )


@router.patch("/schedules/{schedule_id}", response_model=AssessmentScheduleResponse)
async def update_schedule(
    schedule_id: UUID,
    update_data: AssessmentScheduleUpdate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Update an assessment schedule"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    schedule = db.query(AssessmentSchedule).join(Assessment).filter(
        AssessmentSchedule.id == schedule_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    for key, value in update_dict.items():
        if hasattr(schedule, key):
            setattr(schedule, key, value)
    
    schedule.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(schedule)
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.UPDATE,
            resource_type="assessment_schedule",
            resource_id=str(schedule_id),
            tenant_id=str(effective_tenant_id),
            details={"updated_fields": list(update_dict.keys())},
            ip_address=None,
            user_agent=None
        )
        
        return AssessmentScheduleResponse(
            id=str(schedule.id),
            assessment_id=str(schedule.assessment_id),
            tenant_id=str(schedule.tenant_id),
            scheduled_date=schedule.scheduled_date.isoformat(),
            due_date=schedule.due_date.isoformat() if schedule.due_date else None,
            frequency=schedule.frequency,
            selected_vendor_ids=schedule.selected_vendor_ids,
            status=schedule.status,
            triggered_at=schedule.triggered_at.isoformat() if schedule.triggered_at else None,
            completed_at=schedule.completed_at.isoformat() if schedule.completed_at else None,
            created_by=str(schedule.created_by),
            created_at=schedule.created_at.isoformat(),
            updated_at=schedule.updated_at.isoformat()
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating schedule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the schedule"
        )


# Assignment Management Endpoints
class AssessmentAssignmentResponse(BaseModel):
    id: str
    assessment_id: str
    schedule_id: Optional[str]
    tenant_id: str
    vendor_id: Optional[str]
    agent_id: Optional[str]
    assignment_type: str
    assigned_by: str
    status: str
    assigned_at: str
    started_at: Optional[str]
    completed_at: Optional[str]
    due_date: Optional[str]
    workflow_ticket_id: Optional[str] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class AssessmentSubmissionResponse(BaseModel):
    """Response model for assessment submission"""
    assignment_id: str
    workflow_ticket_id: Optional[str]
    status: str
    workflow_triggered: bool
    message: str


@router.get("/{assessment_id}/assignments", response_model=List[AssessmentAssignmentResponse])
async def list_assessment_assignments(
    assessment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List assignments for an assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    assignments = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.assessment_id == assessment_id
    ).order_by(AssessmentAssignment.assigned_at.desc()).all()
    
    return [
        AssessmentAssignmentResponse(
            id=str(a.id),
            assessment_id=str(a.assessment_id),
            schedule_id=str(a.schedule_id) if a.schedule_id else None,
            tenant_id=str(a.tenant_id),
            vendor_id=str(a.vendor_id) if a.vendor_id else None,
            agent_id=str(a.agent_id) if a.agent_id else None,
            assignment_type=a.assignment_type,
            assigned_by=str(a.assigned_by),
            status=a.status,
            assigned_at=a.assigned_at.isoformat(),
            started_at=a.started_at.isoformat() if a.started_at else None,
            completed_at=a.completed_at.isoformat() if a.completed_at else None,
            due_date=a.due_date.isoformat() if a.due_date else None,
            created_at=a.created_at.isoformat(),
            updated_at=a.updated_at.isoformat()
        )
        for a in assignments
    ]


@router.post("/{assessment_id}/assignments", response_model=AssessmentAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    assessment_id: UUID,
    assignment_data: AssessmentAssignmentCreate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Create an assignment for an assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Check tenant isolation
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    # Validate that assessment has at least one question
    question_count = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.assessment_id == assessment_id,
        AssessmentQuestion.tenant_id == effective_tenant_id
    ).count()
    
    if question_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create assignment: Assessment must have at least one question. Please add questions to the assessment first."
        )
    
    service = AssessmentService(db)
    
    assignment_dict = assignment_data.dict()
    
    try:
        schedule_id = None
        if assignment_dict.get('schedule_id'):
            schedule_id = UUID(assignment_dict['schedule_id'])
        
        assignment = service.create_assignment(
            assessment_id=assessment_id,
            assignment_data=assignment_dict,
            tenant_id=effective_tenant_id,
            assigned_by=current_user.id,
            schedule_id=schedule_id
        )
        
        # Generate human-readable workflow ticket ID when assignment is created
        # This ensures ticket IDs are available for pending assignments in the inbox
        if not assignment.workflow_ticket_id:
            try:
                assignment.workflow_ticket_id = _generate_assessment_ticket_id(db, effective_tenant_id)
                db.flush()  # Flush to save ticket ID before creating action items
                logger.info(f"✅ Generated workflow ticket ID {assignment.workflow_ticket_id} for assignment {assignment.id} at creation")
            except Exception as e:
                logger.warning(f"Failed to generate workflow ticket ID for assignment {assignment.id} at creation: {e}. Will retry on completion.")
                # Continue without ticket ID - it will be generated on completion as fallback - it will be set from the action item ID
        
        # Create action item for vendor users when assignment is created via API
        # Note: Action items are also created in the service layer, but we keep this here
        # for onboarding flows and as a safety net. Duplicate prevention is handled by checking
        # if action items already exist for this assignment.
        from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
        from app.models.user import UserRole, User
        from app.models.vendor import Vendor
        
        # Check if action items already exist (created by service layer)
        existing_action_items = db.query(ActionItem).filter(
            ActionItem.source_id == assignment.id,
            ActionItem.source_type == "assessment_assignment",
            ActionItem.action_type == ActionItemType.ASSESSMENT
        ).count()
        
        # Only create action items if they don't already exist (avoid duplicates)
        if existing_action_items == 0:
            # Find vendor users to assign the task to
            vendor_users = []
            if assignment.vendor_id:
                vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
                if vendor and vendor.contact_email:
                    # Find users with matching email (vendor users)
                    vendor_users = db.query(User).filter(
                        User.tenant_id == effective_tenant_id,
                        User.email == vendor.contact_email,
                        User.is_active == True
                    ).all()
                    # If no exact match, find any vendor users in the tenant
                    if not vendor_users:
                        vendor_users = db.query(User).filter(
                            User.tenant_id == effective_tenant_id,
                            User.role == UserRole.VENDOR_USER,
                            User.is_active == True
                        ).limit(1).all()
            
            # Create action items for vendor users
            for vendor_user in vendor_users:
                action_item = ActionItem(
                    tenant_id=effective_tenant_id,
                    assigned_to=vendor_user.id,
                    assigned_by=current_user.id,
                    assigned_at=datetime.utcnow(),  # Explicitly set to current UTC time
                    action_type=ActionItemType.ASSESSMENT.value,
                    title=f"Complete Assessment: {assessment.name}",
                    description=f"Assessment has been assigned to you. Please complete all questions by the due date." + (f" Due: {assignment.due_date.strftime('%Y-%m-%d')}" if assignment.due_date else ""),
                    status=ActionItemStatus.PENDING,
                    priority=ActionItemPriority.HIGH.value if assignment.due_date and assignment.due_date < datetime.utcnow() + timedelta(days=7) else ActionItemPriority.MEDIUM.value,
                    due_date=assignment.due_date,
                    source_type="assessment_assignment",
                    source_id=assignment.id,
                    action_url=f"/assessments/{assignment.id}",
                    item_metadata={
                        "assessment_id": str(assessment.id),
                        "assessment_name": assessment.name,
                        "assessment_type": assessment.assessment_type,
                        "assignment_id": str(assignment.id),
                        "vendor_id": str(assignment.vendor_id) if assignment.vendor_id else None,
                        "agent_id": str(assignment.agent_id) if assignment.agent_id else None,
                        "assignment_type": assignment.assignment_type,
                        "workflow_type": "assessment_assignment",
                        "workflow_ticket_id": assignment.workflow_ticket_id  # Include ticket ID in metadata
                    }
                )
                db.add(action_item)
                logger.info(f"Created assessment action item (via API) for vendor user {vendor_user.email} (ID: {vendor_user.id}) for assignment {assignment.id}")
            
            if vendor_users:
                db.commit()  # Commit action items
        else:
            logger.info(f"Action items already exist for assignment {assignment.id} (created by service layer), skipping duplicate creation")
        
        return AssessmentAssignmentResponse(
            id=str(assignment.id),
            assessment_id=str(assignment.assessment_id),
            schedule_id=str(assignment.schedule_id) if assignment.schedule_id else None,
            tenant_id=str(assignment.tenant_id),
            vendor_id=str(assignment.vendor_id) if assignment.vendor_id else None,
            agent_id=str(assignment.agent_id) if assignment.agent_id else None,
            assignment_type=assignment.assignment_type,
            assigned_by=str(assignment.assigned_by),
            status=assignment.status,
            assigned_at=assignment.assigned_at.isoformat(),
            started_at=assignment.started_at.isoformat() if assignment.started_at else None,
            completed_at=assignment.completed_at.isoformat() if assignment.completed_at else None,
            due_date=assignment.due_date.isoformat() if assignment.due_date else None,
            created_at=assignment.created_at.isoformat(),
            updated_at=assignment.updated_at.isoformat()
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating assignment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the assignment"
        )


# Assessment Response Endpoints
@router.get("/assignments/{assignment_id}/questions", response_model=List[AssessmentQuestionResponse])
async def get_assignment_questions(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get questions for an assessment assignment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    from sqlalchemy.orm import joinedload
    
    # Verify assessment exists and get its tenant_id for debugging
    assessment = db.query(Assessment).filter(
        Assessment.id == assignment.assessment_id
    ).first()
    
    if not assessment:
        logger.error(f"Assessment {assignment.assessment_id} not found for assignment {assignment_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    # Verify tenant isolation - assessment should belong to same tenant as assignment
    if assessment.tenant_id != effective_tenant_id:
        logger.error(f"Tenant mismatch: Assessment {assignment.assessment_id} belongs to tenant {assessment.tenant_id}, but assignment belongs to tenant {effective_tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Assessment belongs to a different tenant"
        )
    
    logger.info(f"Fetching questions for assignment {assignment_id}, assessment_id: {assignment.assessment_id}, tenant_id: {effective_tenant_id}, assessment_tenant_id: {assessment.tenant_id}")
    
    # Optimize query: only load requirement for questions that actually reference requirements
    # This avoids unnecessary joins for questions that don't need them
    # IMPORTANT: Filter by both assessment_id AND tenant_id for tenant isolation
    # Use assessment.tenant_id to ensure we get questions that belong to the assessment's tenant
    # (This handles cases where questions might have been created with assessment's tenant_id)
    
    # First try with assessment.tenant_id
    questions = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.assessment_id == assignment.assessment_id,
        AssessmentQuestion.tenant_id == assessment.tenant_id  # Use assessment's tenant_id
    ).order_by(AssessmentQuestion.order).all()
    
    # If no questions found, try without tenant filter (for backward compatibility with old data)
    if len(questions) == 0:
        logger.warning(
            f"No questions found for assessment {assignment.assessment_id} with tenant filter (tenant: {assessment.tenant_id}). "
            f"Trying without tenant filter for backward compatibility."
        )
        all_questions = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assignment.assessment_id
        ).order_by(AssessmentQuestion.order).all()
        
        if len(all_questions) > 0:
            # Found questions without tenant filter - likely old data with mismatched tenant_ids
            logger.warning(
                f"Found {len(all_questions)} questions for assessment {assignment.assessment_id} without tenant filter. "
                f"Assessment tenant: {assessment.tenant_id}, Effective tenant: {effective_tenant_id}. "
                f"Question tenant_ids: {[str(q.tenant_id) for q in all_questions[:5]]}"
            )
            
            # Fix tenant_id for questions that have wrong tenant_id
            fixed_count = 0
            for q in all_questions:
                if q.tenant_id != assessment.tenant_id:
                    logger.info(f"Fixing tenant_id for question {q.id}: {q.tenant_id} -> {assessment.tenant_id}")
                    q.tenant_id = assessment.tenant_id
                    fixed_count += 1
            
            if fixed_count > 0:
                try:
                    db.commit()
                    logger.info(f"Fixed tenant_id for {fixed_count} questions. Refreshing query.")
                    # Re-query with correct tenant_id and order
                    questions = db.query(AssessmentQuestion).filter(
                        AssessmentQuestion.assessment_id == assignment.assessment_id,
                        AssessmentQuestion.tenant_id == assessment.tenant_id
                    ).order_by(AssessmentQuestion.order).all()
                except Exception as e:
                    logger.error(f"Error fixing question tenant_ids: {e}", exc_info=True)
                    db.rollback()
                    # Use questions as-is if fix fails
                    questions = all_questions
            else:
                questions = all_questions
        else:
            logger.warning(f"No questions found for assessment {assignment.assessment_id} at all. Assessment may not have questions.")
    
    logger.info(f"Returning {len(questions)} questions for assignment {assignment_id}, assessment {assignment.assessment_id} (using assessment tenant: {assessment.tenant_id})")
    
    # Get requirement IDs that need to be loaded
    requirement_ids = [q.requirement_id for q in questions if q.requirement_id]
    
    # Load requirements in a separate query if needed (more efficient than joinedload for all)
    requirements_map = {}
    if requirement_ids:
        from app.models.submission_requirement import SubmissionRequirement
        requirements = db.query(SubmissionRequirement).filter(
            SubmissionRequirement.id.in_(requirement_ids)
        ).all()
        requirements_map = {str(req.id): req for req in requirements}
    
    result = []
    for q in questions:
        # For requirement_reference type, get question_text from requirement if not set
        question_text = q.question_text
        field_type = q.field_type
        
        # Get requirement from map if available
        requirement = None
        if q.requirement_id:
            requirement = requirements_map.get(str(q.requirement_id))
        
        if q.question_type == "requirement_reference" and requirement:
            # Use requirement's label as question text if question doesn't have it
            if not question_text and requirement.label:
                question_text = requirement.label
            if not field_type and requirement.field_type:
                field_type = requirement.field_type
            # Use requirement's options if question doesn't have them
            if not q.options and requirement.options:
                # Convert requirement options to question options format
                if isinstance(requirement.options, list):
                    q.options = [{"value": opt, "label": opt} if isinstance(opt, str) else opt for opt in requirement.options]
                elif isinstance(requirement.options, dict):
                    q.options = [{"value": k, "label": v} for k, v in requirement.options.items()]
        
        result.append(
            AssessmentQuestionResponse(
                id=str(q.id),
                assessment_id=str(q.assessment_id),
                question_type=q.question_type,
                title=getattr(q, 'title', None),
                question_text=question_text,
                description=getattr(q, 'description', None),
                field_type=field_type,
                response_type=getattr(q, 'response_type', None),
                category=getattr(q, 'category', None),
                is_required=q.is_required,
                options=q.options,
                validation_rules=q.validation_rules,
                requirement_id=str(q.requirement_id) if q.requirement_id else None,
                order=q.order,
                section=q.section,
                is_reusable=q.is_reusable,
                reusable_question_id=str(q.reusable_question_id) if q.reusable_question_id else None,
                created_at=q.created_at.isoformat(),
                updated_at=q.updated_at.isoformat()
            )
        )
    
    return result


@router.post("/assignments/{assignment_id}/responses", response_model=AssessmentSubmissionResponse)
async def save_assessment_responses(
    assignment_id: UUID,
    responses: Dict[str, Any],  # {question_id: {value, comment, documents} or simple value}
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    is_draft: bool = Query(False, description="If True, save as draft and don't mark as completed")
):
    """Save responses for an assessment assignment
    
    Response format can be:
    - Simple: {question_id: "response_value"}
    - Enhanced: {question_id: {"value": "...", "comment": "...", "documents": [...]}}
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Mark assignment as in_progress if not started
    if not assignment.started_at:
        assignment.started_at = datetime.utcnow()
        assignment.status = 'in_progress'
    
    # Get assessment to ensure tenant isolation and get tenant_id
    assessment = db.query(Assessment).filter(
        Assessment.id == assignment.assessment_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    # Verify tenant isolation
    if assessment.tenant_id != effective_tenant_id:
        logger.error(f"Tenant mismatch: Assessment {assignment.assessment_id} belongs to tenant {assessment.tenant_id}, but assignment belongs to tenant {effective_tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Assessment belongs to a different tenant"
        )
    
    # Get questions for this assessment with tenant filtering
    # First try with tenant filter, then fallback for backward compatibility
    questions = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.assessment_id == assignment.assessment_id,
        AssessmentQuestion.tenant_id == assessment.tenant_id
    ).all()
    
    # Fallback for backward compatibility with old data
    if len(questions) == 0:
        logger.warning(f"No questions found with tenant filter for assessment {assignment.assessment_id}. Trying without tenant filter.")
        questions = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assignment.assessment_id
        ).all()
        if len(questions) > 0:
            logger.warning(f"Found {len(questions)} questions without tenant filter. Using them but tenant isolation may be compromised.")
    
    if len(questions) == 0:
        logger.warning(f"Assignment {assignment_id} has no questions. Cannot validate completion.")
        # Don't fail, but log warning
    
    from app.models.submission_requirement import SubmissionRequirementResponse
    
    # Save responses for all question types
    for question in questions:
        question_response = responses.get(str(question.id))
        
        # Skip if no response provided
        if question_response is None:
            continue
        
        # Handle both simple and enhanced response formats
        if isinstance(question_response, dict):
            response_value = question_response.get('value')
            comment = question_response.get('comment')
            documents = question_response.get('documents', [])
        else:
            # Simple format - just the value
            response_value = question_response
            comment = None
            documents = []
        
        # For requirement_reference questions with agent_id, also save to SubmissionRequirementResponse
        if question.question_type == 'requirement_reference' and question.requirement_id and assignment.agent_id:
            requirement_id = question.requirement_id
            response_data = {
                'value': response_value,
                'comment': comment,
                'documents': documents
            } if isinstance(question_response, dict) else response_value
            
            # Check if response already exists
            existing = db.query(SubmissionRequirementResponse).filter(
                SubmissionRequirementResponse.requirement_id == requirement_id,
                SubmissionRequirementResponse.agent_id == assignment.agent_id
            ).first()
            
            if existing:
                existing.value = response_data
                existing.updated_at = datetime.utcnow()
            else:
                response = SubmissionRequirementResponse(
                    requirement_id=requirement_id,
                    agent_id=assignment.agent_id,
                    value=response_data,
                    submitted_by=current_user.id
                )
                db.add(response)
        
        # Save to AssessmentQuestionResponse for all question types
        # This ensures we have responses stored regardless of question type or assignment type
        try:
            existing_response = db.query(AssessmentQuestionResponseModel).filter(
                AssessmentQuestionResponseModel.assignment_id == assignment_id,
                AssessmentQuestionResponseModel.question_id == question.id
            ).first()
            
            # Evaluate response against pass/fail criteria (real-time, cost-optimized)
            ai_evaluation = None
            if question.reusable_question_id and response_value:
                try:
                    from app.models.question_library import QuestionLibrary
                    from app.services.compliance_calculation_service import ComplianceCalculationService
                    
                    qlib_question = db.query(QuestionLibrary).filter(
                        QuestionLibrary.id == question.reusable_question_id
                    ).first()
                    
                    if qlib_question and qlib_question.pass_fail_criteria:
                        # Create a temporary response object for evaluation
                        temp_response = type('obj', (object,), {
                            'value': response_value,
                            'documents': documents or []
                        })()
                        
                        service = ComplianceCalculationService(db)
                        evaluation = service._evaluate_question_response(
                            qlib_question,
                            temp_response,
                            question
                        )
                        
                        ai_evaluation = {
                            "status": evaluation["status"],
                            "confidence": evaluation.get("confidence", 0.0),
                            "reasoning": evaluation.get("reasoning", ""),
                            "evaluated_at": datetime.utcnow().isoformat(),
                            "evaluated_by": "ai_system"
                        }
                except Exception as e:
                    logger.warning(f"Error evaluating response for question {question.id}: {e}")
                    # Continue without evaluation - don't fail the save
            
            if existing_response:
                existing_response.value = response_value
                existing_response.comment = comment if comment else None
                existing_response.documents = documents if documents and len(documents) > 0 else None
                existing_response.ai_evaluation = ai_evaluation
                existing_response.updated_at = datetime.utcnow()
            else:
                question_response_obj = AssessmentQuestionResponseModel(
                    assignment_id=assignment_id,
                    question_id=question.id,
                    tenant_id=effective_tenant_id,
                    value=response_value,
                    comment=comment if comment else None,
                    documents=documents if documents and len(documents) > 0 else None,
                    submitted_by=current_user.id
                )
                db.add(question_response_obj)
        except Exception as e:
            logger.error(f"Error saving question response for question {question.id}: {e}", exc_info=True)
            # Continue with other questions even if one fails
    
    # Flush responses to database before completion check (so they're available for queries)
    # This ensures the completion check can find responses that were just saved
    try:
        db.flush()
        logger.info(f"Flushed responses to database for assignment {assignment_id} before completion check")
    except Exception as e:
        logger.warning(f"Error flushing responses before completion check: {e}", exc_info=True)
        # Continue anyway - responses might still be in session
    
    # Check if all required questions are answered (only if not draft)
    if not is_draft:
        # Ensure assessment has questions
        if len(questions) == 0:
            logger.error(f"Assignment {assignment_id} has no questions. Cannot submit. Assessment ID: {assignment.assessment_id}, Tenant: {effective_tenant_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot submit assessment: Assessment has no questions. Please add questions to the assessment first."
            )
        
        required_questions = [q for q in questions if q.is_required]
        
        logger.info(f"Checking completion for assignment {assignment_id}: {len(required_questions)} required questions, {len(questions)} total questions, {len(responses)} responses in request")
        
        # Helper function to check if a response value is actually provided (not None, not empty string, not empty dict/list)
        def is_response_provided(response_value):
            """Check if a response value is actually provided (not None, empty string, empty dict, or empty list)"""
            if response_value is None:
                return False
            if isinstance(response_value, str) and response_value.strip() == "":
                return False
            if isinstance(response_value, dict) and len(response_value) == 0:
                return False
            if isinstance(response_value, list) and len(response_value) == 0:
                return False
            # Check if it's a dict with a 'value' key (enhanced format)
            if isinstance(response_value, dict):
                value = response_value.get('value')
                if value is None or (isinstance(value, str) and value.strip() == ""):
                    return False
            return True
        
        # If there are required questions, all must be answered
        # If there are no required questions, at least one question must be answered
        if len(required_questions) > 0:
            answered_status = []
            for q in required_questions:
                # Check if answered in current request
                question_response = responses.get(str(q.id))
                in_request = question_response is not None and is_response_provided(question_response)
                
                # Check if answered in database (with non-empty value)
                # Query for responses with non-null, non-empty values
                from sqlalchemy import and_, or_, func
                db_response = db.query(AssessmentQuestionResponseModel).filter(
                    AssessmentQuestionResponseModel.assignment_id == assignment_id,
                    AssessmentQuestionResponseModel.question_id == q.id,
                    AssessmentQuestionResponseModel.value.isnot(None)
                ).first()
                # Additional check: ensure the value is not an empty string, empty dict, or empty list
                if db_response:
                    in_db = is_response_provided(db_response.value)
                else:
                    in_db = False
                
                # Check if answered via requirement reference
                in_requirement = (q.question_type == 'requirement_reference' and q.requirement_id and assignment.agent_id and
                 db.query(SubmissionRequirementResponse).filter(
                     SubmissionRequirementResponse.requirement_id == q.requirement_id,
                     SubmissionRequirementResponse.agent_id == assignment.agent_id
                 ).first() is not None)
                
                is_answered = in_request or in_db or in_requirement
                answered_status.append((str(q.id), is_answered, in_request, in_db, in_requirement))
            
            all_answered = all(status[1] for status in answered_status)
            
            if not all_answered:
                unanswered = [s[0] for s in answered_status if not s[1]]
                logger.info(f"Not all required questions answered for assignment {assignment_id}. Unanswered question IDs: {unanswered}")
                logger.debug(f"Answered status details: {answered_status}")
        else:
            # No required questions - check if ALL questions have been answered with actual content
            # This ensures that when a questionnaire is submitted, all questions must be answered
            answered_status = []
            for q in questions:
                # Check if answered in current request
                question_response = responses.get(str(q.id))
                in_request = question_response is not None and is_response_provided(question_response)
                
                # Check if answered in database (with non-empty value)
                db_response = db.query(AssessmentQuestionResponseModel).filter(
                    AssessmentQuestionResponseModel.assignment_id == assignment_id,
                    AssessmentQuestionResponseModel.question_id == q.id,
                    AssessmentQuestionResponseModel.value.isnot(None)
                ).first()
                # Additional check: ensure the value is not an empty string, empty dict, or empty list
                if db_response:
                    in_db = is_response_provided(db_response.value)
                else:
                    in_db = False
                
                # Check if answered via requirement reference
                in_requirement = (q.question_type == 'requirement_reference' and q.requirement_id and assignment.agent_id and
                 db.query(SubmissionRequirementResponse).filter(
                     SubmissionRequirementResponse.requirement_id == q.requirement_id,
                     SubmissionRequirementResponse.agent_id == assignment.agent_id
                 ).first() is not None)
                
                is_answered = in_request or in_db or in_requirement
                answered_status.append((str(q.id), is_answered, in_request, in_db, in_requirement))
            
            all_answered = all(status[1] for status in answered_status)
            answered_count = sum(1 for status in answered_status if status[1])
            
            if not all_answered:
                unanswered = [s[0] for s in answered_status if not s[1]]
                logger.info(f"Not all questions answered for assignment {assignment_id} (no required questions). Unanswered question IDs: {unanswered}")
                logger.debug(f"Answered status details: {answered_status}")
            
            logger.info(f"No required questions. Checking if all questions answered: {answered_count}/{len(questions)} answered")
        
        # Log completion check result with detailed information
        logger.info(f"Completion check for assignment {assignment_id}: all_answered={all_answered}, is_draft={is_draft}, required_questions={len(required_questions) if len(required_questions) > 0 else 0}, total_questions={len(questions)}")
        
        if all_answered:
            logger.info(f"✅ Completion check passed for assignment {assignment_id}. Proceeding to mark as completed and trigger workflow.")
            # Capture previous status before any changes
            previous_status = assignment.status
            # Check if assignment is already completed
            was_already_completed = assignment.status == 'completed'
            
            logger.info(f"✅ All required questions answered for assignment {assignment_id}. Marking as completed and triggering workflows.")
            assignment.status = 'completed'
            if not assignment.completed_at:
                assignment.completed_at = datetime.utcnow()
                logger.info(f"✅ Set completed_at timestamp for assignment {assignment_id}")
            
            # CRITICAL: Flush assignment status to database BEFORE creating approval action items
            # This ensures the assignment.status is 'completed' when the approval workflow checks it
            db.flush()
            logger.info(f"✅ Flushed assignment {assignment_id} status='completed' to database before triggering approval workflow")
            
            # Generate human-readable workflow ticket ID (e.g., ASMT-2026-017)
            if not assignment.workflow_ticket_id:
                try:
                    assignment.workflow_ticket_id = _generate_assessment_ticket_id(db, assignment.tenant_id)
                    logger.info(f"✅ Generated workflow ticket ID {assignment.workflow_ticket_id} for assignment {assignment_id}")
                except Exception as e:
                    logger.error(f"❌ Failed to generate workflow ticket ID for assignment {assignment_id}: {str(e)}", exc_info=True)
                    # Continue without ticket ID - it's not critical
            else:
                logger.info(f"✅ Assignment {assignment_id} already has workflow ticket ID: {assignment.workflow_ticket_id}")
            
            # Create workflow history entry for submission (only if not already completed)
            if not was_already_completed:
                from app.models.assessment_workflow_history import AssessmentWorkflowHistory, WorkflowActionType
                from app.models.assessment_review import AssessmentQuestionReview
                
                # Check if this is a resubmission (was previously sent back or denied)
                is_resubmission = previous_status in ['in_progress', 'rejected', 'needs_revision']
                
                # If resubmission, get information about previously returned questions
                resubmitted_questions_info = []
                if is_resubmission:
                    # Get questions that were previously marked as in_progress or fail
                    from app.models.assessment_review import AssessmentReview
                    # AssessmentQuestion is already imported at the top of the file
                    
                    # Get the most recent review
                    recent_review = db.query(AssessmentReview).filter(
                        AssessmentReview.assignment_id == assignment_id,
                        AssessmentReview.tenant_id == assignment.tenant_id
                    ).order_by(AssessmentReview.created_at.desc()).first()
                    
                    if recent_review:
                        # Get questions that were previously returned
                        previously_returned = db.query(AssessmentQuestionReview).filter(
                            AssessmentQuestionReview.review_id == recent_review.id,
                            AssessmentQuestionReview.status.in_(["in_progress", "fail"])
                        ).all()
                        
                        for q_review in previously_returned:
                            question = db.query(AssessmentQuestion).filter(AssessmentQuestion.id == q_review.question_id).first()
                            resubmitted_questions_info.append({
                                "question_id": str(q_review.question_id),
                                "question_text": question.question_text if question else None,
                                "question_number": question.question_number if question else None,
                                "previous_status": q_review.status,
                                "previous_comment": q_review.reviewer_comment
                            })
                
                # Determine action type: RESUBMITTED if it was previously sent back, otherwise SUBMITTED
                action_type = WorkflowActionType.RESUBMITTED.value if is_resubmission else WorkflowActionType.SUBMITTED.value
                
                workflow_history = AssessmentWorkflowHistory(
                    assignment_id=assignment_id,
                    assessment_id=assignment.assessment_id,
                    tenant_id=assignment.tenant_id,
                    action_type=action_type,
                    action_by=current_user.id,
                    action_at=datetime.utcnow(),
                    previous_status=previous_status,
                    new_status='completed',
                    workflow_ticket_id=assignment.workflow_ticket_id,
                    action_metadata={
                        "submitted_by": current_user.name or current_user.email,
                        "submitted_at": assignment.completed_at.isoformat() if assignment.completed_at else datetime.utcnow().isoformat(),
                        "is_resubmission": is_resubmission,
                        "resubmitted_questions": resubmitted_questions_info if is_resubmission else []
                    }
                )
                db.add(workflow_history)
                logger.info(f"Created workflow history entry for {'resubmission' if is_resubmission else 'submission'} of assignment {assignment_id}")
            
            # Update ActionItem status to completed for vendor assignment items
            # This ensures completed assessments don't show as pending in vendor's action items
            from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus
            vendor_assignment_items = db.query(ActionItem).filter(
                ActionItem.source_id == assignment_id,
                ActionItem.source_type == "assessment_assignment",
                ActionItem.action_type == ActionItemType.ASSESSMENT,
                ActionItem.status.in_([ActionItemStatus.PENDING, ActionItemStatus.IN_PROGRESS])
            ).all()
            
            for item in vendor_assignment_items:
                item.status = ActionItemStatus.COMPLETED.value
                item.completed_at = datetime.utcnow()
                logger.info(f"Updated ActionItem {item.id} to completed status for assignment {assignment_id}")
            
            # SIMPLIFIED WORKFLOW: Submission → Approval
            # On submission, directly create APPROVAL action items for approvers
            # The approver view will use form layouts (assessment_workflow, pending_approval stage) for visibility
            existing_approval_items = db.query(ActionItem).filter(
                ActionItem.source_id == assignment_id,
                ActionItem.source_type == "assessment_approval",
                ActionItem.action_type == ActionItemType.APPROVAL,
                ActionItem.status.in_(["pending", "in_progress"])
            ).count()
            
            logger.info(f"Checking for existing approval items for assignment {assignment_id}: found {existing_approval_items} items")
            
            if existing_approval_items > 0:
                logger.info(f"Approval workflow already triggered for assignment {assignment_id}. Found {existing_approval_items} existing approval action items.")
            else:
                # Create approval action items directly on submission
                # This creates action items that will show in approver inbox based on form layout visibility
                try:
                    logger.info(f"🚀 Assignment {assignment_id} submitted. Triggering approval workflow, submitted by user {current_user.id} ({current_user.email})")
                    logger.info(f"   Assignment details: status={assignment.status}, assessment_id={assignment.assessment_id}, tenant_id={assignment.tenant_id}, workflow_ticket_id={assignment.workflow_ticket_id}")
                    
                    # Ensure assignment is flushed before triggering workflow
                    db.flush()
                    
                    # Run synchronously to create action items immediately (they'll be committed with the main transaction)
                    await _trigger_assessment_approval_workflow(assignment, current_user, db, background_tasks)
                    
                    # Flush again to ensure action items are in the session
                    db.flush()
                    
                    # Verify action items were created
                    created_count = db.query(ActionItem).filter(
                        ActionItem.source_id == assignment_id,
                        ActionItem.source_type == "assessment_approval",
                        ActionItem.action_type == ActionItemType.APPROVAL
                    ).count()
                    
                    if created_count > 0:
                        logger.info(f"✅ Successfully triggered approval workflow for assignment {assignment_id}. Created {created_count} approval action items for approvers.")
                    else:
                        logger.warning(f"⚠️ Approval workflow triggered but no action items were created for assignment {assignment_id}. This may indicate no approvers were found.")
                except Exception as e:
                    logger.error(f"❌ Error triggering approval workflow for assignment {assignment_id}: {e}", exc_info=True, extra={
                        "assignment_id": str(assignment_id),
                        "user_id": str(current_user.id),
                        "error_type": type(e).__name__,
                        "error_message": str(e)
                    })
                    # Don't fail the submission if workflow trigger fails, but log the error
                    # The workflow can be manually triggered later if needed
        else:
            # Log detailed information about why assignment is not complete
            if len(required_questions) > 0:
                unanswered_required = []
                for q in required_questions:
                    question_response = responses.get(str(q.id))
                    db_response = db.query(AssessmentQuestionResponseModel).filter(
                        AssessmentQuestionResponseModel.assignment_id == assignment_id,
                        AssessmentQuestionResponseModel.question_id == q.id,
                        AssessmentQuestionResponseModel.value.isnot(None)
                    ).first()
                    if not question_response and not db_response:
                        unanswered_required.append(str(q.id))
                logger.warning(f"Assignment {assignment_id} not yet complete. Required questions: {len(required_questions)}, Unanswered required question IDs: {unanswered_required}")
            else:
                total_answered = sum(1 for q in questions if (
                    str(q.id) in responses or 
                    db.query(AssessmentQuestionResponseModel).filter(
                        AssessmentQuestionResponseModel.assignment_id == assignment_id,
                        AssessmentQuestionResponseModel.question_id == q.id,
                        AssessmentQuestionResponseModel.value.isnot(None)
                    ).first()
                ))
                logger.warning(f"Assignment {assignment_id} not yet complete. Total questions: {len(questions)}, Answered: {total_answered}")
    
    try:
        # Ensure assignment status and action items are saved before committing
        db.flush()  # Flush to ensure assignment status and action items are in the session
        
        # Verify action items were created (for debugging)
        from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus
        approval_items_count = db.query(ActionItem).filter(
            ActionItem.source_id == assignment_id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.action_type == ActionItemType.APPROVAL,
            ActionItem.status.in_([ActionItemStatus.PENDING, ActionItemStatus.IN_PROGRESS])
        ).count()
        # Check for approval items (legacy code - now all use assessment_approval source_type)
        approval_items_legacy_count = db.query(ActionItem).filter(
            ActionItem.source_id == assignment_id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.action_type == ActionItemType.APPROVAL
        ).count()
        
        # Log detailed information about action items
        if approval_items_count > 0:
            approval_items = db.query(ActionItem).filter(
                ActionItem.source_id == assignment_id,
                ActionItem.source_type == "assessment_approval",
                ActionItem.action_type == ActionItemType.APPROVAL
            ).all()
            for item in approval_items:
                logger.info(f"Approval action item {item.id}: assigned_to={item.assigned_to}, status={item.status.value if hasattr(item.status, 'value') else item.status}, tenant_id={item.tenant_id}")
        else:
            logger.warning(f"No approval action items found for assignment {assignment_id} before commit. This may indicate the approval workflow was not triggered or failed.")
        
        logger.info(f"Before commit: Found {approval_items_count} approval action items and {review_items_count} review action items for assignment {assignment_id}")
        
        db.commit()
        logger.info(f"Successfully committed assessment responses and action items for assignment {assignment_id}. Status: {assignment.status}, Approval items: {approval_items_count}")
        
        # Verify after commit - query again to ensure items are persisted
        approval_items_after_commit = db.query(ActionItem).filter(
            ActionItem.source_id == assignment_id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.action_type == ActionItemType.APPROVAL,
            ActionItem.status.in_([ActionItemStatus.PENDING, ActionItemStatus.IN_PROGRESS])
        ).count()
        logger.info(f"After commit: Found {approval_items_after_commit} approval action items for assignment {assignment_id}")
        
        if approval_items_after_commit == 0 and assignment.status == 'completed':
            logger.error(f"CRITICAL: Assignment {assignment_id} is completed but no approval action items exist. Approval workflow may have failed.")
        
        # Verify after commit
        approval_items_after_commit = db.query(ActionItem).filter(
            ActionItem.source_id == assignment_id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.action_type == ActionItemType.APPROVAL
        ).count()
        logger.info(f"After commit: Found {approval_items_after_commit} approval action items for assignment {assignment_id}")
        
        # Verify action items after commit
        approval_items_after = db.query(ActionItem).filter(
            ActionItem.source_id == assignment_id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.action_type == ActionItemType.APPROVAL
        ).all()
        logger.info(f"After commit: Found {len(approval_items_after)} approval action items for assignment {assignment_id}")
        for item in approval_items_after:
            logger.info(f"  - Action item {item.id}: assigned_to={item.assigned_to}, status={item.status.value if hasattr(item.status, 'value') else item.status}, type={item.action_type.value if hasattr(item.action_type, 'value') else item.action_type}")
        
        # Refresh assignment to ensure status is persisted and get latest ticket ID
        db.refresh(assignment)
        logger.info(f"Assignment {assignment_id} status after commit: {assignment.status}, ticket_id: {assignment.workflow_ticket_id}")
        
        # Update action items' metadata with the human-readable ticket ID
        if assignment.workflow_ticket_id:
            from app.models.action_item import ActionItem, ActionItemType
            action_items_to_update = db.query(ActionItem).filter(
                ActionItem.source_id == assignment_id,
                ActionItem.source_type == "assessment_approval",
                ActionItem.action_type == ActionItemType.APPROVAL
            ).all()
            
            for action_item in action_items_to_update:
                # Update metadata to include workflow_ticket_id (human-readable ticket ID)
                if not action_item.item_metadata:
                    action_item.item_metadata = {}
                if not action_item.item_metadata.get("workflow_ticket_id"):
                    action_item.item_metadata["workflow_ticket_id"] = assignment.workflow_ticket_id
                    logger.info(f"Updated action item {action_item.id} metadata with workflow_ticket_id {assignment.workflow_ticket_id}")
            
            if action_items_to_update:
                db.commit()
                logger.info(f"Updated {len(action_items_to_update)} action items with workflow_ticket_id {assignment.workflow_ticket_id}")
        
        # Determine if workflow was triggered
        workflow_triggered = approval_items_after_commit > 0
        
        # Return response with human-readable ticket ID and workflow status
        return AssessmentSubmissionResponse(
            assignment_id=str(assignment_id),
            workflow_ticket_id=assignment.workflow_ticket_id,
            status=assignment.status,
            workflow_triggered=workflow_triggered,
            message=f"Assessment submitted successfully" + (f" with ticket {assignment.workflow_ticket_id}" if assignment.workflow_ticket_id else "")
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving assessment responses: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while saving responses"
        )


async def _trigger_ai_review(
    assignment: AssessmentAssignment,
    submitted_by: User,
    db: Session
):
    """Trigger AI questionnaire review agent"""
    try:
        from app.services.agentic.agent_registry import AgentRegistry
        from app.models.agentic_agent import AgenticAgentType, AgentSkill
        
        registry = AgentRegistry(db)
        
        # Find questionnaire review agent for this tenant
        agents = await registry.get_agents_by_type(
            agent_type=AgenticAgentType.QUESTIONNAIRE_REVIEWER.value,
            tenant_id=assignment.tenant_id,
            active_only=True
        )
        
        if not agents:
            logger.info(f"No questionnaire review agent found for tenant {assignment.tenant_id}")
            return
        
        # Use the first available agent
        agent = agents[0]
        
        # Execute review
        review_result = await agent.execute_skill(
            skill=AgentSkill.QUESTIONNAIRE_REVIEW.value,
            input_data={
                "assignment_id": str(assignment.id)
            },
            context={
                "submitted_by": str(submitted_by.id),
                "submitted_at": assignment.completed_at.isoformat() if assignment.completed_at else datetime.utcnow().isoformat()
            }
        )
        
        # Assign to human reviewers if needed
        if review_result.get("risk_score", 0) >= 50 or len(review_result.get("flagged_risks", [])) > 0:
            await _assign_human_reviewers(
                review_id=review_result.get("review_id"),
                assignment=assignment,
                review_result=review_result,
                db=db
            )
        
        logger.info(f"AI review completed for assignment {assignment.id}: Risk Score {review_result.get('risk_score')}")
        
    except Exception as e:
        logger.error(f"Error triggering AI review: {e}", exc_info=True)
        raise


async def _assign_human_reviewers(
    review_id: str,
    assignment: AssessmentAssignment,
    review_result: Dict[str, Any],
    db: Session
):
    """Assign review to human reviewers based on agent config, flow config, or rules"""
    from app.models.assessment_review import AssessmentReview
    from app.models.user import User, UserRole
    from app.models.assessment import Assessment
    from app.services.email_service import EmailService
    from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
    from app.models.agentic_agent import AgenticAgent
    import os
    
    review = db.query(AssessmentReview).filter(AssessmentReview.id == UUID(review_id)).first()
    if not review:
        return
    
    assessment = db.query(Assessment).filter(Assessment.id == assignment.assessment_id).first()
    if not assessment:
        return
    
    # Determine reviewers - check agent config, flow config, or use rule-based assignment
    reviewers = []
    
    # 1. Check agent configuration for assigned reviewers
    agent = None
    if review.ai_agent_id:
        agent = db.query(AgenticAgent).filter(AgenticAgent.id == review.ai_agent_id).first()
        if agent and agent.configuration:
            assigned_reviewer_ids = agent.configuration.get("reviewers", [])
            if assigned_reviewer_ids:
                reviewers = db.query(User).filter(
                    User.id.in_([UUID(rid) if isinstance(rid, str) else rid for rid in assigned_reviewer_ids]),
                    User.tenant_id == assignment.tenant_id,
                    User.is_active == True
                ).all()
    
    # 2. Check flow configuration (if assessment is part of a flow)
    # This would require checking AgenticFlow configuration
    # For now, we'll use rule-based assignment
    
    # 3. Rule-based assignment using business rules engine
    if not reviewers:
        try:
            from app.services.business_rules_engine import BusinessRulesEngine
            
            rules_engine = BusinessRulesEngine(db, assignment.tenant_id)
            
            # Build context for rule evaluation
            context = {
                "assessment": {
                    "id": str(assessment.id),
                    "name": assessment.name,
                    "assessment_type": assessment.assessment_type,
                    "status": assessment.status
                },
                "review": {
                    "id": str(review.id),
                    "risk_score": review.risk_score,
                    "risk_level": review.risk_level,
                    "review_type": review.review_type
                },
                "assignment": {
                    "id": str(assignment.id),
                    "assignment_type": assignment.assignment_type,
                    "status": assignment.status
                }
            }
            
            # Add agent/vendor context if available
            if assignment.agent_id:
                from app.models.agent import Agent
                agent = db.query(Agent).filter(Agent.id == assignment.agent_id).first()
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
            
            if assignment.vendor_id:
                from app.models.vendor import Vendor
                vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
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
                screen="assessment_review",
                rule_type="assignment"
            )
            
            # Execute automatic assignment actions
            if rule_results:
                action_results = rules_engine.execute_actions(
                    rule_results,
                    context,
                    auto_execute=True
                )
                
                # Extract assigned reviewers from rule actions
                for executed in action_results.get("executed", []):
                    if executed.get("action", {}).get("type") == "assign":
                        assigned_target = executed.get("action", {}).get("value")
                        # Resolve user from assignment target (e.g., "user.department_manager")
                        # For now, use role-based assignment as fallback
                        pass  # Will be handled by fallback logic below
            
        except Exception as e:
            logger.warning(f"Error evaluating business rules for review assignment: {e}", exc_info=True)
            # Continue with default assignment logic
        
        # Fallback: Default rule-based assignment based on risk level and assessment type
        if not reviewers:
            # High risk or critical -> assign to security and compliance reviewers
            if review.risk_level in ["high", "critical"]:
                reviewers = db.query(User).filter(
                    User.tenant_id == assignment.tenant_id,
                    User.role.in_([UserRole.SECURITY_REVIEWER, UserRole.COMPLIANCE_REVIEWER]),
                    User.is_active == True
                ).all()
            # Medium risk -> assign to technical reviewer
            elif review.risk_level == "medium":
                reviewers = db.query(User).filter(
                    User.tenant_id == assignment.tenant_id,
                    User.role == UserRole.TECHNICAL_REVIEWER,
                    User.is_active == True
                ).all()
            # Low risk -> assign to business reviewer or assessment owner
            else:
                # Add assessment owner
                owner = db.query(User).filter(User.id == assessment.owner_id).first()
                if owner and owner.is_active:
                    reviewers.append(owner)
                
                # Add business reviewers
                business_reviewers = db.query(User).filter(
                    User.tenant_id == assignment.tenant_id,
                    User.role == UserRole.BUSINESS_REVIEWER,
                    User.is_active == True
                ).all()
                reviewers.extend(business_reviewers)
    
    # 4. Fallback to assessment owner and team members
    if not reviewers:
        owner = db.query(User).filter(User.id == assessment.owner_id).first()
        if owner and owner.is_active:
            reviewers.append(owner)
        
        if assessment.team_ids:
            # Ensure team_ids is a list and not None
            team_ids_list = assessment.team_ids if isinstance(assessment.team_ids, list) else []
            if team_ids_list:
                team_members = db.query(User).filter(
                    User.id.in_([UUID(tid) for tid in team_ids_list if tid]),
                    User.tenant_id == assignment.tenant_id,
                    User.is_active == True
                ).all()
                reviewers.extend(team_members)
    
    # Remove duplicates
    reviewer_ids = set()
    unique_reviewers = []
    for reviewer in reviewers:
        if reviewer.id not in reviewer_ids:
            reviewer_ids.add(reviewer.id)
            unique_reviewers.append(reviewer)
    
    # Assign to first reviewer (or distribute if multiple)
    if unique_reviewers:
        # For now, assign to first reviewer
        # In future, could distribute based on workload
        assigned_reviewer = unique_reviewers[0]
        review.assigned_to = assigned_reviewer.id
        review.assigned_at = datetime.utcnow()
        review.assigned_by = None  # System assignment
        # Use the agentic agent (if available) for assignment method determination
        agentic_agent_config = agent.configuration if agent and hasattr(agent, 'configuration') else None
        review.assignment_method = "rule_based" if not agentic_agent_config else "agent_config"
        review.status = "pending"  # Pending human review
        review.updated_at = datetime.utcnow()
        
        # Create action item
        action_item = ActionItem(
            tenant_id=assignment.tenant_id,
            assigned_to=assigned_reviewer.id,
            assigned_by=None,
            action_type=ActionItemType.APPROVAL.value,
            title=f"Approve Assessment: {assessment.name}",
            description=f"AI review completed. Risk Score: {review.risk_score:.1f} ({review.risk_level})",
            status=ActionItemStatus.PENDING.value,
            priority=ActionItemPriority.HIGH.value if review.risk_level in ["high", "critical"] else ActionItemPriority.MEDIUM.value,
            due_date=None,
            source_type="assessment_approval",
            source_id=review.id,
            action_url=f"/assessments/review/{review.id}",
            item_metadata={
                "review_id": str(review.id),
                "assignment_id": str(assignment.id),
                "assessment_id": str(assessment.id),
                "assessment_name": assessment.name,
                "risk_score": review.risk_score,
                "risk_level": review.risk_level,
                "workflow_ticket_id": assignment.workflow_ticket_id if hasattr(assignment, 'workflow_ticket_id') else None
            }
        )
        db.add(action_item)
        
        # Send email notification
        try:
            email_service = EmailService()
            email_service.load_config_from_db(db, str(assignment.tenant_id))
            
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            review_url = f"{frontend_url}/assessments/review/{review.id}"
            
            subject = f"Assessment Review Required: {assessment.name}"
            html_body = f"""
            <html>
            <body>
                <h2>Assessment Review Required</h2>
                <p>Hello {assigned_reviewer.name or assigned_reviewer.email},</p>
                <p>An AI review has been completed for the assessment: <strong>{assessment.name}</strong></p>
                <p><strong>Review ID:</strong> {review.id}</p>
                <p><strong>Risk Score:</strong> {review.risk_score:.1f} ({review.risk_level})</p>
                <p><strong>Flagged Risks:</strong> {len(review.flagged_risks or [])}</p>
                <p><a href="{review_url}">Review Assessment</a></p>
            </body>
            </html>
            """
            text_body = f"""
            Assessment Review Required
            
            Hello {assigned_reviewer.name or assigned_reviewer.email},
            
            An AI review has been completed for the assessment: {assessment.name}
            
            Review ID: {review.id}
            Risk Score: {review.risk_score:.1f} ({review.risk_level})
            Flagged Risks: {len(review.flagged_risks or [])}
            
            Review Assessment: {review_url}
            """
            
            sent, _ = await email_service.send_email(
                assigned_reviewer.email,
                subject,
                html_body,
                text_body
            )
        except Exception as e:
            logger.error(f"Failed to send review notification email: {e}", exc_info=True)
        
        db.commit()


async def _check_all_questions_reviewed(
    assignment_id: UUID,
    questions: List[AssessmentQuestion],
    db: Session
) -> bool:
    """Check if all questions have been reviewed (graded)
    
    Returns True if all questions have been reviewed (status is pass, fail, resolved, or in_progress)
    Returns False if any question hasn't been reviewed yet (status is pending or doesn't exist)
    """
    from app.models.assessment_review import AssessmentReview, AssessmentQuestionReview, QuestionReviewStatus
    
    # Get the latest review for this assignment
    review = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id == assignment_id
    ).order_by(AssessmentReview.created_at.desc()).first()
    
    if not review:
        # No review exists yet
        return False
    
    # Get all question reviews for this review
    question_reviews = db.query(AssessmentQuestionReview).filter(
        AssessmentQuestionReview.review_id == review.id
    ).all()
    
    # Create a map of question_id -> review status
    reviewed_questions = {str(qr.question_id): qr.status for qr in question_reviews}
    
    # Check if all questions have been reviewed
    # A question is considered reviewed if it has a status other than "pending" or doesn't exist
    for question in questions:
        question_id_str = str(question.id)
        review_status = reviewed_questions.get(question_id_str)
        
        # If no review exists or status is pending, question is not reviewed
        if not review_status or review_status == QuestionReviewStatus.PENDING.value:
            return False
    
    # All questions have been reviewed
    return True


async def _update_entity_status_on_approval(
    assignment: AssessmentAssignment,
    current_user: User,
    db: Session
):
    """Update vendor/agent status to Green when assessment is approved"""
    try:
        if assignment.vendor_id:
            # Update vendor compliance score to Green
            from app.models.vendor import Vendor
            vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
            if vendor:
                # Set vendor compliance_score to 100 (Green status)
                vendor.compliance_score = 100
                logger.info(f"Assessment approved - Vendor {vendor.name} (ID: {vendor.id}) marked as Green (compliance_score: 100)")

        if assignment.agent_id:
            # Update agent status and compliance score
            from app.models.agent import Agent, AgentStatus
            agent = db.query(Agent).filter(Agent.id == assignment.agent_id).first()
            if agent:
                # Set agent status to APPROVED and compliance_score to 100
                agent.status = AgentStatus.APPROVED.value
                agent.compliance_score = 100
                agent.approval_date = datetime.utcnow()
                logger.info(f"Assessment approved - Agent {agent.name} (ID: {agent.id}) marked as APPROVED (compliance_score: 100)")
        
        # Commit the status updates
        db.commit()
        logger.info(f"Successfully updated entity statuses for assignment {assignment.id}")

    except Exception as e:
        logger.error(f"Error updating entity status on approval: {e}", exc_info=True)
        db.rollback()
        # Don't fail the approval if status update fails


async def _trigger_resubmission_workflow(
    assignment: AssessmentAssignment,
    comment: Optional[str],
    current_user: User,
    db: Session
):
    """Trigger resubmission workflow when assessment needs rework"""
    from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
    from app.services.email_service import EmailService
    from app.models.vendor import Vendor
    from app.models.agent import Agent
    import os

    # Get assessment details
    assessment = db.query(Assessment).filter(Assessment.id == assignment.assessment_id).first()
    if not assessment:
        logger.warning(f"Assessment {assignment.assessment_id} not found for assignment {assignment.id}")
        return

    # Determine who needs to resubmit - typically the original submitter or assigned vendor users
    resubmitters = []

    # Add the original submitter if they still exist and are active
    if assignment.assigned_by:
        original_submitter = db.query(User).filter(
            User.id == assignment.assigned_by,
            User.is_active == True
        ).first()
        if original_submitter:
            resubmitters.append(original_submitter)

    # Add vendor users if this is a vendor assessment
    if assignment.vendor_id:
        vendor_users = db.query(User).filter(
            User.tenant_id == assignment.tenant_id,
            User.role == UserRole.VENDOR_USER,
            User.is_active == True
        ).all()
        # Filter by organization if possible (assuming vendor contact email matches)
        vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
        if vendor and vendor.contact_email:
            vendor_users = [u for u in vendor_users if u.email == vendor.contact_email]
        resubmitters.extend(vendor_users)

    # Remove duplicates
    submitter_ids = set()
    unique_resubmitters = []
    for submitter in resubmitters:
        if submitter.id not in submitter_ids:
            submitter_ids.add(submitter.id)
            unique_resubmitters.append(submitter)

    # If no specific users found, try to find tenant users who can submit assessments
    if not unique_resubmitters:
        tenant_users = db.query(User).filter(
            User.tenant_id == assignment.tenant_id,
            User.role.in_(["user", "tenant_admin", "platform_admin"]),
            User.is_active == True
        ).limit(5).all()  # Limit to avoid spamming too many users
        unique_resubmitters.extend(tenant_users)

    # Get vendor/agent info for context
    vendor_name = "Unknown Vendor"
    agent_name = None
    if assignment.vendor_id:
        vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
        if vendor:
            vendor_name = vendor.name
    if assignment.agent_id:
        agent = db.query(Agent).filter(Agent.id == assignment.agent_id).first()
        if agent:
            agent_name = agent.name

    # Create action items for resubmission
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    resubmit_url = f"{frontend_url}/assessments/{assignment.id}"

    for submitter in unique_resubmitters:
        # Create action item for resubmission
        action_item = ActionItem(
            tenant_id=assignment.tenant_id,
            assigned_to=submitter.id,
            assigned_by=current_user.id,
            action_type=ActionItemType.ASSESSMENT.value,
            title=f"Resubmit Assessment: {assessment.name}",
            description=f"Assessment requires rework. {comment or 'Please review feedback and resubmit.'} Vendor: {vendor_name}" + (f", Agent: {agent_name}" if agent_name else ""),
            status=ActionItemStatus.PENDING.value,
            priority=ActionItemPriority.HIGH.value,
            due_date=assignment.due_date,
            source_type="assessment_resubmission",
            source_id=assignment.id,
            action_url=resubmit_url,
            item_metadata={
                "assessment_id": str(assessment.id),
                "assessment_name": assessment.name,
                "assessment_type": assessment.assessment_type,
                "assignment_id": str(assignment.id),
                "vendor_id": str(assignment.vendor_id) if assignment.vendor_id else None,
                "agent_id": str(assignment.agent_id) if assignment.agent_id else None,
                "vendor_name": vendor_name,
                "agent_name": agent_name,
                "reviewer_comment": comment,
                "requires_resubmission": True,
                "original_submission": assignment.completed_at.isoformat() if assignment.completed_at else None,
                "workflow_type": "assessment_resubmission"
            }
        )
        db.add(action_item)

        # Send email notification for resubmission
        try:
            email_service = EmailService()
            email_service.load_config_from_db(db, str(assignment.tenant_id))

            subject = f"Assessment Requires Rework: {assessment.name}"
            html_body = f"""
            <html>
            <body>
                <h2>Assessment Requires Rework</h2>
                <p>Hello {submitter.name or submitter.email},</p>
                <p>The assessment <strong>{assessment.name}</strong> has been reviewed and requires additional work before approval.</p>
                <p><strong>Assessment:</strong> {assessment.name}</p>
                <p><strong>Type:</strong> {assessment.assessment_type.replace('_', ' ').title()}</p>
                <p><strong>Vendor:</strong> {vendor_name}</p>
                {f'<p><strong>Agent:</strong> {agent_name}</p>' if agent_name else ''}
                {f'<p><strong>Reviewer Feedback:</strong></p><blockquote>{comment}</blockquote>' if comment else ''}
                <p><a href="{resubmit_url}">Review and Resubmit Assessment</a></p>
                <p>Please address the feedback and resubmit the assessment for approval.</p>
            </body>
            </html>
            """
            text_body = f"""
            Assessment Requires Rework

            Hello {submitter.name or submitter.email},

            The assessment {assessment.name} has been reviewed and requires additional work before approval.

            Assessment: {assessment.name}
            Type: {assessment.assessment_type.replace('_', ' ').title()}
            Vendor: {vendor_name}
            {f'Agent: {agent_name}' if agent_name else ''}
            {f'Reviewer Feedback: {comment}' if comment else ''}

            Review and Resubmit: {resubmit_url}

            Please address the feedback and resubmit the assessment for approval.
            """

            sent, _ = await email_service.send_email(submitter.email, subject, html_body, text_body)
        except Exception as e:
            logger.error(f"Failed to send resubmission notification email to {submitter.email}: {e}", exc_info=True)

    logger.info(f"Created assessment resubmission workflow for assignment {assignment.id} with {len(unique_resubmitters)} recipients")


async def _trigger_assessment_approval_workflow(
    assignment: AssessmentAssignment,
    submitted_by: User,
    db: Session,
    background_tasks: Optional[BackgroundTasks] = None
):
    """Trigger assessment approval workflow using workflow configuration steps"""
    from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
    from app.models.approval import ApprovalInstance, ApprovalStep, ApprovalStatus
    from app.services.email_service import EmailService
    from app.models.vendor import Vendor
    from app.models.agent import Agent
    import os

    # Get assessment details
    assessment = db.query(Assessment).filter(Assessment.id == assignment.assessment_id).first()
    if not assessment:
        logger.warning(f"Assessment {assignment.assessment_id} not found for assignment {assignment.id}")
        return

    # Get workflow configuration for assessment workflow
    from app.services.workflow_orchestration import WorkflowOrchestrationService
    from app.models.workflow_config import WorkflowConfiguration
    
    orchestration = WorkflowOrchestrationService(db, assignment.tenant_id)
    
    # Get assessment data for workflow matching
    assessment_data = {
        "id": str(assessment.id),
        "name": assessment.name,
        "assessment_type": assessment.assessment_type,
        "status": assessment.status
    }
    
    # Get workflow configuration for assessment_workflow request type
    workflow_config = orchestration.get_workflow_for_entity(
        entity_type="assessment_assignments",
        entity_data=assessment_data,
        request_type="assessment_workflow"
    )
    
    # If no specific workflow found, try to get default workflow
    if not workflow_config:
        workflow_config = db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.tenant_id == assignment.tenant_id,
            WorkflowConfiguration.is_default == True,
            WorkflowConfiguration.status == "active"
        ).first()
    
    # Get workflow steps from configuration
    workflow_steps = []
    if workflow_config and workflow_config.workflow_steps:
        steps = workflow_config.workflow_steps
        # Handle JSON string if needed
        if isinstance(steps, str):
            import json
            try:
                steps = json.loads(steps)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse workflow_steps JSON: {steps}")
                steps = []
        
        if isinstance(steps, list):
            workflow_steps = sorted(steps, key=lambda x: x.get("step_number", 999))
            logger.info(f"Found workflow config {workflow_config.id} with {len(workflow_steps)} steps for assignment {assignment.id}")
        else:
            logger.warning(f"Workflow steps is not a list: {type(steps)}, value: {steps}")
    else:
        logger.warning(f"No workflow configuration found for assessment assignment {assignment.id}. Using default 2-step workflow.")
        # Fallback to default 2-step workflow if no config found
        workflow_steps = [
            {
                "step_number": 1,
                "step_type": "approval",
                "step_name": "Assessment Review",
                "assigned_role": "approver",
                "required": True,
                "can_skip": False,
                "auto_assign": True
            },
            {
                "step_number": 2,
                "step_type": "approval",
                "step_name": "Final Approval",
                "assigned_role": "approver",
                "required": True,
                "can_skip": False,
                "auto_assign": True
            }
        ]
    
    # Create or get ApprovalInstance for this assignment
    approval_instance = db.query(ApprovalInstance).filter(
        ApprovalInstance.assignment_id == assignment.id
    ).first()
    
    if not approval_instance:
        # Determine first step number
        first_step_number = workflow_steps[0].get("step_number", 1) if workflow_steps else 1
        
        # Create new approval instance
        approval_instance = ApprovalInstance(
            assignment_id=assignment.id,
            current_step=first_step_number,  # Start at first step from workflow config
            status=ApprovalStatus.IN_PROGRESS.value,
            started_at=datetime.utcnow()
        )
        db.add(approval_instance)
        db.flush()
        logger.info(f"Created ApprovalInstance {approval_instance.id} for assignment {assignment.id}, starting at Step {first_step_number}")
        
        # Create ApprovalStep records from workflow configuration
        for step_config in workflow_steps:
            step = ApprovalStep(
                instance_id=approval_instance.id,
                step_number=step_config.get("step_number", 0),
                step_type=step_config.get("step_type", "approval"),
                step_name=step_config.get("step_name", f"Step {step_config.get('step_number', 0)}"),
                status="pending",
                assigned_role=step_config.get("assigned_role", "approver")
            )
            db.add(step)
        
        db.flush()
        logger.info(f"Created {len(workflow_steps)} ApprovalSteps from workflow config for assignment {assignment.id}")
    else:
        logger.info(f"ApprovalInstance {approval_instance.id} already exists for assignment {assignment.id}, current_step={approval_instance.current_step}")
        # Get existing steps
        existing_steps = db.query(ApprovalStep).filter(
            ApprovalStep.instance_id == approval_instance.id
        ).order_by(ApprovalStep.step_number).all()
        
        if not existing_steps and workflow_steps:
            # Create steps if they don't exist
            for step_config in workflow_steps:
                step = ApprovalStep(
                    instance_id=approval_instance.id,
                    step_number=step_config.get("step_number", 0),
                    step_type=step_config.get("step_type", "approval"),
                    step_name=step_config.get("step_name", f"Step {step_config.get('step_number', 0)}"),
                    status="pending",
                    assigned_role=step_config.get("assigned_role", "approver")
                )
                db.add(step)
            db.flush()
            logger.info(f"Created missing ApprovalSteps from workflow config for assignment {assignment.id}")

    # Determine approvers - assessment owner, team members, or role-based approvers
    approvers = []

    # Import UserRole at the top level
    from app.models.user import UserRole
    
    # Add assessment owner
    owner = db.query(User).filter(User.id == assessment.owner_id).first()
    if owner and owner.is_active and owner.role in [UserRole.APPROVER, UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN]:
        approvers.append(owner)

    # Add team members who are approvers
    if assessment.team_ids:
        # Ensure team_ids is a list and not None
        team_ids_list = assessment.team_ids if isinstance(assessment.team_ids, list) else []
        if team_ids_list:
            team_members = db.query(User).filter(
                User.id.in_([UUID(tid) for tid in team_ids_list if tid]),
                User.tenant_id == assignment.tenant_id,
                User.is_active == True,
                User.role.in_([UserRole.APPROVER, UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN])
            ).all()
            approvers.extend(team_members)

    # Add role-based approvers (optimized: combine queries where possible)
    # Include tenant-specific approvers and platform admins
    # Note: Platform admins may not have tenant_id set, so query separately
    from sqlalchemy import or_
    approver_roles = [UserRole.APPROVER, UserRole.TENANT_ADMIN, UserRole.SECURITY_REVIEWER, 
                      UserRole.COMPLIANCE_REVIEWER, UserRole.TECHNICAL_REVIEWER, UserRole.BUSINESS_REVIEWER]
    
    # Single query for tenant approvers
    tenant_approvers = db.query(User).filter(
        User.tenant_id == assignment.tenant_id,
        User.role.in_(approver_roles),
        User.is_active == True
    ).all()

    # Platform admins (may not have tenant_id)
    platform_admins = db.query(User).filter(
        User.role == UserRole.PLATFORM_ADMIN,
        User.is_active == True
    ).all()

    approvers.extend(tenant_approvers)
    approvers.extend(platform_admins)

    # Remove duplicates
    approver_ids = set()
    unique_approvers = []
    for approver in approvers:
        if approver.id not in approver_ids:
            approver_ids.add(approver.id)
            unique_approvers.append(approver)

    # Get vendor/agent info
    vendor_name = "Unknown Vendor"
    agent_name = None
    if assignment.vendor_id:
        vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
        if vendor:
            vendor_name = vendor.name
    if assignment.agent_id:
        agent = db.query(Agent).filter(Agent.id == assignment.agent_id).first()
        if agent:
            agent_name = agent.name

    # Create action items for approvers
    # Action URL points to generic approver view which uses source_type and source_id from business process
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    approval_url = f"/approver/assessment_approval/{assignment.id}"  # Opens generic approver view

    logger.info(f"Triggering assessment approval workflow for assignment {assignment.id}. Found {len(unique_approvers)} approvers.")

    # Fallback: If no approvers found, assign to tenant admin
    if not unique_approvers:
        logger.warning(
            f"No approvers found for assessment {assessment.id} assignment {assignment.id}. "
            f"Assessment owner: {assessment.owner_id}, Tenant: {assignment.tenant_id}, "
            f"Team IDs: {assessment.team_ids}. Falling back to tenant admin."
        )
        # Find a tenant admin as fallback
        tenant_admin = db.query(User).filter(
            User.tenant_id == assignment.tenant_id,
            User.role == UserRole.TENANT_ADMIN,
            User.is_active == True
        ).first()
        
        if tenant_admin:
            logger.info(f"Using tenant admin {tenant_admin.id} ({tenant_admin.email}) as fallback approver for assignment {assignment.id}")
            unique_approvers = [tenant_admin]
        else:
            # Last resort: find any active user in the tenant (excluding the submitter)
            any_user = db.query(User).filter(
                User.tenant_id == assignment.tenant_id,
                User.is_active == True,
                User.id != submitted_by.id  # Exclude the submitter
            ).first()
            if any_user:
                logger.warning(f"No approvers or tenant admin found. Using any active user {any_user.id} ({any_user.email}) as fallback for assignment {assignment.id}")
                unique_approvers = [any_user]
            else:
                # Even if no approvers found, still try to create action item assigned to assessment owner or submitter's manager
                # This ensures the workflow doesn't fail silently
                logger.error(f"No approvers, tenant admin, or active users found for tenant {assignment.tenant_id}. Attempting to use assessment owner as last resort.")
                if assessment.owner_id:
                    owner = db.query(User).filter(User.id == assessment.owner_id).first()
                    if owner and owner.is_active:
                        logger.warning(f"Using assessment owner {owner.id} ({owner.email}) as last resort approver for assignment {assignment.id}")
                        unique_approvers = [owner]
                    else:
                        logger.error(f"Assessment owner {assessment.owner_id} is not active or not found. Cannot create approval action items for assignment {assignment.id}")
                        return  # Cannot proceed without any user to assign to
                else:
                    logger.error(f"No approvers found and assessment has no owner. Cannot create approval action items for assignment {assignment.id}")
                    return  # Cannot proceed without any user to assign to

    action_items_created = 0
    for approver in unique_approvers:
        # Skip if approver is the submitter
        if approver.id == submitted_by.id:
            logger.debug(f"Skipping approver {approver.id} - same as submitter {submitted_by.id}")
            continue

        # Check if action item already exists to avoid duplicates
        existing_action_item = db.query(ActionItem).filter(
            ActionItem.tenant_id == assignment.tenant_id,
            ActionItem.assigned_to == approver.id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.source_id == assignment.id,
            ActionItem.action_type == ActionItemType.APPROVAL.value,
            ActionItem.status.in_([ActionItemStatus.PENDING.value, ActionItemStatus.IN_PROGRESS.value])
        ).first()
        
        if existing_action_item:
            logger.info(f"Approval action item already exists for approver {approver.id} ({approver.email}) and assignment {assignment.id}. Skipping duplicate creation.")
            action_items_created += 1  # Count existing items
            continue

        # Create action item for assessment approval
        # Include human-readable workflow ticket ID in title and description
        # CRITICAL: Only create approval items when assignment status is "completed" (vendor has submitted)
        if assignment.status != 'completed':
            logger.warning(
                f"Cannot create approval action item for assignment {assignment.id}: "
                f"assignment status is '{assignment.status}', expected 'completed'. "
                f"Vendor must complete the assessment first."
            )
            continue
        
        ticket_id_display = f" [{assignment.workflow_ticket_id}]" if assignment.workflow_ticket_id else ""
        action_item = ActionItem(
            tenant_id=assignment.tenant_id,
            assigned_to=approver.id,
            assigned_by=submitted_by.id,
            action_type=ActionItemType.APPROVAL.value,  # Using APPROVAL type for approver workflow
            title=f"Approve Assessment: {assessment.name}{ticket_id_display}",
            description=f"Workflow Ticket: {assignment.workflow_ticket_id or 'N/A'}\nAssessment submitted by {submitted_by.name or submitted_by.email} requires approval. Vendor: {vendor_name}" + (f", Agent: {agent_name}" if agent_name else ""),
            status=ActionItemStatus.PENDING.value,
            priority=ActionItemPriority.HIGH.value,
            due_date=assignment.due_date,
            source_type="assessment_approval",
            source_id=assignment.id,  # UUID type as expected by ActionItem model
            action_url=approval_url,
            item_metadata={
                "assessment_id": str(assessment.id),
                "assessment_name": assessment.name,
                "assessment_type": assessment.assessment_type,
                "assignment_id": str(assignment.id),
                "vendor_id": str(assignment.vendor_id) if assignment.vendor_id else None,
                "agent_id": str(assignment.agent_id) if assignment.agent_id else None,
                "vendor_name": vendor_name,
                "agent_name": agent_name,
                "submitted_by": submitted_by.name or submitted_by.email,
                "submitted_at": assignment.completed_at.isoformat() if assignment.completed_at else datetime.utcnow().isoformat(),
                "workflow_type": "assessment_approval",
                "approval_required": True,
                "vendor_completed": True,  # Flag: Vendor has completed the assessment
                "ready_for_approval": True,  # Flag: Assessment is ready for approver review
                "assignment_status": assignment.status,
                "workflow_ticket_id": assignment.workflow_ticket_id  # Human-readable ticket ID (e.g., ASMT-2026-017)
            }
        )
        db.add(action_item)
        action_items_created += 1
        logger.info(f"Created action item for approver {approver.id} ({approver.email}, role: {approver.role.value if hasattr(approver.role, 'value') else approver.role}) for assignment {assignment.id}")
    
    # Flush to ensure action items are in the session before commit
    # This assigns IDs to the action items so they can be queried
    try:
        db.flush()
        logger.info(f"Flushed {action_items_created} approval action items to database for assignment {assignment.id}")
        
        # Workflow item = Action Item = Ticket (same entity)
        # Set each action item's ID as its own ticket ID, and update assignment with first action item ID
        action_item_ids = []
        first_action_item_id = None
        for approver in unique_approvers:
            if approver.id == submitted_by.id:
                continue
            # Query the action item we just created to get its ID
            action_item = db.query(ActionItem).filter(
                ActionItem.tenant_id == assignment.tenant_id,
                ActionItem.assigned_to == approver.id,
                ActionItem.source_type == "assessment_approval",
                ActionItem.source_id == assignment.id,
                ActionItem.action_type == ActionItemType.APPROVAL.value
            ).order_by(ActionItem.created_at.desc()).first()
            if action_item:
                action_item_id_str = str(action_item.id)
                action_item_ids.append(action_item_id_str)
                
                # Ensure action item metadata has the human-readable workflow_ticket_id from assignment
                if not action_item.item_metadata:
                    action_item.item_metadata = {}
                if assignment.workflow_ticket_id and not action_item.item_metadata.get("workflow_ticket_id"):
                    action_item.item_metadata["workflow_ticket_id"] = assignment.workflow_ticket_id
                    logger.info(f"Set action item {action_item.id} metadata workflow_ticket_id to {assignment.workflow_ticket_id}")
                logger.debug(f"Created action item {action_item.id} for approver {approver.id} ({approver.email})")
        
        if action_item_ids:
            logger.info(f"Successfully created {action_items_created} approval action items for assignment {assignment.id}. Action item IDs: {', '.join(action_item_ids[:5])}{'...' if len(action_item_ids) > 5 else ''}")
        else:
            logger.warning(f"Created {action_items_created} action items but could not retrieve IDs after flush for assignment {assignment.id}")
    except Exception as e:
        logger.error(f"Error flushing action items to database: {e}", exc_info=True)
        raise
    
    # Note: Action items are flushed but will be committed by the calling function (save_assessment_responses)
    # This ensures they're part of the same transaction as the assessment submission

    # Send email notifications to approvers (non-blocking via background tasks)
    # Load email config once before the loop to avoid repeated DB queries
    if background_tasks:
        try:
            email_service = EmailService()
            email_service.load_config_from_db(db, str(assignment.tenant_id))
            
            # Prepare email content template
            submitted_by_name = submitted_by.name or submitted_by.email
            subject = f"Assessment Requires Approval: {assessment.name}"
            
            # Add background tasks for each approver email (non-blocking)
            for approver in unique_approvers:
                # Skip if approver is the submitter
                if approver.id == submitted_by.id:
                    continue
                
                # Personalize email content per approver
                approver_name = approver.name or approver.email
                html_body = f"""
                <html>
                <body>
                    <h2>Assessment Requires Your Approval</h2>
                    <p>Hello {approver_name},</p>
                    <p><strong>{submitted_by_name}</strong> has submitted an assessment that requires your approval.</p>
                    <p><strong>Assessment:</strong> {assessment.name}</p>
                    <p><strong>Type:</strong> {assessment.assessment_type.replace('_', ' ').title()}</p>
                    <p><strong>Vendor:</strong> {vendor_name}</p>
                    {f'<p><strong>Agent:</strong> {agent_name}</p>' if agent_name else ''}
                    <p><strong>Submitted:</strong> {assignment.completed_at.strftime('%Y-%m-%d %H:%M') if assignment.completed_at else 'Just now'}</p>
                    <p><a href="{approval_url}">Review and Approve Assessment</a></p>
                    <p>You can Accept, Deny, or request Clarification for this assessment.</p>
                </body>
                </html>
                """
                text_body = f"""
                Assessment Requires Your Approval

                Hello {approver_name},

                {submitted_by_name} has submitted an assessment that requires your approval.

                Assessment: {assessment.name}
                Type: {assessment.assessment_type.replace('_', ' ').title()}
                Vendor: {vendor_name}
                {f'Agent: {agent_name}' if agent_name else ''}
                Submitted: {assignment.completed_at.strftime('%Y-%m-%d %H:%M') if assignment.completed_at else 'Just now'}

                Review and Approve: {approval_url}

                You can Accept, Deny, or request Clarification for this assessment.
                """
                
                # Add background task (non-blocking - executes after response is sent)
                # Note: FastAPI BackgroundTasks can handle async functions, but we need to ensure proper execution
                background_tasks.add_task(
                    _send_approval_email_sync,
                    email_service,
                    approver.email,
                    subject,
                    html_body,
                    text_body
                )
            
            logger.info(f"Scheduled {len([a for a in unique_approvers if a.id != submitted_by.id])} approval notification emails as background tasks")
        except Exception as e:
            logger.warning(f"Failed to load email config for tenant {assignment.tenant_id}: {e}. Email notifications will be skipped.")
    else:
        logger.warning("BackgroundTasks not available. Skipping email notifications.")

    logger.info(f"Created assessment approval workflow for assignment {assignment.id} with {len(unique_approvers)} approvers")


def _send_approval_email_sync(
    email_service,  # EmailService type (imported inside function to avoid circular imports)
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str
):
    """Helper function to send approval email synchronously (used in background tasks)
    
    Note: FastAPI BackgroundTasks can handle async, but we use sync wrapper for reliability
    """
    import asyncio
    try:
        # Try to get existing event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If loop is running, schedule the coroutine
                asyncio.create_task(email_service.send_email(to_email, subject, html_body, text_body))
            else:
                # If loop exists but not running, run the coroutine
                sent, _ = loop.run_until_complete(email_service.send_email(to_email, subject, html_body, text_body))
        except RuntimeError:
            # No event loop, create one
            sent, _ = asyncio.run(email_service.send_email(to_email, subject, html_body, text_body))
        logger.info(f"Sent approval notification email to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send approval notification email to {to_email}: {e}", exc_info=True)


async def _notify_reviewers_on_submission(
    assignment: AssessmentAssignment,
    submitted_by: User,
    db: Session
):
    """Notify reviewers when assessment is submitted and create action items"""
    from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
    from app.services.email_service import EmailService
    from app.models.vendor import Vendor
    from app.models.agent import Agent
    import os

    # Get assessment details
    assessment = db.query(Assessment).filter(Assessment.id == assignment.assessment_id).first()
    if not assessment:
        return

    # Determine reviewers - assessment owner, team members, or role-based reviewers
    reviewers = []

    # Add assessment owner
    owner = db.query(User).filter(User.id == assessment.owner_id).first()
    if owner and owner.is_active:
        reviewers.append(owner)

    # Add team members if specified
    if assessment.team_ids:
        # Ensure team_ids is a list and not None
        team_ids_list = assessment.team_ids if isinstance(assessment.team_ids, list) else []
        if team_ids_list:
            team_members = db.query(User).filter(
                User.id.in_([UUID(tid) for tid in team_ids_list if tid]),
                User.tenant_id == assignment.tenant_id,
                User.is_active == True
            ).all()
            reviewers.extend(team_members)

    # Add role-based reviewers (security_reviewer, compliance_reviewer, etc.)
    from app.models.user import UserRole
    role_reviewers = db.query(User).filter(
        User.tenant_id == assignment.tenant_id,
        User.role.in_([
            UserRole.SECURITY_REVIEWER,
            UserRole.COMPLIANCE_REVIEWER,
            UserRole.TECHNICAL_REVIEWER,
            UserRole.BUSINESS_REVIEWER
        ]),
        User.is_active == True
    ).all()
    reviewers.extend(role_reviewers)

    # Remove duplicates
    reviewer_ids = set()
    unique_reviewers = []
    for reviewer in reviewers:
        if reviewer.id not in reviewer_ids:
            reviewer_ids.add(reviewer.id)
            unique_reviewers.append(reviewer)
    
    logger.info(f"Found {len(reviewers)} total reviewers, {len(unique_reviewers)} unique reviewers for assignment {assignment.id}. Owner: {assessment.owner_id}, Team IDs: {assessment.team_ids}")

    # Get vendor/agent info for email
    vendor_name = "Unknown Vendor"
    agent_name = None
    if assignment.vendor_id:
        vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
        if vendor:
            vendor_name = vendor.name
    if assignment.agent_id:
        agent = db.query(Agent).filter(Agent.id == assignment.agent_id).first()
        if agent:
            agent_name = agent.name

    # Create action items and send emails
    email_service = EmailService()
    email_service.load_config_from_db(db, str(assignment.tenant_id))

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    assessment_url = f"{frontend_url}/assessments/review/{assignment.id}"

    logger.info(f"Notifying {len(unique_reviewers)} reviewers for assignment {assignment.id}. Submitter: {submitted_by.id} ({submitted_by.email})")
    
    # Create a SINGLE action item per assessment submission (not per reviewer)
    # This task will appear in the approver's inbox and open the submission view
    if not unique_reviewers:
        logger.warning(f"No reviewers found for assignment {assignment.id}. Assessment owner: {assessment.owner_id}, Team IDs: {assessment.team_ids}. Cannot create action item. Please ensure the assessment has an owner or team members assigned.")
        # Still create an action item assigned to tenant admin if available
        from app.models.user import UserRole
        tenant_admin = db.query(User).filter(
            User.tenant_id == assignment.tenant_id,
            User.role == UserRole.TENANT_ADMIN,
            User.is_active == True
        ).first()
        if tenant_admin:
            logger.info(f"Assigning review action item to tenant admin {tenant_admin.id} ({tenant_admin.email}) as fallback")
            unique_reviewers = [tenant_admin]
        else:
            logger.error(f"No reviewers or tenant admin found for assignment {assignment.id}. Workflow cannot be triggered.")
            return
    
    # Assign to the first reviewer/approver (typically the assessment owner)
    # For tenant admins, they can see all action items in their tenant anyway
    assigned_to = unique_reviewers[0].id
    
    # Skip if the assigned reviewer is the submitter - try to find another reviewer
    if assigned_to == submitted_by.id and len(unique_reviewers) > 1:
        assigned_to = unique_reviewers[1].id
        logger.info(f"First reviewer is the submitter, assigning to second reviewer {assigned_to}")
    elif assigned_to == submitted_by.id:
        logger.warning(f"Only reviewer is the submitter for assignment {assignment.id}. Creating action item anyway.")
    
    # Create a single action item for this assessment submission
    # This will appear in the approver's inbox and open the submission view with responses
    action_item = ActionItem(
        tenant_id=assignment.tenant_id,
        assigned_to=assigned_to,
        assigned_by=submitted_by.id,
        action_type=ActionItemType.APPROVAL.value,  # Use APPROVAL type for approval workflow
        title=f"Approve Assessment: {assessment.name}",
        description=f"Assessment submitted by {vendor_name}" + (f" for agent {agent_name}" if agent_name else "") + ". Click to review responses and approve.",
        status=ActionItemStatus.PENDING.value,
        priority=ActionItemPriority.HIGH.value if assignment.due_date and assignment.due_date < datetime.utcnow() else ActionItemPriority.MEDIUM.value,
        due_date=assignment.due_date,
        source_type="assessment_approval",
        source_id=assignment.id,
        action_url=f"/assessments/review/{assignment.id}",  # Open the approver screen with submission view (AssessmentApprover component)
        item_metadata={
            "assessment_id": str(assessment.id),
            "assessment_name": assessment.name,
            "assessment_type": assessment.assessment_type,
            "vendor_id": str(assignment.vendor_id) if assignment.vendor_id else None,
            "agent_id": str(assignment.agent_id) if assignment.agent_id else None,
            "vendor_name": vendor_name,
            "agent_name": agent_name,
            "submitted_by": submitted_by.name or submitted_by.email,
            "submitted_at": assignment.completed_at.isoformat() if assignment.completed_at else None,
            "workflow_ticket_id": assignment.workflow_ticket_id if hasattr(assignment, 'workflow_ticket_id') else None
        }
    )
    db.add(action_item)
    action_items_created = 1
    logger.info(f"Created single approval action item for assignment {assignment.id}. Assigned to {assigned_to}. Action URL: /assessments/review/{assignment.id}")

    # Send email notifications to all reviewers (even though we only created one action item)
    # The action item will be visible to all approvers in the tenant (for tenant_admin role)
    for reviewer in unique_reviewers:
        # Skip if reviewer is the submitter
        if reviewer.id == submitted_by.id:
            continue
            
        try:
            subject = f"Assessment Submitted for Review: {assessment.name}"
            html_body = f"""
            <html>
            <body>
                <h2>Assessment Submitted for Review</h2>
                <p>Hello {reviewer.name or reviewer.email},</p>
                <p><strong>{submitted_by.name or submitted_by.email}</strong> has submitted an assessment for review.</p>
                <p><strong>Assessment:</strong> {assessment.name}</p>
                <p><strong>Type:</strong> {assessment.assessment_type.replace('_', ' ').title()}</p>
                <p><strong>Vendor:</strong> {vendor_name}</p>
                {f'<p><strong>Agent:</strong> {agent_name}</p>' if agent_name else ''}
                <p><a href="{assessment_url}">Review Assessment</a></p>
            </body>
            </html>
            """
            text_body = f"""
            Assessment Submitted for Review

            Hello {reviewer.name or reviewer.email},

            {submitted_by.name or submitted_by.email} has submitted an assessment for review.

            Assessment: {assessment.name}
            Type: {assessment.assessment_type.replace('_', ' ').title()}
            Vendor: {vendor_name}
            {f'Agent: {agent_name}' if agent_name else ''}

            Review Assessment: {assessment_url}
            """

            sent, _ = await email_service.send_email(reviewer.email, subject, html_body, text_body)
            logger.info(f"Sent email notification to reviewer {reviewer.id} ({reviewer.email}) for assignment {assignment.id}")
        except Exception as e:
            logger.error(f"Failed to send email to {reviewer.email}: {e}", exc_info=True)
    
    # Flush action items to ensure they're in the session before the main commit
    if action_items_created > 0:
        db.flush()
        logger.info(f"Flushed {action_items_created} review action items for assignment {assignment.id}. They will be committed with the main transaction.")
    else:
        logger.warning(f"No review action items created for assignment {assignment.id}. Reviewers: {len(unique_reviewers)}, Skipped (submitter): {sum(1 for r in unique_reviewers if r.id == submitted_by.id)}")


@router.post("/assignments/{assignment_id}/responses/draft", status_code=status.HTTP_204_NO_CONTENT)
async def save_assessment_responses_draft(
    assignment_id: UUID,
    responses: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save assessment responses as draft (does not mark as completed)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )

    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    # Mark assignment as in_progress if not started
    if not assignment.started_at:
        assignment.started_at = datetime.utcnow()
        assignment.status = 'in_progress'

    # Get questions for this assessment
    questions = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.assessment_id == assignment.assessment_id
    ).all()

    from app.models.submission_requirement import SubmissionRequirementResponse

    # Save responses for all question types
    for question in questions:
        question_response = responses.get(str(question.id))

        # Skip if no response provided
        if question_response is None:
            continue

        # Handle both simple and enhanced response formats
        if isinstance(question_response, dict):
            response_value = question_response.get('value')
            comment = question_response.get('comment')
            documents = question_response.get('documents', [])
        else:
            # Simple format - just the value
            response_value = question_response
            comment = None
            documents = []

        # For requirement_reference questions with agent_id, also save to SubmissionRequirementResponse
        if question.question_type == 'requirement_reference' and question.requirement_id and assignment.agent_id:
            requirement_id = question.requirement_id
            response_data = {
                'value': response_value,
                'comment': comment,
                'documents': documents
            } if isinstance(question_response, dict) else response_value

            # Check if response already exists
            existing = db.query(SubmissionRequirementResponse).filter(
                SubmissionRequirementResponse.requirement_id == requirement_id,
                SubmissionRequirementResponse.agent_id == assignment.agent_id
            ).first()

            if existing:
                existing.value = response_data
                existing.updated_at = datetime.utcnow()
            else:
                response = SubmissionRequirementResponse(
                    requirement_id=requirement_id,
                    agent_id=assignment.agent_id,
                    value=response_data,
                    submitted_by=current_user.id
                )
                db.add(response)

        # Save to AssessmentQuestionResponse for all question types
        # This ensures we have responses stored regardless of question type or assignment type
        try:
            existing_response = db.query(AssessmentQuestionResponseModel).filter(
                AssessmentQuestionResponseModel.assignment_id == assignment_id,
                AssessmentQuestionResponseModel.question_id == question.id
            ).first()

            if existing_response:
                existing_response.value = response_value
                existing_response.comment = comment if comment else None
                existing_response.documents = documents if documents and len(documents) > 0 else None
                existing_response.updated_at = datetime.utcnow()
            else:
                question_response_obj = AssessmentQuestionResponseModel(
                    assignment_id=assignment_id,
                    question_id=question.id,
                    tenant_id=effective_tenant_id,
                    value=response_value,
                    comment=comment if comment else None,
                    documents=documents if documents and len(documents) > 0 else None,
                    submitted_by=current_user.id
                )
                db.add(question_response_obj)
        except Exception as e:
            logger.error(f"Error saving question response for question {question.id}: {e}", exc_info=True)
            # Continue with other questions even if one fails

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving assessment responses: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while saving responses"
        )


@router.get("/assignments/{assignment_id}/status", response_model=Dict[str, Any])
async def get_assignment_status(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get completion status for an assessment assignment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        # Check if assignment exists but in different tenant (for better error message)
        assignment_exists = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.id == assignment_id
        ).first()
        
        if assignment_exists:
            logger.warning(
                f"Assignment {assignment_id} exists but belongs to tenant {assignment_exists.tenant_id}, "
                f"while user {current_user.id} has effective tenant {effective_tenant_id}. "
                f"This may indicate an action item was created with incorrect tenant_id."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Assignment not found or access denied. This assignment may belong to a different tenant."
            )
        else:
            logger.warning(f"Assignment {assignment_id} not found in database")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
    
    # Authorization check: Approvers should only access completed assignments for review/approval
    # They should NOT access pending/in_progress assignments (those are for vendors to fill out)
    from app.models.user import UserRole
    is_approver_role = current_user.role in [
        UserRole.APPROVER, 
        UserRole.SECURITY_REVIEWER, 
        UserRole.COMPLIANCE_REVIEWER, 
        UserRole.TECHNICAL_REVIEWER, 
        UserRole.BUSINESS_REVIEWER
    ]
    
    if is_approver_role and assignment.status not in ['completed', 'approved', 'rejected', 'needs_revision']:
        # Approver trying to access a pending/in_progress assignment
        # Check if there's an approval action item for this assignment
        from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus
        approval_item = db.query(ActionItem).filter(
            ActionItem.source_id == assignment_id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.action_type == ActionItemType.APPROVAL,
            ActionItem.assigned_to == current_user.id,
            ActionItem.status.in_([ActionItemStatus.PENDING, ActionItemStatus.IN_PROGRESS])
        ).first()
        
        if not approval_item:
            # No approval item exists - approver shouldn't access this assignment
            logger.warning(
                f"Approver {current_user.email} (role: {current_user.role.value}) attempted to access "
                f"assignment {assignment_id} with status '{assignment.status}' without an approval action item. "
                f"Approvers can only review/approve completed assessments."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Approvers can only review/approve completed assessments. "
                       f"This assessment is currently '{assignment.status}' and must be completed by the vendor first. "
                       f"Please use the approval workflow from your inbox."
            )
    
    # Get assessment details first (needed for tenant_id)
    assessment = db.query(Assessment).filter(Assessment.id == assignment.assessment_id).first()
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    # Get questions with tenant filtering (consistent with other endpoints)
    # First try with assessment.tenant_id
    questions = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.assessment_id == assignment.assessment_id,
        AssessmentQuestion.tenant_id == assessment.tenant_id  # Use assessment's tenant_id
    ).all()
    
    # If no questions found, try without tenant filter (for backward compatibility)
    if len(questions) == 0:
        logger.warning(
            f"No questions found for assessment {assignment.assessment_id} with tenant filter (tenant: {assessment.tenant_id}). "
            f"Trying without tenant filter for backward compatibility."
        )
        questions_without_filter = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assignment.assessment_id
        ).all()
        
        if len(questions_without_filter) > 0:
            logger.warning(
                f"Found {len(questions_without_filter)} questions without tenant filter. "
                f"Assessment tenant: {assessment.tenant_id}, Assignment tenant: {assignment.tenant_id}. "
                f"Question tenant_ids: {[str(q.tenant_id) for q in questions_without_filter[:5]]}"
            )
            
            # Fix tenant_id for questions that have wrong tenant_id
            # This ensures future queries work correctly
            fixed_count = 0
            for q in questions_without_filter:
                if q.tenant_id != assessment.tenant_id:
                    logger.info(f"Fixing tenant_id for question {q.id}: {q.tenant_id} -> {assessment.tenant_id}")
                    q.tenant_id = assessment.tenant_id
                    fixed_count += 1
            
            if fixed_count > 0:
                try:
                    db.commit()
                    logger.info(f"Fixed tenant_id for {fixed_count} questions. Refreshing query.")
                    # Re-query with correct tenant_id
                    questions = db.query(AssessmentQuestion).filter(
                        AssessmentQuestion.assessment_id == assignment.assessment_id,
                        AssessmentQuestion.tenant_id == assessment.tenant_id
                    ).all()
                except Exception as e:
                    logger.error(f"Error fixing question tenant_ids: {e}", exc_info=True)
                    db.rollback()
                    # Use questions as-is if fix fails
                    questions = questions_without_filter
            else:
                questions = questions_without_filter
        else:
            logger.warning(
                f"No questions found for assessment {assignment.assessment_id} at all. "
                f"Assessment ID: {assessment.assessment_id}, Assessment name: {assessment.name}"
            )
    
    from app.models.submission_requirement import SubmissionRequirementResponse
    
    # Count answered questions
    answered_count = 0
    for question in questions:
        if question.question_type == 'requirement_reference' and question.requirement_id:
            response = None
            if assignment.agent_id:
                response = db.query(SubmissionRequirementResponse).filter(
                    SubmissionRequirementResponse.requirement_id == question.requirement_id,
                    SubmissionRequirementResponse.agent_id == assignment.agent_id
                ).first()
            if response:
                answered_count += 1
        else:
            # Check if regular question has a response
            question_response = db.query(AssessmentQuestionResponseModel).filter(
                AssessmentQuestionResponseModel.assignment_id == assignment_id,
                AssessmentQuestionResponseModel.question_id == question.id,
                AssessmentQuestionResponseModel.value.isnot(None)
            ).first()
            if question_response and question_response.value:
                # Check if value is not empty
                value = question_response.value
                if isinstance(value, str) and value.strip():
                    answered_count += 1
                elif isinstance(value, dict) and value.get('value'):
                    answered_count += 1
                elif not isinstance(value, (str, dict)):
                    answered_count += 1
    
    # Get point of contact (assigned_by user)
    point_of_contact = None
    if assignment.assigned_by:
        from app.models.user import User
        poc_user = db.query(User).filter(User.id == assignment.assigned_by).first()
        if poc_user:
            point_of_contact = {
                "id": str(poc_user.id),
                "name": poc_user.name,
                "email": poc_user.email
            }
    
    return {
        "assignment_id": str(assignment.id),
        "assessment_id": str(assignment.assessment_id),
        "assessment_name": assessment.name if assessment else None,
        "assessment_id_display": assessment.assessment_id if assessment else None,  # Human-readable ID
        "status": assignment.status,
        "total_questions": len(questions),
        "answered_questions": answered_count,
        "required_questions": len([q for q in questions if q.is_required]),
        "completed": assignment.status == 'completed',
        "started_at": assignment.started_at.isoformat() if assignment.started_at else None,
        "completed_at": assignment.completed_at.isoformat() if assignment.completed_at else None,
        "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
        "workflow_ticket_id": assignment.workflow_ticket_id,  # Include workflow ticket ID
        "point_of_contact": point_of_contact,
    }


@router.post("/assignments/{assignment_id}/trigger-approval-workflow", response_model=Dict[str, Any])
async def trigger_approval_workflow(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Manually trigger the approval workflow for a completed assessment assignment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Check if assignment is completed
    if assignment.status != 'completed':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot trigger approval workflow for assignment with status: {assignment.status}. Assignment must be completed."
        )
    
    # Check if action items already exist for this assignment
    from app.models.action_item import ActionItem, ActionItemType
    existing_action_items = db.query(ActionItem).filter(
        ActionItem.source_id == assignment_id,
        ActionItem.source_type == "assessment_approval",
        ActionItem.action_type == ActionItemType.APPROVAL,
        ActionItem.status.in_(["pending", "in_progress"])
    ).count()
    
    if existing_action_items > 0:
        logger.info(f"Approval workflow already triggered for assignment {assignment_id}. Found {existing_action_items} existing action items.")
        return {
            "success": True,
            "message": f"Approval workflow already triggered. Found {existing_action_items} existing action items.",
            "action_items_count": existing_action_items
        }
    
    # Get the user who submitted the assignment (assigned_by or current_user as fallback)
    submitted_by = current_user
    if assignment.assigned_by:
        submitted_by_user = db.query(User).filter(User.id == assignment.assigned_by).first()
        if submitted_by_user:
            submitted_by = submitted_by_user
    
    # Trigger the approval workflow
    try:
        logger.info(f"Manually triggering approval workflow for assignment {assignment_id}, submitted by user {submitted_by.id} ({submitted_by.email})")
        await _trigger_assessment_approval_workflow(assignment, submitted_by, db, background_tasks)
        
        # Commit the action items
        db.commit()
        
        # Count created action items
        action_items_count = db.query(ActionItem).filter(
            ActionItem.source_id == assignment_id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.action_type == ActionItemType.APPROVAL,
            ActionItem.status == "pending"
        ).count()
        
        logger.info(f"Successfully triggered approval workflow for assignment {assignment_id}. Created {action_items_count} action items.")
        
        return {
            "success": True,
            "message": f"Approval workflow triggered successfully. Created {action_items_count} action items for approvers.",
            "action_items_count": action_items_count
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error triggering approval workflow for assignment {assignment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger approval workflow: {str(e)}"
        )


@router.get("/assignments/{assignment_id}/responses", response_model=Dict[str, Any])
async def get_assignment_responses(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all responses for an assessment assignment"""
    try:
        from app.core.tenant_utils import get_effective_tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant access required"
            )
        
        assignment = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.id == assignment_id,
            AssessmentAssignment.tenant_id == effective_tenant_id
        ).first()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        # Get all question responses - optimized query
        question_responses = db.query(AssessmentQuestionResponseModel).filter(
            AssessmentQuestionResponseModel.assignment_id == assignment_id
        ).all()
        
        # Format responses as {question_id: {value, comment, documents}}
        # Removed excessive logging to improve performance
        responses = {}
        for qr in question_responses:
            question_id_str = str(qr.question_id)
            # Handle None values gracefully
            responses[question_id_str] = {
                "value": qr.value if qr.value is not None else None,
                "comment": qr.comment if qr.comment is not None else None,
                "documents": qr.documents if qr.documents is not None else [],
                "ai_evaluation": qr.ai_evaluation if qr.ai_evaluation is not None else None  # Include AI evaluation
            }
        
        return {
            "assignment_id": str(assignment_id),
            "responses": responses
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        # Handle invalid UUID or other value errors
        logger.error(f"Value error in get_assignment_responses for assignment {assignment_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid request: {str(e)}"
        )
    except Exception as e:
        # Handle any other unexpected errors
        logger.error(f"Unexpected error in get_assignment_responses for assignment {assignment_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving assignment responses"
        )


@router.post("/trigger-schedules", response_model=Dict[str, Any])
async def trigger_schedules(
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Manually trigger due assessment schedules (for testing or cron jobs)"""
    from app.services.assessment_scheduler import AssessmentScheduler
    
    scheduler = AssessmentScheduler(db)
    assignments = scheduler.trigger_due_schedules()
    overdue_count = scheduler.check_overdue_assignments()
    
    return {
        "message": "Schedules processed",
        "assignments_created": len(assignments),
        "overdue_marked": overdue_count,
    }


# Assessment Template Endpoints
class AssessmentTemplateResponse(BaseModel):
    """Assessment template response schema"""
    id: str
    name: str
    assessment_type: str
    description: Optional[str]
    applicable_industries: List[str]
    questions: List[Dict[str, Any]]
    default_schedule_frequency: Optional[str]
    default_status: str
    is_active: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class InstantiateTemplateRequest(BaseModel):
    """Request to instantiate a template"""
    template_id: str
    assessment_name: Optional[str] = None


@template_router.get("", response_model=List[AssessmentTemplateResponse])
async def list_applicable_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List assessment templates applicable to current tenant's industry"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    template_service = AssessmentTemplateService(db)
    templates = template_service.get_applicable_templates(effective_tenant_id)
    
    return [
        AssessmentTemplateResponse(
            id=str(t.id),
            name=t.name,
            assessment_type=t.assessment_type,
            description=t.description,
            applicable_industries=t.applicable_industries or [],
            questions=t.questions or [],
            default_schedule_frequency=t.default_schedule_frequency,
            default_status=t.default_status,
            is_active=t.is_active,
            created_at=t.created_at.isoformat(),
            updated_at=t.updated_at.isoformat()
        )
        for t in templates
    ]


@template_router.post("/instantiate", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
async def instantiate_template(
    request: InstantiateTemplateRequest,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Instantiate a template as a new assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    template_service = AssessmentTemplateService(db)
    
    try:
        assessment = template_service.instantiate_template(
            template_id=UUID(request.template_id),
            tenant_id=effective_tenant_id,
            owner_id=current_user.id,
            created_by=current_user.id,
            assessment_name=request.assessment_name
        )
        
        return _build_assessment_response(assessment, db)
    except ValueError as e:
        logger.warning(f"Validation error instantiating template: {e}", extra={
            "user_id": str(current_user.id),
            "tenant_id": str(effective_tenant_id),
            "template_id": request.template_id
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error instantiating template: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while instantiating the template"
        )


@router.get("/assignments/{assignment_id}/question-owners", response_model=Dict[str, Dict[str, Any]])
async def get_question_owners(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get owners for all questions in an assignment"""
    from app.core.tenant_utils import get_effective_tenant_id
    from sqlalchemy.orm import joinedload
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get all question responses with owners - optimized to avoid N+1 queries
    # First, get all responses with owner_ids
    responses = db.query(AssessmentQuestionResponseModel).filter(
        AssessmentQuestionResponseModel.assignment_id == assignment_id,
        AssessmentQuestionResponseModel.owner_id.isnot(None)
    ).all()
    
    # Collect all unique owner IDs
    owner_ids = list(set([r.owner_id for r in responses if r.owner_id]))
    
    # Load all owners in a single query
    owners_map = {}
    if owner_ids:
        owners = db.query(User).filter(User.id.in_(owner_ids)).all()
        owners_map = {owner.id: owner for owner in owners}
    
    # Build result dictionary
    result = {}
    for response in responses:
        if response.owner_id and response.owner_id in owners_map:
            owner = owners_map[response.owner_id]
            result[str(response.question_id)] = {
                "id": str(owner.id),
                "name": owner.name,
                "email": owner.email,
                "assigned_at": response.assigned_at.isoformat() if response.assigned_at else None
            }
    
    return result


@router.get("/assignments/{assignment_id}/search-users", response_model=List[Dict[str, Any]])
async def search_vendor_users(
    assignment_id: UUID,
    search_query: Optional[str] = Query(None, description="Search by name or email"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search vendor users from the same tenant for question assignment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Get assignment to verify access
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Search for vendor users in the same tenant
    query = db.query(User).filter(
        User.tenant_id == effective_tenant_id,
        User.role == UserRole.VENDOR_USER,
        User.is_active == True
    )
    
    if search_query:
        search_term = f"%{search_query.lower()}%"
        query = query.filter(
            (User.email.ilike(search_term)) |
            (User.name.ilike(search_term))
        )
    
    users = query.limit(20).all()
    
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "organization": u.organization,
            "department": u.department
        }
        for u in users
    ]


@router.post("/assignments/{assignment_id}/questions/{question_id}/assign", response_model=Dict[str, Any])
async def assign_question_owner(
    assignment_id: UUID,
    question_id: UUID,
    owner_data: Dict[str, Any] = Body(..., description="Owner assignment data"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign a question to a specific user (owner)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Get assignment to verify access
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get question
    question = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.id == question_id,
        AssessmentQuestion.assessment_id == assignment.assessment_id
    ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    owner_id = owner_data.get("owner_id")
    owner_email = owner_data.get("owner_email")
    
    if not owner_id and not owner_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either owner_id or owner_email must be provided"
        )
    
    # Find or create user
    owner_user = None
    if owner_id:
        owner_user = db.query(User).filter(
            User.id == UUID(owner_id),
            User.tenant_id == effective_tenant_id
        ).first()
    elif owner_email:
        owner_user = db.query(User).filter(
            User.email == owner_email.lower(),
            User.tenant_id == effective_tenant_id
        ).first()
        
        # If user doesn't exist, create a pending user account
        if not owner_user:
            from app.models.user import UserRole
            from app.core.security import get_password_hash
            import secrets
            
            # Generate a temporary password
            temp_password = secrets.token_urlsafe(16)
            hashed_password = get_password_hash(temp_password)
            
            owner_user = User(
                email=owner_email.lower(),
                name=owner_data.get("owner_name", owner_email.split("@")[0]),
                hashed_password=hashed_password,
                role=UserRole.VENDOR_USER,
                tenant_id=effective_tenant_id,
                is_active=False  # User needs to activate account
            )
            db.add(owner_user)
            db.flush()  # Get the ID without committing
    
    if not owner_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found and could not be created"
        )
    
    # Get or create question response
    question_response = db.query(AssessmentQuestionResponseModel).filter(
        AssessmentQuestionResponseModel.assignment_id == assignment_id,
        AssessmentQuestionResponseModel.question_id == question_id
    ).first()
    
    if not question_response:
        question_response = AssessmentQuestionResponseModel(
            assignment_id=assignment_id,
            question_id=question_id,
            tenant_id=effective_tenant_id,
            owner_id=owner_user.id,
            assigned_by=current_user.id,
            assigned_at=datetime.utcnow()
        )
        db.add(question_response)
    else:
        question_response.owner_id = owner_user.id
        question_response.assigned_by = current_user.id
        question_response.assigned_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(question_response)
        
        # Send notification to the assigned user
        try:
            from app.services.email_service import EmailService
            from app.services.integration_service import IntegrationService
            
            email_service = EmailService()
            email_service.load_config_from_db(db, str(effective_tenant_id))
            
            question_text = question.question_text or getattr(question, 'title', None) or f"Question {getattr(question, 'order', 0) + 1}"
            # Get assessment name
            assessment_obj = db.query(Assessment).filter(Assessment.id == assignment.assessment_id).first()
            assessment_name = assessment_obj.name if assessment_obj else str(assignment.assessment_id)
            
            # Get frontend URL
            import os
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            assignment_url = f"{frontend_url}/assessments/assignments/{assignment_id}"
            
            if not owner_user.is_active:
                # User needs to create account
                subject = f"Assessment Question Assigned - Action Required"
                html_body = f"""
                <html>
                <body>
                    <h2>Question Assignment</h2>
                    <p>Hello {owner_user.name or owner_user.email},</p>
                    <p><strong>{current_user.name}</strong> has assigned you a question in the assessment: <strong>{assessment_name}</strong></p>
                    <p><strong>Question:</strong> {question_text}</p>
                    <p>You need to create an account to complete this assessment.</p>
                    <p><a href="{frontend_url}/register?email={owner_user.email}&assignment_id={assignment_id}">Create Account and Complete Assessment</a></p>
                    <p>If you have any questions, please contact {current_user.name} at {current_user.email}.</p>
                </body>
                </html>
                """
                text_body = f"""
                Question Assignment
                
                Hello {owner_user.name or owner_user.email},
                
                {current_user.name} has assigned you a question in the assessment: {assessment_name}
                
                Question: {question_text}
                
                You need to create an account to complete this assessment.
                
                Create Account: {frontend_url}/register?email={owner_user.email}&assignment_id={assignment_id}
                
                If you have any questions, please contact {current_user.name} at {current_user.email}.
                """
            else:
                # User has account, just notify
                subject = f"Question Assigned: {assessment_name}"
                html_body = f"""
                <html>
                <body>
                    <h2>Question Assignment</h2>
                    <p>Hello {owner_user.name or owner_user.email},</p>
                    <p><strong>{current_user.name}</strong> has assigned you a question in the assessment: <strong>{assessment_name}</strong></p>
                    <p><strong>Question:</strong> {question_text}</p>
                    <p><a href="{assignment_url}">View and Complete Question</a></p>
                </body>
                </html>
                """
                text_body = f"""
                Question Assignment
                
                Hello {owner_user.name or owner_user.email},
                
                {current_user.name} has assigned you a question in the assessment: {assessment_name}
                
                Question: {question_text}
                
                View and Complete: {assignment_url}
                """
            
            sent, _ = await email_service.send_email(
                owner_user.email,
                subject,
                html_body,
                text_body
            )
        except Exception as e:
            logger.error(f"Failed to send notification email: {e}", exc_info=True)
            # Don't fail the assignment if email fails
        
        return {
            "success": True,
            "owner_id": str(owner_user.id),
            "owner_name": owner_user.name,
            "owner_email": owner_user.email,
            "assigned_at": question_response.assigned_at.isoformat() if question_response.assigned_at else None,
            "user_exists": owner_user.is_active
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error assigning question owner: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign question: {str(e)}"
        )


@router.post("/assignments/{assignment_id}/review", response_model=Dict[str, Any])
async def trigger_assessment_review(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    policy_ids: Optional[List[str]] = Body(None, description="Policy IDs to use for context"),
    requirement_ids: Optional[List[str]] = Body(None, description="Requirement IDs to use for context")
):
    """Trigger AI review of a completed assessment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    if assignment.status != 'completed':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment must be completed before review"
        )
    
    try:
        await _trigger_ai_review(
            assignment=assignment,
            submitted_by=current_user,
            db=db
        )
        
        # Get the review that was created
        from app.models.assessment_review import AssessmentReview
        review = db.query(AssessmentReview).filter(
            AssessmentReview.assignment_id == assignment_id
        ).order_by(AssessmentReview.created_at.desc()).first()
        
        if review:
            return {
                "success": True,
                "review_id": str(review.id),
                "risk_score": review.risk_score,
                "risk_level": review.risk_level,
                "flagged_risks_count": len(review.flagged_risks or []),
                "assigned_to": str(review.assigned_to) if review.assigned_to else None
            }
        else:
            return {
                "success": True,
                "message": "Review triggered but not yet completed"
            }
    except Exception as e:
        logger.error(f"Error triggering assessment review: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger review: {str(e)}"
        )


@router.get("/reviews/{review_id}", response_model=Dict[str, Any])
async def get_assessment_review(
    review_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get assessment review details"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.assessment_review import AssessmentReview
    
    review = db.query(AssessmentReview).filter(
        AssessmentReview.id == review_id,
        AssessmentReview.tenant_id == effective_tenant_id
    ).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    return {
        "id": str(review.id),
        "assignment_id": str(review.assignment_id),
        "assessment_id": str(review.assessment_id),
        "review_type": review.review_type,
        "status": review.status,
        "risk_score": review.risk_score,
        "risk_level": review.risk_level,
        "risk_factors": review.risk_factors,
        "analysis_summary": review.analysis_summary,
        "flagged_risks": review.flagged_risks,
        "flagged_questions": review.flagged_questions,
        "recommendations": review.recommendations,
        "assigned_to": str(review.assigned_to) if review.assigned_to else None,
        "assigned_at": review.assigned_at.isoformat() if review.assigned_at else None,
        "ai_review_completed_at": review.ai_review_completed_at.isoformat() if review.ai_review_completed_at else None,
        "created_at": review.created_at.isoformat()
    }


@router.get("/assignments/{assignment_id}/approval-status", response_model=Dict[str, Any])
async def get_assignment_approval_status(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get approval instance and current step for an assessment assignment"""
    from app.core.tenant_utils import get_effective_tenant_id
    from app.models.approval import ApprovalInstance, ApprovalStep
    
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    approval_instance = db.query(ApprovalInstance).filter(
        ApprovalInstance.assignment_id == assignment_id
    ).first()
    
    if not approval_instance:
        return {
            "has_workflow": False,
            "current_step": None,
            "step_name": None,
            "total_steps": 0
        }
    
    # Get current step
    current_step_record = db.query(ApprovalStep).filter(
        ApprovalStep.instance_id == approval_instance.id,
        ApprovalStep.step_number == approval_instance.current_step
    ).first()
    
    # Get total steps
    total_steps = db.query(ApprovalStep).filter(
        ApprovalStep.instance_id == approval_instance.id
    ).count()
    
    return {
        "has_workflow": True,
        "current_step": approval_instance.current_step,
        "step_name": current_step_record.step_name if current_step_record else None,
        "total_steps": total_steps,
        "status": approval_instance.status
    }


@router.get("/assignments/{assignment_id}/workflow-history", response_model=List[Dict[str, Any]])
async def get_assignment_workflow_history(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get complete workflow history for an assessment assignment"""
    from app.core.tenant_utils import get_effective_tenant_id
    from app.models.assessment_workflow_history import AssessmentWorkflowHistory
    from app.models.user import User as UserModel
    
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Get assignment to verify access
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get workflow history
    history_items = db.query(AssessmentWorkflowHistory).filter(
        AssessmentWorkflowHistory.assignment_id == assignment_id,
        AssessmentWorkflowHistory.tenant_id == effective_tenant_id
    ).order_by(AssessmentWorkflowHistory.action_at.desc()).all()
    
    # Batch load users for action_by and forwarded_to
    user_ids = set()
    for item in history_items:
        user_ids.add(item.action_by)
        if item.forwarded_to:
            user_ids.add(item.forwarded_to)
    
    users = {}
    if user_ids:
        users_list = db.query(UserModel).filter(UserModel.id.in_(list(user_ids))).all()
        users = {str(u.id): u for u in users_list}
    
    # Format response
    result = []
    for item in history_items:
        action_by_user = users.get(str(item.action_by))
        forwarded_to_user = users.get(str(item.forwarded_to)) if item.forwarded_to else None
        
        result.append({
            "id": str(item.id),
            "action_type": item.action_type,
            "action_by": {
                "id": str(item.action_by),
                "name": action_by_user.name if action_by_user else None,
                "email": action_by_user.email if action_by_user else None
            },
            "action_at": item.action_at.isoformat(),
            "forwarded_to": {
                "id": str(item.forwarded_to),
                "name": forwarded_to_user.name if forwarded_to_user else None,
                "email": forwarded_to_user.email if forwarded_to_user else None
            } if item.forwarded_to else None,
            "question_ids": item.question_ids,
            "comments": item.comments,
            "decision_comment": item.decision_comment,
            "previous_status": item.previous_status,
            "new_status": item.new_status,
            "workflow_ticket_id": item.workflow_ticket_id,
            "action_metadata": item.action_metadata
        })
    
    return result


@router.post("/assignments/{assignment_id}/forward", response_model=Dict[str, Any])
async def forward_assessment_questions(
    assignment_id: UUID,
    question_ids: Optional[List[UUID]] = Body(None, description="Specific question IDs to forward (if None, forwards entire assessment)"),
    forward_to_user_id: UUID = Body(..., description="User ID to forward to"),
    comment: Optional[str] = Body(None, description="Comment for forwarding"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Forward assessment or specific questions to another user"""
    from app.core.tenant_utils import get_effective_tenant_id
    from app.models.assessment_workflow_history import AssessmentWorkflowHistory, WorkflowActionType
    from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
    import os
    
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Get assignment
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Verify forward_to_user exists and is in same tenant
    forwarded_user = db.query(User).filter(
        User.id == forward_to_user_id,
        User.tenant_id == effective_tenant_id,
        User.is_active == True
    ).first()
    
    if not forwarded_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or not active"
        )
    
    # Log workflow history
    workflow_history = AssessmentWorkflowHistory(
        assignment_id=assignment_id,
        assessment_id=assignment.assessment_id,
        tenant_id=effective_tenant_id,
        action_type=WorkflowActionType.FORWARDED.value,
        action_by=current_user.id,
        action_at=datetime.utcnow(),
        forwarded_to=forward_to_user_id,
        question_ids=[str(qid) for qid in question_ids] if question_ids else None,
        comments=comment or f"Forwarded by {current_user.name or current_user.email}",
        workflow_ticket_id=assignment.workflow_ticket_id,
        action_metadata={
            "forwarded_by": current_user.name or current_user.email,
            "forward_reason": comment,
            "question_ids": [str(qid) for qid in question_ids] if question_ids else None
        }
    )
    db.add(workflow_history)
    
    # Create action item for forwarded user
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    question_context = f" ({len(question_ids)} questions)" if question_ids else ""
    action_item = ActionItem(
        tenant_id=effective_tenant_id,
        assigned_to=forward_to_user_id,
        assigned_by=current_user.id,
        action_type=ActionItemType.APPROVAL.value,
        title=f"Forwarded Assessment{question_context}: {assignment.workflow_ticket_id or 'Assessment'}",
        description=f"Assessment forwarded to you by {current_user.name or current_user.email}. {comment or ''}",
        status=ActionItemStatus.PENDING.value,
        priority=ActionItemPriority.HIGH.value,
        source_type="assessment_approval",
        source_id=assignment_id,
        action_url=f"/assessments/review/{assignment_id}",
        item_metadata={
            "assessment_id": str(assignment.assessment_id),
            "assignment_id": str(assignment_id),
            "forwarded_by": str(current_user.id),
            "forwarded_by_name": current_user.name or current_user.email,
            "workflow_ticket_id": assignment.workflow_ticket_id,
            "question_ids": [str(qid) for qid in question_ids] if question_ids else None
        }
    )
    db.add(action_item)
    
    try:
        db.commit()
        return {
            "success": True,
            "message": f"Assessment forwarded to {forwarded_user.name or forwarded_user.email}",
            "forwarded_to": {
                "id": str(forward_to_user_id),
                "name": forwarded_user.name,
                "email": forwarded_user.email
            },
            "question_ids": [str(qid) for qid in question_ids] if question_ids else None
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error forwarding assessment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to forward assessment: {str(e)}"
        )


@router.get("/assignments/{assignment_id}/reviews", response_model=List[Dict[str, Any]])
async def get_assignment_reviews(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all reviews for an assessment assignment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    from app.models.assessment_review import AssessmentReview
    
    reviews = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id == assignment_id
    ).order_by(AssessmentReview.created_at.desc()).all()
    
    return [
        {
            "id": str(r.id),
            "review_type": r.review_type,
            "status": r.status,
            "risk_score": r.risk_score,
            "risk_level": r.risk_level,
            "assigned_to": str(r.assigned_to) if r.assigned_to else None,
            "created_at": r.created_at.isoformat(),
            "ai_review_completed_at": r.ai_review_completed_at.isoformat() if r.ai_review_completed_at else None
        }
        for r in reviews
    ]


@router.get("/reviews/{review_id}/audit", response_model=List[Dict[str, Any]])
async def get_review_audit_trail(
    review_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get audit trail for an assessment review"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.assessment_review import AssessmentReview, AssessmentReviewAudit, ReviewStatus
    
    review = db.query(AssessmentReview).filter(
        AssessmentReview.id == review_id,
        AssessmentReview.tenant_id == effective_tenant_id
    ).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    audits = db.query(AssessmentReviewAudit).filter(
        AssessmentReviewAudit.review_id == review_id
    ).order_by(AssessmentReviewAudit.created_at).all()
    
    return [
        {
            "id": str(a.id),
            "action": a.action,
            "actor_type": a.actor_type,
            "actor_name": a.actor_name,
            "action_data": a.action_data,
            "questionnaire_id": a.questionnaire_id,
            "vendor_name": a.vendor_name,
            "created_at": a.created_at.isoformat()
        }
        for a in audits
    ]


@router.post("/assignments/{assignment_id}/questions/{question_id}/review", response_model=Dict[str, Any])
async def review_question(
    assignment_id: UUID,
    question_id: UUID,
    status: str = Body(..., description="Review status: pass, fail, or in_progress"),
    comment: Optional[str] = Body(None, description="Reviewer comment (mandatory for fail/in_progress)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Review a specific question - mark as pass, fail, or in_progress"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.assessment_review import (
        AssessmentReview, AssessmentQuestionReview, 
        QuestionReviewStatus
    )
    
    # Validate status
    valid_statuses = [QuestionReviewStatus.PASS.value, QuestionReviewStatus.FAIL.value, QuestionReviewStatus.IN_PROGRESS.value]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    # Validate comment for fail/in_progress
    if status in [QuestionReviewStatus.FAIL.value, QuestionReviewStatus.IN_PROGRESS.value]:
        if not comment or not comment.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment is mandatory for failed or in_progress items"
            )
    
    # Get assignment
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get or create review
    review = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id == assignment_id,
        AssessmentReview.tenant_id == effective_tenant_id
    ).order_by(AssessmentReview.created_at.desc()).first()
    
    if not review:
        # Create a new review if none exists
        review = AssessmentReview(
            assignment_id=assignment_id,
            assessment_id=assignment.assessment_id,
            tenant_id=effective_tenant_id,
            vendor_id=assignment.vendor_id,
            review_type="human_review",
            status="in_progress",
            assigned_to=current_user.id,
            assigned_at=datetime.utcnow(),
            created_by=current_user.id
        )
        db.add(review)
        db.flush()
    
    # Get or create question review
    question_review = db.query(AssessmentQuestionReview).filter(
        AssessmentQuestionReview.review_id == review.id,
        AssessmentQuestionReview.question_id == question_id
    ).first()
    
    if question_review:
        # Update existing review
        question_review.status = status
        question_review.reviewer_comment = comment if comment else question_review.reviewer_comment
        question_review.reviewed_by = current_user.id
        question_review.reviewed_at = datetime.utcnow()
        question_review.is_resolved = False  # Reset resolution if status changed
        question_review.resolved_at = None
        question_review.resolved_by = None
    else:
        # Create new question review
        question_review = AssessmentQuestionReview(
            review_id=review.id,
            assignment_id=assignment_id,
            question_id=question_id,
            tenant_id=effective_tenant_id,
            status=status,
            reviewer_comment=comment,
            reviewed_by=current_user.id,
            reviewed_at=datetime.utcnow()
        )
        db.add(question_review)
    
    try:
        db.commit()
        db.refresh(question_review)
        
        # After reviewing a question, check if all questions are now reviewed
        # If so, trigger approval workflow
        from app.models.assessment import AssessmentQuestion
        all_questions = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assignment.assessment_id,
            AssessmentQuestion.tenant_id == effective_tenant_id
        ).all()
        
        all_questions_reviewed = await _check_all_questions_reviewed(assignment_id, all_questions, db)
        
        if all_questions_reviewed:
            logger.info(f"All questions reviewed for assignment {assignment_id}. Checking if approval workflow should be triggered.")
            
            # Check if approval workflow already exists
            from app.models.action_item import ActionItem, ActionItemType
            existing_approval_items = db.query(ActionItem).filter(
                ActionItem.source_id == assignment_id,
                ActionItem.source_type == "assessment_approval",
                ActionItem.action_type == ActionItemType.APPROVAL,
                ActionItem.status.in_(["pending", "in_progress"])
            ).count()
            
            if existing_approval_items == 0:
                # Trigger approval workflow now that all questions are reviewed
                from fastapi import BackgroundTasks
                background_tasks = BackgroundTasks()
                try:
                    logger.info(f"All questions reviewed for assignment {assignment_id}. Triggering approval workflow.")
                    await _trigger_assessment_approval_workflow(assignment, current_user, db, background_tasks)
                    db.commit()  # Commit the approval workflow action items
                    logger.info(f"Successfully triggered approval workflow for assignment {assignment_id} after all questions reviewed.")
                except Exception as e:
                    logger.error(f"Error triggering approval workflow after question review: {e}", exc_info=True)
                    # Don't fail the review if approval workflow trigger fails
        
        return {
            "success": True,
            "question_review_id": str(question_review.id),
            "status": question_review.status,
            "message": f"Question marked as {status}",
            "all_questions_reviewed": all_questions_reviewed
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error reviewing question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to review question: {str(e)}"
        )


@router.get("/assignments/{assignment_id}/question-reviews", response_model=Dict[str, Any])
async def get_question_reviews(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all question review statuses for an assignment"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.assessment_review import AssessmentReview, AssessmentQuestionReview
    
    # Get assignment
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get review
    review = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id == assignment_id,
        AssessmentReview.tenant_id == effective_tenant_id
    ).order_by(AssessmentReview.created_at.desc()).first()
    
    if not review:
        return {"question_reviews": {}}
    
    # Get all question reviews
    question_reviews = db.query(AssessmentQuestionReview).filter(
        AssessmentQuestionReview.review_id == review.id
    ).all()
    
    # Format as {question_id: {status, comment, etc.}}
    reviews_dict = {}
    for qr in question_reviews:
        reviews_dict[str(qr.question_id)] = {
            "id": str(qr.id),
            "status": qr.status,
            "reviewer_comment": qr.reviewer_comment,
            "vendor_comment": qr.vendor_comment,
            "is_resolved": qr.is_resolved,
            "reviewed_by": str(qr.reviewed_by) if qr.reviewed_by else None,
            "reviewed_at": qr.reviewed_at.isoformat() if qr.reviewed_at else None,
            "resolved_at": qr.resolved_at.isoformat() if qr.resolved_at else None
        }
    
    return {
        "review_id": str(review.id),
        "question_reviews": reviews_dict
    }


@router.post("/assignments/{assignment_id}/questions/{question_id}/vendor-comment", response_model=Dict[str, Any])
async def add_vendor_comment(
    assignment_id: UUID,
    question_id: UUID,
    comment: str = Body(..., description="Vendor comment for followup"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add vendor comment for a failed/in_progress question"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.assessment_review import AssessmentReview, AssessmentQuestionReview
    
    # Get assignment
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get review
    review = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id == assignment_id,
        AssessmentReview.tenant_id == effective_tenant_id
    ).order_by(AssessmentReview.created_at.desc()).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found for this assignment"
        )
    
    # Get question review
    question_review = db.query(AssessmentQuestionReview).filter(
        AssessmentQuestionReview.review_id == review.id,
        AssessmentQuestionReview.question_id == question_id
    ).first()
    
    if not question_review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question review not found"
        )
    
    # Update vendor comment
    question_review.vendor_comment = comment
    question_review.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        return {
            "success": True,
            "message": "Vendor comment added successfully"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding vendor comment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add vendor comment: {str(e)}"
        )


@router.post("/assignments/{assignment_id}/questions/{question_id}/resolve", response_model=Dict[str, Any])
async def resolve_question(
    assignment_id: UUID,
    question_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a failed/in_progress question as resolved"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.assessment_review import AssessmentReview, AssessmentQuestionReview, QuestionReviewStatus
    
    # Get assignment
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get review
    review = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id == assignment_id,
        AssessmentReview.tenant_id == effective_tenant_id
    ).order_by(AssessmentReview.created_at.desc()).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found for this assignment"
        )
    
    # Get question review
    question_review = db.query(AssessmentQuestionReview).filter(
        AssessmentQuestionReview.review_id == review.id,
        AssessmentQuestionReview.question_id == question_id
    ).first()
    
    if not question_review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question review not found"
        )
    
    # Only resolve if status is fail or in_progress
    if question_review.status not in [QuestionReviewStatus.FAIL.value, QuestionReviewStatus.IN_PROGRESS.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only failed or in_progress questions can be resolved"
        )
    
    # Mark as resolved
    question_review.is_resolved = True
    question_review.status = QuestionReviewStatus.RESOLVED.value
    question_review.resolved_at = datetime.utcnow()
    question_review.resolved_by = current_user.id
    
    try:
        db.commit()
        return {
            "success": True,
            "message": "Question marked as resolved"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error resolving question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve question: {str(e)}"
        )


@router.get("/assignments/{assignment_id}/can-close", response_model=Dict[str, Any])
async def can_close_assessment(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if assessment can be closed (all comments/actions resolved)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.assessment_review import AssessmentReview, AssessmentQuestionReview, QuestionReviewStatus
    
    # Get assignment
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get review
    review = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id == assignment_id,
        AssessmentReview.tenant_id == effective_tenant_id
    ).order_by(AssessmentReview.created_at.desc()).first()
    
    if not review:
        return {
            "can_close": True,
            "reason": "No review found"
        }
    
    # Get all question reviews
    question_reviews = db.query(AssessmentQuestionReview).filter(
        AssessmentQuestionReview.review_id == review.id
    ).all()
    
    # Check for unresolved failed/in_progress items
    unresolved = []
    for qr in question_reviews:
        if qr.status in [QuestionReviewStatus.FAIL.value, QuestionReviewStatus.IN_PROGRESS.value]:
            if not qr.is_resolved:
                unresolved.append({
                    "question_id": str(qr.question_id),
                    "status": qr.status,
                    "has_reviewer_comment": bool(qr.reviewer_comment),
                    "has_vendor_comment": bool(qr.vendor_comment)
                })
    
    can_close = len(unresolved) == 0
    
    return {
        "can_close": can_close,
        "unresolved_count": len(unresolved),
        "unresolved_items": unresolved,
        "reason": "All comments and actions resolved" if can_close else f"{len(unresolved)} items need to be resolved"
    }


@router.get("/my-assignments", summary="Get My Assessment Assignments")
async def get_my_assessments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by status: pending, in_progress, completed, etc.", regex=r"^(pending|in_progress|completed|cancelled|approved|rejected|needs_revision)?$")
):
    """Get assessments assigned to current user (for vendor/agent view)"""
    from app.core.tenant_utils import get_effective_tenant_id
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        logger.info(f"User {current_user.email} (role: {current_user.role.value if hasattr(current_user.role, 'value') else current_user.role}, tenant: {current_user.tenant_id}) - effective_tenant_id: {effective_tenant_id}")
        if not effective_tenant_id:
            logger.warning(f"No effective tenant found for user {current_user.email}, returning empty list")
            return []
    except Exception as e:
        logger.error(f"Error getting effective tenant for user {current_user.email}: {e}", exc_info=True)
        return []

    # Check if user is a vendor user or has vendor/agent associations
    from app.models.vendor import Vendor
    from app.models.agent import Agent
    from app.models.user import UserRole

    # Approvers and reviewers should NOT see vendor assignments - they only review/approve completed ones
    # They should use the approval workflow inbox instead
    is_approver_role = current_user.role in [
        UserRole.APPROVER, 
        UserRole.SECURITY_REVIEWER, 
        UserRole.COMPLIANCE_REVIEWER, 
        UserRole.TECHNICAL_REVIEWER, 
        UserRole.BUSINESS_REVIEWER
    ]
    
    if is_approver_role:
        # Approvers don't have "my assignments" - they review/approve through the approval workflow
        logger.info(f"Approver {current_user.email} (role: {current_user.role.value}) requested my-assignments. "
                   f"Approvers should use the approval workflow inbox instead.")
        return []

    # For platform admin or tenant admin, show all assignments in their tenant
    if current_user.role in [UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN]:
        query = db.query(AssessmentAssignment).join(Assessment).filter(
            Assessment.tenant_id == effective_tenant_id
        )
    else:
        # For regular users, try to find assignments based on their vendor/agent associations
        vendor_ids = []
        agent_ids = []

        # Get vendor associations for users (not just vendor users)
        vendors = db.query(Vendor).filter(
            Vendor.tenant_id == effective_tenant_id,
            Vendor.contact_email == current_user.email
        ).all()
        vendor_ids = [v.id for v in vendors]

        # Get agent associations
        agents = db.query(Agent).filter(
            Agent.tenant_id == effective_tenant_id,
            Agent.contact_email == current_user.email
        ).all()
        agent_ids = [a.id for a in agents]

        # Build query for user's assignments
        query = db.query(AssessmentAssignment).join(Assessment).filter(
            Assessment.tenant_id == effective_tenant_id
        )

        # Filter by vendor or agent assignments
        # Use OR logic: show assignments for any associated vendors OR agents
        vendor_filter = AssessmentAssignment.vendor_id.in_(vendor_ids) if vendor_ids else None
        agent_filter = AssessmentAssignment.agent_id.in_(agent_ids) if agent_ids else None

        if vendor_filter and agent_filter:
            query = query.filter(vendor_filter | agent_filter)
        elif vendor_filter:
            query = query.filter(vendor_filter)
        elif agent_filter:
            query = query.filter(agent_filter)
        else:
            # No associations found, return empty list
            logger.info(f"No vendor/agent associations found for user {current_user.email}, returning empty list")
            return []

    # Apply status filter
    if status:
        query = query.filter(AssessmentAssignment.status == status)
    else:
        # By default, show active assignments (not cancelled)
        query = query.filter(AssessmentAssignment.status != 'cancelled')

    assignments = query.order_by(AssessmentAssignment.due_date, AssessmentAssignment.assigned_at.desc()).all()

    result = []
    for assignment in assignments:
        # Get vendor/agent info
        vendor_name = None
        agent_name = None
        if assignment.vendor_id:
            vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
            vendor_name = vendor.name if vendor else "Unknown Vendor"
        if assignment.agent_id:
            agent = db.query(Agent).filter(Agent.id == assignment.agent_id).first()
            agent_name = agent.name if agent else "Unknown Agent"

        # Count responses
        response_count = db.query(AssessmentQuestionResponse).filter(
            AssessmentQuestionResponse.assignment_id == assignment.id
        ).count()

        # Count total questions (with tenant fallback for backward compatibility)
        question_count = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assignment.assessment_id,
            AssessmentQuestion.tenant_id == assignment.tenant_id
        ).count()
        
        # Fallback if no questions found with tenant filter
        if question_count == 0:
            question_count = db.query(AssessmentQuestion).filter(
                AssessmentQuestion.assessment_id == assignment.assessment_id
            ).count()

        # Calculate progress safely
        percentage = 0.0
        if question_count > 0:
            try:
                percentage = round((response_count / question_count * 100), 1)
            except (ZeroDivisionError, TypeError):
                percentage = 0.0

        result.append({
            "id": str(assignment.id),
            "assessment_id": str(assignment.assessment_id),
            "assessment_name": assignment.assessment.name if assignment.assessment else "Unknown Assessment",
            "assessment_type": assignment.assessment.assessment_type if assignment.assessment else "unknown",
            "status": assignment.status or "unknown",
            "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
            "started_at": assignment.started_at.isoformat() if assignment.started_at else None,
            "completed_at": assignment.completed_at.isoformat() if assignment.completed_at else None,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "vendor_name": vendor_name,
            "agent_name": agent_name,
            "progress": {
                "answered": int(response_count),
                "total": int(question_count),
                "percentage": float(percentage)
            },
            "is_overdue": bool(assignment.due_date and assignment.due_date < datetime.utcnow() and assignment.status != 'completed'),
            "assignment_type": assignment.assignment_type or "unknown"
        })

    return result


@router.get("/analytics/dashboard", response_model=Dict[str, Any])
async def get_assessment_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    quarter: Optional[str] = Query(None, description="Quarter filter (e.g., '2024-Q1')"),
    assessment_type: Optional[str] = Query(None, description="Filter by assessment type")
):
    """Get assessment analytics dashboard data"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.vendor import Vendor
    from app.models.agent import Agent
    from datetime import datetime, timedelta
    from collections import defaultdict
    import calendar
    
    # Get all assessments for tenant
    assessments_query = db.query(Assessment).filter(
        Assessment.tenant_id == effective_tenant_id,
        Assessment.is_active == True
    )
    
    if assessment_type:
        assessments_query = assessments_query.filter(Assessment.assessment_type == assessment_type)
    
    assessments = assessments_query.all()
    assessment_ids = [a.id for a in assessments]
    
    # Get all assignments
    assignments_query = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.tenant_id == effective_tenant_id,
        AssessmentAssignment.assessment_id.in_(assessment_ids)
    )
    
    assignments = assignments_query.all()
    
    # Calculate quarterly progress
    now = datetime.utcnow()
    current_year = now.year
    current_quarter = (now.month - 1) // 3 + 1
    
    quarterly_data = defaultdict(lambda: {
        "total": 0,
        "completed": 0,
        "in_progress": 0,
        "pending": 0,
        "overdue": 0
    })
    
    for assignment in assignments:
        if assignment.completed_at:
            completed_quarter = (assignment.completed_at.month - 1) // 3 + 1
            quarter_key = f"{assignment.completed_at.year}-Q{completed_quarter}"
        elif assignment.assigned_at:
            assigned_quarter = (assignment.assigned_at.month - 1) // 3 + 1
            quarter_key = f"{assignment.assigned_at.year}-Q{assigned_quarter}"
        else:
            continue
        
        if quarter and quarter_key != quarter:
            continue
        
        quarterly_data[quarter_key]["total"] += 1
        if assignment.status == "completed":
            quarterly_data[quarter_key]["completed"] += 1
        elif assignment.status == "in_progress":
            quarterly_data[quarter_key]["in_progress"] += 1
        elif assignment.status == "pending":
            quarterly_data[quarter_key]["pending"] += 1
        if assignment.due_date and assignment.due_date < now and assignment.status != "completed":
            quarterly_data[quarter_key]["overdue"] += 1
    
    # Vendor-wise distribution by assessment type
    vendor_distribution = defaultdict(lambda: {
        "vendor_name": "",
        "assessments": defaultdict(lambda: {
            "total": 0,
            "completed": 0,
            "pending": 0,
            "overdue": 0,
            "risk_status": "green"  # green, yellow, red
        })
    })
    
    # Get vendor details
    vendor_ids = [a.vendor_id for a in assignments if a.vendor_id]
    vendors = {v.id: v for v in db.query(Vendor).filter(Vendor.id.in_(vendor_ids)).all()}
    
    for assignment in assignments:
        if not assignment.vendor_id:
            continue

        vendor = vendors.get(assignment.vendor_id)
        if not vendor:
            continue

        # Get the assessment for this assignment to get the assessment type
        assessment = next((a for a in assessments if a.id == assignment.assessment_id), None)
        if not assessment:
            continue

        assessment_type_key = assessment.assessment_type
        vendor_distribution[str(assignment.vendor_id)]["vendor_name"] = vendor.name

        vendor_distribution[str(assignment.vendor_id)]["assessments"][assessment_type_key]["total"] += 1
        
        if assignment.status == "completed":
            vendor_distribution[str(assignment.vendor_id)]["assessments"][assessment_type_key]["completed"] += 1
        elif assignment.status == "pending" or assignment.status == "in_progress":
            vendor_distribution[str(assignment.vendor_id)]["assessments"][assessment_type_key]["pending"] += 1
        
        if assignment.due_date and assignment.due_date < now and assignment.status != "completed":
            vendor_distribution[str(assignment.vendor_id)]["assessments"][assessment_type_key]["overdue"] += 1
    
    # Calculate risk status for each vendor
    for vendor_key, vendor_data in vendor_distribution.items():
        for assessment_type, data in vendor_data["assessments"].items():
            total = data["total"]
            completed = data["completed"]
            overdue = data["overdue"]
            
            if total == 0:
                data["risk_status"] = "green"
            elif overdue > 0:
                data["risk_status"] = "red"
            elif completed / total < 0.5:  # Less than 50% completed
                data["risk_status"] = "yellow"
            elif completed / total < 0.8:  # Less than 80% completed
                data["risk_status"] = "yellow"
            else:
                data["risk_status"] = "green"
    
    # Next assessment due dates
    upcoming_assignments = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.tenant_id == effective_tenant_id,
        AssessmentAssignment.assessment_id.in_(assessment_ids),
        AssessmentAssignment.due_date.isnot(None),
        AssessmentAssignment.due_date >= now,
        AssessmentAssignment.status.in_(["pending", "in_progress"])
    ).order_by(AssessmentAssignment.due_date).limit(20).all()
    
    next_due = []
    for assignment in upcoming_assignments:
        assessment = next((a for a in assessments if a.id == assignment.assessment_id), None)
        vendor = vendors.get(assignment.vendor_id) if assignment.vendor_id else None
        
        next_due.append({
            "assignment_id": str(assignment.id),
            "assessment_name": assessment.name if assessment else "Unknown",
            "assessment_type": assessment.assessment_type if assessment else "unknown",
            "vendor_name": vendor.name if vendor else "Unknown",
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "days_until_due": (assignment.due_date - now).days if assignment.due_date else None,
            "status": assignment.status
        })
    
    # Overall statistics
    total_assessments = len(assessments)
    total_assignments = len(assignments)
    completed_assignments = len([a for a in assignments if a.status == "completed"])
    pending_assignments = len([a for a in assignments if a.status in ["pending", "in_progress"]])
    overdue_assignments = len([a for a in assignments if a.due_date and a.due_date < now and a.status != "completed"])
    
    # Assessment type distribution
    type_distribution = defaultdict(int)
    for assessment in assessments:
        type_distribution[assessment.assessment_type] += 1
    
    # Vendor risk by Assessment Grading (accepted, denied, need_info)
    from app.models.assessment_review import AssessmentReview
    vendor_grading_heatmap = defaultdict(lambda: {
        "vendor_name": "",
        "grading": {
            "accepted": 0,
            "denied": 0,
            "need_info": 0,
            "pending": 0
        }
    })
    
    assignment_ids = [a.id for a in assignments]
    reviews = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id.in_(assignment_ids),
        AssessmentReview.tenant_id == effective_tenant_id
    ).all()
    
    for review in reviews:
        assignment = next((a for a in assignments if a.id == review.assignment_id), None)
        if not assignment or not assignment.vendor_id:
            continue
        
        vendor = vendors.get(assignment.vendor_id)
        if not vendor:
            continue
        
        vendor_key = str(assignment.vendor_id)
        vendor_grading_heatmap[vendor_key]["vendor_name"] = vendor.name
        
        # Map human_decision to grading categories
        if review.human_decision:
            if review.human_decision == "approved":
                vendor_grading_heatmap[vendor_key]["grading"]["accepted"] += 1
            elif review.human_decision == "rejected":
                vendor_grading_heatmap[vendor_key]["grading"]["denied"] += 1
            elif review.human_decision == "needs_revision":
                vendor_grading_heatmap[vendor_key]["grading"]["need_info"] += 1
        else:
            vendor_grading_heatmap[vendor_key]["grading"]["pending"] += 1
    
    # Vendor risk by CVEs
    vendor_cve_risk = defaultdict(lambda: {
        "vendor_name": "",
        "total_cves": 0,
        "critical_cves": 0,
        "high_cves": 0,
        "medium_cves": 0,
        "low_cves": 0,
        "risk_score": 0.0
    })
    
    try:
        from app.models.security_incident import VendorSecurityTracking, SecurityIncident, IncidentSeverity
        from app.core.feature_gating import FeatureGate
        
        # Check if CVE feature is enabled for tenant
        feature_gate = FeatureGate(db)
        if feature_gate.is_feature_enabled(str(effective_tenant_id), "cve_tracking") and vendor_ids:
            # Get all CVE trackings for vendors in this tenant
            trackings = db.query(VendorSecurityTracking).join(
                SecurityIncident, VendorSecurityTracking.incident_id == SecurityIncident.id
            ).filter(
                VendorSecurityTracking.tenant_id == effective_tenant_id,
                SecurityIncident.incident_type == "cve",
                VendorSecurityTracking.vendor_id.in_(vendor_ids)
            ).all()
            
            for tracking in trackings:
                if not tracking.vendor_id:
                    continue
                
                vendor = vendors.get(tracking.vendor_id)
                if not vendor:
                    continue
                
                vendor_key = str(tracking.vendor_id)
                vendor_cve_risk[vendor_key]["vendor_name"] = vendor.name
                vendor_cve_risk[vendor_key]["total_cves"] += 1
                
                # Get incident severity
                incident = db.query(SecurityIncident).filter(
                    SecurityIncident.id == tracking.incident_id
                ).first()
                
                if incident and incident.severity:
                    severity = incident.severity.value if hasattr(incident.severity, 'value') else str(incident.severity)
                    if severity == "critical":
                        vendor_cve_risk[vendor_key]["critical_cves"] += 1
                        vendor_cve_risk[vendor_key]["risk_score"] += 10.0
                    elif severity == "high":
                        vendor_cve_risk[vendor_key]["high_cves"] += 1
                        vendor_cve_risk[vendor_key]["risk_score"] += 7.0
                    elif severity == "medium":
                        vendor_cve_risk[vendor_key]["medium_cves"] += 1
                        vendor_cve_risk[vendor_key]["risk_score"] += 4.0
                    elif severity == "low":
                        vendor_cve_risk[vendor_key]["low_cves"] += 1
                        vendor_cve_risk[vendor_key]["risk_score"] += 1.0
    except Exception as e:
        logger.warning(f"Error fetching CVE data for analytics: {e}")
        # Continue without CVE data if feature is not enabled or error occurs
    
    return {
        "overview": {
            "total_assessments": total_assessments,
            "total_assignments": total_assignments,
            "completed_assignments": completed_assignments,
            "pending_assignments": pending_assignments,
            "overdue_assignments": overdue_assignments,
            "completion_rate": (completed_assignments / total_assignments * 100) if total_assignments > 0 else 0
        },
        "quarterly_progress": dict(quarterly_data),
        "vendor_distribution": {
            str(vendor_id): {
                "vendor_name": data["vendor_name"],
                "assessments": {
                    atype: {
                        "total": adata["total"],
                        "completed": adata["completed"],
                        "pending": adata["pending"],
                        "overdue": adata["overdue"],
                        "risk_status": adata["risk_status"]
                    }
                    for atype, adata in data["assessments"].items()
                },
                "overall_risk": "red" if any(
                    adata["risk_status"] == "red" for adata in data["assessments"].values()
                ) else ("yellow" if any(
                    adata["risk_status"] == "yellow" for adata in data["assessments"].values()
                ) else "green")
            }
            for vendor_id, data in vendor_distribution.items()
        },
        "vendor_grading_heatmap": {
            str(vendor_id): {
                "vendor_name": data["vendor_name"],
                "grading": dict(data["grading"])
            }
            for vendor_id, data in vendor_grading_heatmap.items()
        },
        "vendor_cve_risk": {
            str(vendor_id): {
                "vendor_name": data["vendor_name"],
                "total_cves": data["total_cves"],
                "critical_cves": data["critical_cves"],
                "high_cves": data["high_cves"],
                "medium_cves": data["medium_cves"],
                "low_cves": data["low_cves"],
                "risk_score": round(data["risk_score"], 2)
            }
            for vendor_id, data in vendor_cve_risk.items()
        },
        "next_due_assessments": next_due,
        "assessment_type_distribution": dict(type_distribution),
        "current_quarter": f"{current_year}-Q{current_quarter}"
    }


@router.post("/assignments/{assignment_id}/decision", response_model=Dict[str, Any])
async def submit_final_decision(
    assignment_id: UUID,
    decision: str = Body(..., description="Final decision: accepted, denied, or need_info"),
    comment: Optional[str] = Body(None, description="Optional comment from approver"),
    forward_to_user_id: Optional[UUID] = Body(None, description="Optional user id to forward to"),
    forward_to_group_id: Optional[UUID] = Body(None, description="Optional group id to forward to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit final decision on an assessment assignment review (approver action)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )

    # Only allow approvers or admins to submit final decision
    allowed_roles = [UserRole.APPROVER, UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to submit final decision"
        )

    valid_decisions = ["accepted", "denied", "need_info"]
    if decision not in valid_decisions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision. Must be one of: {', '.join(valid_decisions)}"
        )

    from app.models.assessment_review import AssessmentReview, AssessmentReviewAudit, ReviewStatus

    # Get assignment
    assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.id == assignment_id,
        AssessmentAssignment.tenant_id == effective_tenant_id
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    # Get or create review
    review = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id == assignment_id,
        AssessmentReview.tenant_id == effective_tenant_id
    ).order_by(AssessmentReview.created_at.desc()).first()

    if not review:
        # Create a review record if none exists
        review = AssessmentReview(
            assignment_id=assignment_id,
            assessment_id=assignment.assessment_id,
            tenant_id=effective_tenant_id,
            vendor_id=assignment.vendor_id,
            review_type="human_review",
            status=ReviewStatus.IN_PROGRESS.value,
            assigned_to=current_user.id,
            assigned_at=datetime.utcnow(),
            created_by=current_user.id
        )
        db.add(review)
        db.flush()

    prev_state = {
        "assignment_status": assignment.status,
        "review_human_decision": review.human_decision,
        "review_status": review.status
    }

    # Map decision to internal values
    mapped = {
        "accepted": "approved",
        "denied": "rejected",
        "need_info": "needs_revision"
    }

    new_decision = mapped[decision]

    # Check if workflow-based approval (using ApprovalInstance/ApprovalStep)
    from app.models.approval import ApprovalInstance, ApprovalStep
    approval_instance = db.query(ApprovalInstance).filter(
        ApprovalInstance.assignment_id == assignment_id
    ).first()
    
    is_workflow_based = approval_instance is not None
    is_final_step = False
    
    if is_workflow_based:
        # Get current step
        current_step = db.query(ApprovalStep).filter(
            ApprovalStep.instance_id == approval_instance.id,
            ApprovalStep.step_number == approval_instance.current_step,
            ApprovalStep.status.in_(["pending", "in_progress"])
        ).first()
        
        if current_step:
            # Mark current step as completed
            current_step.status = "completed"
            current_step.completed_by = current_user.id
            current_step.completed_at = datetime.utcnow()
            current_step.notes = comment
            
            # Get workflow configuration to find next step
            from app.services.workflow_orchestration import WorkflowOrchestrationService
            from app.models.workflow_config import WorkflowConfiguration
            from app.models.vendor import Vendor
            from app.models.agent import Agent
            
            # Get assessment details for action item metadata
            assessment = db.query(Assessment).filter(Assessment.id == assignment.assessment_id).first()
            if not assessment:
                logger.warning(f"Assessment {assignment.assessment_id} not found when progressing workflow")
            
            orchestration = WorkflowOrchestrationService(db, effective_tenant_id)
            assessment_data = {
                "id": str(assignment.assessment_id),
                "name": assessment.name if assessment else str(assignment.assessment_id),
                "assessment_type": assessment.assessment_type if assessment else None,
            }
            
            workflow_config = orchestration.get_workflow_for_entity(
                entity_type="assessment_assignments",
                entity_data=assessment_data,
                request_type="assessment_workflow"
            )
            
            if not workflow_config:
                workflow_config = db.query(WorkflowConfiguration).filter(
                    WorkflowConfiguration.tenant_id == effective_tenant_id,
                    WorkflowConfiguration.is_default == True,
                    WorkflowConfiguration.status == "active"
                ).first()
            
            # Get workflow steps
            workflow_steps = []
            if workflow_config and workflow_config.workflow_steps:
                steps = workflow_config.workflow_steps
                if isinstance(steps, str):
                    import json
                    try:
                        steps = json.loads(steps)
                    except json.JSONDecodeError:
                        steps = []
                if isinstance(steps, list):
                    workflow_steps = sorted(steps, key=lambda x: x.get("step_number", 999))
            
            # Find next step
            next_step_config = None
            for step_config in workflow_steps:
                if step_config.get("step_number", 0) > approval_instance.current_step:
                    next_step_config = step_config
                    break
            
            if next_step_config and decision == "accepted":
                # Move to next step
                next_step_number = next_step_config.get("step_number")
                approval_instance.current_step = next_step_number
                approval_instance.status = ApprovalStatus.IN_PROGRESS.value
                
                # Get or create next ApprovalStep
                next_step = db.query(ApprovalStep).filter(
                    ApprovalStep.instance_id == approval_instance.id,
                    ApprovalStep.step_number == next_step_number
                ).first()
                
                if next_step:
                    next_step.status = "pending"
                    # Auto-assign if configured
                    if next_step_config.get("auto_assign", False):
                        assigned_role = next_step_config.get("assigned_role")
                        if assigned_role:
                            role_mapping = {
                                "security_reviewer": UserRole.SECURITY_REVIEWER,
                                "compliance_reviewer": UserRole.COMPLIANCE_REVIEWER,
                                "technical_reviewer": UserRole.TECHNICAL_REVIEWER,
                                "business_reviewer": UserRole.BUSINESS_REVIEWER,
                                "approver": UserRole.APPROVER,
                                "tenant_admin": UserRole.TENANT_ADMIN,
                            }
                            role_enum = role_mapping.get(assigned_role)
                            if role_enum:
                                assignee = db.query(User).filter(
                                    User.tenant_id == effective_tenant_id,
                                    User.role == role_enum,
                                    User.is_active.is_(True)
                                ).first()
                                if assignee:
                                    next_step.assigned_to = assignee.id
                                    logger.info(f"Auto-assigned next step {next_step_number} to {assignee.email} ({assigned_role})")
                    
                    # Create action items for the next step's assignee(s)
                    from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
                    
                    # Get all users assigned to this step (could be multiple if role-based)
                    next_step_assignees = []
                    if next_step.assigned_to:
                        # Direct assignment
                        assignee_user = db.query(User).filter(User.id == next_step.assigned_to).first()
                        if assignee_user:
                            next_step_assignees.append(assignee_user)
                    elif next_step_config.get("assigned_role"):
                        # Role-based assignment - get all users with this role
                        assigned_role = next_step_config.get("assigned_role")
                        role_mapping = {
                            "security_reviewer": UserRole.SECURITY_REVIEWER,
                            "compliance_reviewer": UserRole.COMPLIANCE_REVIEWER,
                            "technical_reviewer": UserRole.TECHNICAL_REVIEWER,
                            "business_reviewer": UserRole.BUSINESS_REVIEWER,
                            "approver": UserRole.APPROVER,
                            "tenant_admin": UserRole.TENANT_ADMIN,
                        }
                        role_enum = role_mapping.get(assigned_role)
                        if role_enum:
                            role_users = db.query(User).filter(
                                User.tenant_id == effective_tenant_id,
                                User.role == role_enum,
                                User.is_active.is_(True)
                            ).all()
                            next_step_assignees.extend(role_users)
                    
                    # Create action items for each assignee
                    for assignee_user in next_step_assignees:
                        # Check if action item already exists for this step
                        existing_item = db.query(ActionItem).filter(
                            ActionItem.source_id == assignment_id,
                            ActionItem.source_type == "assessment_approval",
                            ActionItem.action_type == ActionItemType.APPROVAL,
                            ActionItem.assigned_to == assignee_user.id,
                            ActionItem.status.in_([ActionItemStatus.PENDING, ActionItemStatus.IN_PROGRESS])
                        ).first()
                        
                        if not existing_item:
                            # Build action URL
                            approval_url = f"/approver/assessment_approval/{assignment_id}"
                            
                            # Get vendor/agent names for metadata
                            vendor_name = None
                            agent_name = None
                            if assignment.vendor_id:
                                vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
                                vendor_name = vendor.name if vendor else None
                            if assignment.agent_id:
                                agent = db.query(Agent).filter(Agent.id == assignment.agent_id).first()
                                agent_name = agent.name if agent else None
                            
                            # Create action item for next step
                            action_item = ActionItem(
                                tenant_id=effective_tenant_id,
                                action_type=ActionItemType.APPROVAL,
                                title=f"Approve Assessment: {assessment.name if assessment else 'Assessment'}",
                                description=f"Step {next_step_number}: {next_step_config.get('step_name', 'Approval')}",
                                status=ActionItemStatus.PENDING,
                                priority=ActionItemPriority.MEDIUM,
                                assigned_to=assignee_user.id,
                                assigned_at=datetime.utcnow(),
                                source_type="assessment_approval",
                                source_id=assignment_id,
                                action_url=approval_url,
                                item_metadata={
                                    "assessment_id": str(assessment.id) if assessment else None,
                                    "assessment_name": assessment.name if assessment else None,
                                    "assessment_type": assessment.assessment_type if assessment else None,
                                    "assignment_id": str(assignment.id),
                                    "vendor_id": str(assignment.vendor_id) if assignment.vendor_id else None,
                                    "agent_id": str(assignment.agent_id) if assignment.agent_id else None,
                                    "vendor_name": vendor_name,
                                    "agent_name": agent_name,
                                    "submitted_by": current_user.name or current_user.email,
                                    "submitted_at": assignment.completed_at.isoformat() if assignment.completed_at else datetime.utcnow().isoformat(),
                                    "workflow_type": "assessment_approval",
                                    "approval_required": True,
                                    "vendor_completed": True,
                                    "ready_for_approval": True,
                                    "assignment_status": "completed",
                                    "workflow_ticket_id": assignment.workflow_ticket_id,
                                    "approval_step_number": next_step_number,
                                    "approval_step_name": next_step_config.get("step_name", "Approval")
                                }
                            )
                            db.add(action_item)
                            logger.info(f"Created action item for step {next_step_number} assignee {assignee_user.email} (ID: {assignee_user.id}) for assignment {assignment_id}")
                        else:
                            logger.info(f"Action item already exists for step {next_step_number} assignee {assignee_user.email} for assignment {assignment_id}")
                    
                    # Flush to ensure action items are persisted
                    if next_step_assignees:
                        db.flush()
                        logger.info(f"Flushed action items for step {next_step_number} ({len(next_step_assignees)} assignees) for assignment {assignment_id}")
                
                logger.info(f"Progressed workflow to step {next_step_number} for assignment {assignment_id}")
            else:
                # This was the last step or decision is denied/need_info
                is_final_step = True
                if decision == "accepted":
                    approval_instance.status = ApprovalStatus.APPROVED.value
                    approval_instance.approved_by = current_user.id
                    approval_instance.approval_notes = comment
                    approval_instance.completed_at = datetime.utcnow()
                elif decision == "denied":
                    approval_instance.status = ApprovalStatus.REJECTED.value
                    approval_instance.completed_at = datetime.utcnow()
        else:
            logger.warning(f"No current step found for approval_instance {approval_instance.id}, treating as final step")
            is_final_step = True
    else:
        # No workflow instance - treat as single-step approval
        is_final_step = True

    # Update review
    review.human_decision = new_decision
    review.human_review_completed_at = datetime.utcnow()
    review.human_review_notes = (review.human_review_notes or "") + ("\n" + comment if comment else "")
    review.human_review_started_at = review.human_review_started_at or datetime.utcnow()
    review.human_review_completed_at = datetime.utcnow()
    review.status = ReviewStatus.COMPLETED.value

    # Log workflow history before status change
    from app.models.assessment_workflow_history import AssessmentWorkflowHistory, WorkflowActionType
    
    # Update assignment status based on decision (only if final step)
    new_assignment_status = assignment.status
    if decision == "accepted" and is_final_step:
        new_assignment_status = "approved"
        assignment.status = "approved"  # Update assignment status immediately
        assignment.completed_at = datetime.utcnow()
        # Mark entity as Green when approved
        await _update_entity_status_on_approval(assignment, current_user, db)
        
        # Log workflow history
        workflow_history = AssessmentWorkflowHistory(
            assignment_id=assignment_id,
            assessment_id=assignment.assessment_id,
            tenant_id=effective_tenant_id,
            action_type=WorkflowActionType.APPROVED.value,
            action_by=current_user.id,
            action_at=datetime.utcnow(),
            comments=comment,
            decision_comment=comment,
            previous_status=assignment.status,
            new_status=new_assignment_status,
            workflow_ticket_id=assignment.workflow_ticket_id,
            action_metadata={
                "review_id": str(review.id),
                "decision": decision,
                "reviewer_name": current_user.name or current_user.email
            }
        )
        db.add(workflow_history)
        
    elif decision == "denied":
        new_assignment_status = "rejected"
        assignment.status = "rejected"  # Update assignment status immediately
        
        # Get failed questions with their comments for history
        from app.models.assessment_review import AssessmentQuestionReview
        from app.models.assessment import AssessmentQuestion
        failed_questions = db.query(AssessmentQuestionReview).filter(
            AssessmentQuestionReview.assignment_id == assignment_id,
            AssessmentQuestionReview.status == "fail",
            AssessmentQuestionReview.tenant_id == effective_tenant_id
        ).all()
        
        question_ids = [str(q.question_id) for q in failed_questions] if failed_questions else None
        
        # Build detailed question information with comments
        questions_details = []
        if failed_questions:
            for q_review in failed_questions:
                # Get question text for context
                question = db.query(AssessmentQuestion).filter(AssessmentQuestion.id == q_review.question_id).first()
                questions_details.append({
                    "question_id": str(q_review.question_id),
                    "question_text": question.question_text if question else None,
                    "question_number": question.question_number if question else None,
                    "reviewer_comment": q_review.reviewer_comment,
                    "reviewed_by": str(q_review.reviewed_by) if q_review.reviewed_by else None,
                    "reviewed_at": q_review.reviewed_at.isoformat() if q_review.reviewed_at else None,
                    "status": q_review.status
                })
        
        # Trigger resubmission workflow for rework
        await _trigger_resubmission_workflow(assignment, comment, current_user, db)
        
        # Log workflow history with detailed question information
        workflow_history = AssessmentWorkflowHistory(
            assignment_id=assignment_id,
            assessment_id=assignment.assessment_id,
            tenant_id=effective_tenant_id,
            action_type=WorkflowActionType.DENIED.value,
            action_by=current_user.id,
            action_at=datetime.utcnow(),
            comments=comment,
            decision_comment=comment,
            previous_status=assignment.status,
            new_status=new_assignment_status,
            question_ids=question_ids,  # Failed questions
            workflow_ticket_id=assignment.workflow_ticket_id,
            action_metadata={
                "review_id": str(review.id),
                "decision": decision,
                "reviewer_name": current_user.name or current_user.email,
                "failed_questions": question_ids or [],
                "questions_details": questions_details,  # Detailed question info with comments
                "reason": "Assessment denied - questions failed review"
            }
        )
        db.add(workflow_history)
        logger.info(f"Created workflow history for denied assessment {assignment_id} with {len(questions_details)} failed questions")
        
    elif decision == "need_info":
        new_assignment_status = "in_progress"
        assignment.status = "in_progress"  # Mark as in_progress so vendor can see it needs attention
        
        # Get questions marked as "more info" (in_progress status) with their comments
        from app.models.assessment_review import AssessmentQuestionReview
        from app.models.assessment import AssessmentQuestion
        more_info_questions = db.query(AssessmentQuestionReview).filter(
            AssessmentQuestionReview.assignment_id == assignment_id,
            AssessmentQuestionReview.status == "in_progress",
            AssessmentQuestionReview.tenant_id == effective_tenant_id
        ).all()
        
        question_ids = [str(q.question_id) for q in more_info_questions] if more_info_questions else None
        
        # Build detailed question information with comments
        questions_details = []
        if more_info_questions:
            for q_review in more_info_questions:
                # Get question text for context
                question = db.query(AssessmentQuestion).filter(AssessmentQuestion.id == q_review.question_id).first()
                questions_details.append({
                    "question_id": str(q_review.question_id),
                    "question_text": question.question_text if question else None,
                    "question_number": question.question_number if question else None,
                    "reviewer_comment": q_review.reviewer_comment,
                    "reviewed_by": str(q_review.reviewed_by) if q_review.reviewed_by else None,
                    "reviewed_at": q_review.reviewed_at.isoformat() if q_review.reviewed_at else None,
                    "status": q_review.status
                })
        
        # Trigger resubmission workflow for more info (sends back to vendor)
        await _trigger_resubmission_workflow(assignment, comment, current_user, db)
        
        # Log workflow history with detailed question information
        workflow_history = AssessmentWorkflowHistory(
            assignment_id=assignment_id,
            assessment_id=assignment.assessment_id,
            tenant_id=effective_tenant_id,
            action_type=WorkflowActionType.SENT_BACK.value,
            action_by=current_user.id,
            action_at=datetime.utcnow(),
            comments=comment,
            decision_comment=comment,
            previous_status=prev_state.get("assignment_status"),
            new_status=new_assignment_status,
            question_ids=question_ids,  # Questions that need more info
            workflow_ticket_id=assignment.workflow_ticket_id,
            action_metadata={
                "review_id": str(review.id),
                "decision": decision,
                "reviewer_name": current_user.name or current_user.email,
                "questions_requiring_info": question_ids or [],
                "questions_details": questions_details,  # Detailed question info with comments
                "reason": "Questions require more information or clarification"
            }
        )
        db.add(workflow_history)
        logger.info(f"Created workflow history for sent back assessment {assignment_id} with {len(questions_details)} questions requiring info")

    # Handle forwarding
    if forward_to_user_id:
        # Create workflow history for forward
        forward_history = AssessmentWorkflowHistory(
            assignment_id=assignment_id,
            assessment_id=assignment.assessment_id,
            tenant_id=effective_tenant_id,
            action_type=WorkflowActionType.FORWARDED.value,
            action_by=current_user.id,
            action_at=datetime.utcnow(),
            forwarded_to=forward_to_user_id,
            comments=comment or f"Forwarded by {current_user.name or current_user.email}",
            workflow_ticket_id=assignment.workflow_ticket_id,
            action_metadata={
                "forwarded_by": current_user.name or current_user.email,
                "forward_reason": comment
            }
        )
        db.add(forward_history)
        
        # Create action item for forwarded user
        from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
        forwarded_user = db.query(User).filter(User.id == forward_to_user_id).first()
        if forwarded_user:
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            action_item = ActionItem(
                tenant_id=effective_tenant_id,
                assigned_to=forward_to_user_id,
                assigned_by=current_user.id,
                action_type=ActionItemType.APPROVAL.value,
                title=f"Forwarded Assessment: {assignment.workflow_ticket_id or 'Assessment'}",
                description=f"Assessment forwarded to you by {current_user.name or current_user.email}. {comment or ''}",
                status=ActionItemStatus.PENDING.value,
                priority=ActionItemPriority.HIGH.value,
                source_type="assessment_approval",
                source_id=assignment_id,
                action_url=f"/assessments/review/{assignment_id}",
                item_metadata={
                    "assessment_id": str(assignment.assessment_id),
                    "assignment_id": str(assignment_id),
                    "forwarded_by": str(current_user.id),
                    "forwarded_by_name": current_user.name or current_user.email,
                    "workflow_ticket_id": assignment.workflow_ticket_id
                }
            )
            db.add(action_item)

    assignment.status = new_assignment_status
    assignment.updated_at = datetime.utcnow()
    
    # Update THIS APPROVER's action item to completed when they approve/deny
    # CRITICAL: Only mark THIS approver's action item as completed, not all approvers
    # Other approvers' action items remain PENDING until they complete their review
    from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus
    if decision in ["accepted", "denied"]:
        # Mark only THIS approver's action item as completed
        current_approver_action_item = db.query(ActionItem).filter(
            ActionItem.source_id == assignment_id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.action_type == ActionItemType.APPROVAL,
            ActionItem.assigned_to == current_user.id,  # Only THIS approver's item
            ActionItem.status.in_([ActionItemStatus.PENDING.value, ActionItemStatus.IN_PROGRESS.value])
        ).first()
        
        if current_approver_action_item:
            current_approver_action_item.status = ActionItemStatus.COMPLETED.value
            current_approver_action_item.completed_at = datetime.utcnow()
            logger.info(f"Marked approver {current_user.id}'s action item {current_approver_action_item.id} as completed for assignment {assignment_id} (decision: {decision})")
        else:
            logger.warning(f"No pending action item found for approver {current_user.id} and assignment {assignment_id}")
        
        # Only mark ALL action items as completed if this is the final step and assignment is fully approved/rejected
        # (This happens when assignment.status changes to "approved"/"rejected" - handled separately)

    # Create audit record
    audit = AssessmentReviewAudit(
        review_id=review.id,
        assignment_id=assignment.id,
        assessment_id=assignment.assessment_id,
        tenant_id=effective_tenant_id,
        vendor_id=assignment.vendor_id,
        action="final_decision",
        actor_type="human_user",
        actor_id=current_user.id,
        actor_name=(current_user.name if hasattr(current_user, 'name') else None),
        action_data={
            "decision": decision,
            "mapped_decision": new_decision,
            "comment": comment,
            "forward_to_user_id": str(forward_to_user_id) if forward_to_user_id else None,
            "forward_to_group_id": str(forward_to_group_id) if forward_to_group_id else None
        },
        previous_state=prev_state,
        new_state={
            "assignment_status": assignment.status,
            "review_human_decision": review.human_decision,
            "review_status": review.status
        }
    )
    db.add(audit)

    try:
        db.commit()
        db.refresh(review)
        db.refresh(assignment)
        return {
            "success": True,
            "decision": decision,
            "mapped_decision": review.human_decision,
            "review_id": str(review.id),
            "assignment_status": assignment.status
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error submitting final decision: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit final decision: {str(e)}"
        )
