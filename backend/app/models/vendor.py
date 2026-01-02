"""
Vendor model
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base


class Vendor(Base):
    """Vendor model"""
    __tablename__ = "vendors"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Multi-tenant support
    name = Column(String(255), nullable=False)
    contact_email = Column(String(255), nullable=False, index=True)
    contact_phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    registration_number = Column(String(100), nullable=True)
    logo_url = Column(Text, nullable=True)  # URL or path to vendor logo
    logo_path = Column(Text, nullable=True)  # File path if stored locally
    website = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)  # Vendor description
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Trust Center fields
    trust_center_enabled = Column(Boolean, default=False, nullable=False)
    trust_center_slug = Column(String(100), nullable=True, unique=True)  # Public URL slug
    compliance_score = Column(Integer, nullable=True)  # 0-100
    compliance_url = Column(Text, nullable=True)
    security_policy_url = Column(Text, nullable=True)
    privacy_policy_url = Column(Text, nullable=True)
    customer_logos = Column(JSON, nullable=True)  # Array of {name, logo_url}
    published_artifacts = Column(JSON, nullable=True)  # Array of artifact references
    published_documents = Column(JSON, nullable=True)  # Array of document references
    compliance_certifications = Column(JSON, nullable=True)  # Array of {type, name, logo_url, issued_date, expiry_date, verified}
    
    # Branding fields for vendor portal and trust center
    branding = Column(JSON, nullable=True)  # Branding configuration: {primary_color, secondary_color, font_family, etc.
    
    # Relationships
    # agents = relationship("Agent", back_populates="vendor")

