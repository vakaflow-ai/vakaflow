"""
Product model
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from typing import Optional, Any, Dict
from app.core.database import Base
import enum


class ProductStatus(str, enum.Enum):
    """Product status"""
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    DISCONTINUED = "discontinued"


class Product(Base):
    """Product model"""
    __tablename__ = "products"
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    vendor_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)  # type: ignore
    tenant_id: Optional[uuid.UUID] = Column(UUID(as_uuid=True), nullable=True, index=True)  # type: ignore
    
    # Product identification
    name: str = Column(String(255), nullable=False)  # type: ignore
    product_type: str = Column(String(100), nullable=False)  # type: ignore  # software, hardware, saas, etc.
    category: Optional[str] = Column(String(100), nullable=True)  # type: ignore  # security, compliance, automation, etc.
    subcategory: Optional[str] = Column(String(100), nullable=True)  # type: ignore
    description: Optional[str] = Column(Text, nullable=True)  # type: ignore
    version: Optional[str] = Column(String(50), nullable=True)  # type: ignore
    
    # Product details
    sku: Optional[str] = Column(String(100), nullable=True, unique=True)  # type: ignore
    pricing_model: Optional[str] = Column(String(50), nullable=True)  # type: ignore  # subscription, one-time, usage-based
    website: Optional[str] = Column(String(255), nullable=True)  # type: ignore
    
    # Status and lifecycle
    status: str = Column(String(50), nullable=False, default=ProductStatus.DRAFT.value)  # type: ignore
    approval_date: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore
    
    # Compliance and risk
    compliance_score: Optional[int] = Column(Integer, nullable=True)  # type: ignore
    risk_score: Optional[int] = Column(Integer, nullable=True)  # type: ignore
    
    # Ecosystem mapping fields (MVP - simple fields)
    use_cases: Optional[str] = Column(Text, nullable=True)  # type: ignore  # Rich text area - list of use cases (simple text, no separate model)
    integration_points: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Integration with other products/services
    business_value: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Business value metrics
    deployment_info: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Deployment details
    
    # Extra metadata (using extra_metadata to avoid SQLAlchemy reserved name conflict)
    extra_metadata: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    updated_at: Optional[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore
    
    # Relationships
    # vendor = relationship("Vendor", back_populates="products")
