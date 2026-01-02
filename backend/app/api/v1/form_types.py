"""
Form Type API endpoints
Allows tenant admins to configure form types that map RequestType to different form views
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.form_layout import FormType
from app.models.user import User, UserRole
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/form-types", tags=["form-types"])


class FormTypeCreate(BaseModel):
    """Create form type schema"""
    name: str = Field(..., min_length=1, max_length=255)
    request_type: str = Field(..., pattern="^(admin|approver|end_user|vendor)$")
    description: Optional[str] = None
    view_mappings: Dict[str, str] = Field(default_factory=dict)  # {"approver_view": "layout-id", "submit_view": "layout-id"}
    is_default: bool = False


class FormTypeUpdate(BaseModel):
    """Update form type schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    view_mappings: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class FormTypeResponse(BaseModel):
    """Form type response schema"""
    id: str
    tenant_id: str
    name: str
    request_type: str
    description: Optional[str]
    view_mappings: Dict[str, str]
    is_active: bool
    is_default: bool
    created_by: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.post("", response_model=FormTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_form_type(
    form_type_data: FormTypeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new form type"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins and platform admins can create form types"
        )
    
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    # If setting as default, unset other defaults for this request type
    if form_type_data.is_default:
        db.query(FormType).filter(
            FormType.tenant_id == current_user.tenant_id,
            FormType.request_type == form_type_data.request_type,
            FormType.is_default == True
        ).update({"is_default": False})
    
    form_type = FormType(
        tenant_id=current_user.tenant_id,
        name=form_type_data.name,
        request_type=form_type_data.request_type,
        description=form_type_data.description,
        view_mappings=form_type_data.view_mappings or {},
        is_default=form_type_data.is_default,
        created_by=current_user.id
    )
    
    db.add(form_type)
    db.commit()
    db.refresh(form_type)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="form_type",
        resource_id=str(form_type.id),
        tenant_id=str(current_user.tenant_id),
        details={"name": form_type.name, "request_type": form_type.request_type},
        ip_address=None,
        user_agent=None
    )
    
    return FormTypeResponse(
        id=str(form_type.id),
        tenant_id=str(form_type.tenant_id),
        name=form_type.name,
        request_type=form_type.request_type,
        description=form_type.description,
        view_mappings=form_type.view_mappings or {},
        is_active=form_type.is_active,
        is_default=form_type.is_default,
        created_by=str(form_type.created_by) if form_type.created_by else None,
        created_at=form_type.created_at.isoformat(),
        updated_at=form_type.updated_at.isoformat()
    )


@router.get("", response_model=List[FormTypeResponse])
async def list_form_types(
    request_type: Optional[str] = Query(None, pattern="^(admin|approver|end_user|vendor)$"),
    is_active: Optional[bool] = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List form types for current tenant"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    query = db.query(FormType).filter(
        FormType.tenant_id == current_user.tenant_id
    )
    
    if request_type:
        query = query.filter(FormType.request_type == request_type)
    if is_active is not None:
        query = query.filter(FormType.is_active == is_active)
    
    form_types = query.order_by(
        FormType.request_type,
        FormType.is_default.desc(),
        FormType.name
    ).all()
    
    return [
        FormTypeResponse(
            id=str(ft.id),
            tenant_id=str(ft.tenant_id),
            name=ft.name,
            request_type=ft.request_type,
            description=ft.description,
            view_mappings=ft.view_mappings or {},
            is_active=ft.is_active,
            is_default=ft.is_default,
            created_by=str(ft.created_by) if ft.created_by else None,
            created_at=ft.created_at.isoformat(),
            updated_at=ft.updated_at.isoformat()
        )
        for ft in form_types
    ]


@router.get("/{form_type_id}", response_model=FormTypeResponse)
async def get_form_type(
    form_type_id: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific form type"""
    form_type = db.query(FormType).filter(FormType.id == UUID(form_type_id)).first()
    
    if not form_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form type not found"
        )
    
    # Tenant isolation
    if form_type.tenant_id != current_user.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return FormTypeResponse(
        id=str(form_type.id),
        tenant_id=str(form_type.tenant_id),
        name=form_type.name,
        request_type=form_type.request_type,
        description=form_type.description,
        view_mappings=form_type.view_mappings or {},
        is_active=form_type.is_active,
        is_default=form_type.is_default,
        created_by=str(form_type.created_by) if form_type.created_by else None,
        created_at=form_type.created_at.isoformat(),
        updated_at=form_type.updated_at.isoformat()
    )


@router.patch("/{form_type_id}", response_model=FormTypeResponse)
async def update_form_type(
    form_type_id: str = Path(...),
    form_type_data: FormTypeUpdate = ...,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a form type"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins and platform admins can update form types"
        )
    
    form_type = db.query(FormType).filter(FormType.id == UUID(form_type_id)).first()
    
    if not form_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form type not found"
        )
    
    # Tenant isolation
    if form_type.tenant_id != current_user.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # If setting as default, unset other defaults for this request type
    if form_type_data.is_default is True:
        db.query(FormType).filter(
            FormType.tenant_id == current_user.tenant_id,
            FormType.request_type == form_type.request_type,
            FormType.id != UUID(form_type_id),
            FormType.is_default == True
        ).update({"is_default": False})
    
    # Update fields
    if form_type_data.name is not None:
        form_type.name = form_type_data.name
    if form_type_data.description is not None:
        form_type.description = form_type_data.description
    if form_type_data.view_mappings is not None:
        form_type.view_mappings = form_type_data.view_mappings
    if form_type_data.is_active is not None:
        form_type.is_active = form_type_data.is_active
    if form_type_data.is_default is not None:
        form_type.is_default = form_type_data.is_default
    
    form_type.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(form_type)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="form_type",
        resource_id=str(form_type.id),
        tenant_id=str(current_user.tenant_id),
        details={"name": form_type.name, "request_type": form_type.request_type},
        ip_address=None,
        user_agent=None
    )
    
    return FormTypeResponse(
        id=str(form_type.id),
        tenant_id=str(form_type.tenant_id),
        name=form_type.name,
        request_type=form_type.request_type,
        description=form_type.description,
        view_mappings=form_type.view_mappings or {},
        is_active=form_type.is_active,
        is_default=form_type.is_default,
        created_by=str(form_type.created_by) if form_type.created_by else None,
        created_at=form_type.created_at.isoformat(),
        updated_at=form_type.updated_at.isoformat()
    )


@router.delete("/{form_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_form_type(
    form_type_id: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a form type"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins and platform admins can delete form types"
        )
    
    form_type = db.query(FormType).filter(FormType.id == UUID(form_type_id)).first()
    
    if not form_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form type not found"
        )
    
    # Tenant isolation
    if form_type.tenant_id != current_user.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Audit log before deletion
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.DELETE,
        resource_type="form_type",
        resource_id=str(form_type.id),
        tenant_id=str(current_user.tenant_id),
        details={"name": form_type.name, "request_type": form_type.request_type},
        ip_address=None,
        user_agent=None
    )
    
    db.delete(form_type)
    db.commit()
    
    return None


@router.get("/request-type/{request_type}/active", response_model=FormTypeResponse)
async def get_active_form_type_for_request(
    request_type: str = Path(..., pattern="^(admin|approver|end_user|vendor)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the active form type for a specific request type"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    form_type = db.query(FormType).filter(
        FormType.tenant_id == current_user.tenant_id,
        FormType.request_type == request_type,
        FormType.is_active == True
    ).order_by(FormType.is_default.desc()).first()
    
    if not form_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active form type found for request type: {request_type}"
        )
    
    return FormTypeResponse(
        id=str(form_type.id),
        tenant_id=str(form_type.tenant_id),
        name=form_type.name,
        request_type=form_type.request_type,
        description=form_type.description,
        view_mappings=form_type.view_mappings or {},
        is_active=form_type.is_active,
        is_default=form_type.is_default,
        created_by=str(form_type.created_by) if form_type.created_by else None,
        created_at=form_type.created_at.isoformat(),
        updated_at=form_type.updated_at.isoformat()
    )
