"""
Master Data Lists API endpoints
Allows tenant admins to manage list-type attributes and their values
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.master_data_list import MasterDataList
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/master-data-lists", tags=["master-data-lists"])


class MasterDataValue(BaseModel):
    """Individual value in a master data list"""
    value: str
    label: str
    order: int = 0
    is_active: bool = True
    metadata: Optional[Dict[str, Any]] = None


class MasterDataListCreate(BaseModel):
    """Create master data list schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    list_type: str = Field(..., min_length=1, max_length=100)
    selection_type: str = Field(default="single", pattern="^(single|multi)$")  # "single" or "multi"
    values: List[MasterDataValue] = Field(default_factory=list)
    is_active: bool = True


class MasterDataListUpdate(BaseModel):
    """Update master data list schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    list_type: Optional[str] = Field(None, min_length=1, max_length=100)
    selection_type: Optional[str] = Field(None, pattern="^(single|multi)$")  # "single" or "multi"
    values: Optional[List[MasterDataValue]] = None
    is_active: Optional[bool] = None


class MasterDataListResponse(BaseModel):
    """Master data list response schema"""
    id: str
    tenant_id: str
    name: str
    description: Optional[str]
    list_type: str
    selection_type: str  # "single" or "multi"
    is_active: bool
    is_system: bool
    values: List[Dict[str, Any]]
    created_by: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


def require_master_data_permission(current_user: User = Depends(get_current_user)):
    """Require tenant_admin or platform_admin role"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    return current_user


@router.post("", response_model=MasterDataListResponse, status_code=status.HTTP_201_CREATED)
async def create_master_data_list(
    list_data: MasterDataListCreate,
    current_user: User = Depends(require_master_data_permission),
    db: Session = Depends(get_db)
):
    """Create a new master data list"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    # Check if list with same name already exists for this tenant
    existing = db.query(MasterDataList).filter(
        MasterDataList.tenant_id == effective_tenant_id,
        MasterDataList.name == list_data.name,
        MasterDataList.is_active == True
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Master data list with name '{list_data.name}' already exists"
        )
    
    # Convert values to JSON
    # Convert values to dict (Pydantic v2 compatible)
    values_json = []
    for v in list_data.values:
        if hasattr(v, 'model_dump'):
            values_json.append(v.model_dump())
        elif hasattr(v, 'dict'):
            values_json.append(v.dict())
        else:
            values_json.append(v)
    
    master_list = MasterDataList(
        tenant_id=current_user.tenant_id,
        name=list_data.name,
        description=list_data.description,
        list_type=list_data.list_type,
        selection_type=getattr(list_data, 'selection_type', 'single'),
        values=values_json,
        is_active=list_data.is_active,
        is_system=False,
        created_by=current_user.id
    )
    
    db.add(master_list)
    db.commit()
    db.refresh(master_list)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="master_data_list",
        resource_id=str(master_list.id),
        tenant_id=str(current_user.tenant_id),
        details={"name": master_list.name, "list_type": master_list.list_type},
        ip_address=None,
        user_agent=None
    )
    
    return MasterDataListResponse(
        id=str(master_list.id),
        tenant_id=str(master_list.tenant_id),
        name=master_list.name,
        description=master_list.description,
        list_type=master_list.list_type,
        selection_type=getattr(master_list, 'selection_type', 'single'),
        is_active=master_list.is_active,
        is_system=master_list.is_system,
        values=master_list.values,
        created_by=str(master_list.created_by) if master_list.created_by else None,
        created_at=master_list.created_at.isoformat(),
        updated_at=master_list.updated_at.isoformat()
    )


@router.get("", response_model=List[MasterDataListResponse])
async def list_master_data_lists(
    list_type: Optional[str] = None,
    is_active: Optional[bool] = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List master data lists for current tenant"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    query = db.query(MasterDataList).filter(
        MasterDataList.tenant_id == effective_tenant_id
    )
    
    if list_type:
        query = query.filter(MasterDataList.list_type == list_type)
    if is_active is not None:
        query = query.filter(MasterDataList.is_active == is_active)
    
    lists = query.order_by(MasterDataList.list_type, MasterDataList.name).all()
    
    return [
        MasterDataListResponse(
            id=str(l.id),
            tenant_id=str(l.tenant_id),
            name=l.name,
            description=l.description,
            list_type=l.list_type,
            selection_type=getattr(l, 'selection_type', 'single'),
            is_active=l.is_active,
            is_system=l.is_system,
            values=l.values,
            created_by=str(l.created_by) if l.created_by else None,
            created_at=l.created_at.isoformat(),
            updated_at=l.updated_at.isoformat()
        )
        for l in lists
    ]


@router.get("/by-type/{list_type}/values", response_model=List[Dict[str, Any]])
async def get_values_by_type(
    list_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get active values for a specific list type (e.g., 'question_category')"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    master_list = db.query(MasterDataList).filter(
        MasterDataList.tenant_id == effective_tenant_id,
        MasterDataList.list_type == list_type,
        MasterDataList.is_active == True
    ).first()
    
    if not master_list or not master_list.values:
        return []
    
    # Return only active values, sorted by order
    active_values = [
        v for v in master_list.values 
        if isinstance(v, dict) and v.get('is_active', True)
    ]
    active_values.sort(key=lambda x: x.get('order', 0))
    
    return active_values


@router.get("/{list_id}", response_model=MasterDataListResponse)
async def get_master_data_list(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific master data list"""
    master_list = db.query(MasterDataList).filter(MasterDataList.id == list_id).first()
    
    if not master_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master data list not found"
        )
    
    # Tenant isolation
    if current_user.tenant_id != master_list.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return MasterDataListResponse(
        id=str(master_list.id),
        tenant_id=str(master_list.tenant_id),
        name=master_list.name,
        description=master_list.description,
        list_type=master_list.list_type,
        selection_type=getattr(master_list, 'selection_type', 'single'),
        is_active=master_list.is_active,
        is_system=master_list.is_system,
        values=master_list.values,
        created_by=str(master_list.created_by) if master_list.created_by else None,
        created_at=master_list.created_at.isoformat(),
        updated_at=master_list.updated_at.isoformat()
    )


@router.patch("/{list_id}", response_model=MasterDataListResponse)
async def update_master_data_list(
    list_id: UUID,
    list_data: MasterDataListUpdate,
    current_user: User = Depends(require_master_data_permission),
    db: Session = Depends(get_db)
):
    """Update a master data list"""
    master_list = db.query(MasterDataList).filter(MasterDataList.id == list_id).first()
    
    if not master_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master data list not found"
        )
    
    # Tenant isolation
    if current_user.tenant_id != master_list.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Update fields
    try:
        # Use model_dump for Pydantic v2, fallback to dict for v1
        if hasattr(list_data, 'model_dump'):
            update_data = list_data.model_dump(exclude_unset=True)
        else:
            update_data = list_data.dict(exclude_unset=True)
        
        # System lists: tenant admins can edit values, but only platform admins can edit name/type
        if master_list.is_system and current_user.role.value != "platform_admin":
            restricted_fields = {'name', 'list_type'}
            if any(field in update_data for field in restricted_fields):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="System list name and type can only be modified by platform administrators. You can edit values, description, and active status."
                )
        
        # Convert values to JSON if provided
        if "values" in update_data and update_data["values"] is not None:
            values_json = []
            for v in update_data["values"]:
                if isinstance(v, dict):
                    # Already a dict, use as-is
                    values_json.append(v)
                elif hasattr(v, 'model_dump'):
                    # Pydantic v2 model, convert to dict
                    values_json.append(v.model_dump())
                elif hasattr(v, 'dict'):
                    # Pydantic v1 model, convert to dict
                    values_json.append(v.dict())
                else:
                    # Already in correct format
                    values_json.append(v)
            update_data["values"] = values_json
        
        for field, value in update_data.items():
            if hasattr(master_list, field):
                setattr(master_list, field, value)
        
        master_list.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(master_list)
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        logger.error(f"Error updating master data list {list_id}: {error_msg}", exc_info=True)
        
        # Provide more specific error messages for common database errors
        if "foreign key constraint" in error_msg.lower() or "ForeignKeyViolation" in str(type(e).__name__):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update master data list: It is referenced by other records. Please remove dependencies first."
            )
        elif "unique constraint" in error_msg.lower() or "UniqueViolation" in str(type(e).__name__):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update master data list: A list with this name or identifier already exists."
            )
        elif "not null constraint" in error_msg.lower() or "NotNullViolation" in str(type(e).__name__):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update master data list: Required fields cannot be null."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update master data list: {error_msg}"
            )
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="master_data_list",
        resource_id=str(master_list.id),
        tenant_id=str(current_user.tenant_id),
        details={"updated_fields": list(update_data.keys())},
        ip_address=None,
        user_agent=None
    )
    
    return MasterDataListResponse(
        id=str(master_list.id),
        tenant_id=str(master_list.tenant_id),
        name=master_list.name,
        description=master_list.description,
        list_type=master_list.list_type,
        selection_type=getattr(master_list, 'selection_type', 'single'),
        is_active=master_list.is_active,
        is_system=master_list.is_system,
        values=master_list.values,
        created_by=str(master_list.created_by) if master_list.created_by else None,
        created_at=master_list.created_at.isoformat(),
        updated_at=master_list.updated_at.isoformat()
    )


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_master_data_list(
    list_id: UUID,
    current_user: User = Depends(require_master_data_permission),
    db: Session = Depends(get_db)
):
    """Delete a master data list (soft delete)"""
    master_list = db.query(MasterDataList).filter(MasterDataList.id == list_id).first()
    
    if not master_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master data list not found"
        )
    
    # Tenant isolation
    if current_user.tenant_id != master_list.tenant_id and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # System lists cannot be deleted
    if master_list.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System lists cannot be deleted"
        )
    
    # Soft delete
    master_list.is_active = False
    master_list.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.DELETE,
        resource_type="master_data_list",
        resource_id=str(master_list.id),
        tenant_id=str(current_user.tenant_id),
        details={"name": master_list.name},
        ip_address=None,
        user_agent=None
    )
    
    return None
