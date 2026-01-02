"""
User model
"""
from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    """User roles"""
    PLATFORM_ADMIN = "platform_admin"  # Super admin - can create tenants and manage platform
    TENANT_ADMIN = "tenant_admin"
    POLICY_ADMIN = "policy_admin"
    INTEGRATION_ADMIN = "integration_admin"
    USER_ADMIN = "user_admin"
    SECURITY_REVIEWER = "security_reviewer"
    COMPLIANCE_REVIEWER = "compliance_reviewer"
    TECHNICAL_REVIEWER = "technical_reviewer"
    BUSINESS_REVIEWER = "business_reviewer"
    APPROVER = "approver"
    VENDOR_COORDINATOR = "vendor_coordinator"  # Vendor admin - manages vendor users and vendor settings
    VENDOR_USER = "vendor_user"
    END_USER = "end_user"


class User(Base):
    """User model"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Multi-tenant support
    department = Column(String(100), nullable=True, index=True)  # Department for cost tracking
    organization = Column(String(255), nullable=True, index=True)  # Organization/division
    hashed_password = Column(String(255), nullable=True)  # For password auth
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # reviews = relationship("Review", back_populates="reviewer")

