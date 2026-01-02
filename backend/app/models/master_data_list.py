"""
Master Data List Model
Stores list-type attributes and their values for use in dropdowns and select fields
"""
from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.core.database import Base


class MasterDataList(Base):
    """Master data list - defines a list type (e.g., 'Country', 'Industry', 'Status')"""
    __tablename__ = "master_data_lists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # List metadata
    name = Column(String(255), nullable=False)  # e.g., "Country", "Industry", "Status"
    description = Column(Text, nullable=True)
    list_type = Column(String(100), nullable=False)  # e.g., "country", "industry", "status", "custom"
    selection_type = Column(String(20), default="single", nullable=False)  # "single" or "multi" - controls UI selection behavior
    is_active = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)  # System lists cannot be deleted
    
    # Values stored as JSON array of {value: str, label: str, order: int, is_active: bool}
    values = Column(JSON, nullable=False, default=list)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="master_data_lists")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<MasterDataList(id={self.id}, name={self.name}, list_type={self.list_type})>"
