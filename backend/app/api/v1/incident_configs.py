"""
Incident Configuration API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.incident_config import IncidentConfig, IncidentTriggerType
from app.api.v1.auth import get_current_user
from app.core.tenant_utils import get_effective_tenant_id
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/incident-configs", tags=["incident-configs"])


class IncidentConfigCreate(BaseModel):
    """Incident configuration creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    trigger_type: str = Field(..., description="cve_detected, qualification_failed, risk_threshold_exceeded, compliance_gap_detected")
    trigger_conditions: Optional[Dict[str, Any]] = None
    entity_types: Optional[List[str]] = None
    entity_categories: Optional[List[str]] = None
    external_system: str = Field(..., description="servicenow or jira")
    auto_push: bool = True
    field_mapping: Optional[Dict[str, Any]] = None
    severity_mapping: Optional[Dict[str, Any]] = None
    is_active: bool = True
    priority: int = Field(100, ge=1, le=1000)


class IncidentConfigResponse(BaseModel):
    """Incident configuration response schema"""
    id: str
    name: str
    description: Optional[str]
    trigger_type: str
    trigger_conditions: Optional[Dict[str, Any]]
    entity_types: Optional[List[str]]
    entity_categories: Optional[List[str]]
    external_system: str
    auto_push: bool
    field_mapping: Optional[Dict[str, Any]]
    severity_mapping: Optional[Dict[str, Any]]
    is_active: bool
    priority: int
    created_by: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.post("", response_model=IncidentConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_incident_config(
    config_data: IncidentConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an incident configuration"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to create incident configs"
            )
        
        # Check permissions
        if current_user.role.value not in ["tenant_admin", "platform_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can create incident configurations"
            )
        
        config = IncidentConfig(
            tenant_id=effective_tenant_id,
            name=config_data.name,
            description=config_data.description,
            trigger_type=config_data.trigger_type,
            trigger_conditions=config_data.trigger_conditions,
            entity_types=config_data.entity_types,
            entity_categories=config_data.entity_categories,
            external_system=config_data.external_system,
            auto_push=config_data.auto_push,
            field_mapping=config_data.field_mapping,
            severity_mapping=config_data.severity_mapping,
            is_active=config_data.is_active,
            priority=config_data.priority,
            created_by=current_user.id
        )
        
        db.add(config)
        db.commit()
        db.refresh(config)
        
        return IncidentConfigResponse(
            id=str(config.id),
            name=config.name,
            description=config.description,
            trigger_type=config.trigger_type,
            trigger_conditions=config.trigger_conditions,
            entity_types=config.entity_types,
            entity_categories=config.entity_categories,
            external_system=config.external_system,
            auto_push=config.auto_push,
            field_mapping=config.field_mapping,
            severity_mapping=config.severity_mapping,
            is_active=config.is_active,
            priority=config.priority,
            created_by=str(config.created_by) if config.created_by else None,
            created_at=config.created_at.isoformat() if config.created_at else datetime.utcnow().isoformat(),
            updated_at=config.updated_at.isoformat() if config.updated_at else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating incident config: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create incident configuration"
        )


@router.get("", response_model=List[IncidentConfigResponse])
async def list_incident_configs(
    trigger_type: Optional[str] = Query(None, description="Filter by trigger type"),
    external_system: Optional[str] = Query(None, description="Filter by external system"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List incident configurations (tenant-scoped)"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view incident configs"
            )
        
        query = db.query(IncidentConfig).filter(IncidentConfig.tenant_id == effective_tenant_id)
        
        if trigger_type:
            query = query.filter(IncidentConfig.trigger_type == trigger_type)
        if external_system:
            query = query.filter(IncidentConfig.external_system == external_system)
        if is_active is not None:
            query = query.filter(IncidentConfig.is_active == is_active)
        
        configs = query.order_by(IncidentConfig.priority, IncidentConfig.created_at.desc()).all()
        
        return [
            IncidentConfigResponse(
                id=str(config.id),
                name=config.name,
                description=config.description,
                trigger_type=config.trigger_type,
                trigger_conditions=config.trigger_conditions,
                entity_types=config.entity_types,
                entity_categories=config.entity_categories,
                external_system=config.external_system,
                auto_push=config.auto_push,
                field_mapping=config.field_mapping,
                severity_mapping=config.severity_mapping,
                is_active=config.is_active,
                priority=config.priority,
                created_by=str(config.created_by) if config.created_by else None,
                created_at=config.created_at.isoformat() if config.created_at else datetime.utcnow().isoformat(),
                updated_at=config.updated_at.isoformat() if config.updated_at else None
            )
            for config in configs
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing incident configs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list incident configurations"
        )


@router.get("/{config_id}", response_model=IncidentConfigResponse)
async def get_incident_config(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get incident configuration details"""
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view incident configs"
        )
    
    config = db.query(IncidentConfig).filter(
        IncidentConfig.id == config_id,
        IncidentConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident configuration not found"
        )
    
    return IncidentConfigResponse(
        id=str(config.id),
        name=config.name,
        description=config.description,
        trigger_type=config.trigger_type,
        trigger_conditions=config.trigger_conditions,
        entity_types=config.entity_types,
        entity_categories=config.entity_categories,
        external_system=config.external_system,
        auto_push=config.auto_push,
        field_mapping=config.field_mapping,
        severity_mapping=config.severity_mapping,
        is_active=config.is_active,
        priority=config.priority,
        created_by=str(config.created_by) if config.created_by else None,
        created_at=config.created_at.isoformat() if config.created_at else datetime.utcnow().isoformat(),
        updated_at=config.updated_at.isoformat() if config.updated_at else None
    )


@router.put("/{config_id}", response_model=IncidentConfigResponse)
async def update_incident_config(
    config_id: UUID,
    config_data: IncidentConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update incident configuration"""
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to update incident configs"
        )
    
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update incident configurations"
        )
    
    config = db.query(IncidentConfig).filter(
        IncidentConfig.id == config_id,
        IncidentConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident configuration not found"
        )
    
    # Update fields
    config.name = config_data.name
    config.description = config_data.description
    config.trigger_type = config_data.trigger_type
    config.trigger_conditions = config_data.trigger_conditions
    config.entity_types = config_data.entity_types
    config.entity_categories = config_data.entity_categories
    config.external_system = config_data.external_system
    config.auto_push = config_data.auto_push
    config.field_mapping = config_data.field_mapping
    config.severity_mapping = config_data.severity_mapping
    config.is_active = config_data.is_active
    config.priority = config_data.priority
    
    db.commit()
    db.refresh(config)
    
    return IncidentConfigResponse(
        id=str(config.id),
        name=config.name,
        description=config.description,
        trigger_type=config.trigger_type,
        trigger_conditions=config.trigger_conditions,
        entity_types=config.entity_types,
        entity_categories=config.entity_categories,
        external_system=config.external_system,
        auto_push=config.auto_push,
        field_mapping=config.field_mapping,
        severity_mapping=config.severity_mapping,
        is_active=config.is_active,
        priority=config.priority,
        created_by=str(config.created_by) if config.created_by else None,
        created_at=config.created_at.isoformat() if config.created_at else datetime.utcnow().isoformat(),
        updated_at=config.updated_at.isoformat() if config.updated_at else None
    )


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident_config(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete incident configuration"""
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to delete incident configs"
        )
    
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete incident configurations"
        )
    
    config = db.query(IncidentConfig).filter(
        IncidentConfig.id == config_id,
        IncidentConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident configuration not found"
        )
    
    db.delete(config)
    db.commit()
    
    return None
