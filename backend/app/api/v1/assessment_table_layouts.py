"""
Assessment Table Layout API endpoints
Allows admins to configure table columns for assessment submission and approver views
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.assessment_table_layout import AssessmentTableLayout, TableViewType
from app.models.user import User, UserRole
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assessment-table-layouts", tags=["assessment-table-layouts"])


def require_layout_management_permission(current_user: User = Depends(get_current_user)):
    """Require tenant_admin or platform_admin role"""
    if current_user.role not in [UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins and platform admins can manage table layouts"
        )
    return current_user


class TableColumn(BaseModel):
    """Table column definition"""
    id: str = Field(..., description="Unique column identifier")
    label: str = Field(..., description="Column header label")
    field: Optional[str] = Field(None, description="Data field name (null for action columns)")
    order: int = Field(..., description="Column display order")
    width: Optional[str] = Field(None, description="Column width (e.g., '30%', '200px')")
    visible: bool = Field(True, description="Whether column is visible")
    sortable: bool = Field(False, description="Whether column is sortable")
    type: str = Field(..., description="Column type: text, response, action, comments, attachments, assignee, status")


class AssessmentTableLayoutCreate(BaseModel):
    """Create assessment table layout request"""
    name: str = Field(..., description="Layout name")
    view_type: str = Field(..., description="View type: vendor_submission or approver")
    description: Optional[str] = None
    columns: List[TableColumn] = Field(..., description="Column configurations")
    is_active: bool = True
    is_default: bool = False


class AssessmentTableLayoutUpdate(BaseModel):
    """Update assessment table layout request"""
    name: Optional[str] = None
    description: Optional[str] = None
    columns: Optional[List[TableColumn]] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class AssessmentTableLayoutResponse(BaseModel):
    """Assessment table layout response"""
    id: str
    tenant_id: Optional[str]
    name: str
    view_type: str
    description: Optional[str]
    columns: List[Dict[str, Any]]
    is_active: bool
    is_default: bool
    created_by: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.post("", response_model=AssessmentTableLayoutResponse, status_code=status.HTTP_201_CREATED)
async def create_table_layout(
    layout_data: AssessmentTableLayoutCreate,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Create a new assessment table layout"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Validate view_type
    if layout_data.view_type not in [vt.value for vt in TableViewType]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid view_type: {layout_data.view_type}. Valid types: {', '.join([vt.value for vt in TableViewType])}"
        )
    
    # If setting as default, unset other defaults for this view_type
    if layout_data.is_default:
        db.query(AssessmentTableLayout).filter(
            AssessmentTableLayout.tenant_id == effective_tenant_id,
            AssessmentTableLayout.view_type == layout_data.view_type,
            AssessmentTableLayout.is_default == True
        ).update({"is_default": False})
    
    # Convert columns to dict for JSON storage
    columns_dict = [col.dict() for col in layout_data.columns]
    
    layout = AssessmentTableLayout(
        tenant_id=effective_tenant_id,
        name=layout_data.name,
        view_type=layout_data.view_type,
        description=layout_data.description,
        columns=columns_dict,
        is_active=layout_data.is_active,
        is_default=layout_data.is_default,
        created_by=current_user.id
    )
    
    db.add(layout)
    db.commit()
    db.refresh(layout)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="assessment_table_layout",
        resource_id=str(layout.id),
        tenant_id=str(effective_tenant_id),
        details={"name": layout.name, "view_type": layout.view_type}
    )
    
    return AssessmentTableLayoutResponse(
        id=str(layout.id),
        tenant_id=str(layout.tenant_id) if layout.tenant_id else None,
        name=layout.name,
        view_type=layout.view_type,
        description=layout.description,
        columns=layout.columns,
        is_active=layout.is_active,
        is_default=layout.is_default,
        created_by=str(layout.created_by) if layout.created_by else None,
        created_at=layout.created_at.isoformat(),
        updated_at=layout.updated_at.isoformat()
    )


@router.get("", response_model=List[AssessmentTableLayoutResponse])
async def list_table_layouts(
    view_type: Optional[str] = Query(None, description="Filter by view type"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List assessment table layouts for current tenant"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    query = db.query(AssessmentTableLayout).filter(
        (AssessmentTableLayout.tenant_id == effective_tenant_id) | (AssessmentTableLayout.tenant_id.is_(None))
    )
    
    if view_type:
        if view_type not in [vt.value for vt in TableViewType]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid view_type: {view_type}"
            )
        query = query.filter(AssessmentTableLayout.view_type == view_type)
    
    if is_active is not None:
        query = query.filter(AssessmentTableLayout.is_active == is_active)
    
    layouts = query.order_by(
        AssessmentTableLayout.view_type,
        AssessmentTableLayout.is_default.desc(),
        AssessmentTableLayout.name
    ).all()
    
    # Prioritize tenant-specific layouts over platform-wide defaults
    result = []
    seen_view_types = set()
    for layout in layouts:
        if layout.view_type not in seen_view_types or layout.tenant_id == effective_tenant_id:
            result.append(AssessmentTableLayoutResponse(
                id=str(layout.id),
                tenant_id=str(layout.tenant_id) if layout.tenant_id else None,
                name=layout.name,
                view_type=layout.view_type,
                description=layout.description,
                columns=layout.columns,
                is_active=layout.is_active,
                is_default=layout.is_default,
                created_by=str(layout.created_by) if layout.created_by else None,
                created_at=layout.created_at.isoformat(),
                updated_at=layout.updated_at.isoformat()
            ))
            if layout.is_default:
                seen_view_types.add(layout.view_type)
    
    return result


@router.get("/{layout_id}", response_model=AssessmentTableLayoutResponse)
async def get_table_layout(
    layout_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get assessment table layout by ID"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    layout = db.query(AssessmentTableLayout).filter(
        AssessmentTableLayout.id == layout_id,
        ((AssessmentTableLayout.tenant_id == effective_tenant_id) | (AssessmentTableLayout.tenant_id.is_(None)))
    ).first()
    
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table layout not found"
        )
    
    return AssessmentTableLayoutResponse(
        id=str(layout.id),
        tenant_id=str(layout.tenant_id) if layout.tenant_id else None,
        name=layout.name,
        view_type=layout.view_type,
        description=layout.description,
        columns=layout.columns,
        is_active=layout.is_active,
        is_default=layout.is_default,
        created_by=str(layout.created_by) if layout.created_by else None,
        created_at=layout.created_at.isoformat(),
        updated_at=layout.updated_at.isoformat()
    )


@router.get("/default/{view_type}", response_model=AssessmentTableLayoutResponse)
async def get_default_table_layout(
    view_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get default table layout for a view type"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    if view_type not in [vt.value for vt in TableViewType]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid view_type: {view_type}"
        )
    
    # Try tenant-specific default first
    layout = db.query(AssessmentTableLayout).filter(
        AssessmentTableLayout.tenant_id == effective_tenant_id,
        AssessmentTableLayout.view_type == view_type,
        AssessmentTableLayout.is_default == True,
        AssessmentTableLayout.is_active == True
    ).first()
    
    # Fallback to platform-wide default
    if not layout:
        layout = db.query(AssessmentTableLayout).filter(
            AssessmentTableLayout.tenant_id.is_(None),
            AssessmentTableLayout.view_type == view_type,
            AssessmentTableLayout.is_default == True,
            AssessmentTableLayout.is_active == True
        ).first()
    
    # If still no layout, return default columns from model
    if not layout:
        available_columns = AssessmentTableLayout.AVAILABLE_COLUMNS.get(view_type, [])
        default_columns = [
            {
                "id": col["id"],
                "label": col["label"],
                "field": col.get("field"),
                "order": idx + 1,
                "width": None,
                "visible": col.get("default_visible", True),
                "sortable": False,
                "type": col["type"]
            }
            for idx, col in enumerate(available_columns) if col.get("default_visible", True)
        ]
        
        return AssessmentTableLayoutResponse(
            id="default",
            tenant_id=None,
            name=f"Default {view_type.replace('_', ' ').title()} Layout",
            view_type=view_type,
            description="Default column configuration",
            columns=default_columns,
            is_active=True,
            is_default=True,
            created_by=None,
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat()
        )
    
    return AssessmentTableLayoutResponse(
        id=str(layout.id),
        tenant_id=str(layout.tenant_id) if layout.tenant_id else None,
        name=layout.name,
        view_type=layout.view_type,
        description=layout.description,
        columns=layout.columns,
        is_active=layout.is_active,
        is_default=layout.is_default,
        created_by=str(layout.created_by) if layout.created_by else None,
        created_at=layout.created_at.isoformat(),
        updated_at=layout.updated_at.isoformat()
    )


@router.put("/{layout_id}", response_model=AssessmentTableLayoutResponse)
async def update_table_layout(
    layout_id: UUID,
    layout_data: AssessmentTableLayoutUpdate,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Update assessment table layout"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    layout = db.query(AssessmentTableLayout).filter(
        AssessmentTableLayout.id == layout_id,
        AssessmentTableLayout.tenant_id == effective_tenant_id
    ).first()
    
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table layout not found"
        )
    
    # If setting as default, unset other defaults for this view_type
    if layout_data.is_default is True:
        db.query(AssessmentTableLayout).filter(
            AssessmentTableLayout.tenant_id == effective_tenant_id,
            AssessmentTableLayout.view_type == layout.view_type,
            AssessmentTableLayout.id != layout_id,
            AssessmentTableLayout.is_default == True
        ).update({"is_default": False})
    
    # Update fields
    if layout_data.name is not None:
        layout.name = layout_data.name
    if layout_data.description is not None:
        layout.description = layout_data.description
    if layout_data.columns is not None:
        layout.columns = [col.dict() for col in layout_data.columns]
    if layout_data.is_active is not None:
        layout.is_active = layout_data.is_active
    if layout_data.is_default is not None:
        layout.is_default = layout_data.is_default
    
    layout.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(layout)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="assessment_table_layout",
        resource_id=str(layout.id),
        tenant_id=str(effective_tenant_id),
        details={"name": layout.name}
    )
    
    return AssessmentTableLayoutResponse(
        id=str(layout.id),
        tenant_id=str(layout.tenant_id) if layout.tenant_id else None,
        name=layout.name,
        view_type=layout.view_type,
        description=layout.description,
        columns=layout.columns,
        is_active=layout.is_active,
        is_default=layout.is_default,
        created_by=str(layout.created_by) if layout.created_by else None,
        created_at=layout.created_at.isoformat(),
        updated_at=layout.updated_at.isoformat()
    )


@router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_table_layout(
    layout_id: UUID,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Delete assessment table layout"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    layout = db.query(AssessmentTableLayout).filter(
        AssessmentTableLayout.id == layout_id,
        AssessmentTableLayout.tenant_id == effective_tenant_id
    ).first()
    
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table layout not found"
        )
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.DELETE,
        resource_type="assessment_table_layout",
        resource_id=str(layout_id),
        tenant_id=str(effective_tenant_id),
        details={"name": layout.name}
    )
    
    db.delete(layout)
    db.commit()
    return None


@router.get("/available-columns/{view_type}", response_model=List[Dict[str, Any]])
async def get_available_columns(
    view_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get available columns for a view type"""
    if view_type not in [vt.value for vt in TableViewType]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid view_type: {view_type}"
        )
    
    return AssessmentTableLayout.AVAILABLE_COLUMNS.get(view_type, [])
