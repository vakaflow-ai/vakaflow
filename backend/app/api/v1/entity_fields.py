"""
Entity Field Management API endpoints
Manages entity-based field discovery, configuration, and security permissions
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.entity_field import EntityFieldRegistry, EntityPermission, EntityFieldPermission
from app.api.v1.auth import get_current_user
from app.services.entity_field_discovery import (
    discover_all_entities,
    sync_entity_fields,
    get_entity_label,
    ENTITY_CATEGORIES
)
from app.services.permission_resolution import resolve_field_permissions
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Pydantic Models ====================

class EntityFieldResponse(BaseModel):
    """Entity field response model"""
    id: UUID
    tenant_id: Optional[UUID] = None
    entity_name: str
    entity_label: str
    entity_category: Optional[str] = None
    entity_user_level: Optional[str] = "business"
    field_name: str
    field_label: str
    field_description: Optional[str] = None
    field_type_display: str
    is_nullable: bool
    is_primary_key: bool
    is_foreign_key: bool
    foreign_key_table: Optional[str] = None
    max_length: Optional[int] = None
    is_enabled: bool
    is_required: bool
    display_order: int
    is_auto_discovered: bool
    is_custom: bool
    is_system: bool
    field_config: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    last_discovered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EntityFieldUpdate(BaseModel):
    """Update entity field configuration"""
    field_label: Optional[str] = None
    field_description: Optional[str] = None
    field_type_display: Optional[str] = None
    is_enabled: Optional[bool] = None
    is_required: Optional[bool] = None
    display_order: Optional[int] = None
    field_config: Optional[Dict[str, Any]] = None


class EntityPermissionResponse(BaseModel):
    """Entity permission response model"""
    id: UUID
    tenant_id: Optional[UUID] = None
    entity_name: str
    entity_label: str
    entity_category: Optional[str] = None
    role_permissions: Dict[str, Dict[str, bool]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EntityPermissionUpdate(BaseModel):
    """Update entity permissions"""
    role_permissions: Optional[Dict[str, Dict[str, bool]]] = None
    is_active: Optional[bool] = None


class EntityFieldPermissionResponse(BaseModel):
    """Field permission override response"""
    id: Optional[UUID] = None
    tenant_id: Optional[UUID] = None
    entity_name: str
    field_name: str
    role_permissions: Optional[Dict[str, Dict[str, bool]]] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EntityFieldPermissionUpdate(BaseModel):
    """Update field permission override"""
    role_permissions: Optional[Dict[str, Dict[str, bool]]] = None
    is_active: Optional[bool] = None


class EntityTreeResponse(BaseModel):
    """Entity tree structure response"""
    category: str
    entities: List[Dict[str, Any]]


class SyncResultResponse(BaseModel):
    """Entity field sync result"""
    entities_processed: int
    fields_discovered: int
    fields_created: int
    fields_updated: int
    entities: Dict[str, Dict[str, int]]


# ==================== Helper Functions ====================

def require_admin_permission(current_user: User = Depends(get_current_user)) -> User:
    """Require admin permission for entity field management"""
    allowed_roles = ["tenant_admin", "platform_admin"]
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Admin access required. Your role: {user_role}"
        )
    return current_user


# ==================== Entity Discovery & Sync ====================

@router.post("/entity-fields/sync", response_model=SyncResultResponse)
async def sync_entity_fields_endpoint(
    entity_names: Optional[List[str]] = Query(None, description="Optional list of entity names to sync (all if not provided)"),
    current_user: User = Depends(require_admin_permission),
    db: Session = Depends(get_db)
):
    """Discover and sync fields from all entities to the registry
    
    Auto-discovers fields from SQLAlchemy models and updates EntityFieldRegistry.
    Can sync all entities or specific entities by name.
    """
    try:
        # Sync tenant-specific fields only
        # Platform-wide fields should be synced separately by platform admin
        result = sync_entity_fields(
            db=db,
            tenant_id=current_user.tenant_id,
            entity_names=entity_names,
            created_by=current_user.id
        )
        
        return SyncResultResponse(**result)
    except Exception as e:
        logger.error(f"Error syncing entity fields: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing entity fields: {str(e)}"
        )


@router.get("/entity-fields/discover", response_model=Dict[str, Any])
async def discover_entities_endpoint(
    current_user: User = Depends(require_admin_permission),
    db: Session = Depends(get_db)
):
    """Discover all entities and their fields (without syncing to database)
    
    Returns a preview of what would be discovered without saving to database.
    """
    try:
        entities = discover_all_entities()
        return {
            "total_entities": len(entities),
            "entities": {
                name: {
                    "entity_name": data["entity_name"],
                    "entity_label": data["entity_label"],
                    "entity_category": data["entity_category"],
                    "field_count": len(data["fields"])
                }
                for name, data in entities.items()
            }
        }
    except Exception as e:
        logger.error(f"Error discovering entities: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error discovering entities: {str(e)}"
        )


# ==================== Entity Tree ====================

@router.get("/entity-fields/tree", response_model=List[EntityTreeResponse])
async def get_entity_tree(
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get entity tree organized by category
    
    Returns hierarchical structure of all entities grouped by category.
    """
    # Get all entities from discovery
    discovered_entities = discover_all_entities()
    
    # Group by category
    category_map: Dict[str, List[Dict[str, Any]]] = {}
    for entity_name, entity_data in discovered_entities.items():
        cat = entity_data["entity_category"]
        if category and cat != category:
            continue
        
        if cat not in category_map:
            category_map[cat] = []
        
        # Get field count from registry
        field_count = db.query(EntityFieldRegistry).filter(
            EntityFieldRegistry.tenant_id == current_user.tenant_id,
            EntityFieldRegistry.entity_name == entity_name
        ).count()
        
        category_map[cat].append({
            "entity_name": entity_name,
            "entity_label": entity_data["entity_label"],
            "field_count": field_count,
            "total_fields": len(entity_data["fields"])
        })
    
    # Convert to response format
    result = [
        EntityTreeResponse(
            category=cat,
            entities=sorted(entities, key=lambda x: x["entity_label"])
        )
        for cat, entities in category_map.items()
    ]
    
    return sorted(result, key=lambda x: x.category)


# ==================== Entity Fields Management ====================

@router.get("/entity-fields", response_model=List[EntityFieldResponse])
async def list_entity_fields(
    entity_name: Optional[str] = Query(None, description="Filter by entity name"),
    entity_category: Optional[str] = Query(None, description="Filter by category"),
    entity_user_level: Optional[str] = Query(None, description="Filter by user level (business/advanced)"),
    is_enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    is_system: Optional[bool] = Query(None, description="Filter by system fields"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List entity fields with optional filters
    
    Returns tenant-specific fields and platform-wide fields (where tenant_id is NULL).
    """
    # Query tenant-specific fields and platform-wide fields
    if current_user.tenant_id:
        query = db.query(EntityFieldRegistry).filter(
            or_(
                EntityFieldRegistry.tenant_id == current_user.tenant_id,
                EntityFieldRegistry.tenant_id.is_(None)  # Platform-wide fields
            )
        )
    else:
        # Platform admin or no tenant - get platform-wide fields only
        query = db.query(EntityFieldRegistry).filter(
            EntityFieldRegistry.tenant_id.is_(None)
        )
    
    if entity_name:
        query = query.filter(EntityFieldRegistry.entity_name == entity_name)
    if entity_category:
        query = query.filter(EntityFieldRegistry.entity_category == entity_category)
    if entity_user_level:
        query = query.filter(EntityFieldRegistry.entity_user_level == entity_user_level)
    if is_enabled is not None:
        query = query.filter(EntityFieldRegistry.is_enabled == is_enabled)
    if is_system is not None:
        query = query.filter(EntityFieldRegistry.is_system == is_system)
    
    try:
        fields = query.order_by(
            EntityFieldRegistry.entity_name,
            EntityFieldRegistry.display_order,
            EntityFieldRegistry.field_name
        ).all()
        
        return [EntityFieldResponse.model_validate(f) for f in fields]
    except Exception as e:
        logger.error(f"Error listing entity fields: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing entity fields: {str(e)}"
        )


@router.get("/entity-fields/{entity_name}", response_model=List[EntityFieldResponse])
async def get_entity_fields(
    entity_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all fields for a specific entity"""
    fields = db.query(EntityFieldRegistry).filter(
        EntityFieldRegistry.tenant_id == current_user.tenant_id,
        EntityFieldRegistry.entity_name == entity_name
    ).order_by(
        EntityFieldRegistry.display_order,
        EntityFieldRegistry.field_name
    ).all()
    
    if not fields:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No fields found for entity: {entity_name}"
        )
    
    return [EntityFieldResponse.model_validate(f) for f in fields]


@router.get("/entity-fields/{entity_name}/{field_name}", response_model=EntityFieldResponse)
async def get_entity_field(
    entity_name: str,
    field_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific entity field
    
    Returns tenant-specific field if available, otherwise platform-wide field.
    """
    # Query tenant-specific fields and platform-wide fields (where tenant_id is NULL)
    if current_user.tenant_id:
        field = db.query(EntityFieldRegistry).filter(
            or_(
                EntityFieldRegistry.tenant_id == current_user.tenant_id,
                EntityFieldRegistry.tenant_id.is_(None)  # Platform-wide fields
            ),
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == field_name
        ).first()
    else:
        # Platform admin or no tenant - get platform-wide fields only
        field = db.query(EntityFieldRegistry).filter(
            EntityFieldRegistry.tenant_id.is_(None),
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == field_name
        ).first()
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field {field_name} not found for entity {entity_name}"
        )
    
    return EntityFieldResponse.model_validate(field)


@router.patch("/entity-fields/{entity_name}/{field_name}", response_model=EntityFieldResponse)
async def update_entity_field(
    entity_name: str,
    field_name: str,
    field_data: EntityFieldUpdate,
    current_user: User = Depends(require_admin_permission),
    db: Session = Depends(get_db)
):
    """Update entity field configuration
    
    Updates tenant-specific field if available, otherwise platform-wide field.
    """
    # Query tenant-specific fields and platform-wide fields (where tenant_id is NULL)
    if current_user.tenant_id:
        field = db.query(EntityFieldRegistry).filter(
            or_(
                EntityFieldRegistry.tenant_id == current_user.tenant_id,
                EntityFieldRegistry.tenant_id.is_(None)  # Platform-wide fields
            ),
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == field_name
        ).first()
    else:
        # Platform admin or no tenant - get platform-wide fields only
        field = db.query(EntityFieldRegistry).filter(
            EntityFieldRegistry.tenant_id.is_(None),
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == field_name
        ).first()
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field {field_name} not found for entity {entity_name}"
        )
    
    # Update fields
    update_data = field_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(field, key, value)
    
    field.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(field)
        return EntityFieldResponse.model_validate(field)
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating entity field: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating field: {str(e)}"
        )


# ==================== Entity Permissions Management ====================

@router.get("/entity-permissions", response_model=List[EntityPermissionResponse])
async def list_entity_permissions(
    entity_category: Optional[str] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List entity permissions"""
    query = db.query(EntityPermission).filter(
        EntityPermission.tenant_id == current_user.tenant_id
    )
    
    if entity_category:
        query = query.filter(EntityPermission.entity_category == entity_category)
    if is_active is not None:
        query = query.filter(EntityPermission.is_active == is_active)
    
    permissions = query.order_by(
        EntityPermission.entity_category,
        EntityPermission.entity_name
    ).all()
    
    return [EntityPermissionResponse.model_validate(p) for p in permissions]


@router.get("/entity-permissions/{entity_name}", response_model=EntityPermissionResponse)
async def get_entity_permission(
    entity_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get entity permission baseline"""
    permission = db.query(EntityPermission).filter(
        EntityPermission.tenant_id == current_user.tenant_id,
        EntityPermission.entity_name == entity_name
    ).first()
    
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permission not found for entity: {entity_name}"
        )
    
    return EntityPermissionResponse.model_validate(permission)


@router.put("/entity-permissions/{entity_name}", response_model=EntityPermissionResponse)
async def update_entity_permission(
    entity_name: str,
    permission_data: EntityPermissionUpdate,
    current_user: User = Depends(require_admin_permission),
    db: Session = Depends(get_db)
):
    """Update entity permission baseline"""
    permission = db.query(EntityPermission).filter(
        EntityPermission.tenant_id == current_user.tenant_id,
        EntityPermission.entity_name == entity_name
    ).first()
    
    if not permission:
        # Create if doesn't exist
        discovered_entities = discover_all_entities()
        entity_data = discovered_entities.get(entity_name, {})
        
        permission = EntityPermission(
            tenant_id=current_user.tenant_id,
            entity_name=entity_name,
            entity_label=entity_data.get("entity_label", get_entity_label(entity_name)),
            entity_category=entity_data.get("entity_category", "other"),
            role_permissions={},
            is_active=True,
            created_by=current_user.id
        )
        db.add(permission)
    
    # Update fields
    update_data = permission_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(permission, key, value)
    
    permission.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(permission)
        return EntityPermissionResponse.model_validate(permission)
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating entity permission: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating permission: {str(e)}"
        )


# ==================== Field Permission Overrides ====================

@router.get("/entity-fields/{entity_name}/{field_name}/permissions", response_model=EntityFieldPermissionResponse)
async def get_field_permissions(
    entity_name: str,
    field_name: str,
    include_inherited: bool = Query(False, description="Include inherited permissions from entity baseline"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get field permission overrides with inheritance support
    
    Returns permission overrides if they exist. If include_inherited=True,
    merges with entity-level baseline permissions (showing full resolved permissions).
    
    Hierarchy:
    1. Entity-level permissions (baseline) - inherited by all fields
    2. Field-level overrides (this endpoint) - explicit overrides
    """
    # First, verify the field exists
    if current_user.tenant_id:
        field_query = db.query(EntityFieldRegistry).filter(
            or_(
                EntityFieldRegistry.tenant_id == current_user.tenant_id,
                EntityFieldRegistry.tenant_id.is_(None)  # Platform-wide fields
            ),
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == field_name
        )
    else:
        field_query = db.query(EntityFieldRegistry).filter(
            EntityFieldRegistry.tenant_id.is_(None),
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == field_name
        )
    
    field = field_query.first()
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field {field_name} not found for entity {entity_name}"
        )
    
    # Check for permission override
    permission = db.query(EntityFieldPermission).filter(
        EntityFieldPermission.tenant_id == current_user.tenant_id,
        EntityFieldPermission.entity_name == entity_name,
        EntityFieldPermission.field_name == field_name
    ).first()
    
    # If include_inherited=True, resolve full permissions with inheritance
    if include_inherited and current_user.tenant_id:
        resolved_perms = resolve_field_permissions(
            db=db,
            tenant_id=current_user.tenant_id,
            entity_name=entity_name,
            field_name=field_name,
            field_source="entity"
        )
        
        # Return resolved permissions (includes entity baseline + field overrides)
        now = datetime.utcnow()
        return EntityFieldPermissionResponse(
            id=permission.id if permission else None,
            tenant_id=current_user.tenant_id if current_user.tenant_id else None,
            entity_name=entity_name,
            field_name=field_name,
            role_permissions=resolved_perms,  # Full resolved permissions with inheritance
            is_active=permission.is_active if permission else True,
            created_at=permission.created_at if permission and permission.created_at else now,
            updated_at=permission.updated_at if permission and permission.updated_at else now
        )
    
    # If no override exists, return default structure (empty = inherits from entity)
    if not permission:
        now = datetime.utcnow()
        return EntityFieldPermissionResponse(
            id=None,
            tenant_id=current_user.tenant_id if current_user.tenant_id else None,
            entity_name=entity_name,
            field_name=field_name,
            role_permissions={},  # Empty = inherits from entity baseline
            is_active=True,
            created_at=now,
            updated_at=now
        )
    
    # Return only field-level overrides (not merged with entity baseline)
    return EntityFieldPermissionResponse(
        id=permission.id,
        tenant_id=permission.tenant_id if permission.tenant_id else None,
        entity_name=permission.entity_name,
        field_name=permission.field_name,
        role_permissions=permission.role_permissions or {},  # Only overrides
        is_active=permission.is_active,
        created_at=permission.created_at if permission.created_at else datetime.utcnow(),
        updated_at=permission.updated_at if permission.updated_at else datetime.utcnow()
    )


@router.put("/entity-fields/{entity_name}/{field_name}/permissions", response_model=EntityFieldPermissionResponse)
async def update_field_permissions(
    entity_name: str,
    field_name: str,
    permission_data: EntityFieldPermissionUpdate,
    current_user: User = Depends(require_admin_permission),
    db: Session = Depends(get_db)
):
    """Create or update field permission override"""
    permission = db.query(EntityFieldPermission).filter(
        EntityFieldPermission.tenant_id == current_user.tenant_id,
        EntityFieldPermission.entity_name == entity_name,
        EntityFieldPermission.field_name == field_name
    ).first()
    
    if not permission:
        # Get field to link
        field = db.query(EntityFieldRegistry).filter(
            EntityFieldRegistry.tenant_id == current_user.tenant_id,
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == field_name
        ).first()
        
        if not field:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Field {field_name} not found for entity {entity_name}"
            )
        
        permission = EntityFieldPermission(
            tenant_id=current_user.tenant_id,
            entity_name=entity_name,
            field_name=field_name,
            role_permissions={},
            is_active=True,
            created_by=current_user.id
        )
        db.add(permission)
    
    # Update fields
    update_data = permission_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(permission, key, value)
    
    permission.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(permission)
        # Convert database model to response model
        return EntityFieldPermissionResponse(
            id=permission.id,
            tenant_id=permission.tenant_id if permission.tenant_id else None,
            entity_name=permission.entity_name,
            field_name=permission.field_name,
            role_permissions=permission.role_permissions or {},
            is_active=permission.is_active,
            created_at=permission.created_at if permission.created_at else datetime.utcnow(),
            updated_at=permission.updated_at if permission.updated_at else datetime.utcnow()
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating field permission: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating field permission: {str(e)}"
        )


@router.delete("/entity-fields/{entity_name}/{field_name}/permissions", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field_permissions(
    entity_name: str,
    field_name: str,
    current_user: User = Depends(require_admin_permission),
    db: Session = Depends(get_db)
):
    """Delete field permission override (revert to entity baseline)"""
    permission = db.query(EntityFieldPermission).filter(
        EntityFieldPermission.tenant_id == current_user.tenant_id,
        EntityFieldPermission.entity_name == entity_name,
        EntityFieldPermission.field_name == field_name
    ).first()
    
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permission override not found for field {field_name} in entity {entity_name}"
        )
    
    try:
        db.delete(permission)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting field permission: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting field permission: {str(e)}"
        )

