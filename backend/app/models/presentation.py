"""
Presentation Layer Models - Pages, Widgets, and Data Sources
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class PageType(str, enum.Enum):
    """Page types"""
    DASHBOARD = "dashboard"
    REPORT = "report"
    ANALYTICS = "analytics"
    CUSTOM = "custom"


class WidgetType(str, enum.Enum):
    """Widget types"""
    METRIC = "metric"  # Single metric (number)
    CHART = "chart"  # Chart (line, bar, pie, etc.)
    TABLE = "table"  # Data table
    LIST = "list"  # List of items
    CARD = "card"  # Information card
    MAP = "map"  # Map visualization
    TIMELINE = "timeline"  # Timeline view
    KPI = "kpi"  # KPI dashboard
    AGENT_INSIGHT = "agent_insight"  # Agent-generated insight
    RAG_CONTEXT = "rag_context"  # RAG context display
    CUSTOM = "custom"  # Custom widget


class DataSourceType(str, enum.Enum):
    """Data source types"""
    AGENT = "agent"
    RAG = "rag"
    MCP = "mcp"
    DATABASE = "database"
    ANALYTICS = "analytics"
    EXTERNAL_API = "external_api"


class BusinessPage(Base):
    """Business information page"""
    __tablename__ = "business_pages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Page identification
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    page_type = Column(String(50), nullable=False, default=PageType.DASHBOARD.value)
    category = Column(String(100), nullable=True)  # e.g., "compliance", "risk", "analytics"
    
    # Page layout
    layout_config = Column(JSON, nullable=False)  # Grid layout configuration
    # Structure:
    # {
    #   "columns": 12,
    #   "rows": "auto",
    #   "widgets": [
    #     {
    #       "id": "widget1",
    #       "widget_id": "...",
    #       "position": {"x": 0, "y": 0, "w": 6, "h": 4},
    #       "config": {...}
    #     }
    #   ]
    # }
    
    # Access control
    is_public = Column(Boolean, default=False)  # Public to all tenant users
    allowed_roles = Column(JSON, nullable=True)  # Specific roles that can access
    allowed_users = Column(JSON, nullable=True)  # Specific user IDs
    
    # Metadata
    tags = Column(JSON, nullable=True)
    is_template = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    widgets = relationship("PageWidget", back_populates="page", cascade="all, delete-orphan")


class Widget(Base):
    """Reusable widget definition"""
    __tablename__ = "widgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Widget identification
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    widget_type = Column(String(50), nullable=False)  # WidgetType
    
    # Widget configuration
    widget_config = Column(JSON, nullable=False)  # Widget-specific configuration
    # Structure depends on widget_type:
    # - Metric: {"format": "number", "unit": "$", "decimals": 2}
    # - Chart: {"chart_type": "line", "x_axis": "...", "y_axis": "..."}
    # - Table: {"columns": [...], "sortable": true, "filterable": true}
    
    # Data source configuration
    data_sources = Column(JSON, nullable=False)  # List of data source configs
    # [
    #   {
    #     "type": "agent" | "rag" | "mcp" | "database" | "analytics",
    #     "source_id": "...",
    #     "query": "...",
    #     "params": {...},
    #     "key": "source1"  # Key for data in aggregated result
    #   }
    # ]
    
    # Display configuration
    display_config = Column(JSON, nullable=True)  # Display settings
    refresh_interval = Column(Integer, nullable=True)  # Auto-refresh interval in seconds
    
    # Metadata
    is_system = Column(Boolean, default=False)  # System widget (cannot be deleted)
    is_template = Column(Boolean, default=False)
    tags = Column(JSON, nullable=True)
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    page_widgets = relationship("PageWidget", back_populates="widget")


class PageWidget(Base):
    """Widget instance on a page"""
    __tablename__ = "page_widgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id = Column(UUID(as_uuid=True), ForeignKey("business_pages.id"), nullable=False, index=True)
    widget_id = Column(UUID(as_uuid=True), ForeignKey("widgets.id"), nullable=False, index=True)
    
    # Position and size
    position_x = Column(Integer, nullable=False, default=0)
    position_y = Column(Integer, nullable=False, default=0)
    width = Column(Integer, nullable=False, default=6)
    height = Column(Integer, nullable=False, default=4)
    
    # Widget-specific configuration override
    config_override = Column(JSON, nullable=True)  # Override widget config for this instance
    
    # Display order
    display_order = Column(Integer, nullable=False, default=0)
    is_visible = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    page = relationship("BusinessPage", back_populates="widgets")
    widget = relationship("Widget", back_populates="page_widgets")


class WidgetDataCache(Base):
    """Cache for widget data"""
    __tablename__ = "widget_data_cache"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    widget_id = Column(UUID(as_uuid=True), ForeignKey("widgets.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Cached data
    data = Column(JSON, nullable=False)
    
    # Cache metadata
    cache_key = Column(String(500), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    widget = relationship("Widget")
