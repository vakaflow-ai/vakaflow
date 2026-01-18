"""
File metadata model for storing uploaded files with retention policies
"""
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base

class FileMetadata(Base):
    """Metadata for uploaded files with scheduled cleanup"""
    __tablename__ = "file_metadata"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # File identification
    file_id = Column(String(36), unique=True, nullable=False, index=True)  # UUID string for public reference
    original_name = Column(String(255), nullable=False)  # Original filename
    stored_name = Column(String(255), nullable=False)    # Actual filename on disk
    file_path = Column(Text, nullable=False)             # Full path to file
    
    # File properties
    file_size = Column(Integer, nullable=False)          # Size in bytes
    mime_type = Column(String(100), nullable=False)      # MIME type
    
    # Context linking
    context_type = Column(String(50), nullable=False, index=True)  # assessment, questionnaire, etc.
    context_id = Column(String(36), nullable=False, index=True)    # ID of the context (e.g., assignment_id)
    
    # Ownership and tracking
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    last_accessed = Column(DateTime, nullable=True)      # Last download/access time
    
    # Retention and cleanup
    retention_days = Column(Integer, nullable=False, default=90)   # Days to keep file
    expires_at = Column(DateTime, nullable=True, index=True)       # Expiration timestamp
    deleted_at = Column(DateTime, nullable=True, index=True)       # Soft delete timestamp
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    deleted_reason = Column(String(100), nullable=True)            # Reason for deletion
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", foreign_keys=[tenant_id])
    uploader = relationship("User", foreign_keys=[uploaded_by])
    deleter = relationship("User", foreign_keys=[deleted_by])