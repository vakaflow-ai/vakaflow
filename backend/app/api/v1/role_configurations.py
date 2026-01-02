"""
Role Configurations API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.role_configuration import RoleConfiguration
from app.api.v1.auth import get_current_user
from app.api.v1.tenants import require_tenant_admin, require_platform_admin
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class RoleConfigurationResponse(BaseModel):
    id: str
    tenant_id: Optional[str]
    role: str
    data_filter_rule_ids: Optional[List[Dict[str, Any]]] = None
    data_filter_rule_config: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class RoleConfigurationUpdate(BaseModel):
    data_filter_rule_ids: Optional[List[Dict[str, Any]]] = None
    data_filter_rule_config: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None


@router.get("/role-configurations", response_model=List[RoleConfigurationResponse])
async def get_role_configurations(
    role: Optional[str] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Get role configurations (filtered by tenant for tenant_admin, all for platform_admin)"""
    query = db.query(RoleConfiguration)
    
    # Tenant isolation: tenant_admin can see platform-wide and their tenant's configurations
    if current_user.role == UserRole.TENANT_ADMIN:
        if current_user.tenant_id:
            query = query.filter(
                (RoleConfiguration.tenant_id == current_user.tenant_id) | 
                (RoleConfiguration.tenant_id.is_(None))
            )
    elif current_user.role == UserRole.PLATFORM_ADMIN:
        if tenant_id:
            query = query.filter(RoleConfiguration.tenant_id == tenant_id)
    
    if role:
        query = query.filter(RoleConfiguration.role == role)
    
    configurations = query.order_by(RoleConfiguration.role, RoleConfiguration.tenant_id).all()
    
    return [
        RoleConfigurationResponse(
            id=str(c.id),
            tenant_id=str(c.tenant_id) if c.tenant_id else None,
            role=c.role,
            data_filter_rule_ids=c.data_filter_rule_ids,
            data_filter_rule_config=c.data_filter_rule_config,
            settings=c.settings,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in configurations
    ]


@router.get("/role-configurations/{role}", response_model=RoleConfigurationResponse)
async def get_role_configuration(
    role: str,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Get role configuration for a specific role"""
    query = db.query(RoleConfiguration).filter(RoleConfiguration.role == role)
    
    # Tenant isolation
    if current_user.role == UserRole.TENANT_ADMIN:
        if current_user.tenant_id:
            # Check tenant-specific first, then platform-wide
            config = query.filter(RoleConfiguration.tenant_id == current_user.tenant_id).first()
            if not config:
                config = query.filter(RoleConfiguration.tenant_id.is_(None)).first()
        else:
            config = query.filter(RoleConfiguration.tenant_id.is_(None)).first()
    elif current_user.role == UserRole.PLATFORM_ADMIN:
        if tenant_id:
            config = query.filter(RoleConfiguration.tenant_id == tenant_id).first()
        else:
            # Platform admin gets platform-wide by default
            config = query.filter(RoleConfiguration.tenant_id.is_(None)).first()
    else:
        config = None
    
    if not config:
        # Return empty configuration if not found
        return RoleConfigurationResponse(
            id="",
            tenant_id=str(current_user.tenant_id) if current_user.tenant_id and current_user.role == UserRole.TENANT_ADMIN else None,
            role=role,
            data_filter_rule_ids=None,
            data_filter_rule_config=None,
            settings=None,
            created_at="",
            updated_at="",
        )
    
    return RoleConfigurationResponse(
        id=str(config.id),
        tenant_id=str(config.tenant_id) if config.tenant_id else None,
        role=config.role,
        data_filter_rule_ids=config.data_filter_rule_ids,
        data_filter_rule_config=config.data_filter_rule_config,
        settings=config.settings,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat(),
    )


@router.put("/role-configurations/{role}", response_model=RoleConfigurationResponse)
async def update_role_configuration(
    role: str,
    config_data: RoleConfigurationUpdate,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Create or update role configuration"""
    # Determine tenant_id
    tenant_id = None
    if current_user.role == UserRole.TENANT_ADMIN:
        tenant_id = current_user.tenant_id
    # Platform admin can create platform-wide (tenant_id=None) or tenant-specific configurations
    
    # Check if configuration already exists
    existing = db.query(RoleConfiguration).filter(
        RoleConfiguration.tenant_id == tenant_id,
        RoleConfiguration.role == role
    ).first()
    
    if existing:
        # Update existing configuration
        if config_data.data_filter_rule_ids is not None:
            existing.data_filter_rule_ids = config_data.data_filter_rule_ids
        if config_data.data_filter_rule_config is not None:
            existing.data_filter_rule_config = config_data.data_filter_rule_config
        if config_data.settings is not None:
            existing.settings = config_data.settings
        
        db.commit()
        db.refresh(existing)
        
        return RoleConfigurationResponse(
            id=str(existing.id),
            tenant_id=str(existing.tenant_id) if existing.tenant_id else None,
            role=existing.role,
            data_filter_rule_ids=existing.data_filter_rule_ids,
            data_filter_rule_config=existing.data_filter_rule_config,
            settings=existing.settings,
            created_at=existing.created_at.isoformat(),
            updated_at=existing.updated_at.isoformat(),
        )
    else:
        # Create new configuration
        config = RoleConfiguration(
            tenant_id=tenant_id,
            role=role,
            data_filter_rule_ids=config_data.data_filter_rule_ids,
            data_filter_rule_config=config_data.data_filter_rule_config,
            settings=config_data.settings,
            created_by=current_user.id,
        )
        
        db.add(config)
        db.commit()
        db.refresh(config)
        
        return RoleConfigurationResponse(
            id=str(config.id),
            tenant_id=str(config.tenant_id) if config.tenant_id else None,
            role=config.role,
            data_filter_rule_ids=config.data_filter_rule_ids,
            data_filter_rule_config=config.data_filter_rule_config,
            settings=config.settings,
            created_at=config.created_at.isoformat(),
            updated_at=config.updated_at.isoformat(),
        )

