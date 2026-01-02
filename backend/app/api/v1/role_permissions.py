"""
Role Permissions API endpoints
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from pydantic import BaseModel
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.role_permission import RolePermission
from app.api.v1.auth import get_current_user
from app.api.v1.tenants import require_tenant_admin, require_platform_admin
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class PermissionResponse(BaseModel):
    id: Any
    tenant_id: Optional[Any]
    role: str
    category: str
    permission_key: str
    permission_label: str
    permission_description: Optional[str]
    is_enabled: bool
    data_filter_rule_ids: Optional[List[Dict[str, Any]]] = None  # Array of rule objects
    data_filter_rule_id: Optional[str] = None  # Legacy field (deprecated)
    data_filter_rule_config: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class PermissionCreate(BaseModel):
    role: str
    category: str
    permission_key: str
    permission_label: str
    permission_description: Optional[str] = None
    is_enabled: bool = True


class PermissionUpdate(BaseModel):
    permission_label: Optional[str] = None
    permission_description: Optional[str] = None
    is_enabled: Optional[bool] = None
    data_filter_rule_ids: Optional[List[Dict[str, Any]]] = None  # Array of rule objects: [{"id": "uuid", "type": "business_rule"}, ...]
    data_filter_rule_id: Optional[str] = None  # Legacy: UUID string (deprecated, use data_filter_rule_ids)
    data_filter_rule_config: Optional[Dict[str, Any]] = None


class BulkPermissionUpdate(BaseModel):
    permission_ids: List[str]
    is_enabled: bool


@router.get("/role-permissions/my-permissions", response_model=List[PermissionResponse])
async def get_my_permissions(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's own permissions (any authenticated user can access this)"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view permissions"
        )
    
    # Regular user with tenant - get both platform-wide (defaults) and tenant-specific (overrides)
    # Tenant-specific permissions override platform-wide ones
    platform_perms = db.query(RolePermission).filter(
        RolePermission.tenant_id.is_(None),
        RolePermission.role == current_user.role.value
    ).all()
    
    tenant_perms = db.query(RolePermission).filter(
        RolePermission.tenant_id == effective_tenant_id,
        RolePermission.role == current_user.role.value
    ).all()
    
    # Create a map of permission_key -> permission (tenant overrides platform)
    perm_map = {}
    for p in platform_perms:
        perm_map[p.permission_key] = p
    for p in tenant_perms:
        perm_map[p.permission_key] = p  # Tenant-specific overrides platform-wide
    
    permissions = list(perm_map.values())
    
    # Apply category filter if specified
    if category:
        permissions = [p for p in permissions if p.category == category]
    
    return [
        PermissionResponse(
            id=str(p.id),
            tenant_id=str(p.tenant_id) if p.tenant_id else None,
            role=p.role,
            category=p.category,
            permission_key=p.permission_key,
            permission_label=p.permission_label,
            permission_description=p.permission_description,
            is_enabled=p.is_enabled,
            data_filter_rule_ids=p.data_filter_rule_ids if p.data_filter_rule_ids else (p.data_filter_rule_id and [{"id": str(p.data_filter_rule_id), "type": "business_rule"}] or None),
            data_filter_rule_id=str(p.data_filter_rule_id) if p.data_filter_rule_id else None,
            data_filter_rule_config=p.data_filter_rule_config,
            created_at=p.created_at.isoformat(),
            updated_at=p.updated_at.isoformat(),
        )
        for p in permissions
    ]


@router.get("/role-permissions", response_model=List[PermissionResponse])
async def get_role_permissions(
    role: Optional[str] = None,
    category: Optional[str] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Get role permissions (filtered by tenant)"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view role permissions"
        )
    
    query = db.query(RolePermission)
    
    # Tenant isolation: tenant_admin can see platform-wide permissions (read-only) and their tenant's permissions
    # Platform-wide permissions serve as defaults that can be overridden per tenant
    # ALL users (including platform_admin) must filter by their tenant
    if tenant_id:
        # Validate tenant_id matches current_user's tenant
        if tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Can only view permissions from your own tenant"
            )
        # Show both platform-wide (defaults) and tenant-specific (overrides) for the specified tenant
        query = query.filter(
            (RolePermission.tenant_id == tenant_id) | 
            (RolePermission.tenant_id.is_(None))
        )
    else:
        # Default to current user's tenant - show both platform-wide (defaults) and tenant-specific (overrides)
        query = query.filter(
            (RolePermission.tenant_id == effective_tenant_id) | 
            (RolePermission.tenant_id.is_(None))
        )
    
    # Apply filters
    if role:
        query = query.filter(RolePermission.role == role)
    if category:
        query = query.filter(RolePermission.category == category)
    
    all_permissions = query.order_by(
        RolePermission.category,
        RolePermission.permission_key,
        RolePermission.role,
        RolePermission.tenant_id.desc() # Put tenant-specific (UUID) before platform-wide (None)
    ).all()
    
    # Deduplicate: if both tenant-specific and platform-wide exist for the same key/role, keep tenant-specific
    seen_keys = set()
    permissions = []
    for p in all_permissions:
        # Create a unique key for deduplication
        dedup_key = f"{p.role}:{p.category}:{p.permission_key}"
        if dedup_key not in seen_keys:
            permissions.append(p)
            seen_keys.add(dedup_key)
    
    return [
        PermissionResponse(
            id=str(p.id),
            tenant_id=str(p.tenant_id) if p.tenant_id else None,
            role=p.role,
            category=p.category,
            permission_key=p.permission_key,
            permission_label=p.permission_label,
            permission_description=p.permission_description,
            is_enabled=p.is_enabled,
            data_filter_rule_ids=p.data_filter_rule_ids if p.data_filter_rule_ids else (p.data_filter_rule_id and [{"id": str(p.data_filter_rule_id), "type": "business_rule"}] or None),
            data_filter_rule_id=str(p.data_filter_rule_id) if p.data_filter_rule_id else None,  # Legacy
            data_filter_rule_config=p.data_filter_rule_config,
            created_at=p.created_at.isoformat(),
            updated_at=p.updated_at.isoformat(),
        )
        for p in permissions
    ]


@router.get("/role-permissions/by-category", response_model=Dict[str, Dict[str, List[PermissionResponse]]])
async def get_role_permissions_by_category(
    role: Optional[str] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Get role permissions grouped by category and role
    
    Automatically ensures permissions are seeded if none exist.
    """
    # Auto-seed permissions if none exist (only check platform-wide permissions)
    platform_wide_count = db.query(RolePermission).filter(
        RolePermission.tenant_id.is_(None)
    ).count()
    
    if platform_wide_count == 0:
        # No permissions exist, seed them automatically
        from app.services.role_permission_service import RolePermissionService
        try:
            await RolePermissionService.seed_default_permissions(db)
            logger.info("Auto-seeded permissions in get_role_permissions_by_category")
        except Exception as e:
            logger.warning(f"Failed to auto-seed permissions: {e}")
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view role permissions"
        )
    
    query = db.query(RolePermission)
    
    # Tenant isolation: ALL users can see platform-wide permissions (read-only) and their tenant's permissions
    # Platform-wide permissions serve as defaults that can be overridden per tenant
    # ALL users (including platform_admin) must filter by their tenant
    if tenant_id:
        # Validate tenant_id matches current_user's effective tenant
        if tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Can only view permissions from your own tenant"
            )
        # Show both platform-wide (defaults) and tenant-specific (overrides) for the specified tenant
        query = query.filter(
            (RolePermission.tenant_id == tenant_id) | 
            (RolePermission.tenant_id.is_(None))
        )
    else:
        # Default to current user's effective tenant - show both platform-wide (defaults) and tenant-specific (overrides)
        query = query.filter(
            (RolePermission.tenant_id == effective_tenant_id) | 
            (RolePermission.tenant_id.is_(None))
        )
    
    if role:
        query = query.filter(RolePermission.role == role)
    
    all_permissions = query.order_by(
        RolePermission.category,
        RolePermission.permission_key,
        RolePermission.role,
        RolePermission.tenant_id.desc() # Put tenant-specific (UUID) before platform-wide (None)
    ).all()
    
    # Deduplicate: if both tenant-specific and platform-wide exist for the same key/role, keep tenant-specific
    seen_keys = set()
    permissions = []
    for p in all_permissions:
        dedup_key = f"{p.role}:{p.category}:{p.permission_key}"
        if dedup_key not in seen_keys:
            permissions.append(p)
            seen_keys.add(dedup_key)
    
    # Group by category, then by role
    result: Dict[str, Dict[str, List[PermissionResponse]]] = {}
    for p in permissions:
        if p.category not in result:
            result[p.category] = {}
        if p.role not in result[p.category]:
            result[p.category][p.role] = []
        
        result[p.category][p.role].append(
            PermissionResponse(
                id=str(p.id),
                tenant_id=str(p.tenant_id) if p.tenant_id else None,
                role=p.role,
                category=p.category,
                permission_key=p.permission_key,
                permission_label=p.permission_label,
                permission_description=p.permission_description,
                is_enabled=p.is_enabled,
                data_filter_rule_ids=p.data_filter_rule_ids if p.data_filter_rule_ids else (p.data_filter_rule_id and [{"id": str(p.data_filter_rule_id), "type": "business_rule"}] or None),
                data_filter_rule_id=str(p.data_filter_rule_id) if p.data_filter_rule_id else None,
                data_filter_rule_config=p.data_filter_rule_config,
                created_at=p.created_at.isoformat(),
                updated_at=p.updated_at.isoformat(),
            )
        )
    
    return result


@router.post("/role-permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
async def create_role_permission(
    permission_data: PermissionCreate,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Create a new role permission"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to create role permissions"
        )
    
    # ALL users (including platform_admin) can only create tenant-specific permissions
    tenant_id = effective_tenant_id
    
    # Check if permission already exists
    existing = db.query(RolePermission).filter(
        RolePermission.tenant_id == tenant_id,
        RolePermission.role == permission_data.role,
        RolePermission.category == permission_data.category,
        RolePermission.permission_key == permission_data.permission_key
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission already exists for this role, category, and key"
        )
    
    permission = RolePermission(
        tenant_id=tenant_id,
        role=permission_data.role,
        category=permission_data.category,
        permission_key=permission_data.permission_key,
        permission_label=permission_data.permission_label,
        permission_description=permission_data.permission_description,
        is_enabled=permission_data.is_enabled,
        created_by=current_user.id,
    )
    
    db.add(permission)
    db.commit()
    db.refresh(permission)
    
    return PermissionResponse(
        id=str(permission.id),
        tenant_id=str(permission.tenant_id) if permission.tenant_id else None,
        role=permission.role,
        category=permission.category,
        permission_key=permission.permission_key,
        permission_label=permission.permission_label,
        permission_description=permission.permission_description,
        is_enabled=permission.is_enabled,
        data_filter_rule_id=str(permission.data_filter_rule_id) if permission.data_filter_rule_id else None,
        data_filter_rule_config=permission.data_filter_rule_config,
        created_at=permission.created_at.isoformat(),
        updated_at=permission.updated_at.isoformat(),
    )


@router.patch("/role-permissions/{permission_id}", response_model=PermissionResponse)
async def update_role_permission(
    permission_id: UUID,
    permission_data: PermissionUpdate,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Update a role permission"""
    permission = db.query(RolePermission).filter(RolePermission.id == permission_id).first()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to update role permissions"
        )
    
    # ALL users (including platform_admin) can only update permissions for their own tenant
    # Platform-wide permissions (tenant_id=None) can only be modified by platform_admin
    # If a tenant_admin tries to modify a platform-wide permission, we create a tenant-specific override
    if permission.tenant_id is None:
        role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        if role_value != "platform_admin":
            # Copy-on-Write: Create a tenant-specific override
            logger.info(f"Creating tenant-specific override for permission {permission.permission_key} for tenant {effective_tenant_id}")
            new_permission = RolePermission(
                tenant_id=effective_tenant_id,
                role=permission.role,
                category=permission.category,
                permission_key=permission.permission_key,
                permission_label=permission_data.permission_label if permission_data.permission_label is not None else permission.permission_label,
                permission_description=permission_data.permission_description if permission_data.permission_description is not None else permission.permission_description,
                is_enabled=permission_data.is_enabled if permission_data.is_enabled is not None else permission.is_enabled,
                data_filter_rule_ids=permission_data.data_filter_rule_ids if permission_data.data_filter_rule_ids is not None else permission.data_filter_rule_ids,
                data_filter_rule_id=permission.data_filter_rule_id, # Legacy
                data_filter_rule_config=permission_data.data_filter_rule_config if permission_data.data_filter_rule_config is not None else permission.data_filter_rule_config,
            )
            # Handle legacy data_filter_rule_id if needed
            if permission_data.data_filter_rule_id is not None:
                try:
                    new_permission.data_filter_rule_id = UUID(permission_data.data_filter_rule_id)
                except ValueError:
                    pass

            db.add(new_permission)
            db.commit()
            db.refresh(new_permission)
            
            return PermissionResponse(
                id=str(new_permission.id),
                tenant_id=str(new_permission.tenant_id),
                role=new_permission.role,
                category=new_permission.category,
                permission_key=new_permission.permission_key,
                permission_label=new_permission.permission_label,
                permission_description=new_permission.permission_description,
                is_enabled=new_permission.is_enabled,
                data_filter_rule_ids=new_permission.data_filter_rule_ids,
                data_filter_rule_id=str(new_permission.data_filter_rule_id) if new_permission.data_filter_rule_id else None,
                data_filter_rule_config=new_permission.data_filter_rule_config,
                created_at=new_permission.created_at.isoformat(),
                updated_at=new_permission.updated_at.isoformat(),
            )
    elif permission.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Permission belongs to different tenant"
        )
    
    # Update fields
    if permission_data.permission_label is not None:
        permission.permission_label = permission_data.permission_label
    if permission_data.permission_description is not None:
        permission.permission_description = permission_data.permission_description
    if permission_data.is_enabled is not None:
        permission.is_enabled = permission_data.is_enabled
    
    # Handle new multi-select rule IDs
    if permission_data.data_filter_rule_ids is not None:
        permission.data_filter_rule_ids = permission_data.data_filter_rule_ids
        # Also update legacy field for backward compatibility (migrate first rule if exists)
        if permission_data.data_filter_rule_ids and len(permission_data.data_filter_rule_ids) > 0:
            try:
                permission.data_filter_rule_id = UUID(permission_data.data_filter_rule_ids[0].get('id', ''))
            except (ValueError, KeyError, AttributeError):
                permission.data_filter_rule_id = None
        else:
            permission.data_filter_rule_id = None
    
    # Handle legacy single rule ID (for backward compatibility)
    elif permission_data.data_filter_rule_id is not None:
        if permission_data.data_filter_rule_id:
            try:
                rule_uuid = UUID(permission_data.data_filter_rule_id)
                permission.data_filter_rule_id = rule_uuid
                # Migrate to new format
                permission.data_filter_rule_ids = [{"id": permission_data.data_filter_rule_id, "type": "business_rule"}]
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid data_filter_rule_id format"
                )
        else:
            permission.data_filter_rule_id = None
            permission.data_filter_rule_ids = None
    
    if permission_data.data_filter_rule_config is not None:
        permission.data_filter_rule_config = permission_data.data_filter_rule_config
    
    db.commit()
    db.refresh(permission)
    
    return PermissionResponse(
        id=str(permission.id),
        tenant_id=str(permission.tenant_id) if permission.tenant_id else None,
        role=permission.role,
        category=permission.category,
        permission_key=permission.permission_key,
        permission_label=permission.permission_label,
        permission_description=permission.permission_description,
        is_enabled=permission.is_enabled,
        data_filter_rule_id=str(permission.data_filter_rule_id) if permission.data_filter_rule_id else None,
        data_filter_rule_config=permission.data_filter_rule_config,
        created_at=permission.created_at.isoformat(),
        updated_at=permission.updated_at.isoformat(),
    )


@router.patch("/role-permissions/bulk-toggle", response_model=Dict[str, int])
async def bulk_toggle_permissions(
    bulk_data: BulkPermissionUpdate,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Bulk enable/disable permissions"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to update role permissions"
        )
    
    permission_ids = [UUID(pid) for pid in bulk_data.permission_ids]
    
    # ALL users (including platform_admin) can only update permissions from their own tenant
    query = db.query(RolePermission).filter(
        RolePermission.id.in_(permission_ids),
        RolePermission.tenant_id == effective_tenant_id
    )
    
    permissions = query.all()
    
    if len(permissions) != len(permission_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some permissions not found or access denied"
        )
    
    # Update all permissions
    updated_count = 0
    for permission in permissions:
        permission.is_enabled = bulk_data.is_enabled
        updated_count += 1
    
    db.commit()
    
    return {
        "updated": updated_count,
        "enabled": bulk_data.is_enabled
    }


@router.delete("/role-permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_permission(
    permission_id: UUID,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Delete a role permission"""
    permission = db.query(RolePermission).filter(RolePermission.id == permission_id).first()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to delete role permissions"
        )
    
    # ALL users (including platform_admin) can only delete permissions from their own tenant
    # Platform-wide permissions (tenant_id=None) can only be deleted by platform_admin
    if permission.tenant_id is None:
        role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        if role_value != "platform_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot delete platform-wide permissions"
            )
    elif permission.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Permission belongs to different tenant"
        )
    
    db.delete(permission)
    db.commit()
    
    return None


@router.post("/role-permissions/seed-defaults", response_model=Dict[str, int])
async def seed_default_permissions(
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Seed default permissions for all roles (Platform Admin only)"""
    from app.services.role_permission_service import RolePermissionService
    
    counts = await RolePermissionService.seed_default_permissions(db)
    
    return counts


@router.get("/role-permissions/field-permissions", response_model=Dict[str, Dict[str, List[PermissionResponse]]])
async def get_field_permissions_by_data_level(
    role: Optional[str] = None,
    data_level: Optional[str] = Query(None, description="Filter by data level: submission, approval"),
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Get field-level permissions grouped by data level (Submission, Approval)
    
    Returns permissions organized by:
    - data_level (submission, approval)
    - field_name
    - role
    
    This makes it easy to see and manage field-level permissions for forms and data fields.
    """
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view field permissions"
        )
    
    query = db.query(RolePermission).filter(
        RolePermission.category == "forms_and_data_fields"
    )
    
    # ALL users (including platform_admin) must filter by their tenant
    if tenant_id:
        # Validate tenant_id matches current_user's effective tenant
        if tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Can only view permissions from your own tenant"
            )
        query = query.filter(
            (RolePermission.tenant_id == tenant_id) | 
            (RolePermission.tenant_id.is_(None))
        )
    else:
        # Default to current user's effective tenant
        query = query.filter(
            (RolePermission.tenant_id == effective_tenant_id) | 
            (RolePermission.tenant_id.is_(None))
        )
    
    # Apply filters
    if role:
        query = query.filter(RolePermission.role == role)
    
    if data_level:
        # Filter by data level prefix
        if data_level.lower() == "submission":
            query = query.filter(RolePermission.permission_key.like("submission.field.%"))
        elif data_level.lower() == "approval":
            query = query.filter(RolePermission.permission_key.like("approval.field.%"))
    
    permissions = query.order_by(
        RolePermission.permission_key,
        RolePermission.role
    ).all()
    
    # Group by data level, then by field name, then by role
    result: Dict[str, Dict[str, List[PermissionResponse]]] = {
        "submission": {},
        "approval": {}
    }
    
    for p in permissions:
        # Determine data level from permission key
        if p.permission_key.startswith("submission.field."):
            data_level_key = "submission"
            field_name = p.permission_key.replace("submission.field.", "")
        elif p.permission_key.startswith("approval.field."):
            data_level_key = "approval"
            field_name = p.permission_key.replace("approval.field.", "")
        else:
            continue  # Skip if doesn't match expected pattern
        
        # Initialize field dict if needed
        if field_name not in result[data_level_key]:
            result[data_level_key][field_name] = []
        
        result[data_level_key][field_name].append(
            PermissionResponse(
                id=str(p.id),
                tenant_id=str(p.tenant_id) if p.tenant_id else None,
                role=p.role,
                category=p.category,
                permission_key=p.permission_key,
                permission_label=p.permission_label,
                permission_description=p.permission_description,
                is_enabled=p.is_enabled,
                data_filter_rule_ids=p.data_filter_rule_ids if p.data_filter_rule_ids else (p.data_filter_rule_id and [{"id": str(p.data_filter_rule_id), "type": "business_rule"}] or None),
                data_filter_rule_id=str(p.data_filter_rule_id) if p.data_filter_rule_id else None,
                data_filter_rule_config=p.data_filter_rule_config,
                created_at=p.created_at.isoformat(),
                updated_at=p.updated_at.isoformat(),
            )
        )
    
    return result
