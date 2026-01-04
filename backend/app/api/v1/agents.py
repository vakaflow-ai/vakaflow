"""
Agent management API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr, Field, validator
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.agent import Agent, AgentStatus, AgentMetadata, AgentArtifact
from app.models.vendor import Vendor
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.core.security_middleware import validate_file_upload, sanitize_input
from app.core.cache import cached, invalidate_cache
from app.core.audit import audit_service, AuditAction
from fastapi import Request
import os
import aiofiles
from app.core.config import settings
import re
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


def validate_agent_tenant_access(agent: Agent, current_user: User, db: Session) -> None:
    """
    Validate that the current user has access to the agent based on tenant isolation.
    Raises HTTPException if access is denied.
    ALL users (including platform_admin) must be in the same tenant as the agent.
    Platform admins without tenant_id use the default platform admin tenant.
    """
    from fastapi import HTTPException, status
    from app.core.tenant_utils import get_effective_tenant_id
    
    # Get effective tenant_id (uses default tenant for platform admins without tenant_id)
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access agents"
        )
    
    # Get vendor for the agent
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent vendor not found"
        )
    
    # Validate tenant access - agent's vendor must be in the same tenant as the user's effective tenant
    if vendor.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Agent belongs to a different tenant"
        )
    
    # Vendor users and vendor coordinators can only access their own vendor's agents
    if current_user.role.value in ["vendor_user", "vendor_coordinator"]:
        user_vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if not user_vendor or agent.vendor_id != user_vendor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only access your own vendor's agents"
            )


class AgentCreate(BaseModel):
    """Agent creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=5000)
    version: str = Field(..., min_length=1, max_length=50, pattern=r'^[\w\.-]+$')
    status: Optional[str] = Field(None, description="Agent status (draft, submitted, etc.)")
    capabilities: Optional[List[str]] = Field(None, max_items=50)
    data_types: Optional[List[str]] = Field(None, max_items=50)
    regions: Optional[List[str]] = Field(None, max_items=50)
    integrations: Optional[List[dict]] = Field(None, max_items=20)
    # Enhanced fields
    use_cases: Optional[List[str]] = Field(None, max_items=20, description="List of use cases for this agent")
    features: Optional[List[str]] = Field(None, max_items=50, description="List of features provided by this agent")
    personas: Optional[List[dict]] = Field(None, max_items=20, description="List of target personas with name and description")
    version_info: Optional[dict] = Field(None, description="Version information including release notes, changelog, etc.")
    connection_diagram: Optional[str] = Field(None, description="Mermaid diagram of agent connections")
    mermaid_diagram: Optional[str] = Field(None, description="Alias for connection_diagram")
    # AI/LLM information
    llm_vendor: Optional[str] = Field(None, max_length=100, description="LLM vendor (e.g., OpenAI, Anthropic, Google)")
    llm_model: Optional[str] = Field(None, max_length=100, description="LLM model name (e.g., GPT-4, Claude-3, Gemini-Pro)")
    deployment_type: Optional[str] = Field(None, description="Deployment type: cloud, on_premise, or hybrid")
    data_sharing_scope: Optional[dict] = Field(None, description="Information about what data is shared with LLM")
    data_usage_purpose: Optional[str] = Field(None, max_length=2000, description="How the agent uses data with the LLM")
    workflow_current_step: Optional[int] = Field(None, description="Current step in the onboarding workflow")
    
    @validator('name', 'description')
    def sanitize_text(cls, v):
        """Sanitize text input"""
        if v:
            return sanitize_input(v)
        return v
    
    @validator('version')
    def validate_version(cls, v):
        """Validate version format"""
        if v and not re.match(r'^[\w\.-]+$', v):
            raise ValueError('Invalid version format')
        return v


class AgentResponse(BaseModel):
    """Agent response schema"""
    id: str
    vendor_id: str
    name: str
    type: str
    category: Optional[str]
    subcategory: Optional[str]
    description: Optional[str]
    version: str
    status: str
    compliance_score: Optional[int]
    risk_score: Optional[int]
    submission_date: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Metadata fields
    capabilities: Optional[List[str]] = None
    data_types: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    integrations: Optional[List[dict]] = None
    use_cases: Optional[List[str]] = None
    features: Optional[List[str]] = None
    personas: Optional[List[dict]] = None
    version_info: Optional[dict] = None
    # AI/LLM information
    llm_vendor: Optional[str] = None
    llm_model: Optional[str] = None
    deployment_type: Optional[str] = None
    data_sharing_scope: Optional[Dict[str, Any]] = None
    data_usage_purpose: Optional[str] = None
    # Vendor info
    vendor_name: Optional[str] = None
    vendor_logo_url: Optional[str] = None
    architecture_info: Optional[Dict[str, Any]] = None
    # Workflow tracking
    onboarding_request_id: Optional[str] = None
    workflow_status: Optional[str] = None
    workflow_current_step: Optional[int] = None
    
    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    """Agent list response schema"""
    agents: List[AgentResponse]
    total: int
    page: int
    limit: int


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new agent submission"""
    try:
        # Validate user role
        if current_user.role.value not in ["vendor_user", "tenant_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only vendors can create agents"
            )
        
        # Check feature gate: agent creation (with timeout protection)
        if current_user.tenant_id:
            try:
                from app.core.feature_gating import FeatureGate
                can_create, current_count = FeatureGate.check_agent_limit(db, str(current_user.tenant_id))
                if not can_create:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Agent limit reached ({current_count}). Please upgrade your plan."
                    )
            except HTTPException:
                raise
            except Exception as e:
                # If feature gate check fails, log but allow creation (fail open)
                logger.warning(f"Feature gate check failed for tenant {current_user.tenant_id}: {e}", exc_info=True)
                # Continue with creation - fail open to prevent blocking legitimate requests
        
        # Get or create vendor
        vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if not vendor:
            vendor = Vendor(
                name=f"{current_user.name}'s Company",
                contact_email=current_user.email,
                tenant_id=current_user.tenant_id
            )
            db.add(vendor)
            db.commit()
            db.refresh(vendor)
        
        # Check for duplicate agent name (same vendor, same name) - optimized query
        existing = db.query(Agent).filter(
            Agent.vendor_id == vendor.id,
            Agent.name == agent_data.name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Agent with this name already exists"
            )
        
        # Create agent
        agent = Agent(
            vendor_id=vendor.id,
            name=agent_data.name,
            type=agent_data.type,
            category=agent_data.category,
            subcategory=agent_data.subcategory,
            description=agent_data.description,
            version=agent_data.version,
            status=AgentStatus.DRAFT.value,
        )
        
        db.add(agent)
        db.commit()
        db.refresh(agent)
        
        # Prepare architecture_info with connection diagram if provided
        architecture_info = {}
        connection_diagram = agent_data.connection_diagram or agent_data.mermaid_diagram
        if connection_diagram:
            # Store the diagram exactly as provided (preserve the original format)
            architecture_info['connection_diagram'] = connection_diagram
            logger.info(f"Storing connection diagram for agent {agent.name}: {len(connection_diagram)} characters")
        
        # Create metadata
        metadata = AgentMetadata(
            agent_id=agent.id,
            capabilities=agent_data.capabilities or [],
            data_types=agent_data.data_types or [],
            regions=agent_data.regions or [],
            integrations=agent_data.integrations or [],
            use_cases=agent_data.use_cases or [],
            features=agent_data.features or [],
            personas=agent_data.personas or [],
            version_info=agent_data.version_info or {},
            architecture_info=architecture_info if architecture_info else None,
            llm_vendor=agent_data.llm_vendor,
            llm_model=agent_data.llm_model,
            deployment_type=agent_data.deployment_type,
            data_sharing_scope=agent_data.data_sharing_scope,
            data_usage_purpose=agent_data.data_usage_purpose,
        )
        
        # Handle workflow_current_step if provided
        if agent_data.workflow_current_step is not None:
            if not metadata.extra_data:
                metadata.extra_data = {}
            metadata.extra_data['workflow_current_step'] = agent_data.workflow_current_step
        
        db.add(metadata)
        db.commit()
        db.refresh(agent)
        db.refresh(metadata)
        
        # Audit log (non-blocking - log errors but don't fail the request)
        try:
            audit_service.log_action(
                db=db,
                user_id=str(current_user.id),
                action=AuditAction.CREATE,
                resource_type="agent",
                resource_id=str(agent.id),
                tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
                details={"name": agent.name, "type": agent.type},
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent")
            )
        except Exception as audit_error:
            logger.warning(f"Failed to log audit action for agent creation: {audit_error}", exc_info=True)
            # Continue - don't fail the request if audit logging fails
        
        # Invalidate cache (non-blocking)
        try:
            invalidate_cache(f"agents:*")
        except Exception as cache_error:
            logger.warning(f"Failed to invalidate cache: {cache_error}", exc_info=True)
            # Continue - don't fail the request if cache invalidation fails
        
        # Convert to response model
        return AgentResponse(
            id=str(agent.id),
            vendor_id=str(agent.vendor_id),
            name=agent.name,
            type=agent.type,
            category=agent.category,
            subcategory=agent.subcategory,
            description=agent.description,
            version=agent.version,
            status=agent.status,
            compliance_score=agent.compliance_score,
            risk_score=agent.risk_score,
            submission_date=agent.submission_date,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
            capabilities=metadata.capabilities,
            data_types=metadata.data_types,
            regions=metadata.regions,
            integrations=metadata.integrations,
            use_cases=metadata.use_cases,
            features=metadata.features,
            personas=metadata.personas,
            version_info=metadata.version_info,
            llm_vendor=metadata.llm_vendor,
            llm_model=metadata.llm_model,
            deployment_type=metadata.deployment_type,
            data_sharing_scope=metadata.data_sharing_scope,
            data_usage_purpose=metadata.data_usage_purpose,
            vendor_name=vendor.name if vendor else None,
            vendor_logo_url=vendor.logo_url if vendor else None,
            architecture_info=metadata.architecture_info,
            workflow_current_step=metadata.extra_data.get('workflow_current_step') if metadata.extra_data else None
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Rollback transaction on error
        db.rollback()
        logger.error(f"Failed to create agent: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create agent: {str(e)}"
        )


@router.get("", response_model=AgentListResponse)
async def list_agents(
    page: int = Query(1, ge=1, le=1000),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, description="Comma-separated list of statuses: draft,submitted,in_review,approved,rejected,offboarded"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List agents (filtered by user's vendor and tenant)"""
    # Build query with proper filtering
    query = db.query(Agent)
    
    # Parse status filter - support comma-separated values
    status_list = None
    valid_statuses = {"draft", "submitted", "in_review", "approved", "rejected", "offboarded"}
    if status_filter:
        status_list = [s.strip() for s in status_filter.split(',') if s.strip()]
        # Validate all statuses are valid
        invalid_statuses = [s for s in status_list if s not in valid_statuses]
        if invalid_statuses:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status values: {', '.join(invalid_statuses)}. Valid values are: {', '.join(sorted(valid_statuses))}"
            )
    
    # Tenant isolation - ALL users (including platform_admin) must filter by tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access agents"
        )
    
    # Vendor users and vendor coordinators can ONLY see their own vendor's agents (CRITICAL: No cross-vendor data leak)
    if current_user.role.value in ["vendor_user", "vendor_coordinator"]:
        vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if vendor:
            query = query.filter(Agent.vendor_id == vendor.id)
        else:
            # No vendor found, return empty (vendor user/coordinator without vendor cannot see any agents)
            return AgentListResponse(
                agents=[],
                total=0,
                page=page,
                limit=limit
            )
    # For all other users (tenant admins, reviewers, approvers, platform admins): filter by tenant
    else:
        # Get all vendors in the user's effective tenant (uses default tenant for platform admins)
        vendors = db.query(Vendor).filter(Vendor.tenant_id == effective_tenant_id).all()
        vendor_ids = [v.id for v in vendors]
        if vendor_ids:
            query = query.filter(Agent.vendor_id.in_(vendor_ids))
        else:
            # No vendors in tenant, return empty
            return AgentListResponse(
                agents=[],
                total=0,
                page=page,
                limit=limit
            )
    
    # Filter by status if provided - support multiple statuses
    if status_list:
        query = query.filter(Agent.status.in_(status_list))
    
    # Get total count (optimized)
    total = query.count()
    
    # Pagination with ordering (most recent first)
    agents = query.order_by(Agent.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    # Get all metadata, vendors, and onboarding requests in batch
    agent_ids = [agent.id for agent in agents]
    metadata_map = {
        m.agent_id: m for m in db.query(AgentMetadata).filter(AgentMetadata.agent_id.in_(agent_ids)).all()
    }
    vendor_ids = list(set([agent.vendor_id for agent in agents]))
    vendor_map = {
        v.id: v for v in db.query(Vendor).filter(Vendor.id.in_(vendor_ids)).all()
    }
    
    # Get onboarding requests for these agents
    from app.models.workflow_config import OnboardingRequest
    onboarding_requests = []
    if agent_ids:  # Only query if there are agent IDs
        try:
            onboarding_requests = db.query(OnboardingRequest).filter(
                OnboardingRequest.agent_id.in_(agent_ids)
            ).order_by(OnboardingRequest.created_at.desc()).all()
        except Exception as e:
            # Handle schema mismatch - SQLAlchemy metadata cache issue
            # The columns exist in DB but SQLAlchemy cached the old schema
            if 'does not exist' in str(e) or 'UndefinedColumn' in str(e):
                logger.error(
                    f"CRITICAL: Schema cache mismatch in onboarding_requests table.\n"
                    f"Error: {e}\n"
                    f"The database columns (invitation_id, business_contact_id) exist, "
                    f"but SQLAlchemy's metadata cache is stale.\n"
                    f"SOLUTION: Restart the backend server to refresh SQLAlchemy's schema cache.\n"
                    f"Continuing without onboarding request data for now..."
                )
                # Continue without onboarding data - endpoint will still return agents
                onboarding_requests = []
            else:
                logger.error(f"Failed to load onboarding requests: {e}")
                onboarding_requests = []
    
    # Group by agent_id (get most recent for each agent)
    onboarding_map = {}
    for req in onboarding_requests:
        if req.agent_id not in onboarding_map:
            onboarding_map[req.agent_id] = req
    
    # Convert to response models
    agent_responses = []
    for agent in agents:
        metadata = metadata_map.get(agent.id)
        vendor = vendor_map.get(agent.vendor_id)
        onboarding_req = onboarding_map.get(agent.id)
        
        agent_responses.append(AgentResponse(
            id=str(agent.id),
            vendor_id=str(agent.vendor_id),
            name=agent.name,
            type=agent.type,
            category=agent.category,
            subcategory=agent.subcategory,
            description=agent.description,
            version=agent.version,
            status=agent.status,
            compliance_score=agent.compliance_score,
            risk_score=agent.risk_score,
            submission_date=agent.submission_date,
            created_at=agent.created_at,
            use_cases=metadata.use_cases if metadata else None,
            features=metadata.features if metadata else None,
            personas=metadata.personas if metadata else None,
            version_info=metadata.version_info if metadata else None,
            vendor_name=vendor.name if vendor else None,
            vendor_logo_url=vendor.logo_url if vendor else None,
            onboarding_request_id=str(onboarding_req.id) if onboarding_req else None,
            workflow_status=onboarding_req.status if onboarding_req else None,
            workflow_current_step=onboarding_req.current_step if onboarding_req else None
        ))
    
    return AgentListResponse(
        agents=agent_responses,
        total=total,
        page=page,
        limit=limit
    )


class AgentUpdate(BaseModel):
    """Agent update schema - all fields optional"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=5000)
    version: Optional[str] = Field(None, min_length=1, max_length=50, pattern=r'^[\w\.-]+$')
    status: Optional[str] = Field(None, description="Agent status (draft, submitted, etc.)")
    capabilities: Optional[List[str]] = Field(None, max_items=50)
    data_types: Optional[List[str]] = Field(None, max_items=50)
    regions: Optional[List[str]] = Field(None, max_items=50)
    integrations: Optional[List[dict]] = Field(None, max_items=20)
    use_cases: Optional[List[str]] = Field(None, max_items=20)
    features: Optional[List[str]] = Field(None, max_items=50)
    personas: Optional[List[dict]] = Field(None, max_items=20)
    version_info: Optional[dict] = None
    connection_diagram: Optional[str] = Field(None, description="Mermaid diagram of agent connections")
    # AI/LLM information
    llm_vendor: Optional[str] = Field(None, max_length=100, description="LLM vendor (e.g., OpenAI, Anthropic, Google)")
    llm_model: Optional[str] = Field(None, max_length=500, description="LLM model name(s) - can be comma-separated for multiple models")
    deployment_type: Optional[str] = Field(None, description="Deployment type: public_cloud_saas, private_cloud_customer, vendor_cloud, onprem_customer, or hybrid")
    data_sharing_scope: Optional[dict] = Field(None, description="Information about what data is shared with LLM")
    data_usage_purpose: Optional[str] = Field(None, max_length=2000, description="How the agent uses data with the LLM")
    connections: Optional[List[dict]] = Field(None, description="Agent connections list")


class ConnectionDiagramUpdate(BaseModel):
    """Request schema for updating connection diagram"""
    connection_diagram: str


@router.patch("/{agent_id}/connection-diagram")
async def update_connection_diagram(
    agent_id: UUID,
    diagram_data: ConnectionDiagramUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update connection diagram (for reviewers and approvers)"""
    # Check permissions - allow reviewers, approvers, tenant admins, and platform admins
    allowed_roles = [
        "security_reviewer", "compliance_reviewer", "technical_reviewer",
        "business_reviewer", "approver", "tenant_admin", "platform_admin"
    ]
    
    if current_user.role.value not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reviewers, approvers, and admins can update connection diagrams"
        )
    
    # Get agent
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Validate tenant access
    validate_agent_tenant_access(agent, current_user, db)
    
    # Get or create metadata
    metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent_id).first()
    if not metadata:
        metadata = AgentMetadata(agent_id=agent_id)
        db.add(metadata)
    
    # Store previous diagram for audit
    previous_diagram = None
    if metadata.architecture_info and 'connection_diagram' in metadata.architecture_info:
        previous_diagram = metadata.architecture_info.get('connection_diagram')
    
    # Update connection diagram
    if not metadata.architecture_info:
        metadata.architecture_info = {}
    
    connection_diagram = diagram_data.connection_diagram
    metadata.architecture_info['connection_diagram'] = connection_diagram
    metadata.architecture_info['diagram_updated_by'] = str(current_user.id)
    metadata.architecture_info['diagram_updated_at'] = datetime.utcnow().isoformat()
    
    agent.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(agent)
    db.refresh(metadata)
    
    # Log audit event for connection diagram update
    try:
        audit_service.log_action(
            db=db,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            resource_type="agent",
            resource_id=str(agent_id),
            details={
                "field": "connection_diagram",
                "previous_value_length": len(previous_diagram) if previous_diagram else 0,
                "new_value_length": len(connection_diagram),
                "updated_by": current_user.email,
                "updated_at": datetime.utcnow().isoformat()
            }
        )
        db.commit()
    except Exception as audit_error:
        logger.warning(f"Failed to log audit event for connection diagram update: {audit_error}")
        # Don't fail the request if audit logging fails
    
    return {
        "message": "Connection diagram updated successfully",
        "connection_diagram": connection_diagram
    }


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    agent_data: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an agent (vendor can only update their own agents)"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Validate tenant access
    validate_agent_tenant_access(agent, current_user, db)
    
    # Update agent fields (only provided fields)
    update_data = agent_data.dict(exclude_unset=True)
    
    # Only allow updating draft agents (except for connection_diagram which can be updated by vendors)
    # Vendors can update connection_diagram even for submitted agents
    is_diagram_only_update = (
        'connection_diagram' in update_data and 
        len(update_data) == 1 and 
        current_user.role.value == "vendor_user"
    )
    
    # Allow status change from draft to submitted, but prevent other updates to non-draft agents
    is_status_change_from_draft = (
        agent.status == AgentStatus.DRAFT.value and 
        'status' in update_data and 
        update_data.get('status') != AgentStatus.DRAFT.value
    )
    
    # Check if user is an approver/reviewer with edit permissions during approval stages
    is_approver_or_reviewer = current_user.role.value in [
        "approver", "security_reviewer", "compliance_reviewer", 
        "technical_reviewer", "business_reviewer", "tenant_admin", "platform_admin"
    ]
    
    # Check if agent is in approval/review stage
    from app.models.workflow_config import OnboardingRequest
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.agent_id == agent.id,
        OnboardingRequest.status.in_(["pending", "in_review"])
    ).order_by(OnboardingRequest.created_at.desc()).first()
    
    is_in_approval_stage = (
        agent.status in [AgentStatus.SUBMITTED.value, AgentStatus.IN_REVIEW.value] and
        onboarding_request is not None
    )
    
    # Allow approvers/reviewers to edit during approval stages (but not status changes)
    can_edit_during_approval = (
        is_approver_or_reviewer and 
        is_in_approval_stage and
        'status' not in update_data  # Don't allow status changes via this endpoint
    )
    
    if (agent.status != AgentStatus.DRAFT.value and 
        update_data.get('status') != AgentStatus.DRAFT.value and 
        not is_diagram_only_update and
        not is_status_change_from_draft and
        not can_edit_during_approval):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft agents can be updated, or you must be an approver/reviewer during approval stages"
        )
    
    # Update agent fields (only provided fields)
    if 'name' in update_data:
        agent.name = update_data['name']
    if 'type' in update_data:
        agent.type = update_data['type']
    if 'category' in update_data:
        agent.category = update_data['category']
    if 'subcategory' in update_data:
        agent.subcategory = update_data['subcategory']
    if 'description' in update_data:
        agent.description = update_data['description']
    if 'version' in update_data:
        agent.version = update_data['version']
    if 'status' in update_data:
        try:
            AgentStatus(update_data['status'])
            agent.status = update_data['status']
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {update_data['status']}"
            )
    
    # Update or create metadata - ensure it always exists
    metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent_id).first()
    if not metadata:
        logger.warning(f"Metadata not found for agent {agent_id}, creating new metadata record")
        metadata = AgentMetadata(agent_id=agent_id)
        db.add(metadata)
        # Flush to ensure metadata is available for subsequent operations
        db.flush()
    
    if 'capabilities' in update_data:
        metadata.capabilities = update_data['capabilities']
    if 'data_types' in update_data:
        metadata.data_types = update_data['data_types']
    if 'regions' in update_data:
        metadata.regions = update_data['regions']
    if 'use_cases' in update_data:
        metadata.use_cases = update_data['use_cases']
    if 'features' in update_data:
        metadata.features = update_data['features']
    if 'personas' in update_data:
        metadata.personas = update_data['personas']
    if 'version_info' in update_data:
        metadata.version_info = update_data['version_info']
    if 'llm_vendor' in update_data:
        metadata.llm_vendor = update_data['llm_vendor']
    if 'llm_model' in update_data:
        metadata.llm_model = update_data['llm_model']
    if 'deployment_type' in update_data:
        metadata.deployment_type = update_data['deployment_type']
    if 'data_sharing_scope' in update_data:
        metadata.data_sharing_scope = update_data['data_sharing_scope']
    if 'data_usage_purpose' in update_data:
        metadata.data_usage_purpose = update_data['data_usage_purpose']
    
    connection_diagram = update_data.get('connection_diagram') or update_data.get('mermaid_diagram')
    if connection_diagram:
        # Store diagram in architecture_info (preserve the original format)
        if not metadata.architecture_info:
            metadata.architecture_info = {}
        metadata.architecture_info['connection_diagram'] = connection_diagram
        logger.info(f"Updated connection diagram for agent {agent.id}: {len(connection_diagram)} characters")
    
    # Handle workflow_current_step if provided
    if 'workflow_current_step' in update_data:
        if not metadata.extra_data:
            metadata.extra_data = {}
        metadata.extra_data['workflow_current_step'] = update_data['workflow_current_step']
    
    agent.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(agent)
    db.refresh(metadata)
    
    # Get vendor for response
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    
    return AgentResponse(
        id=str(agent.id),
        vendor_id=str(agent.vendor_id),
        name=agent.name,
        type=agent.type,
        category=agent.category,
        subcategory=agent.subcategory,
        description=agent.description,
        version=agent.version,
        status=agent.status,
        compliance_score=agent.compliance_score,
        risk_score=agent.risk_score,
        submission_date=agent.submission_date,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        capabilities=metadata.capabilities,
        data_types=metadata.data_types,
        regions=metadata.regions,
        integrations=metadata.integrations,
        use_cases=metadata.use_cases,
        features=metadata.features,
        personas=metadata.personas,
        version_info=metadata.version_info,
        llm_vendor=metadata.llm_vendor,
        llm_model=metadata.llm_model,
        deployment_type=metadata.deployment_type,
        data_sharing_scope=metadata.data_sharing_scope,
        data_usage_purpose=metadata.data_usage_purpose,
        vendor_name=vendor.name if vendor else None,
        vendor_logo_url=vendor.logo_url if vendor else None,
        architecture_info=metadata.architecture_info,
        workflow_current_step=metadata.extra_data.get('workflow_current_step') if metadata.extra_data else None
    )


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get agent details"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Validate tenant access
    validate_agent_tenant_access(agent, current_user, db)
    
    # Get metadata
    metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent.id).first()
    
    # Get vendor info
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    
    # Get workflow information
    from app.models.workflow_config import OnboardingRequest
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.agent_id == agent.id
    ).order_by(OnboardingRequest.created_at.desc()).first()
    
    workflow_status = None
    workflow_current_step = None
    onboarding_request_id = None
    
    if onboarding_request:
        onboarding_request_id = str(onboarding_request.id)
        workflow_status = onboarding_request.status
        workflow_current_step = onboarding_request.current_step
    elif metadata and metadata.extra_data:
        workflow_current_step = metadata.extra_data.get('workflow_current_step')
    
    # Convert to response model
    return AgentResponse(
        id=str(agent.id),
        vendor_id=str(agent.vendor_id),
        name=agent.name,
        type=agent.type,
        category=agent.category,
        subcategory=agent.subcategory,
        description=agent.description,
        version=agent.version,
        status=agent.status,
        compliance_score=agent.compliance_score,
        risk_score=agent.risk_score,
        submission_date=agent.submission_date,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        capabilities=metadata.capabilities if metadata else None,
        data_types=metadata.data_types if metadata else None,
        regions=metadata.regions if metadata else None,
        integrations=metadata.integrations if metadata else None,
        use_cases=metadata.use_cases if metadata else None,
        features=metadata.features if metadata else None,
        personas=metadata.personas if metadata else None,
        version_info=metadata.version_info if metadata else None,
        llm_vendor=metadata.llm_vendor if metadata else None,
        llm_model=metadata.llm_model if metadata else None,
        deployment_type=metadata.deployment_type if metadata else None,
        data_sharing_scope=metadata.data_sharing_scope if metadata else None,
        data_usage_purpose=metadata.data_usage_purpose if metadata else None,
        vendor_name=vendor.name if vendor else None,
        vendor_logo_url=vendor.logo_url if vendor else None,
        architecture_info=metadata.architecture_info if metadata else None,
        onboarding_request_id=onboarding_request_id,
        workflow_status=workflow_status,
        workflow_current_step=workflow_current_step
    )


@router.post("/{agent_id}/artifacts", status_code=status.HTTP_201_CREATED)
async def upload_artifact(
    agent_id: UUID,
    file: UploadFile = File(...),
    artifact_type: str = Query("DOCUMENTATION", regex="^(DOCUMENTATION|CODE|CERTIFICATION|TEST_RESULT)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload an artifact for an agent"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Validate tenant access
    validate_agent_tenant_access(agent, current_user, db)
    
    # Validate file
    content = await file.read()
    validate_file_upload(len(content))
    
    # Sanitize filename
    safe_filename = sanitize_input(file.filename or "unnamed", max_length=255)
    # Remove path components
    safe_filename = os.path.basename(safe_filename)
    # Replace dangerous characters
    safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', safe_filename)
    
    # Create upload directory if it doesn't exist
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(agent_id))
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save file with sanitized filename
    file_path = os.path.join(upload_dir, safe_filename)
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Create artifact record
    artifact = AgentArtifact(
        agent_id=agent_id,
        artifact_type=artifact_type,
        file_name=safe_filename,
        file_path=file_path,
        file_size=len(content),
        mime_type=file.content_type,
        extra_data={},  # Additional metadata can go here
    )
    
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    
    # Process and ingest document into RAG knowledge base (async, don't wait)
    try:
        from app.services.document_processor import document_processor
        # Ingest in background (fire and forget for now)
        import asyncio
        # Get the current event loop or create a new one
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Create task and ensure it's handled properly
        task = loop.create_task(
            document_processor.ingest_artifact(
                agent_id=str(agent_id),
                artifact_id=str(artifact.id),
                file_path=file_path,
                document_type=artifact_type.lower(),
                metadata={
                    "file_name": safe_filename,
                    "mime_type": file.content_type or "application/octet-stream",
                }
            )
        )
        # Add error callback to prevent unhandled exceptions
        def handle_task_error(task):
            try:
                task.result()
            except Exception as e:
                logger.error(f"Background RAG ingestion failed: {e}", exc_info=True)
        task.add_done_callback(handle_task_error)
    except Exception as e:
        logger.error(f"Failed to schedule artifact ingestion into RAG: {e}", exc_info=True)
        # Don't fail the upload if RAG ingestion fails
    
    return {
        "id": str(artifact.id),
        "file_name": artifact.file_name,
        "artifact_type": artifact.artifact_type,
        "file_size": artifact.file_size,
    }


@router.post("/{agent_id}/submit", response_model=AgentResponse)
async def submit_agent(
    agent_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit agent for review"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Validate tenant access
    validate_agent_tenant_access(agent, current_user, db)
    
    # Handle already submitted agents - check if there's an active onboarding request
    if agent.status == AgentStatus.SUBMITTED.value:
        from app.models.workflow_config import OnboardingRequest
        existing_request = db.query(OnboardingRequest).filter(
            OnboardingRequest.agent_id == agent.id,
            OnboardingRequest.status.in_(["pending", "in_review"])
        ).order_by(OnboardingRequest.created_at.desc()).first()
        
        if existing_request:
            # Agent is already submitted and has an active onboarding request
            # Return the agent as-is (idempotent behavior)
            logger.info(f"Agent {agent.id} is already submitted with active onboarding request {existing_request.id}")
            # Refresh agent to get latest data
            db.refresh(agent)
            # Get workflow information
            workflow_status = existing_request.status
            workflow_current_step = existing_request.current_step
            onboarding_request_id = str(existing_request.id)
            # Return agent response
            return AgentResponse(
                id=str(agent.id),
                vendor_id=str(agent.vendor_id),
                name=agent.name,
                type=agent.type,
                category=agent.category,
                subcategory=agent.subcategory,
                description=agent.description,
                version=agent.version,
                status=agent.status,
                compliance_score=agent.compliance_score,
                risk_score=agent.risk_score,
                submission_date=agent.submission_date,
                created_at=agent.created_at,
                onboarding_request_id=onboarding_request_id,
                workflow_status=workflow_status,
                workflow_current_step=workflow_current_step
            )
        else:
            # Submitted but no active request - might have been rejected or request failed
            # Allow resubmission by treating it as if it needs to be resubmitted
            logger.info(f"Agent {agent.id} is submitted but has no active onboarding request, allowing resubmission")
            # Continue with submission process
    
    # Allow submission from draft, rejected, or submitted (if no active request) status
    if agent.status not in [AgentStatus.DRAFT.value, AgentStatus.REJECTED.value, AgentStatus.SUBMITTED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent cannot be submitted from {agent.status} status. Only draft, rejected, or submitted (without active request) agents can be submitted."
        )
    
    # Validate required fields before submission
    metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent_id).first()
    if not metadata:
        # Try to create metadata if it doesn't exist (shouldn't happen, but defensive programming)
        logger.warning(f"Metadata not found for agent {agent_id} during submission, creating it")
        try:
            metadata = AgentMetadata(agent_id=agent_id)
            db.add(metadata)
            db.commit()
            db.refresh(metadata)
            logger.info(f"Created metadata for agent {agent_id} during submission")
        except Exception as e:
            logger.error(f"Failed to create metadata for agent {agent_id} during submission: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Agent metadata is required before submission and could not be created automatically. Please update the agent first."
            )
    
    # Get vendor and ensure it has a tenant_id
    # Import Vendor here to avoid UnboundLocalError (defensive import)
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found for this agent"
        )
    
    # Assign vendor to tenant if missing (from current user's tenant)
    if not vendor.tenant_id and current_user.tenant_id:
        vendor.tenant_id = current_user.tenant_id
        db.commit()
        db.refresh(vendor)
        logger.info(f"Assigned vendor {vendor.id} to tenant {current_user.tenant_id}")
    
    if not vendor.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent vendor must be assigned to a tenant. Please contact your administrator."
        )
    
    agent.status = AgentStatus.SUBMITTED.value
    agent.submission_date = datetime.utcnow()
    
    db.commit()
    db.refresh(agent)
    
    # Create onboarding request to trigger workflow
    from app.models.workflow_config import OnboardingRequest, WorkflowConfiguration, WorkflowConfigStatus
    
    # Check if onboarding request already exists (only for pending/in_review - allow new request if rejected)
    existing_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.agent_id == agent.id,
        OnboardingRequest.status.in_(["pending", "in_review"])
    ).order_by(OnboardingRequest.created_at.desc()).first()
    
    if existing_request:
        logger.info(f"Found existing onboarding request {existing_request.id} for agent {agent.id}, status: {existing_request.status}")
        onboarding_request = existing_request
    else:
        onboarding_request = None
        logger.info(f"No existing onboarding request found for agent {agent.id}, will create new one")
    
    if onboarding_request is None:
        logger.info(f"Creating new onboarding request for agent {agent.id}, vendor tenant: {vendor.tenant_id}")
        # Find default workflow for tenant (try active first, then any default)
        from app.models.workflow_config import WorkflowConfigStatus
        workflow_config = None
        
        # Try to find active default workflow
        try:
            workflow_config = db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.tenant_id == vendor.tenant_id,
                WorkflowConfiguration.is_default == True,
                WorkflowConfiguration.status == WorkflowConfigStatus.ACTIVE.value
            ).first()
        except Exception as e:
            logger.warning(f"Error querying for active workflow: {str(e)}")
            # Try without status filter
            try:
                workflow_config = db.query(WorkflowConfiguration).filter(
                    WorkflowConfiguration.tenant_id == vendor.tenant_id,
                    WorkflowConfiguration.is_default == True
                ).first()
            except Exception as e2:
                logger.error(f"Error querying for any default workflow: {str(e2)}")
        
        # If no active default workflow, try to find any default workflow
        if not workflow_config:
            try:
                workflow_config = db.query(WorkflowConfiguration).filter(
                    WorkflowConfiguration.tenant_id == vendor.tenant_id,
                    WorkflowConfiguration.is_default == True
                ).first()
            except Exception as e:
                logger.error(f"Error querying for default workflow: {str(e)}")
        
        if workflow_config:
            step_count = len(workflow_config.workflow_steps) if workflow_config.workflow_steps else 0
            logger.info(f"Found workflow_config for tenant {vendor.tenant_id}: {workflow_config.id}, status: {workflow_config.status}, steps: {step_count}")
        else:
            logger.warning(f"No workflow_config found for tenant {vendor.tenant_id}, creating default...")
        
        # If no default workflow exists, create one
        if not workflow_config:
            from app.services.workflow_seeder import create_default_workflow_for_tenant
            try:
                logger.info(f"Attempting to create default workflow for tenant {vendor.tenant_id}")
                workflow_config = create_default_workflow_for_tenant(db, vendor.tenant_id, current_user.id)
                if workflow_config:
                    # The seeder already commits, but we need to refresh to get the workflow_steps
                    db.refresh(workflow_config)
                    # Ensure workflow is ACTIVE
                    if workflow_config.status != "active":
                        from app.models.workflow_config import WorkflowConfigStatus
                        workflow_config.status = WorkflowConfigStatus.ACTIVE.value
                        db.commit()
                        db.refresh(workflow_config)
                    
                    steps = workflow_config.workflow_steps
                    if isinstance(steps, str):
                        import json
                        steps = json.loads(steps)
                    step_count = len(steps) if isinstance(steps, list) else 0
                    logger.info(f"✅ Created default workflow {workflow_config.id} for tenant {vendor.tenant_id}")
                    logger.info(f"   Status: {workflow_config.status}, Steps: {step_count}, Engine: {workflow_config.workflow_engine}")
                    logger.info(f"   Steps structure: {type(steps)}, First step: {steps[0] if isinstance(steps, list) and steps else 'None'}")
                else:
                    logger.error(f"❌ create_default_workflow_for_tenant returned None for tenant {vendor.tenant_id}")
                    workflow_config = None
            except Exception as e:
                logger.error(f"❌ Failed to create default workflow for tenant {vendor.tenant_id}: {str(e)}", exc_info=True)
                # Continue without workflow if creation fails
                workflow_config = None
                db.rollback()  # Rollback any partial changes
        
        # Determine workflow engine
        workflow_engine = "internal"
        workflow_config_id = None
        if workflow_config:
            workflow_config_id = workflow_config.id
            # Handle workflow_engine - it's stored as string in DB
            if hasattr(workflow_config.workflow_engine, 'value'):
                workflow_engine = workflow_config.workflow_engine.value
            else:
                workflow_engine = str(workflow_config.workflow_engine) if workflow_config.workflow_engine else "internal"
        
        # Find the invitation that led to this vendor registration
        invitation_id = None
        business_contact_id = None
        from app.models.vendor_invitation import VendorInvitation, InvitationStatus
        invitation = db.query(VendorInvitation).filter(
            VendorInvitation.vendor_id == vendor.id,
            VendorInvitation.status == InvitationStatus.ACCEPTED
        ).order_by(VendorInvitation.accepted_at.desc()).first()
        
        if invitation:
            invitation_id = invitation.id
            business_contact_id = invitation.invited_by  # Person who invited the vendor
            logger.info(f"✅ Found invitation {invitation_id} for vendor {vendor.id}, business contact: {business_contact_id}")
        
        # Create onboarding request
        onboarding_request = OnboardingRequest(
            agent_id=agent.id,
            tenant_id=vendor.tenant_id,
            requested_by=current_user.id,
            request_type="onboarding",
            workflow_config_id=workflow_config_id,
            workflow_engine=workflow_engine,
            status="pending",
            current_step=0,
            invitation_id=invitation_id,
            business_contact_id=business_contact_id
        )
        
        # Auto-assign assessments based on rules (moved to background task to avoid blocking)
        async def auto_assign_assessments_task():
            """Background task to auto-assign assessments"""
            try:
                from app.core.database import SessionLocal
                background_db = SessionLocal()
                try:
                    # Refresh vendor and agent in background session
                    background_vendor = background_db.query(Vendor).filter(Vendor.id == vendor.id).first()
                    background_agent = background_db.query(Agent).filter(Agent.id == agent.id).first()
                    
                    if background_vendor and background_agent:
                        from app.services.assessment_service import AssessmentService
                        assessment_service = AssessmentService(background_db)
                        assessment_service.auto_assign_assessments(
                            vendor=background_vendor,
                            agent=background_agent,
                            assignment_type='agent_onboarding'
                        )
                        logger.info(f"Auto-assigned assessments for agent {agent.id}")
                finally:
                    background_db.close()
            except Exception as e:
                logger.warning(f"Failed to auto-assign assessments for agent {agent.id}: {e}", exc_info=True)
                # Don't fail the agent submission if assessment assignment fails
        
        background_tasks.add_task(auto_assign_assessments_task)
        
        # Initialize workflow - assign to first step if workflow exists
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
            
            if not isinstance(steps, list):
                logger.warning(f"Workflow steps is not a list: {type(steps)}, value: {steps}")
                steps = []
            
            if steps:
                # Always start at step 1 (lowest step_number) - workflow follows sequential order
                sorted_steps = sorted(steps, key=lambda x: x.get("step_number", 999))
                first_step = sorted_steps[0] if sorted_steps else None
                
                if first_step:
                    step_number = first_step.get("step_number", 1)
                    onboarding_request.current_step = step_number
                    onboarding_request.status = "in_review"
                    logger.info(f"✅ Initialized workflow to step {step_number}: {first_step.get('step_name', 'Unknown')}")
                    logger.info(f"   Workflow Config: {workflow_config.id}, Steps: {len(steps)}")
                    
                    # Auto-assign if configured
                    if first_step.get("auto_assign", False):
                        assigned_role = first_step.get("assigned_role")
                        
                        # Priority 1: If business_contact_id exists (person who invited), assign to them for first step
                        if business_contact_id and step_number == 1:
                            business_contact = db.query(User).filter(
                                User.id == business_contact_id,
                                User.is_active == True
                            ).first()
                            if business_contact:
                                onboarding_request.assigned_to = business_contact.id
                                logger.info(f"✅ Assigned first step to business contact (inviter): {business_contact.email}")
                            else:
                                logger.warning(f"⚠️ Business contact {business_contact_id} not found or inactive")
                                # Fall through to role-based assignment
                        
                        # Priority 2: Role-based assignment (if not assigned to business contact)
                        if not onboarding_request.assigned_to and assigned_role:
                            # Find user with the assigned role in the tenant
                            from app.models.user import UserRole
                            try:
                                # Map role string to enum (e.g., "security_reviewer" -> UserRole.SECURITY_REVIEWER)
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
                                        User.tenant_id == vendor.tenant_id,
                                        User.role == role_enum,
                                        User.is_active == True
                                    ).first()
                                    if assignee:
                                        onboarding_request.assigned_to = assignee.id
                                        logger.info(f"✅ Auto-assigned to {assignee.email} ({assigned_role})")
                                    else:
                                        logger.warning(f"⚠️ No active user found with role {assigned_role} in tenant {vendor.tenant_id}")
                                        # Assign to tenant admin as fallback
                                        tenant_admin = db.query(User).filter(
                                            User.tenant_id == vendor.tenant_id,
                                            User.role == UserRole.TENANT_ADMIN,
                                            User.is_active == True
                                        ).first()
                                        if tenant_admin:
                                            onboarding_request.assigned_to = tenant_admin.id
                                            logger.info(f"✅ Fallback: Assigned to tenant admin {tenant_admin.email}")
                                else:
                                    logger.warning(f"⚠️ Unknown role in workflow: {assigned_role}")
                            except (KeyError, AttributeError, TypeError) as e:
                                logger.warning(f"⚠️ Error mapping role {assigned_role}: {str(e)}")
                    else:
                        logger.info(f"   Auto-assign is disabled for step {step_number}")
                else:
                    logger.warning(f"⚠️ No first step found in workflow {workflow_config.id} (steps: {len(steps)})")
            else:
                logger.warning(f"⚠️ Workflow {workflow_config.id} has empty steps list")
        else:
            if workflow_config:
                logger.warning(f"⚠️ Workflow {workflow_config.id} has no steps defined (workflow_steps: {workflow_config.workflow_steps})")
            else:
                logger.warning(f"⚠️ No workflow config found for tenant {vendor.tenant_id}, onboarding request will remain in pending status")
        
        try:
            db.add(onboarding_request)
            db.commit()
            db.refresh(onboarding_request)
            logger.info(f"✅ Successfully created onboarding request {onboarding_request.id} for agent {agent.id}")
            logger.info(f"   Status: {onboarding_request.status}, Step: {onboarding_request.current_step}, Workflow Config: {onboarding_request.workflow_config_id}")
            logger.info(f"   Assigned To: {onboarding_request.assigned_to}")
            
            # Trigger workflow orchestration in background (non-blocking)
            if workflow_config and onboarding_request.status == "in_review":
                # Schedule workflow orchestration as background task to avoid blocking response
                async def execute_workflow_orchestration():
                    """Background task to execute workflow orchestration"""
                    try:
                        # Create a new database session for background task
                        from app.core.database import SessionLocal
                        background_db = SessionLocal()
                        try:
                            from app.services.workflow_orchestration import WorkflowOrchestrationService
                            orchestration = WorkflowOrchestrationService(background_db, vendor.tenant_id)
                            
                            # Determine workflow stage from status
                            workflow_stage = "pending_approval"  # Default for in_review status
                            
                            # Get agent data for workflow orchestration
                            agent_data = {
                                "id": str(agent.id),
                                "name": agent.name,
                                "type": agent.type,
                                "category": agent.category,
                                "status": agent.status
                            }
                            
                            # Evaluate business rules for the first step
                            rule_results = orchestration.evaluate_business_rules_for_stage(
                                entity_type="agent",
                                entity_id=agent.id,
                                entity_data=agent_data,
                                request_type="agent_onboarding_workflow",
                                workflow_stage=workflow_stage,
                                user=current_user,
                                auto_execute=True
                            )
                            logger.info(f"✅ Workflow orchestration executed for agent {agent.id}: {rule_results.get('matched_rules', 0)} rules matched")
                            
                            # Send stage notifications if configured
                            if onboarding_request.assigned_to:
                                assigned_user = background_db.query(User).filter(User.id == onboarding_request.assigned_to).first()
                                if assigned_user:
                                    try:
                                        await orchestration.send_stage_notifications(
                                            workflow_config=workflow_config,
                                            workflow_stage=workflow_stage,
                                            entity_type="agent",
                                            entity_id=agent.id,
                                            entity_data=agent_data,
                                            user=assigned_user
                                        )
                                        logger.info(f"✅ Stage notifications sent for agent {agent.id}")
                                    except Exception as notif_error:
                                        logger.warning(f"⚠️ Failed to send stage notifications for agent {agent.id}: {str(notif_error)}")
                                        # Don't fail if notifications fail
                        finally:
                            background_db.close()
                    except Exception as orchestration_error:
                        logger.warning(f"⚠️ Workflow orchestration failed for agent {agent.id}: {str(orchestration_error)}", exc_info=True)
                        # Don't fail the submission if orchestration fails
                
                # Add background task (executes after response is sent)
                background_tasks.add_task(execute_workflow_orchestration)
                logger.info(f"📋 Scheduled workflow orchestration as background task for agent {agent.id}")
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Failed to create onboarding request for agent {agent.id}: {str(e)}", exc_info=True)
            # Don't fail the submission, but log the error
            onboarding_request = None
    else:
        logger.info(f"Using existing onboarding request {onboarding_request.id} for agent {agent.id}, status: {onboarding_request.status}")
    
    # Create ticket for tracking (moved to background task to avoid blocking)
    async def create_ticket_task():
        """Background task to create ticket"""
        try:
            from app.core.database import SessionLocal
            background_db = SessionLocal()
            try:
                from app.services.ticket_service import TicketService
                ticket = TicketService.create_ticket(
                    db=background_db,
                    agent_id=agent.id,
                    submitted_by=current_user.id,
                    tenant_id=vendor.tenant_id,
                    title=f"Agent Submission: {agent.name}",
                    description=f"Ticket created for agent {agent.name} submission"
                )
                logger.info(f"Created ticket for agent {agent.id}")
            finally:
                background_db.close()
        except Exception as e:
            # Log error but don't fail the submission
            logger.error(f"Failed to create ticket for agent {agent.id}: {str(e)}")
    
    background_tasks.add_task(create_ticket_task)
    
    # Audit log (moved to background task to avoid blocking)
    async def audit_log_task():
        """Background task to log audit action"""
        try:
            from app.core.database import SessionLocal
            background_db = SessionLocal()
            try:
                from app.core.audit import audit_service
                audit_service.log_action(
                    db=background_db,
                    user_id=str(current_user.id),
                    action=AuditAction.SUBMIT,
                    resource_type="agent",
                    resource_id=str(agent.id),
                    tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
                    details={"name": agent.name},
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent")
                )
            finally:
                background_db.close()
        except Exception as e:
            logger.warning(f"Failed to log audit action for agent {agent.id}: {str(e)}")
    
    background_tasks.add_task(audit_log_task)
    
    # Invalidate cache (non-blocking, but keep synchronous for immediate effect)
    try:
        invalidate_cache(f"agents:*")
    except Exception as e:
        logger.warning(f"Failed to invalidate cache: {str(e)}")
    
    # Get workflow information - refresh from DB to ensure we have latest
    workflow_status = None
    workflow_current_step = None
    onboarding_request_id = None
    
    if onboarding_request:
        onboarding_request_id = str(onboarding_request.id)
        workflow_status = onboarding_request.status
        workflow_current_step = onboarding_request.current_step
        logger.info(f"✅ Returning onboarding_request_id {onboarding_request_id} in response for agent {agent.id}")
    else:
        # Try to get from DB in case creation failed silently
        latest_request = db.query(OnboardingRequest).filter(
            OnboardingRequest.agent_id == agent.id
        ).order_by(OnboardingRequest.created_at.desc()).first()
        if latest_request:
            onboarding_request_id = str(latest_request.id)
            workflow_status = latest_request.status
            workflow_current_step = latest_request.current_step
            logger.info(f"✅ Retrieved onboarding request {onboarding_request_id} from DB for agent {agent.id}")
        else:
            logger.warning(f"⚠️ No onboarding request found for agent {agent.id} after submission")
    
    # Convert to response model
    return AgentResponse(
        id=str(agent.id),
        vendor_id=str(agent.vendor_id),
        name=agent.name,
        type=agent.type,
        category=agent.category,
        subcategory=agent.subcategory,
        description=agent.description,
        version=agent.version,
        status=agent.status,
        compliance_score=agent.compliance_score,
        risk_score=agent.risk_score,
        submission_date=agent.submission_date,
        created_at=agent.created_at,
        onboarding_request_id=onboarding_request_id,
        workflow_status=workflow_status,
        workflow_current_step=workflow_current_step
    )

