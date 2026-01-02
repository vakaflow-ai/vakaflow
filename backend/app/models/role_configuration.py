"""
Role Configuration model for managing role-level settings and data filter rules
"""
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base


class RoleConfiguration(Base):
    """Role-level configuration including data filter rules"""
    __tablename__ = "role_configurations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)  # null = platform-wide
    role = Column(String(50), nullable=False, index=True)  # UserRole value
    
    # Data filter rules at role level - applies to all permissions for this role
    # Can reference business_rules, master_data_lists, or other rule types
    # Supports multiple rules (array of rule IDs)
    data_filter_rule_ids = Column(JSON, nullable=True)  # Array of rule IDs: [{"id": "uuid", "type": "business_rule"|"master_data"}, ...]
    data_filter_rule_config = Column(JSON, nullable=True)  # Additional config: {"rule_type": "business_rule"|"master_data"|"profile_attribute", ...}
    
    # Additional role-level settings can be added here in the future
    settings = Column(JSON, nullable=True)  # General role settings
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint: one configuration per role per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'role', name='uq_role_configuration'),
        {'comment': 'Role-level configuration including data filter rules'}
    )

