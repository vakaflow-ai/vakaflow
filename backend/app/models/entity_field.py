"""
Entity Field Registry model
Stores discovered and managed fields for all platform entities with entity-based security
"""
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, JSON, Text, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base


class EntityFieldRegistry(Base):
    """Registry of all fields across all entities in the platform
    
    Auto-discovered from SQLAlchemy models and can be customized by users.
    Fields are organized by entity (table) with entity-level security baselining.
    """
    __tablename__ = "entity_field_registry"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)  # null = platform-wide
    
    # Entity identification
    entity_name = Column(String(100), nullable=False, index=True)
    entity_label = Column(String(255), nullable=False)
    entity_category = Column(String(100), nullable=True, index=True)
    entity_user_level = Column(String(50), nullable=True, index=True, server_default='business')  # business, advanced, system
    
    # Field identification
    field_name = Column(String(100), nullable=False, index=True)
    field_label = Column(String(255), nullable=False)
    field_description = Column(Text, nullable=True)
    
    # Field metadata
    field_type = Column(String(50), nullable=False)  # text, textarea, number, date, boolean, select, json, etc. (SQLAlchemy type name or display type)
    field_type_display = Column(String(50), nullable=False)  # text, textarea, number, date, boolean, select, json, etc.
    is_nullable = Column(Boolean, default=True, nullable=False)
    is_primary_key = Column(Boolean, default=False, nullable=False)
    is_foreign_key = Column(Boolean, default=False, nullable=False)
    foreign_key_table = Column(String(100), nullable=True)
    max_length = Column(Integer, nullable=True)
    
    # Field configuration
    is_enabled = Column(Boolean, default=True, nullable=False, index=True)
    is_required = Column(Boolean, default=False, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    
    # Field visibility in Form Designer
    visible_in_form_designer = Column(Boolean, default=True, nullable=False, index=True)  # Show in Form Designer field picker
    form_designer_category = Column(String(100), nullable=True, index=True)  # Category for grouping in Form Designer
    
    # Field source
    is_auto_discovered = Column(Boolean, default=True, nullable=False)
    is_custom = Column(Boolean, default=False, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)  # System/internal fields hidden by default
    
    # Field configuration (JSON for type-specific settings)
    field_config = Column(JSON, nullable=True)  # {placeholder, validation, options, etc.}
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_discovered_at = Column(DateTime, nullable=True)  # When field was last auto-discovered
    
    # Unique constraint: one field per entity per tenant (or platform-wide)
    __table_args__ = (
        UniqueConstraint('tenant_id', 'entity_name', 'field_name', name='uq_entity_field_registry'),
        {'comment': 'Registry of all fields across all platform entities with entity-based security'}
    )


class EntityPermission(Base):
    """Entity-level security permissions baseline
    
    Defines default security permissions for entire entities (tables).
    Individual fields inherit these permissions but can be overridden.
    """
    __tablename__ = "entity_permissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    
    # Entity identification
    entity_name = Column(String(100), nullable=False, index=True)
    entity_label = Column(String(255), nullable=False)
    entity_category = Column(String(100), nullable=True, index=True)
    
    # Role-based permissions (baseline for all fields in this entity)
    # JSON structure: {"role": {"view": bool, "edit": bool}}
    # Example: {"tenant_admin": {"view": true, "edit": true}, "vendor_user": {"view": true, "edit": false}}
    role_permissions = Column(JSON, nullable=False, default={})
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint: one permission config per entity per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'entity_name', name='uq_entity_permissions'),
        {'comment': 'Entity-level security permissions baseline for all platform entities'}
    )


class EntityFieldPermission(Base):
    """Field-level permission overrides
    
    Allows fine-grained permission control for individual fields,
    overriding the entity-level baseline permissions.
    """
    __tablename__ = "entity_field_permissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    
    # Reference to entity field
    entity_name = Column(String(100), nullable=False, index=True)
    field_name = Column(String(100), nullable=False, index=True)
    
    # Field-level permission overrides
    # JSON structure: {"role": {"view": bool, "edit": bool}}
    # If null, inherits from EntityPermission baseline
    role_permissions = Column(JSON, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint: one permission override per field per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'entity_name', 'field_name', name='uq_entity_field_permissions'),
        {'comment': 'Field-level permission overrides for fine-grained security control'}
    )

