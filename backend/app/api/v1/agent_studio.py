"""
Agent Studio API - Centralized Agent Governance and Management
Provides unified interface for managing agents, products, and services with governance focus
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
import logging

from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.ecosystem_entity_service import EcosystemEntityService, EntityType, EntityStatus
from app.models.ecosystem_entity import EcosystemEntity, SharedGovernanceProfile, EntityLifecycleEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent-studio", tags=["agent-studio"])


class GovernanceEntityCreate(BaseModel):
    """Create request for governance entities"""
    name: str = Field(..., min_length=1, max_length=255)
    entity_type: EntityType
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    version: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    organization: Optional[str] = Field(None, max_length=255)
    governance_owner_id: Optional[UUID] = None
    skills: Optional[List[str]] = Field(None, max_items=50)
    service_account: Optional[str] = Field(None, max_length=255)
    kill_switch_enabled: bool = False
    compliance_standards: Optional[List[str]] = Field(None, max_items=20)
    security_controls: Optional[List[str]] = Field(None, max_items=50)
    documentation_urls: Optional[Dict[str, str]] = None
    architecture_diagrams: Optional[List[str]] = Field(None, max_items=10)
    landscape_diagrams: Optional[List[str]] = Field(None, max_items=10)


class GovernanceEntityUpdate(BaseModel):
    """Update request for governance entities"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    version: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    organization: Optional[str] = Field(None, max_length=255)
    governance_owner_id: Optional[UUID] = None
    skills: Optional[List[str]] = Field(None, max_items=50)
    service_account: Optional[str] = Field(None, max_length=255)
    kill_switch_enabled: Optional[bool] = None
    compliance_standards: Optional[List[str]] = Field(None, max_items=20)
    security_controls: Optional[List[str]] = Field(None, max_items=50)
    documentation_urls: Optional[Dict[str, str]] = None
    architecture_diagrams: Optional[List[str]] = Field(None, max_items=10)
    landscape_diagrams: Optional[List[str]] = Field(None, max_items=10)
    status: Optional[EntityStatus] = None


class GovernanceEntityResponse(BaseModel):
    """Response model for governance entities"""
    id: str
    tenant_id: str
    vendor_id: str
    name: str
    entity_type: EntityType
    category: Optional[str]
    subcategory: Optional[str]
    description: Optional[str]
    version: Optional[str]
    status: EntityStatus
    department: Optional[str]
    organization: Optional[str]
    service_account: Optional[str]
    kill_switch_enabled: bool
    last_governance_review: Optional[datetime]
    governance_owner_id: Optional[str]
    skills: Optional[List[str]]
    compliance_score: Optional[int]
    risk_score: Optional[int]
    security_controls: Optional[List[str]]
    compliance_standards: Optional[List[str]]
    documentation_urls: Optional[Dict[str, str]]
    architecture_diagrams: Optional[List[str]]
    landscape_diagrams: Optional[List[str]]
    related_entity_ids: Optional[List[str]]
    submission_date: Optional[datetime]
    approval_date: Optional[datetime]
    activation_date: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Computed fields
    vendor_name: Optional[str] = None
    governance_owner_name: Optional[str] = None
    related_entities_summary: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        from_attributes = True


class GovernanceProfileCreate(BaseModel):
    """Create request for governance profiles"""
    name: str = Field(..., min_length=1, max_length=255)
    profile_type: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=1000)
    security_controls: Optional[List[str]] = Field(None, max_items=50)
    compliance_standards: Optional[List[str]] = Field(None, max_items=20)
    monitoring_requirements: Optional[List[str]] = Field(None, max_items=30)
    documentation_templates: Optional[Dict[str, str]] = None


class GovernanceProfileResponse(BaseModel):
    """Response model for governance profiles"""
    id: str
    tenant_id: str
    name: str
    profile_type: str
    description: Optional[str]
    security_controls: Optional[List[str]]
    compliance_standards: Optional[List[str]]
    monitoring_requirements: Optional[List[str]]
    documentation_templates: Optional[Dict[str, str]]
    entity_count: int
    last_applied: Optional[datetime]
    created_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class StudioDashboardResponse(BaseModel):
    """Dashboard response with aggregated governance metrics"""
    total_entities: int
    entities_by_type: Dict[str, int]
    entities_by_status: Dict[str, int]
    entities_by_department: Dict[str, int]
    entities_by_risk_level: Dict[str, int]
    compliance_summary: Dict[str, Any]
    recent_activities: List[Dict[str, Any]]
    governance_alerts: List[Dict[str, Any]]
    upcoming_reviews: List[Dict[str, Any]]


@router.get("/dashboard", response_model=StudioDashboardResponse)
async def get_studio_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Agent Studio dashboard with governance metrics"""
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant"
        )
    
    service = EcosystemEntityService(db)
    
    # Get all entities for tenant
    entities = service.list_entities(tenant_id=current_user.tenant_id)
    
    # Calculate metrics
    total_entities = len(entities)
    entities_by_type = {}
    entities_by_status = {}
    entities_by_department = {}
    entities_by_risk_level = {"low": 0, "medium": 0, "high": 0}
    
    for entity in entities:
        # By type
        type_key = entity.entity_type.value
        entities_by_type[type_key] = entities_by_type.get(type_key, 0) + 1
        
        # By status
        status_key = entity.status.value
        entities_by_status[status_key] = entities_by_status.get(status_key, 0) + 1
        
        # By department
        dept = entity.department or "Unassigned"
        entities_by_department[dept] = entities_by_department.get(dept, 0) + 1
        
        # By risk level (based on risk score)
        if entity.risk_score:
            if entity.risk_score <= 3:
                entities_by_risk_level["low"] += 1
            elif entity.risk_score <= 7:
                entities_by_risk_level["medium"] += 1
            else:
                entities_by_risk_level["high"] += 1
    
    # Get recent activities (last 10 lifecycle events)
    recent_events = db.query(EntityLifecycleEvent).filter(
        EntityLifecycleEvent.tenant_id == current_user.tenant_id
    ).order_by(EntityLifecycleEvent.created_at.desc()).limit(10).all()
    
    recent_activities = []
    for event in recent_events:
        entity = service.get_entity(event.entity_id)
        recent_activities.append({
            "timestamp": event.created_at.isoformat(),
            "entity_name": entity.name if entity else "Unknown",
            "entity_type": entity.entity_type.value if entity else "unknown",
            "event_type": event.event_type,
            "status_change": f"{event.from_status.value if event.from_status else 'N/A'} → {event.to_status.value}" if event.from_status else event.to_status.value,
            "triggered_by": str(event.triggered_by) if event.triggered_by else None
        })
    
    # Get governance alerts (entities needing attention)
    governance_alerts = []
    
    # Alert: Kill switch enabled
    kill_switch_entities = [e for e in entities if e.kill_switch_enabled]
    if kill_switch_entities:
        governance_alerts.append({
            "type": "warning",
            "title": "Kill Switch Enabled",
            "message": f"{len(kill_switch_entities)} entities have emergency kill switch enabled",
            "count": len(kill_switch_entities),
            "severity": "high"
        })
    
    # Alert: Overdue governance reviews
    overdue_reviews = [e for e in entities 
                      if e.last_governance_review and 
                      (datetime.utcnow() - e.last_governance_review).days > 90]
    if overdue_reviews:
        governance_alerts.append({
            "type": "warning", 
            "title": "Overdue Governance Reviews",
            "message": f"{len(overdue_reviews)} entities haven't been reviewed in 90+ days",
            "count": len(overdue_reviews),
            "severity": "medium"
        })
    
    # Get upcoming reviews (within next 30 days)
    upcoming_reviews = []
    for entity in entities:
        if entity.last_governance_review:
            days_since_review = (datetime.utcnow() - entity.last_governance_review).days
            if 60 <= days_since_review <= 90:  # Due in next 30 days
                upcoming_reviews.append({
                    "entity_id": str(entity.id),
                    "entity_name": entity.name,
                    "entity_type": entity.entity_type.value,
                    "last_review": entity.last_governance_review.isoformat(),
                    "days_until_due": 90 - days_since_review
                })
    
    return StudioDashboardResponse(
        total_entities=total_entities,
        entities_by_type=entities_by_type,
        entities_by_status=entities_by_status,
        entities_by_department=entities_by_department,
        entities_by_risk_level=entities_by_risk_level,
        compliance_summary={
            "average_compliance_score": sum(e.compliance_score or 0 for e in entities) / len(entities) if entities else 0,
            "fully_compliant_count": len([e for e in entities if (e.compliance_score or 0) >= 80]),
            "needs_attention_count": len([e for e in entities if (e.compliance_score or 0) < 60])
        },
        recent_activities=recent_activities,
        governance_alerts=governance_alerts,
        upcoming_reviews=upcoming_reviews[:10]  # Limit to top 10
    )


@router.post("/entities", response_model=GovernanceEntityResponse, status_code=status.HTTP_201_CREATED)
async def create_governance_entity(
    entity_data: GovernanceEntityCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new governance entity (agent, product, or service)"""
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant"
        )
    
    # Get or create vendor for current user
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(
        Vendor.contact_email == current_user.email,
        Vendor.tenant_id == current_user.tenant_id
    ).first()
    
    if not vendor:
        vendor = Vendor(
            name=f"{current_user.name}'s Organization",
            contact_email=current_user.email,
            tenant_id=current_user.tenant_id
        )
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
    
    service = EcosystemEntityService(db)
    
    try:
        entity = service.create_entity(
            tenant_id=current_user.tenant_id,
            vendor_id=vendor.id,
            entity_type=entity_data.entity_type,
            name=entity_data.name,
            category=entity_data.category,
            subcategory=entity_data.subcategory,
            description=entity_data.description,
            version=entity_data.version,
            department=entity_data.department,
            organization=entity_data.organization,
            governance_owner_id=entity_data.governance_owner_id,
            skills=entity_data.skills,
            service_account=entity_data.service_account,
            kill_switch_enabled=entity_data.kill_switch_enabled,
            compliance_standards=entity_data.compliance_standards,
            security_controls=entity_data.security_controls,
            documentation_urls=entity_data.documentation_urls,
            architecture_diagrams=entity_data.architecture_diagrams,
            landscape_diagrams=entity_data.landscape_diagrams
        )
        
        # Get related data for response
        vendor_obj = db.query(Vendor).filter(Vendor.id == entity.vendor_id).first()
        governance_owner = None
        if entity.governance_owner_id:
            governance_owner = db.query(User).filter(User.id == entity.governance_owner_id).first()
        
        return GovernanceEntityResponse(
            id=str(entity.id),
            tenant_id=str(entity.tenant_id),
            vendor_id=str(entity.vendor_id),
            name=entity.name,
            entity_type=entity.entity_type,
            category=entity.category,
            subcategory=entity.subcategory,
            description=entity.description,
            version=entity.version,
            status=entity.status,
            department=entity.department,
            organization=entity.organization,
            service_account=entity.service_account,
            kill_switch_enabled=entity.kill_switch_enabled,
            last_governance_review=entity.last_governance_review,
            governance_owner_id=str(entity.governance_owner_id) if entity.governance_owner_id else None,
            skills=entity.skills,
            compliance_score=entity.compliance_score,
            risk_score=entity.risk_score,
            security_controls=entity.security_controls,
            compliance_standards=entity.compliance_standards,
            documentation_urls=entity.documentation_urls,
            architecture_diagrams=entity.architecture_diagrams,
            landscape_diagrams=entity.landscape_diagrams,
            related_entity_ids=[str(eid) for eid in (entity.related_entity_ids or [])],
            submission_date=entity.submission_date,
            approval_date=entity.approval_date,
            activation_date=entity.activation_date,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            vendor_name=vendor_obj.name if vendor_obj else None,
            governance_owner_name=governance_owner.name if governance_owner else None
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create governance entity: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create entity: {str(e)}"
        )


@router.get("/entities", response_model=List[GovernanceEntityResponse])
async def list_governance_entities(
    entity_types: Optional[str] = Query(None, description="Comma-separated entity types: agent,product,service"),
    statuses: Optional[str] = Query(None, description="Comma-separated statuses"),
    department: Optional[str] = Query(None, description="Filter by department"),
    organization: Optional[str] = Query(None, description="Filter by organization"),
    search: Optional[str] = Query(None, description="Search term for name/description"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List governance entities with filtering"""
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant"
        )
    
    service = EcosystemEntityService(db)
    
    # Parse filters
    entity_type_list = None
    if entity_types:
        type_values = [t.strip() for t in entity_types.split(',')]
        entity_type_list = [EntityType(t) for t in type_values if t in ['agent', 'product', 'service']]
    
    status_list = None
    if statuses:
        status_values = [s.strip() for s in statuses.split(',')]
        status_list = [EntityStatus(s) for s in status_values]
    
    entities = service.list_entities(
        tenant_id=current_user.tenant_id,
        entity_types=entity_type_list,
        statuses=status_list,
        department=department,
        organization=organization,
        search_term=search
    )
    
    # Convert to response models
    response_models = []
    for entity in entities:
        vendor = db.query(Vendor).filter(Vendor.id == entity.vendor_id).first()
        governance_owner = None
        if entity.governance_owner_id:
            governance_owner = db.query(User).filter(User.id == entity.governance_owner_id).first()
        
        response_models.append(GovernanceEntityResponse(
            id=str(entity.id),
            tenant_id=str(entity.tenant_id),
            vendor_id=str(entity.vendor_id),
            name=entity.name,
            entity_type=entity.entity_type,
            category=entity.category,
            subcategory=entity.subcategory,
            description=entity.description,
            version=entity.version,
            status=entity.status,
            department=entity.department,
            organization=entity.organization,
            service_account=entity.service_account,
            kill_switch_enabled=entity.kill_switch_enabled,
            last_governance_review=entity.last_governance_review,
            governance_owner_id=str(entity.governance_owner_id) if entity.governance_owner_id else None,
            skills=entity.skills,
            compliance_score=entity.compliance_score,
            risk_score=entity.risk_score,
            security_controls=entity.security_controls,
            compliance_standards=entity.compliance_standards,
            documentation_urls=entity.documentation_urls,
            architecture_diagrams=entity.architecture_diagrams,
            landscape_diagrams=entity.landscape_diagrams,
            related_entity_ids=[str(eid) for eid in (entity.related_entity_ids or [])],
            submission_date=entity.submission_date,
            approval_date=entity.approval_date,
            activation_date=entity.activation_date,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            vendor_name=vendor.name if vendor else None,
            governance_owner_name=governance_owner.name if governance_owner else None
        ))
    
    return response_models


@router.patch("/entities/{entity_id}/status")
async def update_entity_status(
    entity_id: UUID,
    status: EntityStatus,
    reason: Optional[str] = None,
    workflow_step: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update entity status (governance workflow actions)"""
    
    service = EcosystemEntityService(db)
    
    try:
        entity = service.update_entity_status(
            entity_id=entity_id,
            new_status=status,
            triggered_by=current_user.id,
            reason=reason,
            workflow_step=workflow_step
        )
        
        return {
            "message": f"Entity status updated to {status.value}",
            "entity_id": str(entity.id),
            "new_status": entity.status.value
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to update entity status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update status: {str(e)}"
        )


@router.post("/profiles", response_model=GovernanceProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_governance_profile(
    profile_data: GovernanceProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a shared governance profile"""
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant"
        )
    
    service = EcosystemEntityService(db)
    
    try:
        profile = service.create_governance_profile(
            tenant_id=current_user.tenant_id,
            name=profile_data.name,
            profile_type=profile_data.profile_type,
            description=profile_data.description,
            security_controls=profile_data.security_controls,
            compliance_standards=profile_data.compliance_standards,
            monitoring_requirements=profile_data.monitoring_requirements,
            documentation_templates=profile_data.documentation_templates,
            created_by=current_user.id
        )
        
        return GovernanceProfileResponse(
            id=str(profile.id),
            tenant_id=str(profile.tenant_id),
            name=profile.name,
            profile_type=profile.profile_type,
            description=profile.description,
            security_controls=profile.security_controls,
            compliance_standards=profile.compliance_standards,
            monitoring_requirements=profile.monitoring_requirements,
            documentation_templates=profile.documentation_templates,
            entity_count=profile.entity_count,
            last_applied=profile.last_applied,
            created_by=str(profile.created_by) if profile.created_by else None,
            created_at=profile.created_at,
            updated_at=profile.updated_at
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create governance profile: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create profile: {str(e)}"
        )


@router.get("/profiles", response_model=List[GovernanceProfileResponse])
async def list_governance_profiles(
    profile_type: Optional[str] = Query(None, description="Filter by profile type"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List governance profiles for tenant"""
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant"
        )
    
    query = db.query(SharedGovernanceProfile).filter(
        SharedGovernanceProfile.tenant_id == current_user.tenant_id
    )
    
    if profile_type:
        query = query.filter(SharedGovernanceProfile.profile_type == profile_type)
    
    profiles = query.order_by(SharedGovernanceProfile.created_at.desc()).all()
    
    return [
        GovernanceProfileResponse(
            id=str(p.id),
            tenant_id=str(p.tenant_id),
            name=p.name,
            profile_type=p.profile_type,
            description=p.description,
            security_controls=p.security_controls,
            compliance_standards=p.compliance_standards,
            monitoring_requirements=p.monitoring_requirements,
            documentation_templates=p.documentation_templates,
            entity_count=p.entity_count,
            last_applied=p.last_applied,
            created_by=str(p.created_by) if p.created_by else None,
            created_at=p.created_at,
            updated_at=p.updated_at
        )
        for p in profiles
    ]


@router.post("/entities/{entity_id}/apply-profile/{profile_id}")
async def apply_governance_profile(
    entity_id: UUID,
    profile_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply a governance profile to an entity"""
    
    service = EcosystemEntityService(db)
    
    try:
        entity = service.apply_governance_profile(
            entity_id=entity_id,
            profile_id=profile_id,
            applied_by=current_user.id
        )
        
        return {
            "message": "Governance profile applied successfully",
            "entity_id": str(entity.id),
            "profile_id": str(profile_id)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to apply governance profile: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply profile: {str(e)}"
        )


@router.get("/entities/{entity_id}", response_model=GovernanceEntityResponse)
async def get_governance_entity(
    entity_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information for a specific governance entity"""
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant"
        )
    
    service = EcosystemEntityService(db)
    
    try:
        entity = service.get_entity(entity_id=entity_id)
        
        # Verify tenant access
        if entity.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this entity"
            )
        
        # Get related data
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.id == entity.vendor_id).first()
        governance_owner = None
        if entity.governance_owner_id:
            governance_owner = db.query(User).filter(User.id == entity.governance_owner_id).first()
        
        # Get related entities summary
        related_entities_summary = []
        if entity.related_entity_ids:
            related_entities = db.query(EcosystemEntity).filter(
                EcosystemEntity.id.in_(entity.related_entity_ids)
            ).all()
            related_entities_summary = [
                {
                    "id": str(e.id),
                    "name": e.name,
                    "entity_type": e.entity_type.value,
                    "status": e.status.value
                }
                for e in related_entities
            ]
        
        return GovernanceEntityResponse(
            id=str(entity.id),
            tenant_id=str(entity.tenant_id),
            vendor_id=str(entity.vendor_id),
            name=entity.name,
            entity_type=entity.entity_type,
            category=entity.category,
            subcategory=entity.subcategory,
            description=entity.description,
            version=entity.version,
            status=entity.status,
            department=entity.department,
            organization=entity.organization,
            service_account=entity.service_account,
            kill_switch_enabled=entity.kill_switch_enabled,
            last_governance_review=entity.last_governance_review,
            governance_owner_id=str(entity.governance_owner_id) if entity.governance_owner_id else None,
            skills=entity.skills,
            compliance_score=entity.compliance_score,
            risk_score=entity.risk_score,
            security_controls=entity.security_controls,
            compliance_standards=entity.compliance_standards,
            documentation_urls=entity.documentation_urls,
            architecture_diagrams=entity.architecture_diagrams,
            landscape_diagrams=entity.landscape_diagrams,
            related_entity_ids=[str(eid) for eid in (entity.related_entity_ids or [])],
            submission_date=entity.submission_date,
            approval_date=entity.approval_date,
            activation_date=entity.activation_date,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            vendor_name=vendor.name if vendor else None,
            governance_owner_name=governance_owner.name if governance_owner else None,
            related_entities_summary=related_entities_summary
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to get governance entity: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get entity: {str(e)}"
        )


@router.patch("/entities/{entity_id}", response_model=GovernanceEntityResponse)
async def update_governance_entity(
    entity_id: UUID,
    entity_data: GovernanceEntityUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a governance entity"""
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant"
        )
    
    service = EcosystemEntityService(db)
    
    try:
        # Get existing entity to verify access
        existing_entity = service.get_entity(entity_id=entity_id)
        if existing_entity.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this entity"
            )
        
        # Prepare update data
        update_kwargs = {}
        for field, value in entity_data.model_dump(exclude_unset=True).items():
            if value is not None:
                update_kwargs[field] = value
        
        entity = service.update_entity(
            entity_id=entity_id,
            **update_kwargs
        )
        
        # Get related data for response
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.id == entity.vendor_id).first()
        governance_owner = None
        if entity.governance_owner_id:
            governance_owner = db.query(User).filter(User.id == entity.governance_owner_id).first()
        
        return GovernanceEntityResponse(
            id=str(entity.id),
            tenant_id=str(entity.tenant_id),
            vendor_id=str(entity.vendor_id),
            name=entity.name,
            entity_type=entity.entity_type,
            category=entity.category,
            subcategory=entity.subcategory,
            description=entity.description,
            version=entity.version,
            status=entity.status,
            department=entity.department,
            organization=entity.organization,
            service_account=entity.service_account,
            kill_switch_enabled=entity.kill_switch_enabled,
            last_governance_review=entity.last_governance_review,
            governance_owner_id=str(entity.governance_owner_id) if entity.governance_owner_id else None,
            skills=entity.skills,
            compliance_score=entity.compliance_score,
            risk_score=entity.risk_score,
            security_controls=entity.security_controls,
            compliance_standards=entity.compliance_standards,
            documentation_urls=entity.documentation_urls,
            architecture_diagrams=entity.architecture_diagrams,
            landscape_diagrams=entity.landscape_diagrams,
            related_entity_ids=[str(eid) for eid in (entity.related_entity_ids or [])],
            submission_date=entity.submission_date,
            approval_date=entity.approval_date,
            activation_date=entity.activation_date,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            vendor_name=vendor.name if vendor else None,
            governance_owner_name=governance_owner.name if governance_owner else None
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update governance entity: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update entity: {str(e)}"
        )


@router.get("/entities/{entity_id}/lifecycle-history", response_model=List[Dict[str, Any]])
async def get_entity_lifecycle_history(
    entity_id: UUID,
    limit: int = Query(50, ge=1, le=100, description="Maximum number of events to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get lifecycle history for a governance entity"""
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant"
        )
    
    # Verify entity exists and belongs to tenant
    entity = db.query(EcosystemEntity).filter(
        EcosystemEntity.id == entity_id,
        EcosystemEntity.tenant_id == current_user.tenant_id
    ).first()
    
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found or access denied"
        )
    
    # Get lifecycle events
    events = db.query(EntityLifecycleEvent).filter(
        EntityLifecycleEvent.entity_id == entity_id,
        EntityLifecycleEvent.tenant_id == current_user.tenant_id
    ).order_by(EntityLifecycleEvent.created_at.desc()).limit(limit).all()
    
    # Get user names for triggered_by fields
    user_ids = [event.triggered_by for event in events if event.triggered_by]
    users = {}
    if user_ids:
        user_results = db.query(User).filter(User.id.in_(user_ids)).all()
        users = {user.id: user.name for user in user_results}
    
    # Format response
    history = []
    for event in events:
        history.append({
            "id": str(event.id),
            "event_type": event.event_type,
            "from_status": event.from_status.value if event.from_status else None,
            "to_status": event.to_status.value,
            "triggered_by": users.get(event.triggered_by, "System") if event.triggered_by else "System",
            "triggered_by_id": str(event.triggered_by) if event.triggered_by else None,
            "reason": event.reason,
            "automated": event.automated,
            "workflow_step": event.workflow_step,
            "event_data": event.event_data,
            "created_at": event.created_at.isoformat()
        })
    
    return history