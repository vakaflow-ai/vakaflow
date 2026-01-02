"""
Page Service - Manages business pages and their widgets
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging

from app.models.presentation import BusinessPage, PageWidget, Widget
from app.services.presentation.widget_service import WidgetService

logger = logging.getLogger(__name__)


class PageService:
    """Service for managing business pages"""
    
    def __init__(self, db_session):
        """
        Initialize page service
        
        Args:
            db_session: Database session
        """
        self.db = db_session
        self.widget_service = WidgetService(db_session)
    
    async def get_page_data(
        self,
        page_id: UUID,
        tenant_id: UUID,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get all data for a page (all widgets)
        
        Args:
            page_id: Page ID
            tenant_id: Tenant ID
            context: Additional context
            
        Returns:
            Page data with all widget data
        """
        page = self.db.query(BusinessPage).filter(
            BusinessPage.id == page_id,
            BusinessPage.tenant_id == tenant_id,
            BusinessPage.is_active == True
        ).first()
        
        if not page:
            raise ValueError(f"Page {page_id} not found")
        
        # Get all widgets for the page
        page_widgets = self.db.query(PageWidget).filter(
            PageWidget.page_id == page_id,
            PageWidget.is_visible == True
        ).order_by(PageWidget.display_order).all()
        
        # Collect data for all widgets
        widgets_data = {}
        for page_widget in page_widgets:
            try:
                widget_data = await self.widget_service.get_widget_data(
                    widget_id=page_widget.widget_id,
                    tenant_id=tenant_id,
                    context=context
                )
                
                widgets_data[str(page_widget.id)] = {
                    "widget_id": str(page_widget.widget_id),
                    "widget_type": page_widget.widget.widget_type,
                    "position": {
                        "x": page_widget.position_x,
                        "y": page_widget.position_y,
                        "w": page_widget.width,
                        "h": page_widget.height
                    },
                    "data": widget_data,
                    "config": page_widget.config_override or page_widget.widget.widget_config
                }
            except Exception as e:
                logger.error(f"Error loading widget {page_widget.widget_id}: {e}")
                widgets_data[str(page_widget.id)] = {
                    "error": str(e),
                    "status": "error"
                }
        
        return {
            "page_id": str(page_id),
            "page_name": page.name,
            "page_type": page.page_type,
            "layout": page.layout_config,
            "widgets": widgets_data,
            "context": context
        }
    
    async def get_page_summary(
        self,
        page_id: UUID,
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Get page summary (without widget data)
        
        Args:
            page_id: Page ID
            tenant_id: Tenant ID
            
        Returns:
            Page summary
        """
        page = self.db.query(BusinessPage).filter(
            BusinessPage.id == page_id,
            BusinessPage.tenant_id == tenant_id
        ).first()
        
        if not page:
            raise ValueError(f"Page {page_id} not found")
        
        # Count widgets
        widget_count = self.db.query(PageWidget).filter(
            PageWidget.page_id == page_id,
            PageWidget.is_visible == True
        ).count()
        
        return {
            "id": str(page.id),
            "name": page.name,
            "description": page.description,
            "page_type": page.page_type,
            "category": page.category,
            "widget_count": widget_count,
            "is_active": page.is_active,
            "created_at": page.created_at.isoformat(),
            "updated_at": page.updated_at.isoformat()
        }
