"""
Action Items API - User inbox endpoints
"""
from sklearn import base
from fastapi import APIRouter, Depends, HTTPException, status as http_status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.action_item_service import ActionItemService

router = APIRouter(prefix="/actions", tags=["actions"])


class ActionItemResponse(BaseModel):
    """Action item response model"""
    id: str
    type: str
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[str]
    assigned_at: Optional[str]
    completed_at: Optional[str]
    source_type: str
    source_id: str
    action_url: str
    metadata: Optional[dict] = None


class InboxResponse(BaseModel):
    """Inbox response model"""
    items: List[ActionItemResponse]
    pending: List[ActionItemResponse]
    completed: List[ActionItemResponse]
    overdue: List[ActionItemResponse]
    total: int
    pending_count: int
    completed_count: int
    overdue_count: int


@router.get("/inbox", response_model=InboxResponse)
async def get_inbox(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: pending, completed, overdue"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's action items inbox"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access action items"
        )
    
    try:
        service = ActionItemService(db)
        result = service.get_user_inbox(
            user_id=UUID(str(current_user.id)),
            tenant_id=effective_tenant_id,
            status=status_filter,
            action_type=action_type,
            limit=limit,
            offset=offset,
            user_role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting user inbox: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get inbox: {str(e)}"
        )
    
    # Convert to response models
    def to_response(item: dict) -> ActionItemResponse:
        return ActionItemResponse(
            id=item["id"],
            type=item["type"],
            title=item["title"],
            description=item.get("description"),
            status=item["status"],
            priority=item.get("priority", "medium"),
            due_date=item.get("due_date"),
            assigned_at=item.get("assigned_at"),
            completed_at=item.get("completed_at"),
            source_type=item["source_type"],
            source_id=item["source_id"],
            action_url=item["action_url"],
            metadata=item.get("metadata")
        )
    
    return InboxResponse(
        items=[to_response(item) for item in result["items"]],
        pending=[to_response(item) for item in result["pending"]],
        completed=[to_response(item) for item in result["completed"]],
        overdue=[to_response(item) for item in result["overdue"]],
        total=result["total"],
        pending_count=result["pending_count"],
        completed_count=result["completed_count"],
        overdue_count=result["overdue_count"]
    )


@router.get("/inbox/pending", response_model=List[ActionItemResponse])
async def get_pending_actions(
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's pending action items"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access action items"
        )
    
    try:
        service = ActionItemService(db)
        result = service.get_user_inbox(
            user_id=UUID(str(current_user.id)),
            tenant_id=effective_tenant_id,
            status="pending",
            action_type=action_type,
            limit=limit,
            offset=0,
            user_role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting pending actions: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pending actions: {str(e)}"
        )
    
    return [
        ActionItemResponse(
            id=item["id"],
            type=item["type"],
            title=item["title"],
            description=item.get("description"),
            status=item["status"],
            priority=item.get("priority", "medium"),
            due_date=item.get("due_date"),
            assigned_at=item.get("assigned_at"),
            completed_at=item.get("completed_at"),
            source_type=item["source_type"],
            source_id=item["source_id"],
            action_url=item["action_url"],
            metadata=item.get("metadata")
        )
        for item in result["pending"]
    ]


@router.get("/inbox/completed", response_model=List[ActionItemResponse])
async def get_completed_actions(
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's completed action items"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access action items"
        )
    
    try:
        service = ActionItemService(db)
        result = service.get_user_inbox(
            user_id=UUID(str(current_user.id)),
            tenant_id=effective_tenant_id,
            status="completed",
            action_type=action_type,
            limit=limit,
            offset=0,
            user_role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting completed actions: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get completed actions: {str(e)}"
        )
    
    return [
        ActionItemResponse(
            id=item["id"],
            type=item["type"],
            title=item["title"],
            description=item.get("description"),
            status=item["status"],
            priority=item.get("priority", "medium"),
            due_date=item.get("due_date"),
            assigned_at=item.get("assigned_at"),
            completed_at=item.get("completed_at"),
            source_type=item["source_type"],
            source_id=item["source_id"],
            action_url=item["action_url"],
            metadata=item.get("metadata")
        )
        for item in result["completed"]
    ]


@router.get("/inbox/counts")
async def get_inbox_counts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get action item counts for user"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access action items"
        )
    
    try:
        service = ActionItemService(db)
        result = service.get_user_inbox(
            user_id=UUID(str(current_user.id)),
            tenant_id=effective_tenant_id,
            limit=1,
            offset=0,
            user_role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        )
        
        return {
            "pending": result.get("pending_count", 0),
            "completed": result.get("completed_count", 0),
            "overdue": result.get("overdue_count", 0),
            "total": result.get("total", 0)
        }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting inbox counts: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get inbox counts: {str(e)}"
        )


@router.get("/inbox/{source_type}/{source_id}", response_model=ActionItemResponse)
async def get_action_item(
    source_type: str,
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get action item by source_type and source_id"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access action items"
        )
    
    try:
        from app.models.action_item import ActionItem
        # Find action item by source_type and source_id, assigned to current user
        action_item = db.query(ActionItem).filter(
            ActionItem.source_type == source_type,
            ActionItem.source_id == source_id,
            ActionItem.tenant_id == effective_tenant_id,
            ActionItem.assigned_to == current_user.id
        ).first()
        
        # If not found, check if user is admin (can see all items in tenant)
        if not action_item:
            from app.models.user import User as UserModel
            user = db.query(UserModel).filter(UserModel.id == current_user.id).first()
            if user and user.role.value in ["tenant_admin", "platform_admin"]:
                action_item = db.query(ActionItem).filter(
                    ActionItem.source_type == source_type,
                    ActionItem.source_id == source_id,
                    ActionItem.tenant_id == effective_tenant_id
                ).first()
        
        if not action_item:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Action item not found"
            )
        
        return ActionItemResponse(
            id=str(action_item.id),
            type=action_item.action_type.value if hasattr(action_item.action_type, 'value') else str(action_item.action_type),
            title=action_item.title,
            description=action_item.description,
            status=action_item.status.value if hasattr(action_item.status, 'value') else str(action_item.status),
            priority=action_item.priority.value if hasattr(action_item.priority, 'value') else str(action_item.priority),
            due_date=action_item.due_date.isoformat() if action_item.due_date else None,
            assigned_at=action_item.assigned_at.isoformat() if action_item.assigned_at else None,
            completed_at=action_item.completed_at.isoformat() if action_item.completed_at else None,
            source_type=action_item.source_type,
            source_id=str(action_item.source_id),
            action_url=action_item.action_url or "",
            metadata=action_item.item_metadata
        )
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting action item: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get action item: {str(e)}"
        )


@router.post("/inbox/{source_type}/{source_id}/read")
async def mark_as_read(
    source_type: str,
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark an action item as read"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access action items"
        )
    
    service = ActionItemService(db)
    service.mark_as_read(str(source_id), source_type, current_user.id)
    
    return {"message": "Marked as read"}
