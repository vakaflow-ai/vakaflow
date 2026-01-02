"""
Entity and Fields Catalog model
Stores custom fields that can be used in Process Designer with role-based permissions
"""
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base


class CustomFieldCatalog(Base):
    """Custom field catalog - user-created reusable form field definitions
    
    This catalog stores ONLY user-created reusable custom field definitions (file uploads,
    external links, custom metadata fields, etc.) that can be used in Process Designer.
    
    Note: Submission Requirements are separate entities with their own fields (title, description,
    owner, etc.). They are NOT stored in this catalog. Their field_name can be referenced in
    Process Designer via /form-layouts/available-fields.
    
    Agent model fields are also available via /form-layouts/available-fields, not this catalog.
    """
    __tablename__ = "custom_field_catalog"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Field identification
    field_name = Column(String(100), nullable=False, index=True)  # Unique field name (e.g., "agreement_file", "deployment_diagram")
    field_type = Column(String(50), nullable=False)  # text, textarea, select, number, date, email, url, file_upload, external_link, etc.
    label = Column(String(255), nullable=False)  # Display label
    description = Column(Text, nullable=True)  # Help text/description
    placeholder = Column(String(255), nullable=True)  # Placeholder text
    
    # Field configuration
    is_required = Column(Boolean, default=False, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False, index=True)
    
    # Type-specific configuration
    accepted_file_types = Column(String(255), nullable=True)  # For file_upload: ".pdf,.doc,.docx"
    link_text = Column(String(255), nullable=True)  # For external_link: button text
    master_data_list_id = Column(UUID(as_uuid=True), ForeignKey("master_data_lists.id"), nullable=True)  # For select/multi_select
    options = Column(JSON, nullable=True)  # Static options: [{"value": "opt1", "label": "Option 1"}]
    
    # Role-based permissions
    # JSON structure: {"role": {"view": true/false, "edit": true/false}}
    # Example: {"vendor_user": {"view": true, "edit": true}, "approver": {"view": true, "edit": false}}
    role_permissions = Column(JSON, nullable=False, default={})
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint: one field per tenant with same field_name
    __table_args__ = (
        {'comment': 'Entity and Fields Catalog - user-created reusable form field definitions for Process Designer'}
    )

