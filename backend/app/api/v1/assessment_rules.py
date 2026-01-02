"""
API endpoints for Assessment Rules management
Attribute-level rules for automatically adding questions/requirements to assessments
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.assessment_rule import AssessmentRule, RuleType
from app.models.assessment import Assessment
from app.models.tenant import Tenant
from app.api.v1.auth import get_current_user
from app.api.v1.submission_requirements import require_requirement_management_permission
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assessment-rules", tags=["assessment-rules"])


# Pydantic Schemas
class AssessmentRuleCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    rule_type: str = Field(..., description="question_group, requirement_group, auto_add")
    match_conditions: Dict[str, Any] = Field(..., description="JSON conditions for matching")
    question_ids: Optional[List[str]] = None
    requirement_ids: Optional[List[str]] = None
    priority: int = Field(default=100, description="Lower number = higher priority")
    is_active: bool = True
    is_automatic: bool = True  # If true, auto-applies; if false, suggests to user


class AssessmentRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    rule_type: Optional[str] = None
    match_conditions: Optional[Dict[str, Any]] = None
    question_ids: Optional[List[str]] = None
    requirement_ids: Optional[List[str]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    is_automatic: Optional[bool] = None


class AssessmentRuleResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: Optional[str]
    rule_type: str
    match_conditions: Dict[str, Any]
    question_ids: Optional[List[str]]
    requirement_ids: Optional[List[str]]
    priority: int
    is_active: bool
    is_automatic: bool
    created_by: str
    updated_by: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class ApplyRulesRequest(BaseModel):
    assessment_id: str
    auto_apply: bool = True  # If true, automatically apply matching rules; if false, return suggestions


class RuleSuggestion(BaseModel):
    rule_id: str
    rule_name: str
    rule_description: Optional[str]
    questions_to_add: List[str]  # Question library IDs
    requirements_to_add: List[str]  # Requirement IDs
    match_reason: str  # Why this rule matched


@router.get("", response_model=List[AssessmentRuleResponse])
async def list_rules(
    rule_type: Optional[str] = Query(None, description="Filter by rule type"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List assessment rules"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    query = db.query(AssessmentRule).filter(
        AssessmentRule.tenant_id == effective_tenant_id
    )
    
    if rule_type:
        query = query.filter(AssessmentRule.rule_type == rule_type)
    
    if is_active is not None:
        query = query.filter(AssessmentRule.is_active == is_active)
    
    rules = query.order_by(
        AssessmentRule.priority,
        AssessmentRule.name
    ).all()
    
    return [
        AssessmentRuleResponse(
            id=str(r.id),
            tenant_id=str(r.tenant_id),
            name=r.name,
            description=r.description,
            rule_type=r.rule_type,
            match_conditions=r.match_conditions,
            question_ids=r.question_ids,
            requirement_ids=r.requirement_ids,
            priority=r.priority,
            is_active=r.is_active,
            is_automatic=r.is_automatic,
            created_by=str(r.created_by),
            updated_by=str(r.updated_by) if r.updated_by else None,
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat()
        )
        for r in rules
    ]


@router.post("", response_model=AssessmentRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    rule_data: AssessmentRuleCreate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Create a new assessment rule"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Validate rule type
    if rule_data.rule_type not in [e.value for e in RuleType]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid rule type: {rule_data.rule_type}"
        )
    
    rule = AssessmentRule(
        tenant_id=effective_tenant_id,
        name=rule_data.name,
        description=rule_data.description,
        rule_type=rule_data.rule_type,
        match_conditions=rule_data.match_conditions,
        question_ids=rule_data.question_ids,
        requirement_ids=rule_data.requirement_ids,
        priority=rule_data.priority,
        is_active=rule_data.is_active,
        is_automatic=rule_data.is_automatic,
        created_by=current_user.id
    )
    
    try:
        db.add(rule)
        db.commit()
        db.refresh(rule)
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.CREATE,
            resource_type="assessment_rule",
            resource_id=str(rule.id),
            tenant_id=str(current_user.tenant_id),
            details={"name": rule.name, "rule_type": rule.rule_type},
            ip_address=None,
            user_agent=None
        )
        
        return AssessmentRuleResponse(
            id=str(rule.id),
            tenant_id=str(rule.tenant_id),
            name=rule.name,
            description=rule.description,
            rule_type=rule.rule_type,
            match_conditions=rule.match_conditions,
            question_ids=rule.question_ids,
            requirement_ids=rule.requirement_ids,
            priority=rule.priority,
            is_active=rule.is_active,
            is_automatic=rule.is_automatic,
            created_by=str(rule.created_by),
            updated_by=str(rule.updated_by) if rule.updated_by else None,
            created_at=rule.created_at.isoformat(),
            updated_at=rule.updated_at.isoformat()
        )
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error creating rule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create rule due to database constraint violation"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating rule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the rule"
        )


@router.get("/{rule_id}", response_model=AssessmentRuleResponse)
async def get_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific assessment rule"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    rule = db.query(AssessmentRule).filter(
        AssessmentRule.id == rule_id,
        AssessmentRule.tenant_id == effective_tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found"
        )
    
    return AssessmentRuleResponse(
        id=str(rule.id),
        tenant_id=str(rule.tenant_id),
        name=rule.name,
        description=rule.description,
        rule_type=rule.rule_type,
        match_conditions=rule.match_conditions,
        question_ids=rule.question_ids,
        requirement_ids=rule.requirement_ids,
        priority=rule.priority,
        is_active=rule.is_active,
        is_automatic=rule.is_automatic,
        created_by=str(rule.created_by),
        updated_by=str(rule.updated_by) if rule.updated_by else None,
        created_at=rule.created_at.isoformat(),
        updated_at=rule.updated_at.isoformat()
    )


@router.patch("/{rule_id}", response_model=AssessmentRuleResponse)
async def update_rule(
    rule_id: UUID,
    update_data: AssessmentRuleUpdate,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Update an assessment rule"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    rule = db.query(AssessmentRule).filter(
        AssessmentRule.id == rule_id,
        AssessmentRule.tenant_id == effective_tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found"
        )
    
    # Update fields
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    for key, value in update_dict.items():
        if hasattr(rule, key):
            setattr(rule, key, value)
    
    rule.updated_by = current_user.id
    rule.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(rule)
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.UPDATE,
            resource_type="assessment_rule",
            resource_id=str(rule_id),
            tenant_id=str(current_user.tenant_id),
            details={"updated_fields": list(update_dict.keys())},
            ip_address=None,
            user_agent=None
        )
        
        return AssessmentRuleResponse(
            id=str(rule.id),
            tenant_id=str(rule.tenant_id),
            name=rule.name,
            description=rule.description,
            rule_type=rule.rule_type,
            match_conditions=rule.match_conditions,
            question_ids=rule.question_ids,
            requirement_ids=rule.requirement_ids,
            priority=rule.priority,
            is_active=rule.is_active,
            is_automatic=rule.is_automatic,
            created_by=str(rule.created_by),
            updated_by=str(rule.updated_by) if rule.updated_by else None,
            created_at=rule.created_at.isoformat(),
            updated_at=rule.updated_at.isoformat()
        )
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error updating rule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update rule due to database constraint violation"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating rule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the rule"
        )


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: UUID,
    current_user: User = Depends(require_requirement_management_permission),
    db: Session = Depends(get_db)
):
    """Delete an assessment rule (soft delete)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    rule = db.query(AssessmentRule).filter(
        AssessmentRule.id == rule_id,
        AssessmentRule.tenant_id == effective_tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found"
        )
    
    # Soft delete
    rule.is_active = False
    rule.updated_by = current_user.id
    rule.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.DELETE,
            resource_type="assessment_rule",
            resource_id=str(rule_id),
            tenant_id=str(current_user.tenant_id),
            details={"name": rule.name},
            ip_address=None,
            user_agent=None
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error deleting rule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the rule"
        )


@router.post("/apply", response_model=List[RuleSuggestion])
async def apply_rules_to_assessment(
    request: ApplyRulesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply matching rules to an assessment and return suggestions or auto-apply"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Get assessment
    assessment = db.query(Assessment).filter(
        Assessment.id == UUID(request.assessment_id),
        Assessment.tenant_id == effective_tenant_id
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    # Get tenant for industry
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    tenant_industry = tenant.industry if tenant else None
    
    # Get active rules for this tenant
    rules = db.query(AssessmentRule).filter(
        AssessmentRule.tenant_id == current_user.tenant_id,
        AssessmentRule.is_active == True
    ).order_by(AssessmentRule.priority).all()
    
    suggestions = []
    
    for rule in rules:
        # Check if rule matches assessment attributes
        if _rule_matches_assessment(rule, assessment, tenant_industry):
            suggestions.append(RuleSuggestion(
                rule_id=str(rule.id),
                rule_name=rule.name,
                rule_description=rule.description,
                questions_to_add=rule.question_ids or [],
                requirements_to_add=rule.requirement_ids or [],
                match_reason=_get_match_reason(rule, assessment, tenant_industry)
            ))
    
    # If auto_apply is True, we would apply the rules here
    # For now, we just return suggestions
    # TODO: Implement actual application logic in assessment service
    
    return suggestions


def _rule_matches_assessment(rule: AssessmentRule, assessment: Assessment, tenant_industry: Optional[str]) -> bool:
    """Check if a rule matches an assessment based on match_conditions"""
    conditions = rule.match_conditions
    
    # Check assessment_type
    if 'assessment_type' in conditions:
        if assessment.assessment_type not in conditions['assessment_type']:
            return False
    
    # Check industry
    if 'industry' in conditions:
        if tenant_industry not in conditions['industry']:
            return False
    
    # Check vendor_category (if assessment has vendor context)
    if 'vendor_category' in conditions:
        # TODO: Extract vendor category from assessment context
        pass
    
    # Check risk_type (if assessment has risk context)
    if 'risk_type' in conditions:
        # TODO: Extract risk type from assessment context
        pass
    
    # All conditions matched
    return True


def _get_match_reason(rule: AssessmentRule, assessment: Assessment, tenant_industry: Optional[str]) -> str:
    """Generate a human-readable reason why the rule matched"""
    reasons = []
    conditions = rule.match_conditions
    
    if 'assessment_type' in conditions:
        reasons.append(f"Assessment type: {assessment.assessment_type}")
    
    if 'industry' in conditions and tenant_industry:
        reasons.append(f"Industry: {tenant_industry}")
    
    return "; ".join(reasons) if reasons else "Rule matched"
