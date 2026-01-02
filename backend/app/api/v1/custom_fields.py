"""
Entity and Fields Catalog API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.custom_field import CustomFieldCatalog
from app.models.submission_requirement import SubmissionRequirement
from app.api.v1.auth import get_current_user
from app.api.v1.tenants import require_tenant_admin
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class CustomFieldResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    field_name: str
    field_type: str
    label: str
    description: Optional[str] = None
    placeholder: Optional[str] = None
    is_required: bool
    is_enabled: bool
    is_standard: bool
    field_source: Optional[str] = None
    field_source_id: Optional[UUID] = None
    accepted_file_types: Optional[str] = None
    link_text: Optional[str] = None
    master_data_list_id: Optional[UUID] = None
    options: Optional[List[Dict[str, str]]] = None
    role_permissions: Dict[str, Dict[str, bool]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomFieldCreate(BaseModel):
    field_name: str
    field_type: str
    label: str
    description: Optional[str] = None
    placeholder: Optional[str] = None
    is_required: bool = False
    is_enabled: bool = True
    accepted_file_types: Optional[str] = None
    link_text: Optional[str] = None
    master_data_list_id: Optional[UUID] = None
    options: Optional[List[Dict[str, str]]] = None
    role_permissions: Optional[Dict[str, Dict[str, bool]]] = None


class CustomFieldUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    placeholder: Optional[str] = None
    is_required: Optional[bool] = None
    is_enabled: Optional[bool] = None
    accepted_file_types: Optional[str] = None
    link_text: Optional[str] = None
    master_data_list_id: Optional[UUID] = None
    options: Optional[List[Dict[str, str]]] = None
    role_permissions: Optional[Dict[str, Dict[str, bool]]] = None


class CustomFieldListResponse(BaseModel):
    """Custom fields list response with pagination"""
    fields: List[CustomFieldResponse]
    total: int
    page: int
    limit: int


@router.get("/custom-fields", response_model=CustomFieldListResponse)
async def list_custom_fields(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_enabled: Optional[bool] = None,
    is_standard: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get paginated entity and fields catalog for the tenant.
    
    Returns ONLY user-created reusable custom field definitions (file uploads, external links,
    custom metadata fields, etc.) that can be used in Process Designer.
    
    Note: Submission Requirements are separate entities with their own fields (title, description,
    owner, etc.). Their field_name can be referenced in Process Designer via /form-layouts/available-fields,
    but they are NOT stored in this catalog.
    
    Agent model fields are also available via /form-layouts/available-fields, not this catalog.
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return CustomFieldListResponse(fields=[], total=0, page=page, limit=limit)
    
    # Get custom fields from catalog (user-created reusable form field definitions only)
    query = db.query(CustomFieldCatalog).filter(
        CustomFieldCatalog.tenant_id == effective_tenant_id
    )
    
    if is_enabled is not None:
        query = query.filter(CustomFieldCatalog.is_enabled == is_enabled)
    if is_standard is not None:
        query = query.filter(CustomFieldCatalog.is_standard == is_standard)
    
    custom_fields = query.order_by(CustomFieldCatalog.label).all()
    
    result = []
    
    # Add user-created custom fields only
    for field in custom_fields:
        result.append(CustomFieldResponse.model_validate(field))
    
    logger.info(f"Total custom fields loaded: {len(result)}")
    
    # Sort by label
    result.sort(key=lambda x: x.label.lower())
    
    # Calculate total before pagination
    total = len(result)
    
    # Apply pagination
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_result = result[start_idx:end_idx]
    
    logger.info(f"Returning page {page}: {len(paginated_result)} fields out of {total} total")
    
    return CustomFieldListResponse(
        fields=paginated_result,
        total=total,
        page=page,
        limit=limit
    )


@router.post("/custom-fields", response_model=CustomFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_field(
    field_data: CustomFieldCreate,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Create a new custom field"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    # Check if field name already exists
    existing = db.query(CustomFieldCatalog).filter(
        CustomFieldCatalog.tenant_id == effective_tenant_id,
        CustomFieldCatalog.field_name == field_data.field_name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field with name '{field_data.field_name}' already exists"
        )
    
    # Initialize default role permissions if not provided
    role_permissions = field_data.role_permissions or {}
    if not role_permissions:
        # Default: admins get view+edit, others get view only
        from app.models.user import UserRole
        for role in UserRole:
            if role.value in ['tenant_admin', 'platform_admin']:
                role_permissions[role.value] = {"view": True, "edit": True}
            else:
                role_permissions[role.value] = {"view": True, "edit": False}
    
    field = CustomFieldCatalog(
        tenant_id=effective_tenant_id,
        field_name=field_data.field_name,
        field_type=field_data.field_type,
        label=field_data.label,
        description=field_data.description,
        placeholder=field_data.placeholder,
        is_required=field_data.is_required,
        is_enabled=field_data.is_enabled,
        is_standard=False,
        field_source="custom",
        accepted_file_types=field_data.accepted_file_types,
        link_text=field_data.link_text,
        master_data_list_id=field_data.master_data_list_id,
        options=field_data.options,
        role_permissions=role_permissions,
        created_by=current_user.id,
    )
    
    db.add(field)
    db.commit()
    db.refresh(field)
    
    return CustomFieldResponse.model_validate(field)


@router.patch("/custom-fields/{field_id}", response_model=CustomFieldResponse)
async def update_custom_field(
    field_id: UUID,
    field_data: CustomFieldUpdate,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Update a custom field"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    field = db.query(CustomFieldCatalog).filter(
        CustomFieldCatalog.id == field_id,
        CustomFieldCatalog.tenant_id == effective_tenant_id
    ).first()
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found"
        )
    
    # Update fields
    if field_data.label is not None:
        field.label = field_data.label
    if field_data.description is not None:
        field.description = field_data.description
    if field_data.placeholder is not None:
        field.placeholder = field_data.placeholder
    if field_data.is_required is not None:
        field.is_required = field_data.is_required
    if field_data.is_enabled is not None:
        field.is_enabled = field_data.is_enabled
    if field_data.accepted_file_types is not None:
        field.accepted_file_types = field_data.accepted_file_types
    if field_data.link_text is not None:
        field.link_text = field_data.link_text
    if field_data.master_data_list_id is not None:
        field.master_data_list_id = field_data.master_data_list_id
    if field_data.options is not None:
        field.options = field_data.options
    if field_data.role_permissions is not None:
        field.role_permissions = field_data.role_permissions
    
    db.commit()
    db.refresh(field)
    
    return CustomFieldResponse.model_validate(field)


@router.delete("/custom-fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_field(
    field_id: UUID,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Delete a custom field (cannot delete standard fields)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    field = db.query(CustomFieldCatalog).filter(
        CustomFieldCatalog.id == field_id,
        CustomFieldCatalog.tenant_id == effective_tenant_id
    ).first()
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found"
        )
    
    if field.is_standard:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete standard fields"
        )
    
    db.delete(field)
    db.commit()
    
    return None

