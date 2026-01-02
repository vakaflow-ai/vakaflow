"""
Workflow configuration API endpoints
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.workflow_config import (
    WorkflowConfiguration, WorkflowEngineType, WorkflowConfigStatus,
    OnboardingRequest, ApproverGroup
)
from app.models.integration import Integration, IntegrationType
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction

router = APIRouter(prefix="/workflow-config", tags=["workflow-config"])


def get_role_value(role):
    """Safely get role value as string, handling both enum and string types"""
    if hasattr(role, 'value'):
        return role.value
    return str(role)


def get_enum_value(value):
    """Safely get enum value as string, handling both enum and string types"""
    if value is None:
        return None
    if hasattr(value, 'value'):
        return value.value
    return str(value)


def serialize_for_json(obj):
    """Recursively serialize objects for JSON, converting UUIDs to strings"""
    from uuid import UUID
    import json
    
    if isinstance(obj, UUID):
        return str(obj)
    elif isinstance(obj, dict):
        return {k: serialize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_for_json(item) for item in obj]
    elif isinstance(obj, (datetime,)):
        return obj.isoformat()
    else:
        # Try to convert to JSON-serializable type
        try:
            json.dumps(obj)
            return obj
        except (TypeError, ValueError):
            return str(obj)


class WorkflowStepCreate(BaseModel):
    """Workflow step creation schema"""
    step_number: int = Field(..., ge=1)
    step_type: str = Field(..., pattern="^(review|approval|notification)$")
    step_name: str = Field(..., min_length=1, max_length=255)
    assigned_role: Optional[str] = None
    assigned_user_id: Optional[UUID] = None
    required: bool = True
    can_skip: bool = False
    auto_assign: bool = True
    conditions: Optional[Dict[str, Any]] = None
    is_first_step: bool = False  # Mark this step as the starting step
    stage_settings: Optional[StageSettingsCreate] = None  # Stage settings for this step


class AssignmentRulesCreate(BaseModel):
    """Assignment rules creation schema"""
    approver_selection: str = Field(default="role_based", pattern="^(round_robin|specific_user|role_based)$")
    specific_approver_id: Optional[UUID] = None
    reviewer_auto_assign: bool = True
    escalation_rules: Optional[Dict[str, Any]] = None


class WorkflowConditionsCreate(BaseModel):
    """Workflow conditions creation schema"""
    agent_types: Optional[List[str]] = None
    risk_levels: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    priority: int = Field(default=1, ge=1)


class TriggerRulesCreate(BaseModel):
    """Trigger rules for workflow routing"""
    sso_groups: Optional[List[str]] = None
    departments: Optional[List[str]] = None
    application_categories: Optional[List[str]] = None
    agent_types: Optional[List[str]] = None
    risk_levels: Optional[List[str]] = None
    match_all: bool = Field(default=False, description="true = all conditions must match, false = any condition matches")


class StageSettingsCreate(BaseModel):
    """Stage settings for workflow steps"""
    visible_fields: Optional[List[str]] = None  # Fields from submission that are visible
    email_notifications: Optional[Dict[str, Any]] = None
    layout_id: Optional[UUID] = None  # Form layout ID for approver screen tabs
    # email_notifications structure:
    # {
    #   "enabled": true,
    #   "recipients": ["user", "vendor", "next_approver"],
    #   "reminders": [1, 2]  # Days before reminder
    # }


class WorkflowConfigCreate(BaseModel):
    """Workflow configuration creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    workflow_engine: str = Field(default="internal", pattern="^(internal|servicenow|jira|custom)$")
    integration_id: Optional[UUID] = None
    integration_config: Optional[Dict[str, Any]] = None
    workflow_steps: Optional[List[WorkflowStepCreate]] = None
    assignment_rules: Optional[AssignmentRulesCreate] = None
    conditions: Optional[WorkflowConditionsCreate] = None
    trigger_rules: Optional[TriggerRulesCreate] = None
    is_default: bool = False
    status: Optional[str] = Field(default="draft", pattern="^(active|inactive|draft)$")


class WorkflowConfigUpdate(BaseModel):
    """Workflow configuration update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    workflow_engine: Optional[str] = Field(None, pattern="^(internal|servicenow|jira|custom)$")
    integration_id: Optional[UUID] = None
    integration_config: Optional[Dict[str, Any]] = None
    workflow_steps: Optional[List[WorkflowStepCreate]] = None
    assignment_rules: Optional[AssignmentRulesCreate] = None
    conditions: Optional[WorkflowConditionsCreate] = None
    trigger_rules: Optional[TriggerRulesCreate] = None
    status: Optional[str] = Field(None, pattern="^(active|inactive|draft)$")
    is_default: Optional[bool] = None


class WorkflowConfigResponse(BaseModel):
    """Workflow configuration response schema"""
    id: str
    tenant_id: str
    name: str
    description: Optional[str]
    workflow_engine: str
    integration_id: Optional[str]
    integration_name: Optional[str] = None
    workflow_steps: Optional[List[Dict[str, Any]]]
    assignment_rules: Optional[Dict[str, Any]]
    conditions: Optional[Dict[str, Any]]
    trigger_rules: Optional[Dict[str, Any]] = None
    status: str
    is_default: bool
    created_by: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class OnboardingRequestCreate(BaseModel):
    """Onboarding request creation schema"""
    agent_id: UUID
    request_type: str = Field(default="onboarding", pattern="^(onboarding|renewal|update)$")
    workflow_config_id: Optional[UUID] = None
    request_metadata: Optional[Dict[str, Any]] = None


class ApproveRequest(BaseModel):
    """Approve request schema"""
    notes: Optional[str] = None


class RejectRequest(BaseModel):
    """Reject request schema"""
    reason: str = Field(..., min_length=1)


class ApproveRequest(BaseModel):
    """Approve request schema"""
    notes: Optional[str] = None


class RejectRequest(BaseModel):
    """Reject request schema"""
    reason: str = Field(..., min_length=1)


class OnboardingRequestResponse(BaseModel):
    """Onboarding request response schema"""
    id: str
    agent_id: str
    tenant_id: str
    requested_by: str
    request_type: str
    workflow_config_id: Optional[str]
    workflow_engine: str
    external_workflow_id: Optional[str]
    status: str
    assigned_to: Optional[str]
    assigned_to_email: Optional[str] = None  # Email of assigned user
    assigned_to_name: Optional[str] = None  # Name of assigned user
    current_step: int
    reviewed_by: Optional[str]
    reviewed_at: Optional[str]
    review_notes: Optional[str]
    approved_by: Optional[str]
    approved_by_name: Optional[str] = None  # Name of approver
    approved_by_email: Optional[str] = None  # Email of approver
    approved_at: Optional[str]
    approval_notes: Optional[str]
    rejected_by: Optional[str]
    rejected_by_name: Optional[str] = None  # Name of rejector
    rejected_by_email: Optional[str] = None  # Email of rejector
    rejected_at: Optional[str]
    rejection_reason: Optional[str]
    invitation_id: Optional[str] = None  # ID of the vendor invitation
    business_contact_id: Optional[str] = None  # ID of the person who invited the vendor
    request_number: Optional[str] = None  # Human-readable request number (AI-1, AI-2, etc.)
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


def build_onboarding_request_response(db: Session, request: OnboardingRequest) -> "OnboardingRequestResponse":
    """Helper function to build OnboardingRequestResponse with email lookup"""
    # Get assigned user details if assigned_to exists
    assigned_to_email = None
    assigned_to_name = None
    if request.assigned_to:
        assigned_user = db.query(User).filter(User.id == request.assigned_to).first()
        if assigned_user:
            assigned_to_email = assigned_user.email
            assigned_to_name = assigned_user.name
    
    # Get approver details if approved_by exists
    approved_by_name = None
    approved_by_email = None
    if request.approved_by:
        approver = db.query(User).filter(User.id == request.approved_by).first()
        if approver:
            approved_by_name = approver.name
            approved_by_email = approver.email
    
    # Get rejector details if rejected_by exists
    rejected_by_name = None
    rejected_by_email = None
    if request.rejected_by:
        rejector = db.query(User).filter(User.id == request.rejected_by).first()
        if rejector:
            rejected_by_name = rejector.name
            rejected_by_email = rejector.email
    
    return OnboardingRequestResponse(
        id=str(request.id),
        agent_id=str(request.agent_id),
        tenant_id=str(request.tenant_id),
        requested_by=str(request.requested_by),
        request_type=request.request_type,
        workflow_config_id=str(request.workflow_config_id) if request.workflow_config_id else None,
        workflow_engine=request.workflow_engine,
        external_workflow_id=request.external_workflow_id,
        status=request.status,
        assigned_to=str(request.assigned_to) if request.assigned_to else None,
        assigned_to_email=assigned_to_email,
        assigned_to_name=assigned_to_name,
        current_step=request.current_step,
        reviewed_by=str(request.reviewed_by) if request.reviewed_by else None,
        reviewed_at=request.reviewed_at.isoformat() if request.reviewed_at else None,
        review_notes=request.review_notes,
        approved_by=str(request.approved_by) if request.approved_by else None,
        approved_by_name=approved_by_name,
        approved_by_email=approved_by_email,
        approved_at=request.approved_at.isoformat() if request.approved_at else None,
        approval_notes=request.approval_notes,
        rejected_by=str(request.rejected_by) if request.rejected_by else None,
        rejected_by_name=rejected_by_name,
        rejected_by_email=rejected_by_email,
        rejected_at=request.rejected_at.isoformat() if request.rejected_at else None,
        rejection_reason=request.rejection_reason,
        invitation_id=str(request.invitation_id) if request.invitation_id else None,
        business_contact_id=str(request.business_contact_id) if request.business_contact_id else None,
        request_number=request.request_number,
        created_at=request.created_at.isoformat(),
        updated_at=request.updated_at.isoformat()
    )


@router.post("", response_model=WorkflowConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow_config(
    config_data: WorkflowConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new workflow configuration (tenant admin only)"""
    # Check permissions
    if get_role_value(current_user.role) not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins can create workflow configurations"
        )
    
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be assigned to a tenant"
        )
    
    # Validate integration if external engine is selected
    if config_data.workflow_engine != "internal" and not config_data.integration_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integration ID is required for external workflow engines"
        )
    
    if config_data.integration_id:
        integration = db.query(Integration).filter(
            Integration.id == config_data.integration_id,
            Integration.tenant_id == effective_tenant_id
        ).first()
        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found or does not belong to your tenant"
            )
    
    # If this is set as default, unset other defaults
    if config_data.is_default:
        db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.tenant_id == effective_tenant_id,
            WorkflowConfiguration.is_default == True
        ).update({"is_default": False})
    
    # Convert workflow steps to JSON and validate/update step ordering
    workflow_steps_json = None
    if config_data.workflow_steps:
        steps = [step.dict() for step in config_data.workflow_steps]
        
        # Check if any step is marked as first
        first_step_found = any(step.get('is_first_step', False) for step in steps)
        
        # If no step is marked as first, make the first step (lowest step_number) the first
        if not first_step_found and steps:
            # Sort by step_number to find the first one
            sorted_steps = sorted(steps, key=lambda x: x.get('step_number', 999))
            sorted_steps[0]['is_first_step'] = True
        
        # Ensure only one step is marked as first
        first_step_count = sum(1 for step in steps if step.get('is_first_step', False))
        if first_step_count > 1:
            # Keep only the first one (lowest step_number) as first
            sorted_steps = sorted(steps, key=lambda x: x.get('step_number', 999))
            for step in steps:
                step['is_first_step'] = False
            sorted_steps[0]['is_first_step'] = True
        
        # Serialize UUIDs and other non-JSON types before saving
        workflow_steps_json = serialize_for_json(steps)
    
    # Serialize trigger_rules for JSON storage
    trigger_rules_json = None
    if config_data.trigger_rules:
        trigger_rules_json = serialize_for_json(config_data.trigger_rules.dict() if hasattr(config_data.trigger_rules, 'dict') else config_data.trigger_rules)
    
    # Create workflow configuration
    workflow_config = WorkflowConfiguration(
        tenant_id=effective_tenant_id,
        name=config_data.name,
        description=config_data.description,
        workflow_engine=WorkflowEngineType(config_data.workflow_engine).value,
        integration_id=config_data.integration_id,
        integration_config=config_data.integration_config,
        workflow_steps=workflow_steps_json,
        assignment_rules=config_data.assignment_rules.dict() if config_data.assignment_rules else None,
        conditions=config_data.conditions.dict() if config_data.conditions else None,
        trigger_rules=trigger_rules_json,
        status=WorkflowConfigStatus(config_data.status).value if config_data.status else WorkflowConfigStatus.DRAFT.value,
        is_default=config_data.is_default,
        created_by=current_user.id
    )
    
    db.add(workflow_config)
    db.commit()
    db.refresh(workflow_config)
    
    # Get integration name if exists
    integration_name = None
    if workflow_config.integration_id:
        integration = db.query(Integration).filter(Integration.id == workflow_config.integration_id).first()
        if integration:
            integration_name = integration.name
    
    return WorkflowConfigResponse(
        id=str(workflow_config.id),
        tenant_id=str(workflow_config.tenant_id),
        name=workflow_config.name,
        description=workflow_config.description,
        workflow_engine=get_enum_value(workflow_config.workflow_engine),
        integration_id=str(workflow_config.integration_id) if workflow_config.integration_id else None,
        integration_name=integration_name,
        workflow_steps=workflow_config.workflow_steps,
        assignment_rules=workflow_config.assignment_rules,
        conditions=workflow_config.conditions,
        trigger_rules=workflow_config.trigger_rules,
        status=get_enum_value(workflow_config.status),
        is_default=workflow_config.is_default,
        created_by=str(workflow_config.created_by) if workflow_config.created_by else None,
        created_at=workflow_config.created_at.isoformat(),
        updated_at=workflow_config.updated_at.isoformat()
    )


@router.get("", response_model=List[WorkflowConfigResponse])
async def list_workflow_configs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List workflow configurations for tenant"""
    # Check permissions
    user_role = get_role_value(current_user.role)
    if user_role not in ["tenant_admin", "platform_admin", "approver"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must filter by tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    query = db.query(WorkflowConfiguration).filter(WorkflowConfiguration.tenant_id == effective_tenant_id)
    
    configs = query.order_by(WorkflowConfiguration.is_default.desc(), WorkflowConfiguration.created_at.desc()).all()
    
    result = []
    for config in configs:
        integration_name = None
        if config.integration_id:
            integration = db.query(Integration).filter(Integration.id == config.integration_id).first()
            if integration:
                integration_name = integration.name
        
        result.append(WorkflowConfigResponse(
            id=str(config.id),
            tenant_id=str(config.tenant_id),
            name=config.name,
            description=config.description,
            workflow_engine=get_enum_value(config.workflow_engine),
            integration_id=str(config.integration_id) if config.integration_id else None,
            integration_name=integration_name,
            workflow_steps=config.workflow_steps,
            assignment_rules=config.assignment_rules,
            conditions=config.conditions,
            trigger_rules=config.trigger_rules,
            status=get_enum_value(config.status),
            is_default=config.is_default,
            created_by=str(config.created_by) if config.created_by else None,
            created_at=config.created_at.isoformat(),
            updated_at=config.updated_at.isoformat()
        ))
    
    return result


# Onboarding requests routes must come before /{config_id} routes to avoid route conflicts
@router.post("/onboarding-requests", response_model=OnboardingRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_onboarding_request(
    request_data: OnboardingRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an onboarding request for an agent"""
    # Verify agent exists
    from app.models.agent import Agent
    agent = db.query(Agent).filter(Agent.id == request_data.agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get tenant_id from agent's vendor
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    if not vendor or not vendor.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent vendor must be assigned to a tenant"
        )
    
    # Determine workflow configuration
    workflow_config_id = request_data.workflow_config_id
    workflow_engine = "internal"  # Default to internal
    
    if not workflow_config_id:
        # Find default workflow for tenant
        default_config = db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.tenant_id == vendor.tenant_id,
            WorkflowConfiguration.is_default == True,
            WorkflowConfiguration.status == WorkflowConfigStatus.ACTIVE.value
        ).first()
        
        # If no default workflow exists, create one
        if not default_config:
            from app.services.workflow_seeder import ensure_default_workflow_exists
            default_config = ensure_default_workflow_exists(db, vendor.tenant_id, current_user.id)
            db.commit()
            db.refresh(default_config)
        
        if default_config:
            workflow_config_id = default_config.id
            workflow_engine = default_config.workflow_engine  # Already a string
    
    # Generate human-readable request number (AI-1, AI-2, etc.)
    # Get the highest request number for this tenant
    last_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.tenant_id == vendor.tenant_id,
        OnboardingRequest.request_number.isnot(None),
        OnboardingRequest.request_number.like('AI-%')
    ).order_by(OnboardingRequest.created_at.desc()).all()
    
    # Find the highest number by parsing all request numbers
    max_number = 0
    for req in last_request:
        if req.request_number:
            try:
                # Extract number from request_number (e.g., "AI-123" -> 123)
                number_part = req.request_number.split('-')[1]
                num = int(number_part)
                if num > max_number:
                    max_number = num
            except (ValueError, IndexError):
                continue
    
    next_number = max_number + 1
    request_number = f"AI-{next_number}"
    
    # Create onboarding request
    onboarding_request = OnboardingRequest(
        agent_id=request_data.agent_id,
        tenant_id=vendor.tenant_id,
        requested_by=current_user.id,
        request_type=request_data.request_type,
        workflow_config_id=workflow_config_id,
        workflow_engine=workflow_engine,  # Already a string
        status="pending",
        request_metadata=request_data.request_metadata,
        request_number=request_number
    )
    
    db.add(onboarding_request)
    db.commit()
    db.refresh(onboarding_request)
    
    return build_onboarding_request_response(db, onboarding_request)


@router.get("/onboarding-requests", response_model=List[OnboardingRequestResponse])
async def list_onboarding_requests(
    status: Optional[str] = Query(None, pattern="^(pending|in_review|approved|rejected|cancelled)$"),
    agent_id: Optional[UUID] = Query(None, description="Filter by agent ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List onboarding requests"""
    # Check permissions
    if get_role_value(current_user.role) not in ["approver", "tenant_admin", "platform_admin", "vendor_user"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    query = db.query(OnboardingRequest)
    
    # Tenant isolation - ALL users (including platform_admin) must filter by tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    query = query.filter(OnboardingRequest.tenant_id == effective_tenant_id)
    
    # Filter by agent_id if provided (for vendors to track their agents)
    if agent_id:
        query = query.filter(OnboardingRequest.agent_id == agent_id)
    
    # Filter by status
    if status:
        query = query.filter(OnboardingRequest.status == status)
    
    # Vendor users can only see requests for their agents
    if get_role_value(current_user.role) == "vendor_user":
        # Get vendor's agents
        from app.models.vendor import Vendor
        from app.models.agent import Agent
        vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if vendor:
            agent_ids = [str(a.id) for a in db.query(Agent).filter(Agent.vendor_id == vendor.id).all()]
            if agent_ids:
                query = query.filter(OnboardingRequest.agent_id.in_(agent_ids))
            else:
                return []
        else:
            return []
    
    # Approvers can only see requests assigned to them (unless admin)
    # Admins (tenant_admin, platform_admin) can see all requests
    if get_role_value(current_user.role) == "approver":
        query = query.filter(
            (OnboardingRequest.assigned_to == current_user.id) |
            (OnboardingRequest.assigned_to.is_(None))
        )
    
    requests = query.order_by(OnboardingRequest.created_at.desc()).all()
    
    return [build_onboarding_request_response(db, r) for r in requests]


@router.post("/onboarding-requests/{request_id}/approve", response_model=OnboardingRequestResponse)
async def approve_onboarding_request(
    request_id: UUID,
    approval_data: Optional[ApproveRequest] = Body(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve an onboarding request (approver or admin)"""
    # Check permissions
    user_role = get_role_value(current_user.role)
    is_admin = user_role in ["tenant_admin", "platform_admin"]
    is_approver = user_role == "approver"
    
    if not (is_admin or is_approver):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approvers or admins can approve onboarding requests"
        )
    
    request = db.query(OnboardingRequest).filter(OnboardingRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding request not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access onboarding requests"
        )
    if request.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Approvers can only approve requests assigned to them
    # Admins can approve any request (acting on behalf of approvers)
    if is_approver and not is_admin:
        if request.assigned_to and request.assigned_to != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only approve requests assigned to you"
            )
    
    if request.status not in ["pending", "in_review"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request with status: {request.status}"
        )
    
    # Update request
    request.status = "approved"
    request.approved_by = current_user.id
    request.approved_at = datetime.utcnow()
    request.approval_notes = approval_data.notes if approval_data else None
    
    # Update agent status
    from app.models.agent import Agent, AgentStatus
    agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
    if agent:
        agent.status = AgentStatus.APPROVED.value
        agent.approval_date = datetime.utcnow()
    
    # Update ticket status if ticket exists
    from app.services.ticket_service import TicketService
    from app.models.ticket import TicketStage, TicketStatus
    try:
        ticket = TicketService.get_ticket_by_agent(db, request.agent_id)
        if ticket:
            TicketService.update_ticket_stage(
                db=db,
                ticket_id=ticket.id,
                new_stage=TicketStage.COMPLETED,
                user_id=current_user.id,
                status="completed"
            )
            TicketService.update_ticket_status(
                db=db,
                ticket_id=ticket.id,
                new_status=TicketStatus.APPROVED,
                user_id=current_user.id
            )
    except Exception as e:
        # Log error but don't fail the approval
        import logging
        logging.error(f"Failed to update ticket for agent {request.agent_id}: {str(e)}")
    
    db.commit()
    db.refresh(request)
    
    # Audit log
    audit_details = {
        "agent_id": str(request.agent_id),
        "request_status": request.status
    }
    # Note if admin is acting on behalf of assigned approver
    if is_admin and request.assigned_to and request.assigned_to != current_user.id:
        audit_details["acted_on_behalf_of"] = str(request.assigned_to)
        audit_details["admin_action"] = True
    
    audit_service.log_action(
        db=db,
        user_id=current_user.id,
        action=AuditAction.WORKFLOW_APPROVED,
        resource_type="onboarding_request",
        resource_id=str(request.id),
        details=audit_details
    )
    
    return build_onboarding_request_response(db, request)


class RejectRequest(BaseModel):
    """Reject request schema"""
    reason: str = Field(..., min_length=1)


@router.post("/onboarding-requests/{request_id}/reject", response_model=OnboardingRequestResponse)
async def reject_onboarding_request(
    request_id: UUID,
    reject_data: RejectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject an onboarding request (approver or admin)"""
    # Check permissions
    user_role = get_role_value(current_user.role)
    is_admin = user_role in ["tenant_admin", "platform_admin"]
    is_approver = user_role == "approver"
    
    if not (is_admin or is_approver):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approvers or admins can reject onboarding requests"
        )
    
    request = db.query(OnboardingRequest).filter(OnboardingRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding request not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access onboarding requests"
        )
    if request.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Approvers can only reject requests assigned to them
    # Admins can reject any request (acting on behalf of approvers)
    if is_approver and not is_admin:
        if request.assigned_to and request.assigned_to != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only reject requests assigned to you"
            )
    
    if request.status not in ["pending", "in_review"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject request with status: {request.status}"
        )
    
    # Update request
    request.status = "rejected"
    request.rejected_by = current_user.id
    request.rejected_at = datetime.utcnow()
    request.rejection_reason = reject_data.reason
    
    # Update agent status
    from app.models.agent import Agent, AgentStatus
    agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
    if agent:
        agent.status = AgentStatus.REJECTED.value
        agent.rejection_date = datetime.utcnow()
        agent.rejection_reason = reject_data.reason
    
    db.commit()
    db.refresh(request)
    
    # Audit log
    audit_details = {
        "agent_id": str(request.agent_id),
        "reason": reject_data.reason,
        "request_status": request.status
    }
    # Note if admin is acting on behalf of assigned approver
    if is_admin and request.assigned_to and request.assigned_to != current_user.id:
        audit_details["acted_on_behalf_of"] = str(request.assigned_to)
        audit_details["admin_action"] = True
    
    audit_service.log_action(
        db=db,
        user_id=current_user.id,
        action=AuditAction.WORKFLOW_REJECTED,
        resource_type="onboarding_request",
        resource_id=str(request.id),
        details=audit_details
    )
    
    return build_onboarding_request_response(db, request)


@router.get("/onboarding-requests/agent/{agent_id}", response_model=OnboardingRequestResponse)
async def get_onboarding_request_by_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get onboarding request for a specific agent (for vendors to track status)"""
    # Verify agent exists and user has access
    from app.models.agent import Agent
    from app.models.vendor import Vendor
    
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check permissions - vendor can only see their own agents
    if get_role_value(current_user.role) == "vendor_user":
        vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if not vendor or agent.vendor_id != vendor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    elif get_role_value(current_user.role) != "platform_admin":
        # Tenant isolation for other roles
        # Platform admins without tenant_id use the default platform admin tenant
        from app.core.tenant_utils import get_effective_tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
        if not vendor or vendor.tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Get most recent onboarding request for this agent
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.agent_id == agent_id
    ).order_by(OnboardingRequest.created_at.desc()).first()
    
    if not onboarding_request:
        # Return 204 No Content instead of 404 - agent exists but no workflow request yet
        # This allows frontend to handle it gracefully as "no data" rather than an error
        from fastapi.responses import Response
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    return build_onboarding_request_response(db, onboarding_request)


# Approver Groups Endpoints
# IMPORTANT: These routes must be defined BEFORE /{config_id} route to avoid route conflicts

class ApproverGroupCreate(BaseModel):
    """Approver group creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    member_ids: List[UUID] = Field(default_factory=list)


class ApproverGroupUpdate(BaseModel):
    """Approver group update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    member_ids: Optional[List[UUID]] = None


class ApproverGroupResponse(BaseModel):
    """Approver group response schema"""
    id: str
    tenant_id: str
    name: str
    description: Optional[str]
    member_ids: List[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.get("/approver-groups", response_model=List[ApproverGroupResponse])
async def list_approver_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List approver groups for tenant"""
    if get_role_value(current_user.role) not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must filter by tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    query = db.query(ApproverGroup).filter(ApproverGroup.tenant_id == effective_tenant_id)
    
    groups = query.order_by(ApproverGroup.created_at.desc()).all()
    
    result = []
    for g in groups:
        # Convert member_ids to strings, handling both UUID and string types
        member_ids_list = []
        if g.member_ids:
            for mid in g.member_ids:
                if isinstance(mid, str):
                    member_ids_list.append(mid)
                else:
                    member_ids_list.append(str(mid))
        
        result.append(ApproverGroupResponse(
            id=str(g.id),
            tenant_id=str(g.tenant_id),
            name=g.name,
            description=g.description,
            member_ids=member_ids_list,
            created_at=g.created_at.isoformat(),
            updated_at=g.updated_at.isoformat()
        ))
    return result


@router.get("/approver-groups/{group_id}", response_model=ApproverGroupResponse)
async def get_approver_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get approver group details"""
    group = db.query(ApproverGroup).filter(ApproverGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approver group not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access approver groups"
        )
    if group.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return ApproverGroupResponse(
        id=str(group.id),
        tenant_id=str(group.tenant_id),
        name=group.name,
        description=group.description,
        member_ids=[str(mid) for mid in (group.member_ids or [])],
        created_at=group.created_at.isoformat(),
        updated_at=group.updated_at.isoformat()
    )


@router.post("/approver-groups", response_model=ApproverGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_approver_group(
    group_data: ApproverGroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create approver group"""
    if get_role_value(current_user.role) not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant"
        )
    
    group = ApproverGroup(
        tenant_id=effective_tenant_id,
        name=group_data.name,
        description=group_data.description,
        member_ids=[str(mid) for mid in group_data.member_ids]
    )
    
    db.add(group)
    db.commit()
    db.refresh(group)
    
    return ApproverGroupResponse(
        id=str(group.id),
        tenant_id=str(group.tenant_id),
        name=group.name,
        description=group.description,
        member_ids=[str(mid) for mid in (group.member_ids or [])],
        created_at=group.created_at.isoformat(),
        updated_at=group.updated_at.isoformat()
    )


@router.patch("/approver-groups/{group_id}", response_model=ApproverGroupResponse)
async def update_approver_group(
    group_id: UUID,
    group_data: ApproverGroupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update approver group"""
    if get_role_value(current_user.role) not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    group = db.query(ApproverGroup).filter(ApproverGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approver group not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access approver groups"
        )
    if group.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if group_data.name is not None:
        group.name = group_data.name
    if group_data.description is not None:
        group.description = group_data.description
    if group_data.member_ids is not None:
        group.member_ids = [str(mid) for mid in group_data.member_ids]
    
    group.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(group)
    
    return ApproverGroupResponse(
        id=str(group.id),
        tenant_id=str(group.tenant_id),
        name=group.name,
        description=group.description,
        member_ids=[str(mid) for mid in (group.member_ids or [])],
        created_at=group.created_at.isoformat(),
        updated_at=group.updated_at.isoformat()
    )


@router.delete("/approver-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_approver_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete approver group"""
    if get_role_value(current_user.role) not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    group = db.query(ApproverGroup).filter(ApproverGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approver group not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access approver groups"
        )
    if group.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    db.delete(group)
    db.commit()
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{config_id}", response_model=WorkflowConfigResponse)
async def get_workflow_config(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific workflow configuration"""
    config = db.query(WorkflowConfiguration).filter(WorkflowConfiguration.id == config_id).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow configuration not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access workflow configurations"
        )
    if config.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    integration_name = None
    if config.integration_id:
        integration = db.query(Integration).filter(Integration.id == config.integration_id).first()
        if integration:
            integration_name = integration.name
    
    return WorkflowConfigResponse(
        id=str(config.id),
        tenant_id=str(config.tenant_id),
        name=config.name,
        description=config.description,
        workflow_engine=get_enum_value(config.workflow_engine),
        integration_id=str(config.integration_id) if config.integration_id else None,
        integration_name=integration_name,
        workflow_steps=config.workflow_steps,
        assignment_rules=config.assignment_rules,
        conditions=config.conditions,
        trigger_rules=getattr(config, 'trigger_rules', None),
        status=get_enum_value(config.status),
        is_default=config.is_default,
        created_by=str(config.created_by) if config.created_by else None,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat()
    )


@router.patch("/{config_id}", response_model=WorkflowConfigResponse)
async def update_workflow_config(
    config_id: UUID,
    config_data: WorkflowConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a workflow configuration (tenant admin only)"""
    # Check permissions
    if get_role_value(current_user.role) not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins can update workflow configurations"
        )
    
    config = db.query(WorkflowConfiguration).filter(WorkflowConfiguration.id == config_id).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow configuration not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access workflow configurations"
        )
    if config.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Update fields
    update_data = config_data.dict(exclude_unset=True)
    if 'name' in update_data:
        config.name = update_data['name']
    if 'description' in update_data:
        config.description = update_data['description']
    if 'workflow_engine' in update_data:
        config.workflow_engine = WorkflowEngineType(update_data['workflow_engine']).value
    if 'integration_id' in update_data:
        config.integration_id = update_data['integration_id']
    if 'integration_config' in update_data:
        config.integration_config = update_data['integration_config']
    if 'workflow_steps' in update_data:
        steps = []
        for step in update_data['workflow_steps']:
            # Convert Pydantic model to dict if needed, preserving all fields including stage_settings
            if hasattr(step, 'dict'):
                step_dict = step.dict(exclude_unset=False)  # Include all fields
            elif hasattr(step, 'model_dump'):
                step_dict = step.model_dump(exclude_unset=False)  # Pydantic v2
            else:
                step_dict = step
            
            # Ensure stage_settings is preserved (it may be a dict or Pydantic model)
            if 'stage_settings' in step_dict and step_dict['stage_settings']:
                # Convert stage_settings to dict if it's a Pydantic model
                if hasattr(step_dict['stage_settings'], 'dict'):
                    step_dict['stage_settings'] = step_dict['stage_settings'].dict(exclude_unset=False)
                elif hasattr(step_dict['stage_settings'], 'model_dump'):
                    step_dict['stage_settings'] = step_dict['stage_settings'].model_dump(exclude_unset=False)
            
            steps.append(step_dict)
        
        # Validate and update step ordering
        first_step_found = any(step.get('is_first_step', False) for step in steps)
        
        # If no step is marked as first, make the first step (lowest step_number) the first
        if not first_step_found and steps:
            sorted_steps = sorted(steps, key=lambda x: x.get('step_number', 999))
            sorted_steps[0]['is_first_step'] = True
        
        # Ensure only one step is marked as first
        first_step_count = sum(1 for step in steps if step.get('is_first_step', False))
        if first_step_count > 1:
            # Keep only the first one (lowest step_number) as first
            sorted_steps = sorted(steps, key=lambda x: x.get('step_number', 999))
            for step in steps:
                step['is_first_step'] = False
            sorted_steps[0]['is_first_step'] = True
        
        # Serialize UUIDs and other non-JSON types before saving
        config.workflow_steps = serialize_for_json(steps)
    if 'assignment_rules' in update_data:
        config.assignment_rules = update_data['assignment_rules'].dict() if hasattr(update_data['assignment_rules'], 'dict') else update_data['assignment_rules']
    if 'conditions' in update_data:
        config.conditions = update_data['conditions'].dict() if hasattr(update_data['conditions'], 'dict') else update_data['conditions']
    if 'trigger_rules' in update_data:
        trigger_rules_data = update_data['trigger_rules']
        config.trigger_rules = serialize_for_json(trigger_rules_data.dict() if hasattr(trigger_rules_data, 'dict') else trigger_rules_data)
    if 'status' in update_data:
        config.status = WorkflowConfigStatus(update_data['status']).value
    if 'is_default' in update_data:
        if update_data['is_default']:
            # Unset other defaults
            db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.tenant_id == config.tenant_id,
                WorkflowConfiguration.id != config_id,
                WorkflowConfiguration.is_default == True
            ).update({"is_default": False})
        config.is_default = update_data['is_default']
    
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    
    integration_name = None
    if config.integration_id:
        integration = db.query(Integration).filter(Integration.id == config.integration_id).first()
        if integration:
            integration_name = integration.name
    
    return WorkflowConfigResponse(
        id=str(config.id),
        tenant_id=str(config.tenant_id),
        name=config.name,
        description=config.description,
        workflow_engine=get_enum_value(config.workflow_engine),
        integration_id=str(config.integration_id) if config.integration_id else None,
        integration_name=integration_name,
        workflow_steps=config.workflow_steps,
        assignment_rules=config.assignment_rules,
        conditions=config.conditions,
        status=get_enum_value(config.status),
        is_default=config.is_default,
        created_by=str(config.created_by) if config.created_by else None,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat()
    )


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow_config(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a workflow configuration (tenant admin only)"""
    # Check permissions
    if get_role_value(current_user.role) not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins can delete workflow configurations"
        )
    
    config = db.query(WorkflowConfiguration).filter(WorkflowConfiguration.id == config_id).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow configuration not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access workflow configurations"
        )
    if config.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Cannot delete default workflow
    if config.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete default workflow. Set another workflow as default first."
        )
    
    db.delete(config)
    db.commit()
    
    return None


@router.post("/{config_id}/set-first-step", response_model=WorkflowConfigResponse)
async def set_first_workflow_step(
    config_id: UUID,
    step_number: int = Query(..., ge=1, description="Step number to set as first step"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set which step should be the first step in the workflow (tenant admin only)"""
    # Check permissions
    if get_role_value(current_user.role) not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins can set the first workflow step"
        )
    
    config = db.query(WorkflowConfiguration).filter(WorkflowConfiguration.id == config_id).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow configuration not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access workflow configurations"
        )
    if config.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if not config.workflow_steps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workflow steps configured"
        )
    
    # Find the step with the specified step_number
    step_found = False
    for step in config.workflow_steps:
        if step.get('step_number') == step_number:
            step['is_first_step'] = True
            step_found = True
        else:
            step['is_first_step'] = False
    
    if not step_found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Step number {step_number} not found in workflow"
        )
    
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    
    integration_name = None
    if config.integration_id:
        integration = db.query(Integration).filter(Integration.id == config.integration_id).first()
        if integration:
            integration_name = integration.name
    
    return WorkflowConfigResponse(
        id=str(config.id),
        tenant_id=str(config.tenant_id),
        name=config.name,
        description=config.description,
        workflow_engine=get_enum_value(config.workflow_engine),
        integration_id=str(config.integration_id) if config.integration_id else None,
        integration_name=integration_name,
        workflow_steps=config.workflow_steps,
        assignment_rules=config.assignment_rules,
        conditions=config.conditions,
        trigger_rules=getattr(config, 'trigger_rules', None),
        status=get_enum_value(config.status),
        is_default=config.is_default,
        created_by=str(config.created_by) if config.created_by else None,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat()
    )


@router.post("/{config_id}/reorder-steps", response_model=WorkflowConfigResponse)
async def reorder_workflow_steps(
    config_id: UUID,
    step_order: List[int] = Body(..., description="List of step numbers in desired order"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reorder workflow steps and set the first step (tenant admin only)"""
    # Check permissions
    if get_role_value(current_user.role) not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins can reorder workflow steps"
        )
    
    config = db.query(WorkflowConfiguration).filter(WorkflowConfiguration.id == config_id).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow configuration not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access workflow configurations"
        )
    if config.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if not config.workflow_steps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workflow steps to reorder"
        )
    
    # Validate step_order contains all step numbers
    existing_step_numbers = {step.get('step_number') for step in config.workflow_steps}
    if set(step_order) != existing_step_numbers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Step order must contain all existing step numbers"
        )
    
    # Create a mapping of step_number to step
    step_map = {step.get('step_number'): step for step in config.workflow_steps}
    
    # Reorder steps based on step_order
    reordered_steps = []
    for idx, step_num in enumerate(step_order):
        step = step_map.get(step_num)
        if not step:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Step number {step_num} not found"
            )
        
        # Update step_number to reflect new order (starting from 1)
        step['step_number'] = idx + 1
        
        # Mark the first step in the order as the starting step
        step['is_first_step'] = (idx == 0)
        
        reordered_steps.append(step)
    
    config.workflow_steps = reordered_steps
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    
    integration_name = None
    if config.integration_id:
        integration = db.query(Integration).filter(Integration.id == config.integration_id).first()
        if integration:
            integration_name = integration.name
    
    return WorkflowConfigResponse(
        id=str(config.id),
        tenant_id=str(config.tenant_id),
        name=config.name,
        description=config.description,
        workflow_engine=get_enum_value(config.workflow_engine),
        integration_id=str(config.integration_id) if config.integration_id else None,
        integration_name=integration_name,
        workflow_steps=config.workflow_steps,
        assignment_rules=config.assignment_rules,
        conditions=config.conditions,
        status=get_enum_value(config.status),
        is_default=config.is_default,
        created_by=str(config.created_by) if config.created_by else None,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat()
    )




# Approver Groups Endpoints moved above - see line ~900


@router.get("/health-check", response_model=Dict[str, Any])
async def workflow_health_check(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check workflow system health - tables and tenant workflows (Platform Admin only)"""
    if get_role_value(current_user.role) != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can access health check"
        )
    
    from sqlalchemy import inspect
    from app.models.tenant import Tenant
    
    results = {
        "tables_exist": {},
        "tenants": [],
        "summary": {}
    }
    
    # Check if tables exist
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    
    required_tables = ['workflow_configurations', 'onboarding_requests', 'approver_groups']
    for table in required_tables:
        results["tables_exist"][table] = table in tables
    
    # Check workflows for each tenant
    tenants = db.query(Tenant).all()
    tenants_with_workflows = 0
    tenants_without_workflows = 0
    
    for tenant in tenants:
        default_workflow = db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.tenant_id == tenant.id,
            WorkflowConfiguration.is_default == True
        ).first()
        
        any_workflow = db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.tenant_id == tenant.id
        ).first()
        
        active_workflow = db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.tenant_id == tenant.id,
            WorkflowConfiguration.status == WorkflowConfigStatus.ACTIVE.value
        ).first()
        
        tenant_info = {
            "id": str(tenant.id),
            "name": tenant.name,
            "slug": tenant.slug,
            "has_default_workflow": default_workflow is not None,
            "has_any_workflow": any_workflow is not None,
            "has_active_workflow": active_workflow is not None,
            "workflow_count": db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.tenant_id == tenant.id
            ).count()
        }
        
        if default_workflow:
            tenant_info["default_workflow"] = {
                "id": str(default_workflow.id),
                "name": default_workflow.name,
                "status": get_enum_value(default_workflow.status),
                "steps_count": len(default_workflow.workflow_steps) if default_workflow.workflow_steps else 0,
                "engine": get_enum_value(default_workflow.workflow_engine)
            }
            tenants_with_workflows += 1
        else:
            tenants_without_workflows += 1
        
        results["tenants"].append(tenant_info)
    
    # Summary
    results["summary"] = {
        "all_tables_exist": all(results["tables_exist"].values()),
        "total_tenants": len(tenants),
        "tenants_with_workflows": tenants_with_workflows,
        "tenants_without_workflows": tenants_without_workflows,
        "total_workflows": db.query(WorkflowConfiguration).count(),
        "total_onboarding_requests": db.query(OnboardingRequest).count()
    }
    
    return results
