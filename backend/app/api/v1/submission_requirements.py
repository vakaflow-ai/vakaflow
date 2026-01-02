"""
Submission requirements API endpoints
Allows tenant admins, security, and compliance teams to define submission forms
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.submission_requirement import SubmissionRequirement, SubmissionRequirementResponse, RequirementFieldType
from app.models.user import User, UserRole
from app.models.agent import Agent
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
from app.services.requirement_auto_generator import requirement_auto_generator
from app.services.requirement_service import RequirementService
from sqlalchemy.exc import ProgrammingError, OperationalError, IntegrityError, InternalError
import logging
import re
import time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/submission-requirements", tags=["submission-requirements"])


class RequirementFieldTypeEnum(str):
    """Field type enum for Pydantic"""
    TEXT = "text"
    TEXTAREA = "textarea"
    NUMBER = "number"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    DATE = "date"
    FILE = "file"
    URL = "url"
    EMAIL = "email"


class RequirementCreate(BaseModel):
    """Create submission requirement schema"""
    label: str = Field(..., min_length=1, max_length=255, description="Title: Human-readable question/requirement text")
    field_type: str = Field(..., pattern="^(text|textarea|number|select|multi_select|checkbox|radio|date|file|url|email)$")
    requirement_type: str = Field(..., pattern="^(compliance|risk|questionnaires)$", description="Requirement type: compliance, risk, or questionnaires (MANDATORY)")
    description: Optional[str] = None
    placeholder: Optional[str] = Field(None, max_length=255)
    is_required: bool = False
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    pattern: Optional[str] = None
    options: Optional[List[Dict[str, Any]]] = None  # For select/radio/checkbox: [{"value": "opt1", "label": "Option 1"}]
    category: Optional[str] = Field(None, pattern="^(security|compliance|technical|business)$")
    section: Optional[str] = Field(None, max_length=100)
    questionnaire_type: Optional[str] = Field(None, max_length=100, description="Questionnaire type: TPRM- Questionnaire, Vendor Security Questionnaire, Sub Contractor Questionnaire, Vendor Qualification")
    order: int = Field(0, ge=0)
    # Questionnaire-style: Multiple response types allowed
    allowed_response_types: Optional[List[str]] = Field(None, description="Response types allowed: ['text', 'file', 'url']. Defaults to [field_type]")
    # Filtering: Show requirement based on agent metadata
    filter_conditions: Optional[Dict[str, Any]] = Field(None, description="Filter conditions: {'agent_category': ['Security'], 'agent_type': ['AI_AGENT']}")


class RequirementUpdate(BaseModel):
    """Update submission requirement schema"""
    label: Optional[str] = Field(None, min_length=1, max_length=255)
    requirement_type: Optional[str] = Field(None, pattern="^(compliance|risk|questionnaires)$", description="Requirement type: compliance, risk, or questionnaires (MANDATORY)")
    description: Optional[str] = None
    placeholder: Optional[str] = Field(None, max_length=255)
    is_required: Optional[bool] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    pattern: Optional[str] = None
    options: Optional[List[Dict[str, Any]]] = None
    category: Optional[str] = Field(None, pattern="^(security|compliance|technical|business)$")
    section: Optional[str] = Field(None, max_length=100)
    questionnaire_type: Optional[str] = Field(None, max_length=100, description="Questionnaire type: TPRM- Questionnaire, Vendor Security Questionnaire, Sub Contractor Questionnaire, Vendor Qualification")
    order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    is_enabled: Optional[bool] = None
    allowed_response_types: Optional[List[str]] = None
    filter_conditions: Optional[Dict[str, Any]] = None


class RequirementResponse(BaseModel):
    """Submission requirement response schema"""
    id: str
    catalog_id: Optional[str] = None  # Human-readable catalog ID: REQ-COM-01, REQ-SEC-02, etc.
    tenant_id: str
    label: str  # Title: Human-readable question/requirement text
    field_name: str  # Computed from catalog_id (not stored in database)
    field_type: str
    requirement_type: str  # MANDATORY: compliance, risk, or questionnaires (auto-detected if column doesn't exist)
    description: Optional[str]
    placeholder: Optional[str]
    is_required: bool
    min_length: Optional[int]
    max_length: Optional[int]
    min_value: Optional[int]
    max_value: Optional[int]
    pattern: Optional[str]
    options: Optional[List[Dict[str, Any]]]
    category: Optional[str]
    section: Optional[str]
    questionnaire_type: Optional[str] = None
    order: int
    is_active: bool
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    source_name: Optional[str] = None
    is_auto_generated: bool = False
    is_enabled: bool = True
    allowed_response_types: Optional[List[str]] = None
    filter_conditions: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


def _generate_catalog_id(db: Session, tenant_id: UUID, requirement_type: str, category: Optional[str] = None, questionnaire_type: Optional[str] = None) -> str:
    """Generate a unique catalog ID for a requirement
    
    Format: REQ-{CATEGORY}-{SEQ}
    Examples:
    - REQ-SEC-01, REQ-SEC-02 (Security requirements)
    - REQ-COM-01, REQ-COM-02 (Compliance requirements)
    - REQ-TEC-01 (Technical requirements)
    - REQ-BUS-01 (Business requirements)
    - REQ-GEN-01 (General requirements)
    - REQ-TPRM-01 (TPRM Questionnaire)
    - REQ-VSEC-01 (Vendor Security Questionnaire)
    """
    # Determine category prefix based on category or questionnaire_type
    if questionnaire_type:
        # For questionnaires, use questionnaire type abbreviation
        if 'TPRM' in questionnaire_type.upper():
            category_prefix = 'TPRM'
        elif 'SECURITY' in questionnaire_type.upper() or 'SEC' in questionnaire_type.upper():
            category_prefix = 'VSEC'  # Vendor Security
        elif 'SUB' in questionnaire_type.upper() or 'CONTRACTOR' in questionnaire_type.upper():
            category_prefix = 'SCON'  # Sub Contractor
        elif 'QUALIFICATION' in questionnaire_type.upper() or 'QUAL' in questionnaire_type.upper():
            category_prefix = 'VQUA'  # Vendor Qualification
        else:
            # Use first 4 chars of questionnaire type, cleaned
            category_prefix = questionnaire_type[:4].upper().replace(' ', '').replace('-', '')
    elif category:
        # Use first 3 chars of category
        category_prefix = category[:3].upper()
    else:
        category_prefix = 'GEN'
    
    # Find the next sequence number for this tenant + category combination
    base_query = db.query(SubmissionRequirement).filter(
        SubmissionRequirement.tenant_id == tenant_id,
        SubmissionRequirement.is_active == True
    )
    
    # Filter by category or questionnaire_type
    if questionnaire_type:
        base_query = base_query.filter(SubmissionRequirement.questionnaire_type == questionnaire_type)
    elif category:
        base_query = base_query.filter(SubmissionRequirement.category == category)
    else:
        # For general, filter where category is NULL or empty
        base_query = base_query.filter(
            (SubmissionRequirement.category == None) | (SubmissionRequirement.category == '')
        )
    
    # Count existing requirements with this category pattern
    existing_count = base_query.count()
    seq_num = existing_count + 1
    
    # Generate catalog ID: REQ-{CATEGORY}-{SEQ}
    catalog_id = f"REQ-{category_prefix}-{seq_num:02d}"
    
    # Ensure uniqueness (in case of race conditions)
    max_attempts = 100
    attempt = 0
    while attempt < max_attempts:
        existing = db.query(SubmissionRequirement).filter(
            SubmissionRequirement.catalog_id == catalog_id,
            SubmissionRequirement.tenant_id == tenant_id
        ).first()
        if not existing:
            break
        seq_num += 1
        catalog_id = f"REQ-{category_prefix}-{seq_num:02d}"
        attempt += 1
    
    return catalog_id


def _build_requirement_response(requirement: SubmissionRequirement) -> RequirementResponse:
    """Helper function to build RequirementResponse from SubmissionRequirement"""
    # Handle requirement_type - use getattr to handle cases where column doesn't exist yet
    requirement_type = getattr(requirement, 'requirement_type', None)
    if not requirement_type:
        # Auto-detect based on existing data if migration hasn't run yet
        if requirement.section == 'Risks' or requirement.source_type == 'risk':
            requirement_type = 'risk'
        elif requirement.section == 'Compliance Frameworks' or requirement.source_type == 'framework':
            requirement_type = 'compliance'
        elif requirement.questionnaire_type:
            requirement_type = 'questionnaires'
        else:
            requirement_type = 'compliance'  # Default
    
    # Get catalog_id if column exists
    catalog_id = getattr(requirement, 'catalog_id', None)
    
    return RequirementResponse(
        id=str(requirement.id),
        catalog_id=catalog_id,
        tenant_id=str(requirement.tenant_id),
        label=requirement.label,
        field_name=requirement.field_name,
        field_type=requirement.field_type,
        requirement_type=requirement_type,
        description=requirement.description,
        placeholder=requirement.placeholder,
        is_required=requirement.is_required,
        min_length=requirement.min_length,
        max_length=requirement.max_length,
        min_value=requirement.min_value,
        max_value=requirement.max_value,
        pattern=requirement.pattern,
        options=requirement.options,
        category=requirement.category,
        section=requirement.section,
        questionnaire_type=requirement.questionnaire_type,
        order=requirement.order,
        is_active=requirement.is_active,
        source_type=requirement.source_type,
        source_id=requirement.source_id,
        source_name=requirement.source_name,
        is_auto_generated=requirement.is_auto_generated or False,
        is_enabled=requirement.is_enabled if requirement.is_enabled is not None else True,
        allowed_response_types=requirement.allowed_response_types,
        filter_conditions=requirement.filter_conditions,
        created_at=requirement.created_at.isoformat(),
        updated_at=requirement.updated_at.isoformat()
    )


def _matches_filter_conditions(requirement: SubmissionRequirement, agent_category: Optional[str] = None, agent_type: Optional[str] = None, agent_metadata: Optional[Dict[str, Any]] = None) -> bool:
    """Check if requirement matches filter conditions based on agent metadata"""
    if not requirement.filter_conditions:
        return True  # No filter conditions means show for all
    
    conditions = requirement.filter_conditions
    if isinstance(conditions, dict):
        # Check agent_category filter
        if 'agent_category' in conditions:
            allowed_categories = conditions['agent_category']
            if isinstance(allowed_categories, list):
                if agent_category and agent_category not in allowed_categories:
                    return False
            elif agent_category != allowed_categories:
                return False
        
        # Check agent_type filter
        if 'agent_type' in conditions:
            allowed_types = conditions['agent_type']
            if isinstance(allowed_types, list):
                if agent_type and agent_type not in allowed_types:
                    return False
            elif agent_type != allowed_types:
                return False
        
        # Check other metadata filters
        if agent_metadata:
            for key, value in conditions.items():
                if key not in ['agent_category', 'agent_type']:
                    if key in agent_metadata:
                        filter_value = conditions[key]
                        if isinstance(filter_value, list):
                            if agent_metadata[key] not in filter_value:
                                return False
                        elif agent_metadata[key] != filter_value:
                            return False
    
    return True


class RequirementResponseValue(BaseModel):
    """Agent requirement response value schema"""
    id: str
    requirement_id: str
    requirement_label: str
    field_name: Optional[str] = None  # Field name computed from requirement (for mapping to form fields)
    value: Optional[Any]
    file_path: Optional[str]
    file_name: Optional[str]
    submitted_at: str


def require_requirement_management_permission(current_user: User = Depends(get_current_user)) -> User:
    """Require permission to manage submission requirements"""
    allowed_roles = ["tenant_admin", "platform_admin", "security_reviewer", "compliance_reviewer", "policy_admin"]
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requirement management access required. Your role: {user_role}"
        )
    return current_user


@router.post("", response_model=RequirementResponse, status_code=status.HTTP_201_CREATED)
async def create_requirement(
    requirement_data: RequirementCreate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Create a new submission requirement (tenant-specific)
    
    Uses service layer for business logic separation.
    Auto-generates catalog_id and field_name if not provided.
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required to create requirements"
        )
    
    try:
        service = RequirementService(db)
        
        # Prepare requirement data
        req_dict = requirement_data.dict()
        
        # Generate catalog_id first if not provided
        if not req_dict.get('catalog_id'):
            catalog_id = _generate_catalog_id(
                db=db,
                tenant_id=effective_tenant_id,
                requirement_type=req_dict.get('requirement_type', 'compliance'),
                category=req_dict.get('category'),
                questionnaire_type=req_dict.get('questionnaire_type')
            )
            req_dict['catalog_id'] = catalog_id
        
        # Note: field_name is now a computed property from catalog_id in the model
        # No need to set it explicitly - it will be computed automatically
        
        requirement = service.create_requirement(
            requirement_data=req_dict,
            tenant_id=effective_tenant_id,
            created_by=current_user.id
        )
        
        return _build_requirement_response(requirement)
    
    except ValueError as e:
        logger.warning(f"Validation error creating requirement: {e}", extra={
            "user_id": str(current_user.id),
            "tenant_id": str(current_user.tenant_id)
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except IntegrityError as e:
        logger.error(f"Database integrity error creating requirement: {e}", extra={
            "user_id": str(current_user.id),
            "tenant_id": str(current_user.tenant_id)
        })
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A requirement with this identifier already exists"
        )
    except Exception as e:
        logger.error(f"Unexpected error creating requirement: {e}", extra={
            "user_id": str(current_user.id),
            "tenant_id": str(current_user.tenant_id),
            "error_type": type(e).__name__
        }, exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the requirement"
        )


@router.get("", response_model=List[RequirementResponse])
async def list_requirements(
    category: Optional[str] = Query(None, pattern="^(security|compliance|technical|business)$"),
    section: Optional[str] = None,
    requirement_type: Optional[str] = Query(None, pattern="^(compliance|risk)$", description="Filter by requirement type: compliance or risk (questionnaires are in question library)"),
    questionnaire_type: Optional[str] = Query(None, description="Filter by questionnaire type (deprecated - use question library)"),
    source_type: Optional[str] = Query(None, pattern="^(framework|risk|category|manual|library)$"),
    is_active: Optional[bool] = True,
    is_enabled: Optional[bool] = None,
    agent_category: Optional[str] = Query(None, description="Filter requirements based on agent category"),
    agent_type: Optional[str] = Query(None, description="Filter requirements based on agent type"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List submission requirements for current tenant (high-level requirements only, not questions).
    
    This endpoint only returns high-level requirements (compliance/risk types).
    Questions are managed in the Question Library (/api/v1/question-library).
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    # Get tenant's industry for filtering
    from app.models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.id == effective_tenant_id).first()
    # Safely get industry - handle case where column doesn't exist yet (before migration)
    tenant_industry = None
    if tenant:
        try:
            tenant_industry = getattr(tenant, 'industry', None)
        except Exception:
            # Column doesn't exist yet - migration not run
            tenant_industry = None
    
    # Filter out questionnaires - only show high-level requirements (compliance/risk)
    # Questions are managed in question_library, not here
    query = db.query(SubmissionRequirement).filter(
        SubmissionRequirement.tenant_id == current_user.tenant_id
    ).filter(
        # Exclude questionnaires - they should be in question_library
        or_(
            SubmissionRequirement.requirement_type != 'questionnaires',
            SubmissionRequirement.requirement_type.is_(None)
        )
    )
    
    if category:
        query = query.filter(SubmissionRequirement.category == category)
    if section:
        query = query.filter(SubmissionRequirement.section == section)
    if questionnaire_type:
        # Deprecated - questionnaire_type filter should not be used for requirements
        # This is kept for backward compatibility but will return empty results
        query = query.filter(SubmissionRequirement.questionnaire_type == questionnaire_type)
    if source_type:
        query = query.filter(SubmissionRequirement.source_type == source_type)
    if is_active is not None:
        query = query.filter(SubmissionRequirement.is_active == is_active)
    if is_enabled is not None:
        query = query.filter(SubmissionRequirement.is_enabled == is_enabled)
    
    # Try to filter and order by requirement_type, but handle case where column doesn't exist in DB
    filter_by_requirement_type = requirement_type is not None
    try:
        if filter_by_requirement_type:
            # Only allow compliance or risk types (not questionnaires)
            if requirement_type in ['compliance', 'risk']:
                query = query.filter(SubmissionRequirement.requirement_type == requirement_type)
        
        # Try to order by requirement_type
        try:
            requirements = query.order_by(
                SubmissionRequirement.requirement_type,
                SubmissionRequirement.source_type,
                SubmissionRequirement.section,
                SubmissionRequirement.order,
                SubmissionRequirement.label
            ).all()
        except (ProgrammingError, OperationalError, InternalError) as e:
            # Column doesn't exist or transaction aborted - rollback and recreate query
            try:
                db.rollback()
            except Exception:
                pass  # Ignore rollback errors if already rolled back
            # Recreate the base query after rollback
            query = db.query(SubmissionRequirement).filter(
                SubmissionRequirement.tenant_id == current_user.tenant_id
            ).filter(
                # Exclude questionnaires
                or_(
                    SubmissionRequirement.requirement_type != 'questionnaires',
                    SubmissionRequirement.requirement_type.is_(None)
                )
            )
            if category:
                query = query.filter(SubmissionRequirement.category == category)
            if section:
                query = query.filter(SubmissionRequirement.section == section)
            if questionnaire_type:
                query = query.filter(SubmissionRequirement.questionnaire_type == questionnaire_type)
            if source_type:
                query = query.filter(SubmissionRequirement.source_type == source_type)
            if is_active is not None:
                query = query.filter(SubmissionRequirement.is_active == is_active)
            if is_enabled is not None:
                query = query.filter(SubmissionRequirement.is_enabled == is_enabled)
            if filter_by_requirement_type and requirement_type in ['compliance', 'risk']:
                query = query.filter(SubmissionRequirement.requirement_type == requirement_type)
            requirements = query.order_by(
                SubmissionRequirement.source_type,
                SubmissionRequirement.section,
                SubmissionRequirement.order,
                SubmissionRequirement.label
            ).all()
    except (ProgrammingError, OperationalError, InternalError) as e:
        # Column doesn't exist or transaction aborted - rollback and recreate query without requirement_type filter
        try:
            db.rollback()
        except Exception:
            pass  # Ignore rollback errors if already rolled back
        # Recreate the base query after rollback
        query = db.query(SubmissionRequirement).filter(
            SubmissionRequirement.tenant_id == current_user.tenant_id
        ).filter(
            # Exclude questionnaires
            or_(
                SubmissionRequirement.requirement_type != 'questionnaires',
                SubmissionRequirement.requirement_type.is_(None)
            )
        )
        if category:
            query = query.filter(SubmissionRequirement.category == category)
        if section:
            query = query.filter(SubmissionRequirement.section == section)
        if questionnaire_type:
            query = query.filter(SubmissionRequirement.questionnaire_type == questionnaire_type)
        if source_type:
            query = query.filter(SubmissionRequirement.source_type == source_type)
        if is_active is not None:
            query = query.filter(SubmissionRequirement.is_active == is_active)
        if is_enabled is not None:
            query = query.filter(SubmissionRequirement.is_enabled == is_enabled)
        requirements = query.order_by(
            SubmissionRequirement.source_type,
            SubmissionRequirement.section,
            SubmissionRequirement.order,
            SubmissionRequirement.label
        ).all()
        
        # Filter manually based on section/source_type
        if filter_by_requirement_type:
            filtered = []
            for req in requirements:
                req_type = None
                if req.section == 'Risks' or req.source_type == 'risk':
                    req_type = 'risk'
                elif req.section == 'Compliance Frameworks' or req.source_type == 'framework':
                    req_type = 'compliance'
                elif req.questionnaire_type:
                    req_type = 'questionnaires'
                else:
                    req_type = 'compliance'
                
                if req_type == requirement_type:
                    filtered.append(req)
            requirements = filtered
    except Exception as e:
        # Any other database error - rollback and log
        db.rollback()
        logger.error(f"Database error listing requirements: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching requirements"
        )
    
    # Apply industry filtering
    if tenant_industry:
        filtered_by_industry = []
        for req in requirements:
            # If requirement has no applicable_industries set, show it (backward compatibility)
            if not req.applicable_industries:
                filtered_by_industry.append(req)
            # If requirement applies to all industries
            elif "all" in req.applicable_industries:
                filtered_by_industry.append(req)
            # If requirement applies to tenant's industry
            elif tenant_industry in req.applicable_industries:
                filtered_by_industry.append(req)
        requirements = filtered_by_industry
    else:
        # If tenant has no industry set, only show requirements that apply to all or have no industry filter
        filtered_by_industry = []
        for req in requirements:
            if not req.applicable_industries or "all" in req.applicable_industries:
                filtered_by_industry.append(req)
        requirements = filtered_by_industry
    
    # Apply filter conditions based on agent metadata
    if agent_category or agent_type:
        filtered_requirements = []
        agent_metadata = {}
        if agent_category:
            agent_metadata['agent_category'] = agent_category
        if agent_type:
            agent_metadata['agent_type'] = agent_type
        
        for req in requirements:
            if _matches_filter_conditions(req, agent_category, agent_type, agent_metadata):
                filtered_requirements.append(req)
        requirements = filtered_requirements
    
    return [_build_requirement_response(r) for r in requirements]


@router.get("/{requirement_id}", response_model=RequirementResponse)
async def get_requirement(
    requirement_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific submission requirement"""
    requirement = db.query(SubmissionRequirement).filter(
        SubmissionRequirement.id == requirement_id
    ).first()
    
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found"
        )
    
    # Tenant isolation
    if current_user.tenant_id != requirement.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return _build_requirement_response(requirement)


@router.patch("/{requirement_id}", response_model=RequirementResponse)
async def update_requirement(
    requirement_id: UUID,
    requirement_data: RequirementUpdate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Update a submission requirement
    
    Uses service layer for business logic separation.
    """
    # Check tenant isolation first
    requirement = db.query(SubmissionRequirement).filter(
        SubmissionRequirement.id == requirement_id
    ).first()
    
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found"
        )
    
    # Tenant isolation check
    if current_user.tenant_id != requirement.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    try:
        service = RequirementService(db)
        update_data = requirement_data.dict(exclude_unset=True)
        updated_requirement = service.update_requirement(
            requirement_id=requirement_id,
            update_data=update_data,
            updated_by=current_user.id
        )
        return _build_requirement_response(updated_requirement)
    except ValueError as e:
        logger.warning(f"Validation error updating requirement: {e}", extra={
            "user_id": str(current_user.id),
            "requirement_id": str(requirement_id)
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except IntegrityError as e:
        logger.error(f"Database integrity error updating requirement: {e}", extra={
            "user_id": str(current_user.id),
            "requirement_id": str(requirement_id)
        })
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update requirement due to constraint violation"
        )
    except Exception as e:
        logger.error(f"Unexpected error updating requirement: {e}", extra={
            "user_id": str(current_user.id),
            "requirement_id": str(requirement_id),
            "error_type": type(e).__name__
        }, exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the requirement"
        )
    
    requirement.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(requirement)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="submission_requirement",
        resource_id=str(requirement.id),
        tenant_id=str(current_user.tenant_id),
        details={"updated_fields": list(update_data.keys())},
        ip_address=None,
        user_agent=None
    )
    
    return _build_requirement_response(requirement)


@router.delete("/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_requirement(
    requirement_id: UUID,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Delete a submission requirement (soft delete)
    
    Uses service layer for business logic separation.
    """
    # Check tenant isolation first
    requirement = db.query(SubmissionRequirement).filter(
        SubmissionRequirement.id == requirement_id
    ).first()
    
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found"
        )
    
    # Tenant isolation check
    if current_user.tenant_id != requirement.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    try:
        service = RequirementService(db)
        service.delete_requirement(
            requirement_id=requirement_id,
            deleted_by=current_user.id
        )
    except ValueError as e:
        logger.warning(f"Validation error deleting requirement: {e}", extra={
            "user_id": str(current_user.id),
            "requirement_id": str(requirement_id)
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error deleting requirement: {e}", extra={
            "user_id": str(current_user.id),
            "requirement_id": str(requirement_id),
            "error_type": type(e).__name__
        }, exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the requirement"
        )
    
    # Audit log is handled by service
    return None


@router.post("/agents/{agent_id}/responses", status_code=status.HTTP_201_CREATED)
async def save_requirement_responses(
    agent_id: UUID,
    responses: Dict[str, Any],  # {requirement_id: value}
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save requirement responses for an agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get vendor to check tenant
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Tenant isolation
    if current_user.tenant_id != vendor.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get all active requirements for tenant
    requirements = db.query(SubmissionRequirement).filter(
        SubmissionRequirement.tenant_id == current_user.tenant_id,
        SubmissionRequirement.is_active == True
    ).all()
    
    requirement_map = {str(r.id): r for r in requirements}
    
    # Delete existing responses
    db.query(SubmissionRequirementResponse).filter(
        SubmissionRequirementResponse.agent_id == agent_id
    ).delete()
    
    # Create new responses
    for req_id_str, value in responses.items():
        if req_id_str in requirement_map:
            requirement = requirement_map[req_id_str]
            
            # Validate required fields
            # For questionnaire-style responses, check if at least one response type has a value
            if requirement.is_required:
                if isinstance(value, dict):
                    # Questionnaire-style: must have at least text, files, or links
                    has_text = value.get('text', '').strip() if isinstance(value.get('text'), str) else False
                    has_files = value.get('files') and len(value.get('files', [])) > 0
                    has_links = value.get('links') and len(value.get('links', [])) > 0
                    if not (has_text or has_files or has_links):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Required field '{requirement.label}' must have at least one response (text, file, or link)"
                        )
                elif value is None or value == "" or (isinstance(value, list) and len(value) == 0):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Required field '{requirement.label}' is missing"
                    )
            
            response = SubmissionRequirementResponse(
                agent_id=agent_id,
                requirement_id=requirement.id,
                value=value,  # Can be string or object {text, files, links}
                submitted_by=current_user.id
            )
            db.add(response)
    
    db.commit()
    
    return {"message": "Responses saved successfully"}


@router.get("/agents/{agent_id}/responses", response_model=List[RequirementResponseValue])
async def get_agent_requirement_responses(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get requirement responses for an agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get vendor to check tenant
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Tenant isolation - allow admins, approvers, reviewers, and vendor users
    allowed_roles = [
        "platform_admin", 
        "tenant_admin", 
        "approver", 
        "security_reviewer", 
        "compliance_reviewer",
        "technical_reviewer",
        "business_reviewer",
        "vendor_user"  # Vendors can see their own agent responses
    ]
    
    # Vendor users can only see their own agents
    if current_user.role.value == "vendor_user":
        if current_user.email != vendor.contact_email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    elif current_user.tenant_id != vendor.tenant_id and current_user.role.value not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    responses = db.query(SubmissionRequirementResponse).filter(
        SubmissionRequirementResponse.agent_id == agent_id
    ).all()
    
    result = []
    for response in responses:
        requirement = db.query(SubmissionRequirement).filter(
            SubmissionRequirement.id == response.requirement_id
        ).first()
        
        if requirement:
            result.append(RequirementResponseValue(
                id=str(response.id),
                requirement_id=str(response.requirement_id),
                requirement_label=requirement.label,
                field_name=requirement.field_name,  # Include field_name for mapping to form fields
                value=response.value,
                file_path=response.file_path,
                file_name=response.file_name,
                submitted_at=response.submitted_at.isoformat()
            ))
    
    return result


class AutoGenerateRequest(BaseModel):
    """Request schema for auto-generating requirements"""
    source_types: Optional[List[str]] = None
    framework_ids: Optional[List[str]] = None
    risk_ids: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    
    class Config:
        """Pydantic config"""
        # Allow None values and empty lists
        allow_none = True


@router.post("/auto-generate", status_code=status.HTTP_201_CREATED)
async def auto_generate_requirements(
    request: AutoGenerateRequest,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """
    Auto-generate requirements from frameworks, risks, categories, or library
    
    source_types: List of sources to generate from: ["framework", "risk", "category", "library"]
    """
    try:
        logger.info(f"Auto-generate request from user {current_user.id}: source_types={request.source_types}, categories={request.categories}, framework_ids={request.framework_ids}, risk_ids={request.risk_ids}")
        
        from app.core.tenant_utils import get_effective_tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            logger.error(f"User {current_user.id} does not have a tenant_id")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant ID required. Please contact your administrator to assign you to a tenant."
            )
        
        source_types = request.source_types or []
        result = {
            "frameworks": [],
            "risks": [],
            "categories": [],
            "library": {}
        }
        if "framework" in source_types:
            result["frameworks"] = requirement_auto_generator.generate_from_frameworks(
                db=db,
                tenant_id=str(current_user.tenant_id),
                framework_ids=request.framework_ids,
                created_by=str(current_user.id)
            )
        
        if "risk" in source_types:
            result["risks"] = requirement_auto_generator.generate_from_risks(
                db=db,
                tenant_id=str(current_user.tenant_id),
                risk_ids=request.risk_ids,
                created_by=str(current_user.id)
            )
        
        if "category" in source_types:
            result["categories"] = requirement_auto_generator.generate_from_categories(
                db=db,
                tenant_id=str(current_user.tenant_id),
                categories=request.categories,
                created_by=str(current_user.id)
            )
        
        if "library" in source_types:
            result["library"] = requirement_auto_generator.generate_from_library(
                db=db,
                tenant_id=str(current_user.tenant_id),
                categories=request.categories,
                created_by=str(current_user.id)
            )
        
        # Count totals
        total_created = (
            len(result["frameworks"]) +
            len(result["risks"]) +
            len(result["categories"]) +
            sum(len(reqs) for reqs in result["library"].values())
        )
        
        logger.info(f"Successfully generated {total_created} requirements for tenant {current_user.tenant_id}")
        
        return {
            "message": f"Successfully generated {total_created} requirements",
            "created": total_created,
            "details": {
                "frameworks": len(result["frameworks"]),
                "risks": len(result["risks"]),
                "categories": len(result["categories"]),
                "library": {k: len(v) for k, v in result["library"].items()}
            }
        }
    except Exception as e:
        logger.error(f"Error auto-generating requirements: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate requirements: {str(e)}"
        )


@router.patch("/{requirement_id}/toggle", response_model=RequirementResponse)
async def toggle_requirement(
    requirement_id: UUID,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Toggle requirement enabled/disabled status"""
    requirement = db.query(SubmissionRequirement).filter(
        SubmissionRequirement.id == requirement_id
    ).first()
    
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found"
        )
    
    # Tenant isolation
    if current_user.tenant_id != requirement.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Toggle enabled status
    requirement.is_enabled = not (requirement.is_enabled or False)
    requirement.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(requirement)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="submission_requirement",
        resource_id=str(requirement.id),
        tenant_id=str(current_user.tenant_id),
        details={"is_enabled": requirement.is_enabled},
        ip_address=None,
        user_agent=None
    )
    
    return _build_requirement_response(requirement)

