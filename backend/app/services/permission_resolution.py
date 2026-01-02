"""
Permission Resolution Service
Resolves field permissions using hierarchical inheritance:
1. Entity-level permissions (baseline)
2. Field-level permissions (override)
3. Layout-specific permissions (override for workflows)
"""
from typing import Dict, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_
from uuid import UUID
from app.models.entity_field import EntityPermission, EntityFieldPermission
from app.models.custom_field import CustomFieldCatalog
from app.models.form_layout import FormFieldAccess
from app.models.role_permission import RolePermission
import logging

logger = logging.getLogger(__name__)


def resolve_field_permissions(
    db: Session,
    tenant_id: UUID,
    entity_name: Optional[str] = None,
    field_name: Optional[str] = None,
    field_source: Optional[str] = None,  # "entity", "custom_field", "submission_requirement"
    custom_field_id: Optional[UUID] = None,
    request_type: Optional[str] = None,
    workflow_stage: Optional[str] = None,
    role: Optional[str] = None
) -> Dict[str, Dict[str, bool]]:
    """
    Resolve field permissions using hierarchical inheritance.
    
    Hierarchy:
    1. Entity-level permissions (baseline)
    2. Field-level permissions (override)
    3. Layout-specific permissions (override for workflows)
    
    Returns:
        Dict of role permissions: {"role": {"view": bool, "edit": bool}}
    """
    resolved_permissions: Dict[str, Dict[str, bool]] = {}
    
    # Step 0: Get RolePermission baseline (category: forms_and_data_fields)
    # This serves as the system-wide baseline for specific field keys managed in the permission tree
    if field_name:
        # Determine likely permission key prefix based on request_type/stage
        # Default to submission if not specified
        prefix = "submission.field"
        if request_type and ("approval" in request_type.lower() or "review" in request_type.lower()):
            prefix = "approval.field"
        
        perm_key = f"{prefix}.{field_name}"
        
        # Query both tenant-specific and platform-wide permissions
        role_perms = db.query(RolePermission).filter(
            or_(
                RolePermission.tenant_id == tenant_id,
                RolePermission.tenant_id.is_(None)
            ),
            RolePermission.category == "forms_and_data_fields",
            or_(
                RolePermission.permission_key == perm_key,
                RolePermission.permission_key.like(f"%.field.{field_name}") # Fallback for other prefixes
            )
        ).order_by(RolePermission.tenant_id.desc()).all() # Tenant-specific first
        
        # Deduplicate and apply
        seen_roles = set()
        for rp in role_perms:
            if rp.role not in seen_roles:
                if rp.role not in resolved_permissions:
                    resolved_permissions[rp.role] = {}
                # RolePermission is a single toggle, so we map it to both view and edit
                # as it represents "access" to that field in the system defaults
                resolved_permissions[rp.role]["view"] = rp.is_enabled
                resolved_permissions[rp.role]["edit"] = rp.is_enabled
                seen_roles.add(rp.role)

    # Step 1: Get entity-level baseline permissions
    if entity_name:
        entity_permission = db.query(EntityPermission).filter(
            or_(
                EntityPermission.tenant_id == tenant_id,
                EntityPermission.tenant_id.is_(None)
            ),
            EntityPermission.entity_name == entity_name,
            EntityPermission.is_active == True
        ).first()
        
        if entity_permission and entity_permission.role_permissions:
            for role, perms in entity_permission.role_permissions.items():
                if role not in resolved_permissions:
                    resolved_permissions[role] = {}
                resolved_permissions[role].update(perms)
    
    # Step 2: Get field-level overrides
    if field_source == "custom_field" and custom_field_id:
        custom_field = db.query(CustomFieldCatalog).filter(
            CustomFieldCatalog.id == custom_field_id,
            CustomFieldCatalog.tenant_id == tenant_id,
            CustomFieldCatalog.is_enabled == True
        ).first()
        
        if custom_field and custom_field.role_permissions:
            for role, perms in custom_field.role_permissions.items():
                if role not in resolved_permissions:
                    resolved_permissions[role] = {}
                resolved_permissions[role].update(perms)
    
    elif field_source == "entity" and entity_name and field_name:
        field_permission = db.query(EntityFieldPermission).filter(
            or_(
                EntityFieldPermission.tenant_id == tenant_id,
                EntityFieldPermission.tenant_id.is_(None)
            ),
            EntityFieldPermission.entity_name == entity_name,
            EntityFieldPermission.field_name == field_name,
            EntityFieldPermission.is_active == True
        ).first()
        
        if field_permission and field_permission.role_permissions:
            for role, perms in field_permission.role_permissions.items():
                if role not in resolved_permissions:
                    resolved_permissions[role] = {}
                resolved_permissions[role].update(perms)
    
    # Step 3: Get layout-specific overrides (highest precedence)
    if request_type and workflow_stage and field_name:
        layout_access = db.query(FormFieldAccess).filter(
            FormFieldAccess.tenant_id == tenant_id,
            FormFieldAccess.field_name == field_name,
            FormFieldAccess.request_type == request_type,
            FormFieldAccess.workflow_stage == workflow_stage,
            FormFieldAccess.is_active == True
        ).first()
        
        if layout_access and layout_access.role_permissions:
            for role, perms in layout_access.role_permissions.items():
                if role not in resolved_permissions:
                    resolved_permissions[role] = {}
                resolved_permissions[role].update(perms)
    
    # Filter by role if specified
    if role:
        return {role: resolved_permissions.get(role, {})}
    
    return resolved_permissions


def get_effective_permission(
    db: Session,
    tenant_id: UUID,
    entity_name: Optional[str] = None,
    field_name: Optional[str] = None,
    field_source: Optional[str] = None,
    custom_field_id: Optional[UUID] = None,
    request_type: Optional[str] = None,
    workflow_stage: Optional[str] = None,
    role: str = "vendor_user",
    permission_type: str = "view"
) -> bool:
    """
    Get effective permission for a specific role and permission type.
    
    Returns:
        True if permission is granted, False otherwise
    """
    permissions = resolve_field_permissions(
        db=db,
        tenant_id=tenant_id,
        entity_name=entity_name,
        field_name=field_name,
        field_source=field_source,
        custom_field_id=custom_field_id,
        request_type=request_type,
        workflow_stage=workflow_stage,
        role=role
    )
    
    role_perms = permissions.get(role, {})
    return role_perms.get(permission_type, False)


def get_all_roles_permissions(
    db: Session,
    tenant_id: UUID,
    entity_name: str,
    field_name: Optional[str] = None,
    field_source: Optional[str] = None,
    custom_field_id: Optional[UUID] = None
) -> Dict[str, Dict[str, bool]]:
    """Get all roles' permissions for a field"""
    return resolve_field_permissions(
        db=db,
        tenant_id=tenant_id,
        entity_name=entity_name,
        field_name=field_name,
        field_source=field_source,
        custom_field_id=custom_field_id
    )

