"""
Architecture documentation model
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base


class ArchitectureDocument(Base):
    """Architecture documentation linked to entities"""
    __tablename__ = "architecture_documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Linked entity
    entity_type = Column(String(50), nullable=False, index=True)  # product, service, agent
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Architecture details
    diagram_type = Column(String(50), nullable=True)  # network, data_flow, deployment, system
    diagram_url = Column(Text, nullable=True)  # URL to diagram
    diagram_data = Column(Text, nullable=True)  # Base64 or JSON diagram data
    
    description = Column(Text, nullable=True)
    components = Column(JSON, nullable=True)  # List of components
    data_flows = Column(JSON, nullable=True)  # Data flow definitions
    integration_points = Column(JSON, nullable=True)  # Integration details
    
    version = Column(String(50), nullable=True)
    last_reviewed = Column(DateTime, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # reviewer = relationship("User", foreign_keys=[reviewed_by])
