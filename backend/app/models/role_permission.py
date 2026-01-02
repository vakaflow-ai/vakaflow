"""
Role Permission model for managing role-based permissions
"""
from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base


class RolePermission(Base):
    """Role-based permission configuration"""
    __tablename__ = "role_permissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)  # null = platform-wide
    role = Column(String(50), nullable=False, index=True)  # UserRole value
    
    # Permission category and key
    category = Column(String(100), nullable=False, index=True)  # e.g., "agent_management", "compliance", "administration"
    permission_key = Column(String(100), nullable=False, index=True)  # e.g., "agents.create", "agents.view", "agents.edit"
    permission_label = Column(String(255), nullable=False)  # Human-readable label
    permission_description = Column(String(500), nullable=True)  # Description of what this permission allows
    
    # Permission state
    is_enabled = Column(Boolean, default=True, nullable=False)
    
    # Data filter rules - evaluates to filter data even if permission is assigned
    # Can reference business_rules, master_data_lists, or other rule types
    # Supports multiple rules (array of rule IDs)
    data_filter_rule_ids = Column(JSON, nullable=True)  # Array of rule IDs: [{"id": "uuid", "type": "business_rule"|"master_data"}, ...]
    data_filter_rule_config = Column(JSON, nullable=True)  # Additional config: {"rule_type": "business_rule"|"master_data"|"profile_attribute", ...}
    # Legacy field for backward compatibility (will be migrated)
    data_filter_rule_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Deprecated: use data_filter_rule_ids instead
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint: one permission per role per category per key per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'role', 'category', 'permission_key', name='uq_role_permission'),
        {'comment': 'Role-based permission configuration'}
    )

