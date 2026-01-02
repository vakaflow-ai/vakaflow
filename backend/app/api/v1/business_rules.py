"""
API endpoints for Business Rules management
General-purpose rules that can be used across business flows, entities, and screens
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
import json
import re
import uuid

from app.core.database import get_db
from app.models.user import User
from app.models.business_rule import BusinessRule
from app.models.tenant import Tenant
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
from sqlalchemy.exc import OperationalError, ProgrammingError
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/business-rules", tags=["business-rules"])


# Pydantic Schemas
class BusinessRuleCreate(BaseModel):
    rule_id: Optional[str] = Field(None, max_length=100, description="Unique rule identifier (auto-generated if not provided)")
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    condition_expression: str = Field(..., description="Condition expression (e.g., 'user.department = Agent.department')")
    action_expression: str = Field(..., description="Action expression (e.g., 'assign_to:user.department_manager' or 'step:approval_required')")
    rule_type: str = Field(default="conditional", description="conditional, assignment, workflow, validation")
    applicable_entities: Optional[List[str]] = Field(None, description="Entities where rule can be used: agent, assessment, workflow, user")
    applicable_screens: Optional[List[str]] = Field(None, description="Screens where rule can be used")
    action_type: Optional[str] = Field(None, description="assign, route, validate, notify, execute_step")
    action_config: Optional[Dict[str, Any]] = None
    priority: int = Field(default=100, description="Lower number = higher priority")
    is_active: bool = True
    is_automatic: bool = True


class BusinessRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    condition_expression: Optional[str] = None
    action_expression: Optional[str] = None
    rule_type: Optional[str] = None
    applicable_entities: Optional[List[str]] = None
    applicable_screens: Optional[List[str]] = None
    action_type: Optional[str] = None
    action_config: Optional[Dict[str, Any]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    is_automatic: Optional[bool] = None


class BusinessRuleResponse(BaseModel):
    id: str
    rule_id: str
    name: str
    description: Optional[str] = None
    condition_expression: str
    action_expression: str
    rule_type: str
    applicable_entities: Optional[List[str]] = None
    applicable_screens: Optional[List[str]] = None
    action_type: Optional[str] = None
    action_config: Optional[Dict[str, Any]] = None
    priority: int
    is_active: bool
    is_automatic: bool
    created_by: str
    updated_by: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=List[BusinessRuleResponse])
async def list_business_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = None,
    rule_type: Optional[str] = None,
    applicable_entity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List business rules for the current tenant"""
    try:
        # Check if user has permission to access business rules
        if current_user.role.value not in ['tenant_admin', 'platform_admin', 'policy_admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to access business rules"
            )
        
        # Tenant isolation - ALL users (including platform_admin) must have tenant_id
        # Platform admins without tenant_id use the default platform admin tenant
        from app.core.tenant_utils import get_effective_tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to access business rules"
            )
        
        # ALL users (including platform_admin) must filter by tenant
        query = db.query(BusinessRule).filter(
            BusinessRule.tenant_id == effective_tenant_id
        )
        
        if is_active is not None:
            query = query.filter(BusinessRule.is_active == is_active)
        
        if rule_type:
            query = query.filter(BusinessRule.rule_type == rule_type)
        
        # Order by priority (ascending - lower number = higher priority), then by created_at (descending)
        from sqlalchemy import asc, desc
        try:
            rules = query.order_by(asc(BusinessRule.priority), desc(BusinessRule.created_at)).offset(skip).limit(limit).all()
        except (OperationalError, ProgrammingError) as db_error:
            # Check if table doesn't exist
            error_msg = str(db_error).lower()
            if 'does not exist' in error_msg or 'relation' in error_msg:
                logger.warning("business_rules table does not exist. Please run migrations.")
                return []
            logger.error(f"Database error executing business rules query: {db_error}", exc_info=True)
            db.rollback()
            # Fallback: try without ordering
            try:
                # Rebuild query after rollback
                if current_user.role.value == 'platform_admin':
                    fallback_query = db.query(BusinessRule)
                else:
                    fallback_query = db.query(BusinessRule).filter(
                        BusinessRule.tenant_id == effective_tenant_id
                    )
                if is_active is not None:
                    fallback_query = fallback_query.filter(BusinessRule.is_active == is_active)
                if rule_type:
                    fallback_query = fallback_query.filter(BusinessRule.rule_type == rule_type)
                rules = fallback_query.offset(skip).limit(limit).all()
            except Exception as fallback_error:
                logger.error(f"Error in fallback query: {fallback_error}", exc_info=True)
                db.rollback()
                return []
        except Exception as query_error:
            logger.error(f"Error executing business rules query: {query_error}", exc_info=True)
            # Rollback the transaction if it was aborted
            try:
                db.rollback()
            except Exception as rollback_error:
                logger.error(f"Error during rollback: {rollback_error}", exc_info=True)
            
            # Fallback: try without ordering (with fresh query)
            try:
                # Rebuild query after rollback
                if current_user.role.value == 'platform_admin':
                    fallback_query = db.query(BusinessRule)
                else:
                    fallback_query = db.query(BusinessRule).filter(
                        BusinessRule.tenant_id == effective_tenant_id
                    )
                if is_active is not None:
                    fallback_query = fallback_query.filter(BusinessRule.is_active == is_active)
                if rule_type:
                    fallback_query = fallback_query.filter(BusinessRule.rule_type == rule_type)
                rules = fallback_query.offset(skip).limit(limit).all()
            except Exception as fallback_error:
                logger.error(f"Error in fallback query: {fallback_error}", exc_info=True)
                try:
                    db.rollback()
                except:
                    pass
                # Last resort: return empty list
                return []
        
        # Filter by applicable_entity in Python if specified (safer than JSONB query)
        if applicable_entity:
            filtered_rules = []
            for rule in rules:
                try:
                    if rule.applicable_entities and isinstance(rule.applicable_entities, list):
                        if applicable_entity in rule.applicable_entities:
                            filtered_rules.append(rule)
                    elif rule.applicable_entities and isinstance(rule.applicable_entities, str):
                        # Handle case where it might be stored as JSON string
                        try:
                            entities = json.loads(rule.applicable_entities)
                            if isinstance(entities, list) and applicable_entity in entities:
                                filtered_rules.append(rule)
                        except:
                            pass
                except Exception as filter_error:
                    logger.warning(f"Error filtering rule {rule.id} by entity: {filter_error}")
                    continue
            rules = filtered_rules
        
        result = []
        for rule in rules:
            try:
                # Normalize JSON fields - SQLAlchemy JSON columns are already parsed
                # But handle edge cases where they might be strings or None
                applicable_entities = rule.applicable_entities
                if applicable_entities is None:
                    applicable_entities = None
                elif isinstance(applicable_entities, str):
                    try:
                        parsed = json.loads(applicable_entities)
                        applicable_entities = parsed if isinstance(parsed, list) else None
                    except:
                        applicable_entities = None
                elif not isinstance(applicable_entities, list):
                    applicable_entities = None
                
                applicable_screens = rule.applicable_screens
                if applicable_screens is None:
                    applicable_screens = None
                elif isinstance(applicable_screens, str):
                    try:
                        parsed = json.loads(applicable_screens)
                        applicable_screens = parsed if isinstance(parsed, list) else None
                    except:
                        applicable_screens = None
                elif not isinstance(applicable_screens, list):
                    applicable_screens = None
                
                # Ensure action_config is a dict or None
                action_config = rule.action_config
                if action_config is None:
                    action_config = None
                elif isinstance(action_config, str):
                    try:
                        parsed = json.loads(action_config)
                        action_config = parsed if isinstance(parsed, dict) else None
                    except:
                        action_config = None
                elif not isinstance(action_config, dict):
                    action_config = None
                
                result.append(BusinessRuleResponse(
                    id=str(rule.id),
                    rule_id=rule.rule_id,
                    name=rule.name,
                    description=rule.description,
                    condition_expression=rule.condition_expression,
                    action_expression=rule.action_expression,
                    rule_type=rule.rule_type,
                    applicable_entities=applicable_entities,
                    applicable_screens=applicable_screens,
                    action_type=rule.action_type,
                    action_config=action_config,
                    priority=rule.priority,
                    is_active=rule.is_active,
                    is_automatic=rule.is_automatic,
                    created_by=str(rule.created_by),
                    updated_by=str(rule.updated_by) if rule.updated_by else None,
                    created_at=rule.created_at.isoformat() if rule.created_at else datetime.utcnow().isoformat(),
                    updated_at=rule.updated_at.isoformat() if rule.updated_at else datetime.utcnow().isoformat()
                ))
            except Exception as e:
                logger.error(f"Error serializing business rule {rule.id}: {e}", exc_info=True)
                import traceback
                logger.error(traceback.format_exc())
                continue
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in list_business_rules: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while retrieving business rules: {str(e)}"
        )


@router.get("/{rule_id}", response_model=BusinessRuleResponse)
async def get_business_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific business rule by ID"""
    # Check if user has permission to access business rules
    if current_user.role.value not in ['tenant_admin', 'platform_admin', 'policy_admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access business rules"
        )
    
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    rule = db.query(BusinessRule).filter(
        BusinessRule.id == rule_id,
        BusinessRule.tenant_id == effective_tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found"
        )
    
    return BusinessRuleResponse(
        id=str(rule.id),
        rule_id=rule.rule_id,
        name=rule.name,
        description=rule.description,
        condition_expression=rule.condition_expression,
        action_expression=rule.action_expression,
        rule_type=rule.rule_type,
        applicable_entities=rule.applicable_entities,
        applicable_screens=rule.applicable_screens,
        action_type=rule.action_type,
        action_config=rule.action_config,
        priority=rule.priority,
        is_active=rule.is_active,
        is_automatic=rule.is_automatic,
        created_by=str(rule.created_by),
        updated_by=str(rule.updated_by) if rule.updated_by else None,
        created_at=rule.created_at.isoformat(),
        updated_at=rule.updated_at.isoformat()
    )


@router.post("", response_model=BusinessRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_business_rule(
    rule_data: BusinessRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new business rule"""
    # Check if user has permission to create business rules
    if current_user.role.value not in ['tenant_admin', 'platform_admin', 'policy_admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create business rules"
        )
    
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    # Auto-generate rule_id if not provided
    if not rule_data.rule_id:
        # Generate rule_id from name: lowercase, replace spaces with underscores, remove special chars
        base_rule_id = re.sub(r'[^a-z0-9_]', '', rule_data.name.lower().replace(' ', '_'))
        if not base_rule_id:
            base_rule_id = 'rule'
        
        # Ensure uniqueness by appending a short UUID if needed
        rule_id = base_rule_id
        counter = 0
        while True:
            existing = db.query(BusinessRule).filter(
                BusinessRule.rule_id == rule_id,
                BusinessRule.tenant_id == effective_tenant_id
            ).first()
            if not existing:
                break
            # Append short UUID to make it unique
            short_uuid = str(uuid.uuid4())[:8]
            rule_id = f"{base_rule_id}_{short_uuid}"
            counter += 1
            if counter > 10:  # Safety check
                rule_id = f"{base_rule_id}_{uuid.uuid4().hex[:8]}"
                break
    else:
        rule_id = rule_data.rule_id
        # Check if rule_id already exists
        existing = db.query(BusinessRule).filter(
            BusinessRule.rule_id == rule_id,
            BusinessRule.tenant_id == effective_tenant_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rule with rule_id '{rule_id}' already exists"
            )
    
    rule = BusinessRule(
        tenant_id=effective_tenant_id,
        rule_id=rule_id,
        name=rule_data.name,
        description=rule_data.description,
        condition_expression=rule_data.condition_expression,
        action_expression=rule_data.action_expression,
        rule_type=rule_data.rule_type,
        applicable_entities=rule_data.applicable_entities,
        applicable_screens=rule_data.applicable_screens,
        action_type=rule_data.action_type,
        action_config=rule_data.action_config,
        priority=rule_data.priority,
        is_active=rule_data.is_active,
        is_automatic=rule_data.is_automatic,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    try:
        db.add(rule)
        db.commit()
        db.refresh(rule)
        
        # Audit log
        try:
            audit_service.log_action(
                db=db,
                user_id=str(current_user.id),
                action=AuditAction.CREATE,
                resource_type="business_rule",
                resource_id=str(rule.id),
                tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
                details={"rule_id": rule.rule_id, "name": rule.name},
                ip_address=None,
                user_agent=None
            )
        except Exception as audit_error:
            logger.warning(f"Failed to log audit trail: {audit_error}")
            # Don't fail the request if audit logging fails
        
        logger.info(f"Created business rule {rule.rule_id} by user {current_user.id}")
        
        return BusinessRuleResponse(
            id=str(rule.id),
            rule_id=rule.rule_id,
            name=rule.name,
            description=rule.description,
            condition_expression=rule.condition_expression,
            action_expression=rule.action_expression,
            rule_type=rule.rule_type,
            applicable_entities=rule.applicable_entities,
            applicable_screens=rule.applicable_screens,
            action_type=rule.action_type,
            action_config=rule.action_config,
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
        logger.error(f"Error creating business rule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create rule. Rule ID may already exist."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating business rule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while creating the rule: {str(e)}"
        )


@router.patch("/{rule_id}", response_model=BusinessRuleResponse)
async def update_business_rule(
    rule_id: UUID,
    rule_data: BusinessRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a business rule"""
    # Check if user has permission to update business rules
    if current_user.role.value not in ['tenant_admin', 'platform_admin', 'policy_admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update business rules"
        )
    
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    rule = db.query(BusinessRule).filter(
        BusinessRule.id == rule_id,
        BusinessRule.tenant_id == effective_tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found"
        )
    
    # Update fields
    update_dict = rule_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(rule, field, value)
    
    rule.updated_by = current_user.id
    rule.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(rule)
        
        # Audit log
        try:
            audit_service.log_action(
                db=db,
                user_id=str(current_user.id),
                action=AuditAction.UPDATE,
                resource_type="business_rule",
                resource_id=str(rule.id),
                tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
                details={"rule_id": rule.rule_id, "changes": update_dict},
                ip_address=None,
                user_agent=None
            )
        except Exception as audit_error:
            logger.warning(f"Failed to log audit trail: {audit_error}")
            # Don't fail the request if audit logging fails
        
        logger.info(f"Updated business rule {rule.rule_id} by user {current_user.id}")
        
        return BusinessRuleResponse(
            id=str(rule.id),
            rule_id=rule.rule_id,
            name=rule.name,
            description=rule.description,
            condition_expression=rule.condition_expression,
            action_expression=rule.action_expression,
            rule_type=rule.rule_type,
            applicable_entities=rule.applicable_entities,
            applicable_screens=rule.applicable_screens,
            action_type=rule.action_type,
            action_config=rule.action_config,
            priority=rule.priority,
            is_active=rule.is_active,
            is_automatic=rule.is_automatic,
            created_by=str(rule.created_by),
            updated_by=str(rule.updated_by) if rule.updated_by else None,
            created_at=rule.created_at.isoformat(),
            updated_at=rule.updated_at.isoformat()
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating business rule: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update rule"
        )


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_business_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a business rule"""
    # Check if user has permission to delete business rules
    if current_user.role.value not in ['tenant_admin', 'platform_admin', 'policy_admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete business rules"
        )
    
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    rule = db.query(BusinessRule).filter(
        BusinessRule.id == rule_id,
        BusinessRule.tenant_id == effective_tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found"
        )
    
    rule_id_str = rule.rule_id
    
    try:
        db.delete(rule)
        db.commit()
        
        # Audit log
        try:
            audit_service.log_action(
                db=db,
                user_id=str(current_user.id),
                action=AuditAction.DELETE,
                resource_type="business_rule",
                resource_id=str(rule_id),
                tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
                details={"rule_id": rule_id_str},
                ip_address=None,
                user_agent=None
            )
        except Exception as audit_error:
            logger.warning(f"Failed to log audit trail: {audit_error}")
            # Don't fail the request if audit logging fails
        
        logger.info(f"Deleted business rule {rule_id_str} by user {current_user.id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting business rule: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to delete rule"
        )


@router.get("/entities/attributes", response_model=Dict[str, Any])
async def get_rule_entities_attributes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get available entities and their attributes for rule building"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.agent import Agent
    from app.models.user import User as UserModel
    from app.models.assessment import Assessment, AssessmentAssignment
    from app.models.vendor import Vendor
    from sqlalchemy import distinct, func
    
    tenant_id = current_user.tenant_id
    
    # Define entity attributes structure
    entities_attributes = {
        "agent": {
            "label": "Agent",
            "attributes": {
                "name": {"label": "Name", "type": "string", "operators": ["=", "!=", "contains", "like"]},
                "type": {"label": "Type", "type": "enum", "operators": ["=", "!=", "in"], "values_source": "agent_type"},
                "category": {"label": "Category", "type": "enum", "operators": ["=", "!=", "in"], "values_source": "dynamic"},
                "subcategory": {"label": "Subcategory", "type": "enum", "operators": ["=", "!=", "in"], "values_source": "dynamic"},
                "status": {"label": "Status", "type": "enum", "operators": ["=", "!=", "in"], "values_source": "agent_status"},
                "compliance_score": {"label": "Compliance Score", "type": "number", "operators": ["=", "!=", ">", "<", ">=", "<="]},
                "risk_score": {"label": "Risk Score", "type": "number", "operators": ["=", "!=", ">", "<", ">=", "<="]},
                "pii_data": {"label": "PII Data", "type": "boolean", "operators": ["="], "values": ["yes", "no", "true", "false"]},
            }
        },
        "user": {
            "label": "User",
            "attributes": {
                "name": {"label": "Name", "type": "string", "operators": ["=", "!=", "contains", "like"]},
                "email": {"label": "Email", "type": "string", "operators": ["=", "!=", "contains", "like"]},
                "role": {"label": "Role", "type": "enum", "operators": ["=", "!=", "in"], "values_source": "user_role"},
                "department": {"label": "Department", "type": "enum", "operators": ["=", "!=", "in"], "values_source": "dynamic"},
                "organization": {"label": "Organization", "type": "enum", "operators": ["=", "!=", "in"], "values_source": "dynamic"},
            }
        },
        "assessment": {
            "label": "Assessment",
            "attributes": {
                "name": {"label": "Name", "type": "string", "operators": ["=", "!=", "contains", "like"]},
                "assessment_type": {"label": "Assessment Type", "type": "enum", "operators": ["=", "!=", "in"], "values_source": "assessment_type"},
                "status": {"label": "Status", "type": "enum", "operators": ["=", "!=", "in"], "values_source": "assessment_status"},
            }
        },
        "assessment_assignment": {
            "label": "Assessment Assignment",
            "attributes": {
                "status": {"label": "Status", "type": "enum", "operators": ["=", "!=", "in"], "values": ["pending", "in_progress", "completed", "failed"]},
            }
        },
        "vendor": {
            "label": "Vendor",
            "attributes": {
                "name": {"label": "Name", "type": "string", "operators": ["=", "!=", "contains", "like"]},
                "contact_email": {"label": "Contact Email", "type": "string", "operators": ["=", "!=", "contains", "like"]},
            }
        }
    }
    
    return {
        "entities": entities_attributes
    }


@router.get("/entities/{entity}/attributes/{attribute}/values", response_model=List[str])
async def get_attribute_values(
    entity: str,
    attribute: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get possible values for a specific entity attribute"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    from app.models.agent import Agent
    from app.models.user import User as UserModel
    from app.models.assessment import Assessment
    from app.models.vendor import Vendor
    from app.services.master_data_service import MasterDataService
    from sqlalchemy import distinct, func
    
    tenant_id = current_user.tenant_id
    values = []
    
    try:
        if entity == "agent":
            if attribute == "category":
                # Get distinct categories from agents
                from app.models.vendor import Vendor
                vendors = db.query(Vendor).filter(Vendor.tenant_id == tenant_id).all()
                vendor_ids = [v.id for v in vendors]
                categories = db.query(distinct(Agent.category)).filter(
                    Agent.category.isnot(None),
                    Agent.category != '',
                    Agent.vendor_id.in_(vendor_ids)
                ).all()
                values = [cat[0] for cat in categories if cat[0]]
            elif attribute == "subcategory":
                # Get distinct subcategories from agents
                from app.models.vendor import Vendor
                vendors = db.query(Vendor).filter(Vendor.tenant_id == tenant_id).all()
                vendor_ids = [v.id for v in vendors]
                subcategories = db.query(distinct(Agent.subcategory)).filter(
                    Agent.subcategory.isnot(None),
                    Agent.subcategory != '',
                    Agent.vendor_id.in_(vendor_ids)
                ).all()
                values = [subcat[0] for subcat in subcategories if subcat[0]]
            elif attribute == "type":
                # Get from master data
                master_values = MasterDataService.get_master_data_values(db, str(tenant_id), "agent_type")
                values = [v.get('value') for v in master_values if v.get('value')]
            elif attribute == "status":
                # Get from master data
                master_values = MasterDataService.get_master_data_values(db, str(tenant_id), "agent_status")
                values = [v.get('value') for v in master_values if v.get('value')]
            elif attribute == "pii_data":
                # Check agent metadata for PII data
                from app.models.agent import AgentMetadata
                from app.models.vendor import Vendor
                vendors = db.query(Vendor).filter(Vendor.tenant_id == tenant_id).all()
                vendor_ids = [v.id for v in vendors]
                agents = db.query(Agent).filter(Agent.vendor_id.in_(vendor_ids)).all()
                agent_ids = [a.id for a in agents]
                
                # Check metadata for agents with PII data
                has_pii = []
                no_pii = []
                for agent_id in agent_ids:
                    metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent_id).first()
                    if metadata and metadata.data_sharing_scope:
                        if isinstance(metadata.data_sharing_scope, dict) and metadata.data_sharing_scope.get('shares_pii'):
                            has_pii.append(str(agent_id))
                        else:
                            no_pii.append(str(agent_id))
                    else:
                        no_pii.append(str(agent_id))
                
                # Return boolean values
                if has_pii or no_pii:
                    values = ["yes", "no", "true", "false"]
                else:
                    values = ["yes", "no", "true", "false"]
        
        elif entity == "user":
            if attribute == "department":
                # Get distinct departments from users
                departments = db.query(distinct(UserModel.department)).filter(
                    UserModel.department.isnot(None),
                    UserModel.department != '',
                    UserModel.tenant_id == tenant_id
                ).all()
                values = [dept[0] for dept in departments if dept[0]]
                # Also check master data
                master_values = MasterDataService.get_master_data_values(db, str(tenant_id), "department")
                master_depts = [v.get('value') for v in master_values if v.get('value')]
                values = list(set(values + master_depts))
            elif attribute == "organization":
                # Get distinct organizations from users
                orgs = db.query(distinct(UserModel.organization)).filter(
                    UserModel.organization.isnot(None),
                    UserModel.organization != '',
                    UserModel.tenant_id == tenant_id
                ).all()
                values = [org[0] for org in orgs if org[0]]
                # Also check master data
                master_values = MasterDataService.get_master_data_values(db, str(tenant_id), "organization")
                master_orgs = [v.get('value') for v in master_values if v.get('value')]
                values = list(set(values + master_orgs))
            elif attribute == "role":
                # Get from master data
                master_values = MasterDataService.get_master_data_values(db, str(tenant_id), "user_role")
                values = [v.get('value') for v in master_values if v.get('value')]
        
        elif entity == "assessment":
            if attribute == "assessment_type":
                # Get from master data
                master_values = MasterDataService.get_master_data_values(db, str(tenant_id), "assessment_type")
                values = [v.get('value') for v in master_values if v.get('value')]
            elif attribute == "status":
                # Get from master data
                master_values = MasterDataService.get_master_data_values(db, str(tenant_id), "assessment_status")
                values = [v.get('value') for v in master_values if v.get('value')]
        
        elif entity == "assessment_assignment":
            if attribute == "status":
                values = ["pending", "in_progress", "completed", "failed"]
        
    except Exception as e:
        logger.error(f"Error fetching attribute values for {entity}.{attribute}: {e}", exc_info=True)
        # Return empty list on error
    
    return sorted(list(set(values))) if values else []


@router.post("/evaluate", response_model=Dict[str, Any])
async def evaluate_business_rules(
    context: Dict[str, Any] = Body(..., description="Context data for rule evaluation"),
    entity_type: str = Body(..., description="Entity type (agent, assessment, workflow, user)"),
    screen: Optional[str] = Body(None, description="Screen name (e.g., agent_submission, assessment_review)"),
    rule_type: Optional[str] = Body(None, description="Rule type filter (conditional, assignment, workflow, validation)"),
    auto_execute: bool = Body(True, description="Automatically execute actions if rules match"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Evaluate business rules for a given context"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )
    
    try:
        from app.services.business_rules_engine import BusinessRulesEngine
        
        rules_engine = BusinessRulesEngine(db, current_user.tenant_id)
        
        # Evaluate rules
        rule_results = rules_engine.evaluate_rules(
            context=context,
            entity_type=entity_type,
            screen=screen,
            rule_type=rule_type
        )
        
        # Execute actions
        action_results = rules_engine.execute_actions(
            rule_results,
            context,
            auto_execute=auto_execute
        )
        
        return {
            "matched_rules": len(rule_results),
            "rule_results": rule_results,
            "action_results": action_results
        }
    except Exception as e:
        logger.error(f"Error evaluating business rules: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate rules: {str(e)}"
        )
