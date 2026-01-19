"""
Request Type Configuration Model
Controls visibility and tenant mapping for request types in onboarding hub
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Integer, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.core.database import Base
import enum


class VisibilityScope(str, enum.Enum):
    """Visibility scope for request types"""
    INTERNAL = "internal"      # Only visible to internal users/admins
    EXTERNAL = "external"      # Visible to external vendor portals
    BOTH = "both"             # Visible to both internal and external


class RequestTypeConfig(Base):
    """Configuration for request type visibility and tenant mapping"""
    __tablename__ = "request_type_configs"
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    tenant_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)  # type: ignore
    
    # Request type identification
    request_type: str = Column(String(100), nullable=False, index=True)  # e.g., "agent_onboarding_workflow"  # type: ignore
    display_name: str = Column(String(255), nullable=False)  # e.g., "Agent Onboarding"  # type: ignore
    
    # Visibility configuration
    visibility_scope: VisibilityScope = Column(Enum(VisibilityScope), nullable=False, default=VisibilityScope.BOTH)  # type: ignore
    is_active: bool = Column(Boolean, default=True, nullable=False)  # type: ignore
    
    # Tenant-specific display configuration
    show_tenant_name: bool = Column(Boolean, default=False, nullable=False)  # Show tenant name in external portals  # type: ignore
    tenant_display_format: Optional[str] = Column(String(100), nullable=True)  # Format string: "{request_type} - {tenant_name}"  # type: ignore
    
    # Portal-specific configuration
    internal_portal_order: Optional[int] = Column(Integer, nullable=True)  # Order in internal portal  # type: ignore
    external_portal_order: Optional[int] = Column(Integer, nullable=True)  # Order in external portal  # type: ignore
    
    # Permissions
    allowed_roles: Optional[List[str]] = Column(JSON, nullable=True)  # List of roles that can access this request type  # type: ignore
    # Example: ["tenant_admin", "platform_admin", "vendor_user"] for external visibility
    
    # Description and metadata
    description: Optional[str] = Column(Text, nullable=True)  # type: ignore
    icon_class: Optional[str] = Column(String(100), nullable=True)  # Icon class for UI display  # type: ignore
    
    # Configuration
    extra_metadata: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # Additional configuration options  # type: ignore
    
    # Status
    is_default: bool = Column(Boolean, default=False, nullable=False)  # type: ignore
    
    # Metadata
    created_by: Optional[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # type: ignore
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    updated_at: Optional[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore
    
    # Relationships
    # tenant = relationship("Tenant", backref="request_type_configs")
    # creator = relationship("User", foreign_keys=[created_by])
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'request_type', name='uq_tenant_request_type'),
        {'comment': 'Request type configuration for visibility and tenant mapping'}
    )


class RequestTypeFormAssociation(Base):
    """Junction table for many-to-many relationship between RequestTypeConfig and FormLayout"""
    __tablename__ = "request_type_form_associations"
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    
    # References
    request_type_config_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("request_type_configs.id"), nullable=False, index=True)  # type: ignore
    form_layout_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("form_layouts.id"), nullable=False, index=True)  # type: ignore
    
    # Association metadata
    display_order: int = Column(Integer, default=0, nullable=False)  # Order in which forms appear for this request type  # type: ignore
    is_primary: bool = Column(Boolean, default=False, nullable=False)  # Primary/default form for this request type  # type: ignore
    form_variation_type: Optional[str] = Column(String(100), nullable=True)  # e.g., "standard", "advanced", "minimal"  # type: ignore
    
    # Metadata
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    updated_at: Optional[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('request_type_config_id', 'form_layout_id', name='uq_request_type_form'),
        {'comment': 'Junction table linking request types to their associated form layouts'}
    )


class RequestTypeTenantMapping(Base):
    """Mapping of request types across tenants for external portal display"""
    __tablename__ = "request_type_tenant_mappings"
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    
    # Reference to the original request type config
    request_type_config_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("request_type_configs.id"), nullable=False, index=True)  # type: ignore
    
    # Tenant information
    tenant_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)  # type: ignore
    tenant_name: str = Column(String(255), nullable=False)  # type: ignore
    
    # External display configuration
    external_display_name: str = Column(String(255), nullable=False)  # e.g., "Agent Onboarding - Acme Corp"  # type: ignore
    external_description: Optional[str] = Column(Text, nullable=True)  # type: ignore
    
    # Visibility override for this tenant
    is_visible_externally: bool = Column(Boolean, default=True, nullable=False)  # type: ignore
    
    # Order in external portal for this tenant
    external_order: Optional[int] = Column(Integer, nullable=True)  # type: ignore
    
    # Metadata
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    updated_at: Optional[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore
    
    # Relationships
    # request_type_config = relationship("RequestTypeConfig", backref="tenant_mappings")
    # tenant = relationship("Tenant", backref="request_type_mappings")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('request_type_config_id', 'tenant_id', name='uq_request_type_tenant'),
        {'comment': 'Mapping of request types across tenants for external portal display'}
    )