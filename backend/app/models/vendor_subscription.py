"""
Vendor subscription, follow, and interest list models
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base


class VendorSubscription(Base):
    """Vendor subscription by tenant"""
    __tablename__ = "vendor_subscriptions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    subscribed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    notification_preferences = Column(JSON, nullable=True)  # Email notifications, update frequency, etc.


class VendorFollow(Base):
    """Vendor follow by user"""
    __tablename__ = "vendor_follows"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    followed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class VendorInterestList(Base):
    """Vendor interest list entry by user"""
    __tablename__ = "vendor_interest_lists"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)  # User notes about why they're interested

