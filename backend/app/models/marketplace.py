"""
Marketplace models for vendor ratings and reviews
"""
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Text, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class RatingValue(int, enum.Enum):
    """Rating value (1-5 stars)"""
    ONE = 1
    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5


class VendorRating(Base):
    """Vendor rating by end users"""
    __tablename__ = "vendor_ratings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Rating details
    rating = Column(Integer, nullable=False)  # 1-5 stars
    comment = Column(Text, nullable=True)
    
    # Rating categories
    ease_of_use = Column(Integer, nullable=True)  # 1-5
    reliability = Column(Integer, nullable=True)  # 1-5
    performance = Column(Integer, nullable=True)  # 1-5
    support = Column(Integer, nullable=True)  # 1-5
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # vendor = relationship("Vendor", back_populates="ratings")
    # agent = relationship("Agent", back_populates="ratings")
    # user = relationship("User", foreign_keys=[user_id])


class VendorReview(Base):
    """Detailed vendor review"""
    __tablename__ = "vendor_reviews"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Review content
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    
    # Review status
    is_verified = Column(Boolean, default=False)  # Verified purchase/usage
    is_helpful = Column(Integer, default=0)  # Helpful votes count
    is_approved = Column(Boolean, default=True)  # Moderation status
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # vendor = relationship("Vendor", back_populates="reviews")
    # agent = relationship("Agent", back_populates="reviews")
    # user = relationship("User", foreign_keys=[user_id])

