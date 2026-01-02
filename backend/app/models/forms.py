"""
Forms model - stores user-designed forms in the forms library
Separate from form_layouts which may contain processes
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base


class Form(Base):
    """Form definition - user-designed forms stored in the forms library"""
    __tablename__ = "forms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Form identification
    name = Column(String(255), nullable=False)  # Form name
    layout_type = Column(String(255), nullable=True)  # LayoutType: submission, approver, completed - can be comma-separated for multiple types
    description = Column(Text, nullable=True)
    
    # Form configuration
    sections = Column(JSON, nullable=False)  # Array of section definitions
    # Example structure:
    # [
    #   {
    #     "id": "section-1",
    #     "title": "Basic Information",
    #     "order": 1,
    #     "fields": ["field_name_1", "field_name_2"]
    #   }
    # ]
    
    # Field dependencies for conditional visibility
    field_dependencies = Column(JSON, nullable=True)
    
    # Custom field references - array of CustomFieldCatalog IDs
    custom_field_ids = Column(JSON, nullable=True)  # Array of UUID strings referencing CustomFieldCatalog
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        {'comment': 'Forms library - user-designed forms separate from processes/layouts'}
    )

