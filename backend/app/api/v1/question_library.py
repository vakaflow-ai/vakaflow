"""
API endpoints for Question Library management
Central repository for reusable questions across assessments
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, cast, nullslast
from sqlalchemy.dialects.postgresql import JSONB
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.question_library import QuestionLibrary, QuestionCategory
from app.models.assessment import AssessmentType
from app.api.v1.auth import get_current_user
from app.api.v1.submission_requirements import require_requirement_management_permission
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/question-library", tags=["question-library"])


# Pydantic Schemas
class QuestionLibraryCreate(BaseModel):
    title: str = Field(..., max_length=255)
    question_text: str = Field(..., description="The actual question text")
    description: Optional[str] = None
    assessment_type: List[str] = Field(..., description="Array of assessment types: ['tprm', 'vendor_qualification', etc.]")
    category: Optional[str] = Field(None, max_length=100)
    field_type: str = Field(default="text", max_length=50, description="text, textarea, select, etc.")
    response_type: str = Field(default="Text", max_length=50, description="Text, File, Number, Date, etc.")
    is_required: bool = False
    options: Optional[List[Dict[str, Any]]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    requirement_ids: Optional[List[str]] = None
    compliance_framework_ids: Optional[List[str]] = None
    risk_framework_ids: Optional[List[str]] = None
    applicable_industries: Optional[List[str]] = None
    applicable_vendor_types: Optional[List[str]] = None
    pass_fail_criteria: Optional[Dict[str, Any]] = None


class QuestionLibraryUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    question_text: Optional[str] = None
    description: Optional[str] = None
    assessment_type: Optional[List[str]] = None
    category: Optional[str] = Field(None, max_length=100)
    field_type: Optional[str] = Field(None, max_length=50)
    response_type: Optional[str] = Field(None, max_length=50)
    is_required: Optional[bool] = None
    options: Optional[List[Dict[str, Any]]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    requirement_ids: Optional[List[str]] = None
    compliance_framework_ids: Optional[List[str]] = None
    risk_framework_ids: Optional[List[str]] = None
    applicable_industries: Optional[List[str]] = None
    applicable_vendor_types: Optional[List[str]] = None
    pass_fail_criteria: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class QuestionLibraryResponse(BaseModel):
    id: str
    question_id: Optional[str]  # Human-readable question ID (e.g., Q-SEC-01)
    tenant_id: Optional[str]  # None for platform-wide questions
    title: str
    question_text: str
    description: Optional[str]
    assessment_type: List[str]  # Array of assessment types
    category: Optional[str]
    field_type: str
    response_type: str
    is_required: bool
    options: Optional[List[Dict[str, Any]]]
    validation_rules: Optional[Dict[str, Any]]
    requirement_ids: Optional[List[str]]
    compliance_framework_ids: Optional[List[str]]
    risk_framework_ids: Optional[List[str]] = None
    applicable_industries: Optional[List[str]]
    applicable_vendor_types: Optional[List[str]] = None
    pass_fail_criteria: Optional[Dict[str, Any]] = None
    is_active: bool
    usage_count: int
    created_by: str
    updated_by: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.get("", response_model=List[QuestionLibraryResponse])
async def list_questions(
    assessment_type: Optional[str] = Query(None, description="Filter by assessment type"),
    category: Optional[str] = Query(None, description="Filter by category"),
    industry: Optional[str] = Query(None, description="Filter by applicable industry"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List questions from the library (includes platform-wide questions)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    logger.info(f"Listing questions with filters: assessment_type={assessment_type}, category={category}, industry={industry}, is_active={is_active}")
    
    # Include both tenant-specific questions and platform-wide questions (tenant_id IS NULL)
    if effective_tenant_id:
        from sqlalchemy import or_
        query = db.query(QuestionLibrary).filter(
            or_(
                QuestionLibrary.tenant_id == effective_tenant_id,
                QuestionLibrary.tenant_id.is_(None)  # Platform-wide questions
            )
        )
    else:
        # Platform admin without tenant - show only platform-wide questions
        query = db.query(QuestionLibrary).filter(
            QuestionLibrary.tenant_id.is_(None)
        )
    
    # Note: We'll filter by assessment_type in Python after fetching
    # This is more reliable than SQL JSONB filtering which can be tricky
    if assessment_type:
        logger.info(f"Will filter by assessment_type '{assessment_type}' in Python after query")
    
    if category:
        query = query.filter(QuestionLibrary.category == category)
    
    if industry:
        # Filter by industry in applicable_industries JSON array
        # Use JSON contains operator - check if industry is in the array
        import json
        try:
            industry_jsonb = func.cast(json.dumps([industry]), JSONB)
            query = query.filter(
                cast(QuestionLibrary.applicable_industries, JSONB).op('@>')(industry_jsonb)
            )
        except Exception as e:
            logger.warning(f"Error filtering by industry {industry}: {e}")
            # Fallback: filter in Python after query
            pass
    
    if is_active is not None:
        query = query.filter(QuestionLibrary.is_active == is_active)
    
    # Sort by question_id (human-readable ID), with nulls last, then by category and title
    questions = query.order_by(
        nullslast(QuestionLibrary.question_id.asc()),  # Sort by question_id (human-readable ID)
        QuestionLibrary.category,
        QuestionLibrary.title
    ).all()
    
    logger.info(f"Fetched {len(questions)} questions from database before filtering")
    
    # Apply Python filter for assessment_type (more reliable than SQL JSONB filtering)
    if assessment_type:
        logger.info(f"Applying Python filter for assessment_type: '{assessment_type}' on {len(questions)} questions")
        filtered_questions = []
        for q in questions:
            q_types = q.assessment_type
            
            # Handle different formats
            if isinstance(q_types, str):
                try:
                    import json
                    q_types = json.loads(q_types)
                except (json.JSONDecodeError, ValueError):
                    q_types = [q_types] if q_types else []
            elif not isinstance(q_types, list):
                q_types = [q_types] if q_types else []
            
            # Check if the assessment_type array contains the filter value
            if assessment_type in q_types:
                filtered_questions.append(q)
            else:
                logger.debug(f"Question {q.id} excluded: assessment_type={q_types}, filter={assessment_type}")
        
        original_count = len(questions)
        questions = filtered_questions
        logger.info(f"Filtered questions by assessment_type '{assessment_type}': {original_count} -> {len(questions)}")
    
    # Apply category filter if provided
    if category:
        original_count = len(questions)
        questions = [q for q in questions if q.category == category]
        logger.info(f"Filtered questions by category '{category}': {original_count} -> {len(questions)}")
    
    result = []
    for q in questions:
        try:
            # Handle assessment_type - convert to list if it's a string (for backward compatibility)
            assessment_types = q.assessment_type
            if isinstance(assessment_types, str):
                assessment_types = [assessment_types]
            elif not isinstance(assessment_types, list):
                assessment_types = []
            
            result.append(QuestionLibraryResponse(
                id=str(q.id),
                question_id=q.question_id,
                tenant_id=str(q.tenant_id) if q.tenant_id else None,
                title=q.title,
                question_text=q.question_text,
                description=q.description,
                assessment_type=assessment_types,
                category=q.category,
                field_type=q.field_type,
                response_type=q.response_type,
                is_required=q.is_required,
                options=q.options if q.options else None,
                validation_rules=q.validation_rules if q.validation_rules else None,
                requirement_ids=q.requirement_ids if q.requirement_ids else None,
                compliance_framework_ids=q.compliance_framework_ids if q.compliance_framework_ids else None,
                risk_framework_ids=q.risk_framework_ids if q.risk_framework_ids else None,
                applicable_industries=q.applicable_industries if q.applicable_industries else None,
                applicable_vendor_types=q.applicable_vendor_types if q.applicable_vendor_types else None,
                pass_fail_criteria=q.pass_fail_criteria if q.pass_fail_criteria else None,
                is_active=q.is_active,
                usage_count=q.usage_count or 0,
                created_by=str(q.created_by),
                updated_by=str(q.updated_by) if q.updated_by else None,
                created_at=q.created_at.isoformat() if q.created_at else datetime.utcnow().isoformat(),
                updated_at=q.updated_at.isoformat() if q.updated_at else None,
            ))
        except Exception as e:
            logger.error(f"Error serializing question {q.id}: {e}", exc_info=True)
            continue
    
    return result


@router.post("", response_model=QuestionLibraryResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    question_data: QuestionLibraryCreate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Create a new question in the library (platform admins can create platform-wide questions)"""
    from app.core.tenant_utils import get_effective_tenant_id
    from app.models.user import UserRole
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Platform admins can create platform-wide questions (tenant_id = None)
    # Regular users must have a tenant
    if not effective_tenant_id and current_user.role != UserRole.PLATFORM_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required or platform admin role"
        )
    
    # Validate assessment types
    valid_types = [e.value for e in AssessmentType]
    if not question_data.assessment_type or len(question_data.assessment_type) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one assessment type is required"
        )
    for atype in question_data.assessment_type:
        if atype not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid assessment type: {atype}. Valid types: {valid_types}"
            )
    
    # Validate VARCHAR length constraints (Pydantic should catch these, but double-check)
    if len(question_data.field_type) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field 'field_type' must be 50 characters or less (received {len(question_data.field_type)} characters)"
        )
    if len(question_data.response_type) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field 'response_type' must be 50 characters or less (received {len(question_data.response_type)} characters)"
        )
    if question_data.category and len(question_data.category) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field 'category' must be 100 characters or less (received {len(question_data.category)} characters)"
        )
    
    # Validate response_type matches field_type
    field_type_to_response_type = {
        'file': 'File',
        'number': 'Number',
        'date': 'Date',
        'url': 'URL',
    }
    expected_response_type = field_type_to_response_type.get(question_data.field_type, 'Text')
    
    # For file, number, date - response_type must match exactly
    if question_data.field_type in ['file', 'number', 'date']:
        if question_data.response_type != expected_response_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"For field_type '{question_data.field_type}', response_type must be '{expected_response_type}', got '{question_data.response_type}'"
            )
    
    # For url - recommend URL but allow Text
    if question_data.field_type == 'url' and question_data.response_type not in ['URL', 'Text']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"For field_type 'url', response_type should be 'URL' or 'Text', got '{question_data.response_type}'"
        )
    
    # For option-based fields (select, multi_select, radio, checkbox) - validate options exist
    if question_data.field_type in ['select', 'multi_select', 'radio', 'checkbox']:
        if not question_data.options or len(question_data.options) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Field type '{question_data.field_type}' requires at least one option"
            )
        # Validate option format
        for opt in question_data.options:
            if not isinstance(opt, dict) or 'value' not in opt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Options must be objects with 'value' and 'label' fields"
                )
    
    # Generate human-readable question ID (use None for platform questions)
    question_id = _generate_question_id(db, effective_tenant_id, question_data.category) if effective_tenant_id else None
    
    question = QuestionLibrary(
        tenant_id=effective_tenant_id,
        question_id=question_id,
        title=question_data.title,
        question_text=question_data.question_text,
        description=question_data.description,
        assessment_type=question_data.assessment_type,
        category=question_data.category,
        field_type=question_data.field_type,
        response_type=question_data.response_type,
        is_required=question_data.is_required,
        options=question_data.options,
        validation_rules=question_data.validation_rules,
        requirement_ids=question_data.requirement_ids,
        compliance_framework_ids=question_data.compliance_framework_ids,
        risk_framework_ids=question_data.risk_framework_ids,
        applicable_industries=question_data.applicable_industries,
        applicable_vendor_types=question_data.applicable_vendor_types,
        pass_fail_criteria=question_data.pass_fail_criteria,
        created_by=current_user.id,
        is_active=True,
        usage_count=0
    )
    
    try:
        db.add(question)
        db.commit()
        db.refresh(question)
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.CREATE,
            resource_type="question_library",
            resource_id=str(question.id),
            tenant_id=str(current_user.tenant_id),
            details={"title": question.title, "assessment_type": question.assessment_type},
            ip_address=None,
            user_agent=None
        )
        
        # Handle assessment_type - convert to list if needed
        assessment_types = question.assessment_type
        if isinstance(assessment_types, str):
            assessment_types = [assessment_types]
        elif not isinstance(assessment_types, list):
            assessment_types = []
        
        return QuestionLibraryResponse(
            id=str(question.id),
            question_id=question.question_id,
            tenant_id=str(question.tenant_id) if question.tenant_id else None,
            title=question.title,
            question_text=question.question_text,
            description=question.description,
            assessment_type=assessment_types,
            category=question.category,
            field_type=question.field_type,
            response_type=question.response_type,
            is_required=question.is_required,
            options=question.options,
            validation_rules=question.validation_rules,
            requirement_ids=question.requirement_ids,
            compliance_framework_ids=question.compliance_framework_ids,
            risk_framework_ids=question.risk_framework_ids,
            applicable_industries=question.applicable_industries,
            applicable_vendor_types=question.applicable_vendor_types,
            pass_fail_criteria=question.pass_fail_criteria,
            is_active=question.is_active,
            usage_count=question.usage_count,
            created_by=str(question.created_by),
            updated_by=str(question.updated_by) if question.updated_by else None,
            created_at=question.created_at.isoformat() if question.created_at else None,
            updated_at=question.updated_at.isoformat() if question.updated_at else None
        )
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error creating question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create question due to database constraint violation"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the question"
        )


@router.get("/{question_id}", response_model=QuestionLibraryResponse)
async def get_question(
    question_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific question from the library"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    question = db.query(QuestionLibrary).filter(
        QuestionLibrary.id == question_id,
        QuestionLibrary.tenant_id == effective_tenant_id
    ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    # Handle assessment_type - convert to list if it's a string (for backward compatibility)
    assessment_types = question.assessment_type
    if isinstance(assessment_types, str):
        assessment_types = [assessment_types]
    elif not isinstance(assessment_types, list):
        assessment_types = []
    
    return QuestionLibraryResponse(
        id=str(question.id),
        question_id=question.question_id,
        tenant_id=str(question.tenant_id) if question.tenant_id else None,
        title=question.title,
        question_text=question.question_text,
        description=question.description,
        assessment_type=assessment_types,
        category=question.category,
        field_type=question.field_type,
        response_type=question.response_type,
        is_required=question.is_required,
        options=question.options,
        validation_rules=question.validation_rules,
        requirement_ids=question.requirement_ids,
        compliance_framework_ids=question.compliance_framework_ids,
        risk_framework_ids=question.risk_framework_ids,
        applicable_industries=question.applicable_industries,
        applicable_vendor_types=question.applicable_vendor_types,
        pass_fail_criteria=question.pass_fail_criteria,
        is_active=question.is_active,
        usage_count=question.usage_count,
        created_by=str(question.created_by),
        updated_by=str(question.updated_by) if question.updated_by else None,
        created_at=question.created_at.isoformat(),
        updated_at=question.updated_at.isoformat()
    )


def _generate_question_id(db: Session, tenant_id: Optional[UUID], category: Optional[str] = None) -> Optional[str]:
    """Generate a unique human-readable question ID for a tenant
    
    Format: Q-{CATEGORY}-{SEQ}
    Examples:
    - Q-SEC-01, Q-SEC-02 (Security questions)
    - Q-COM-01, Q-COM-02 (Compliance questions)
    - Q-GEN-01 (General questions)
    
    Returns None for platform questions (tenant_id = None)
    """
    if not tenant_id:
        return None
    
    # Determine category prefix
    if category:
        category_prefix = category[:3].upper().replace(' ', '').replace('-', '').replace('_', '')
    else:
        category_prefix = 'GEN'
    
    # Find the next sequence number for this tenant + category combination
    base_query = db.query(QuestionLibrary).filter(
        QuestionLibrary.tenant_id == tenant_id,
        QuestionLibrary.is_active == True
    )
    
    if category:
        base_query = base_query.filter(QuestionLibrary.category == category)
    else:
        # For general, filter where category is NULL or empty
        base_query = base_query.filter(
            (QuestionLibrary.category == None) | (QuestionLibrary.category == '')
        )
    
    # Count existing questions with this category pattern
    existing_count = base_query.count()
    seq_num = existing_count + 1
    
    # Generate question ID: Q-{CATEGORY}-{SEQ}
    question_id = f"Q-{category_prefix}-{seq_num:02d}"
    
    # Ensure uniqueness (in case of race conditions)
    max_attempts = 100
    attempt = 0
    while attempt < max_attempts:
        existing = db.query(QuestionLibrary).filter(
            QuestionLibrary.question_id == question_id,
            QuestionLibrary.tenant_id == tenant_id
        ).first()
        if not existing:
            break
        seq_num += 1
        question_id = f"Q-{category_prefix}-{seq_num:02d}"
        attempt += 1
    
    return question_id


def _normalize_assessment_types(assessment_types) -> list:
    """
    Recursively normalize assessment_types to a flat list of strings.
    Handles: strings, lists, nested lists, JSON strings, etc.
    """
    import json
    result = []
    
    if isinstance(assessment_types, str):
        # Try to parse as JSON
        cleaned = assessment_types.strip().strip('"').strip("'")
        if cleaned.startswith('[') and cleaned.endswith(']'):
            try:
                parsed = json.loads(cleaned)
                # Recursively process the parsed result
                result.extend(_normalize_assessment_types(parsed))
            except (json.JSONDecodeError, ValueError):
                # Not valid JSON, treat as single value
                result.append(assessment_types)
        else:
            result.append(assessment_types)
    elif isinstance(assessment_types, list):
        # Process each item recursively
        for item in assessment_types:
            result.extend(_normalize_assessment_types(item))
    elif assessment_types is not None:
        # Convert to string for other types
        result.append(str(assessment_types))
    
    return result


@router.patch("/{question_id}", response_model=QuestionLibraryResponse)
async def update_question(
    question_id: UUID,
    update_data: QuestionLibraryUpdate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Update a question in the library"""
    from app.core.tenant_utils import get_effective_tenant_id
    from app.models.user import UserRole
    from sqlalchemy import or_
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Allow access to platform-wide questions (tenant_id IS NULL) or tenant-specific questions
    if effective_tenant_id:
        question = db.query(QuestionLibrary).filter(
            QuestionLibrary.id == question_id,
            or_(
                QuestionLibrary.tenant_id == effective_tenant_id,
                QuestionLibrary.tenant_id.is_(None)  # Platform-wide questions
            )
        ).first()
    else:
        # Platform admin without tenant - only platform-wide questions
        question = db.query(QuestionLibrary).filter(
            QuestionLibrary.id == question_id,
            QuestionLibrary.tenant_id.is_(None)
        ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    # If tenant admin tries to update a platform-wide question, create a tenant-specific copy instead
    if question.tenant_id is None and current_user.role != UserRole.PLATFORM_ADMIN:
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant access required to create a copy of platform question"
            )
        
        # Create a tenant-specific copy of the platform question
        logger.info(f"Tenant admin {current_user.email} creating tenant-specific copy of platform question {question_id}")
        
        # Generate question ID for the tenant copy
        new_question_id = _generate_question_id(db, effective_tenant_id, question.category or update_data.category)
        
        # Create new question with tenant_id set
        new_question = QuestionLibrary(
            id=uuid.uuid4(),
            tenant_id=effective_tenant_id,
            question_id=new_question_id,
            title=update_data.title if update_data.title is not None else question.title,
            question_text=update_data.question_text if update_data.question_text is not None else question.question_text,
            description=update_data.description if update_data.description is not None else question.description,
            assessment_type=update_data.assessment_type if update_data.assessment_type is not None else question.assessment_type,
            category=update_data.category if update_data.category is not None else question.category,
            field_type=update_data.field_type if update_data.field_type is not None else question.field_type,
            response_type=update_data.response_type if update_data.response_type is not None else question.response_type,
            is_required=update_data.is_required if update_data.is_required is not None else question.is_required,
            options=update_data.options if update_data.options is not None else question.options,
            validation_rules=update_data.validation_rules if update_data.validation_rules is not None else question.validation_rules,
            requirement_ids=update_data.requirement_ids if update_data.requirement_ids is not None else question.requirement_ids,
            compliance_framework_ids=update_data.compliance_framework_ids if update_data.compliance_framework_ids is not None else question.compliance_framework_ids,
            risk_framework_ids=update_data.risk_framework_ids if update_data.risk_framework_ids is not None else question.risk_framework_ids,
            applicable_industries=update_data.applicable_industries if update_data.applicable_industries is not None else question.applicable_industries,
            applicable_vendor_types=update_data.applicable_vendor_types if update_data.applicable_vendor_types is not None else question.applicable_vendor_types,
            pass_fail_criteria=update_data.pass_fail_criteria if update_data.pass_fail_criteria is not None else question.pass_fail_criteria,
            created_by=current_user.id,
            updated_by=current_user.id,
            is_active=update_data.is_active if update_data.is_active is not None else question.is_active,
            usage_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        db.add(new_question)
        db.commit()
        db.refresh(new_question)
        
        logger.info(f"Created tenant-specific copy of platform question: {new_question.id} (original: {question_id})")
        
        # Return the new question
        # Handle assessment_type - convert to list if needed
        assessment_types = new_question.assessment_type
        if isinstance(assessment_types, str):
            assessment_types = [assessment_types]
        elif not isinstance(assessment_types, list):
            assessment_types = []
        
        return QuestionLibraryResponse(
            id=str(new_question.id),
            tenant_id=str(new_question.tenant_id) if new_question.tenant_id else None,
            question_id=new_question.question_id,
            title=new_question.title,
            question_text=new_question.question_text,
            description=new_question.description,
            assessment_type=assessment_types,
            category=new_question.category,
            field_type=new_question.field_type,
            response_type=new_question.response_type,
            is_required=new_question.is_required,
            options=new_question.options,
            validation_rules=new_question.validation_rules,
            requirement_ids=new_question.requirement_ids,
            compliance_framework_ids=new_question.compliance_framework_ids,
            risk_framework_ids=new_question.risk_framework_ids,
            applicable_industries=new_question.applicable_industries,
            applicable_vendor_types=new_question.applicable_vendor_types,
            pass_fail_criteria=new_question.pass_fail_criteria,
            is_active=new_question.is_active,
            usage_count=new_question.usage_count,
            created_by=str(new_question.created_by),
            updated_by=str(new_question.updated_by) if new_question.updated_by else None,
            created_at=new_question.created_at.isoformat() if new_question.created_at else None,
            updated_at=new_question.updated_at.isoformat() if new_question.updated_at else None,
        )
    
    # Update fields - include all provided fields (even empty strings for optional fields)
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    # Validate response_type matches field_type if both are being updated
    if 'field_type' in update_dict or 'response_type' in update_dict:
        field_type = update_dict.get('field_type', question.field_type)
        response_type = update_dict.get('response_type', question.response_type)
        
        field_type_to_response_type = {
            'file': 'File',
            'number': 'Number',
            'date': 'Date',
            'url': 'URL',
        }
        expected_response_type = field_type_to_response_type.get(field_type, 'Text')
        
        # For file, number, date - response_type must match exactly
        if field_type in ['file', 'number', 'date']:
            if response_type != expected_response_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"For field_type '{field_type}', response_type must be '{expected_response_type}', got '{response_type}'"
                )
        
        # For url - recommend URL but allow Text
        if field_type == 'url' and response_type not in ['URL', 'Text']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"For field_type 'url', response_type should be 'URL' or 'Text', got '{response_type}'"
            )
        
        # For option-based fields - validate options exist
        if field_type in ['select', 'multi_select', 'radio', 'checkbox']:
            options = update_dict.get('options', question.options)
            if not options or len(options) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Field type '{field_type}' requires at least one option"
                )
            # Validate option format
            for opt in options:
                if not isinstance(opt, dict) or 'value' not in opt:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Options must be objects with 'value' and 'label' fields"
                    )
    
    # Log the update for debugging
    logger.info(f"Updating question {question_id} with fields: {list(update_dict.keys())}")
    if 'assessment_type' in update_dict:
        logger.info(f"Assessment types being updated (type: {type(update_dict['assessment_type'])}): {update_dict['assessment_type']}")
    
    # Validate assessment types if provided
    if 'assessment_type' in update_dict:
        valid_types = [e.value for e in AssessmentType]
        assessment_types_raw = update_dict['assessment_type']
        
        logger.info(f"Raw assessment_type received (type: {type(assessment_types_raw)}): {assessment_types_raw}")
        
        # Normalize using recursive helper function
        assessment_types = _normalize_assessment_types(assessment_types_raw)
        
        logger.info(f"Normalized assessment_types: {assessment_types}")
        
        if len(assessment_types) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="assessment_type must be a non-empty array"
            )
        
        # Validate each assessment type
        invalid_types = []
        for atype in assessment_types:
            # Ensure atype is a string (not a list or other type)
            if not isinstance(atype, str):
                logger.warning(f"Assessment type is not a string: {atype} (type: {type(atype)})")
                atype = str(atype)
            
            if atype not in valid_types:
                invalid_types.append(atype)
        
        if invalid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid assessment type(s): {invalid_types}. Valid types: {valid_types}"
            )
        
        # Update the dict with the normalized list
        update_dict['assessment_type'] = assessment_types
        logger.info(f"Validated and normalized assessment_types: {assessment_types}")
    
    # Validate VARCHAR(50) fields before updating
    varchar_50_fields = ['field_type', 'response_type']
    for field in varchar_50_fields:
        if field in update_dict and update_dict[field] is not None:
            value = str(update_dict[field])
            if len(value) > 50:
                logger.error(f"Field {field} value too long ({len(value)} chars): {value}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Field '{field}' must be 50 characters or less (received {len(value)} characters: '{value[:50]}...')"
                )
    
    # Validate VARCHAR(100) field (category)
    if 'category' in update_dict and update_dict['category'] is not None:
        value = str(update_dict['category'])
        if len(value) > 100:
            logger.error(f"Field category value too long ({len(value)} chars): {value}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Field 'category' must be 100 characters or less (received {len(value)} characters: '{value[:100]}...')"
            )
    
    for key, value in update_dict.items():
        if hasattr(question, key):
            setattr(question, key, value)
    
    question.updated_by = current_user.id
    question.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(question)
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.UPDATE,
            resource_type="question_library",
            resource_id=str(question_id),
            tenant_id=str(current_user.tenant_id),
            details={"updated_fields": list(update_dict.keys())},
            ip_address=None,
            user_agent=None
        )
        
        # Handle assessment_type - convert to list if it's a string (for backward compatibility)
        assessment_types = question.assessment_type
        if isinstance(assessment_types, str):
            assessment_types = [assessment_types]
        elif not isinstance(assessment_types, list):
            assessment_types = []
        
        return QuestionLibraryResponse(
            id=str(question.id),
            question_id=question.question_id,
            tenant_id=str(question.tenant_id) if question.tenant_id else None,
            title=question.title,
            question_text=question.question_text,
            description=question.description,
            assessment_type=assessment_types,
            category=question.category,
            field_type=question.field_type,
            response_type=question.response_type,
            is_required=question.is_required,
            options=question.options if question.options else None,
            validation_rules=question.validation_rules if question.validation_rules else None,
            requirement_ids=question.requirement_ids if question.requirement_ids else None,
            compliance_framework_ids=question.compliance_framework_ids if question.compliance_framework_ids else None,
            risk_framework_ids=question.risk_framework_ids if question.risk_framework_ids else None,
            applicable_industries=question.applicable_industries if question.applicable_industries else None,
            applicable_vendor_types=question.applicable_vendor_types if question.applicable_vendor_types else None,
            pass_fail_criteria=question.pass_fail_criteria if question.pass_fail_criteria else None,
            is_active=question.is_active,
            usage_count=question.usage_count or 0,
            created_by=str(question.created_by),
            updated_by=str(question.updated_by) if question.updated_by else None,
            created_at=question.created_at.isoformat() if question.created_at else datetime.utcnow().isoformat(),
            updated_at=question.updated_at.isoformat() if question.updated_at else datetime.utcnow().isoformat()
        )
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error updating question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update question due to database constraint violation"
        )
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        logger.error(f"Unexpected error updating question: {error_msg}", exc_info=True)
        # Provide more detailed error message
        if "validation error" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Validation error: {error_msg}"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while updating the question: {error_msg}"
        )


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: UUID,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Delete a question from the library (soft delete)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    question = db.query(QuestionLibrary).filter(
        QuestionLibrary.id == question_id,
        QuestionLibrary.tenant_id == effective_tenant_id
    ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    # Soft delete
    question.is_active = False
    question.updated_by = current_user.id
    question.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.DELETE,
            resource_type="question_library",
            resource_id=str(question_id),
            tenant_id=str(current_user.tenant_id),
            details={"title": question.title},
            ip_address=None,
            user_agent=None
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error deleting question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the question"
        )


@router.patch("/{question_id}/toggle", response_model=QuestionLibraryResponse)
async def toggle_question(
    question_id: UUID,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Toggle question active/inactive status"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    question = db.query(QuestionLibrary).filter(
        QuestionLibrary.id == question_id,
        QuestionLibrary.tenant_id == effective_tenant_id
    ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    # Toggle active status
    question.is_active = not (question.is_active or False)
    question.updated_by = current_user.id
    question.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(question)
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.UPDATE,
            resource_type="question_library",
            resource_id=str(question_id),
            tenant_id=str(current_user.tenant_id),
            details={"is_active": question.is_active, "title": question.title},
            ip_address=None,
            user_agent=None
        )
        
        # Handle assessment_type - convert to list if it's a string (for backward compatibility)
        assessment_types = question.assessment_type
        if isinstance(assessment_types, str):
            assessment_types = [assessment_types]
        elif not isinstance(assessment_types, list):
            assessment_types = []
        
        return QuestionLibraryResponse(
            id=str(question.id),
            question_id=question.question_id,
            tenant_id=str(question.tenant_id) if question.tenant_id else None,
            title=question.title,
            question_text=question.question_text,
            description=question.description,
            assessment_type=assessment_types,
            category=question.category,
            field_type=question.field_type,
            response_type=question.response_type,
            is_required=question.is_required,
            options=question.options,
            validation_rules=question.validation_rules,
            requirement_ids=question.requirement_ids,
            compliance_framework_ids=question.compliance_framework_ids,
            risk_framework_ids=question.risk_framework_ids,
            applicable_industries=question.applicable_industries,
            applicable_vendor_types=question.applicable_vendor_types,
            pass_fail_criteria=question.pass_fail_criteria,
            is_active=question.is_active,
            usage_count=question.usage_count,
            created_by=str(question.created_by),
            updated_by=str(question.updated_by) if question.updated_by else None,
            created_at=question.created_at.isoformat(),
            updated_at=question.updated_at.isoformat()
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error toggling question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while toggling the question"
        )
