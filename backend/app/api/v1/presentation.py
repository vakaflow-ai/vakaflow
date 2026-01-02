"""
Presentation Layer API - Business pages and widgets
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.presentation import (
    BusinessPage, Widget, PageWidget, PageType, WidgetType, DataSourceType
)
from app.services.presentation.page_service import PageService
from app.services.presentation.widget_service import WidgetService
from app.services.presentation.data_aggregator import DataAggregator

router = APIRouter(prefix="/presentation", tags=["Presentation"])


# Pydantic models
class WidgetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    widget_type: str
    widget_config: dict
    data_sources: List[dict]
    display_config: Optional[dict] = None
    refresh_interval: Optional[int] = None
    tags: Optional[List[str]] = []


class WidgetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    widget_type: str
    widget_config: dict
    data_sources: List[dict]
    is_system: bool
    tags: Optional[List[str]]
    
    class Config:
        from_attributes = True


class PageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    page_type: str = PageType.DASHBOARD.value
    category: Optional[str] = None
    layout_config: dict
    is_public: bool = False
    allowed_roles: Optional[List[str]] = None
    tags: Optional[List[str]] = []


class PageResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    page_type: str
    category: Optional[str]
    is_active: bool
    tags: Optional[List[str]]
    
    class Config:
        from_attributes = True


class PageDataResponse(BaseModel):
    page_id: str
    page_name: str
    page_type: str
    layout: dict
    widgets: Dict[str, Any]
    context: Optional[dict] = None


@router.get("/pages", response_model=List[PageResponse])
async def list_pages(
    page_type: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List business pages"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    query = db.query(BusinessPage).filter(
        BusinessPage.tenant_id == effective_tenant_id,
        BusinessPage.is_active == True
    )
    
    # Filter by access
    if not current_user.role.value == "platform_admin":
        # Check if page is public or user has access
        # Use PostgreSQL JSONB @> operator for JSON array containment
        from sqlalchemy import cast, func
        from sqlalchemy.dialects.postgresql import JSONB
        import json
        
        allowed_roles_jsonb = func.cast(json.dumps([current_user.role.value]), JSONB)
        allowed_users_jsonb = func.cast(json.dumps([str(current_user.id)]), JSONB)
        
        query = query.filter(
            (BusinessPage.is_public == True) |
            (cast(BusinessPage.allowed_roles, JSONB).op('@>')(allowed_roles_jsonb)) |
            (cast(BusinessPage.allowed_users, JSONB).op('@>')(allowed_users_jsonb))
        )
    
    if page_type:
        query = query.filter(BusinessPage.page_type == page_type)
    
    if category:
        query = query.filter(BusinessPage.category == category)
    
    pages = query.all()
    return pages


@router.get("/pages/{page_id}", response_model=PageDataResponse)
async def get_page(
    page_id: UUID,
    context: Optional[str] = Query(None, description="JSON context for data sources"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get page with all widget data"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Parse context if provided
    import json
    page_context = None
    if context:
        try:
            page_context = json.loads(context)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid context JSON"
            )
    
    page_service = PageService(db)
    
    try:
        page_data = await page_service.get_page_data(
            page_id=page_id,
            tenant_id=effective_tenant_id,
            context=page_context
        )
        return page_data
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/pages", response_model=PageResponse, status_code=status.HTTP_201_CREATED)
async def create_page(
    page_data: PageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new business page"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    page = BusinessPage(
        tenant_id=effective_tenant_id,
        name=page_data.name,
        description=page_data.description,
        page_type=page_data.page_type,
        category=page_data.category,
        layout_config=page_data.layout_config,
        is_public=page_data.is_public,
        allowed_roles=page_data.allowed_roles,
        tags=page_data.tags,
        created_by=current_user.id
    )
    
    db.add(page)
    db.commit()
    db.refresh(page)
    
    return page


@router.post("/widgets", response_model=WidgetResponse, status_code=status.HTTP_201_CREATED)
async def create_widget(
    widget_data: WidgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new widget"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    widget = Widget(
        tenant_id=effective_tenant_id,
        name=widget_data.name,
        description=widget_data.description,
        widget_type=widget_data.widget_type,
        widget_config=widget_data.widget_config,
        data_sources=widget_data.data_sources,
        display_config=widget_data.display_config,
        refresh_interval=widget_data.refresh_interval,
        tags=widget_data.tags,
        created_by=current_user.id
    )
    
    db.add(widget)
    db.commit()
    db.refresh(widget)
    
    return widget


@router.get("/widgets", response_model=List[WidgetResponse])
async def list_widgets(
    widget_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List widgets"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    query = db.query(Widget).filter(
        Widget.tenant_id == effective_tenant_id
    )
    
    if widget_type:
        query = query.filter(Widget.widget_type == widget_type)
    
    widgets = query.all()
    return widgets


@router.get("/widgets/{widget_id}/data")
async def get_widget_data(
    widget_id: UUID,
    context: Optional[str] = Query(None, description="JSON context for data sources"),
    force_refresh: bool = Query(False, description="Force refresh (bypass cache)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get data for a widget"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    # Parse context if provided
    import json
    widget_context = None
    if context:
        try:
            widget_context = json.loads(context)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid context JSON"
            )
    
    widget_service = WidgetService(db)
    
    try:
        data = await widget_service.get_widget_data(
            widget_id=widget_id,
            tenant_id=effective_tenant_id,
            context=widget_context,
            force_refresh=force_refresh
        )
        return data
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/aggregate")
async def aggregate_data(
    data_sources: List[dict],
    context: Optional[dict] = None,
    use_cache: bool = Query(True, description="Use cache if available"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Aggregate data from multiple sources (Agents, RAG, MCP)
    
    Request body:
    {
      "data_sources": [
        {
          "type": "agent",
          "source_id": "...",
          "query": "skill_name",
          "params": {...},
          "key": "source1"
        },
        {
          "type": "rag",
          "query": "search query",
          "params": {"limit": 5},
          "key": "source2"
        }
      ],
      "context": {...}
    }
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant"
        )
    
    aggregator = DataAggregator(db)
    
    try:
        result = await aggregator.aggregate_data(
            data_sources=data_sources,
            tenant_id=effective_tenant_id,
            context=context,
            use_cache=use_cache
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Data aggregation failed: {str(e)}"
        )
