"""
MFA (Multi-Factor Authentication) models
"""
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class MFAMethod(str, enum.Enum):
    """MFA method types"""
    TOTP = "totp"  # Time-based One-Time Password
    SMS = "sms"
    EMAIL = "email"
    BACKUP_CODE = "backup_code"


class MFAStatus(str, enum.Enum):
    """MFA status"""
    PENDING = "pending"
    VERIFIED = "verified"
    DISABLED = "disabled"


class MFAConfig(Base):
    """MFA configuration for users"""
    __tablename__ = "mfa_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # MFA settings
    is_enabled = Column(Boolean, default=False)
    method = Column(String(50), nullable=True)  # TOTP, SMS, EMAIL
    status = Column(String(50), nullable=False, default=MFAStatus.PENDING.value)
    
    # TOTP settings
    totp_secret = Column(String(255), nullable=True)  # Base32 encoded secret
    totp_backup_codes = Column(String, nullable=True)  # JSON array of backup codes
    
    # SMS/Email settings
    phone_number = Column(String(20), nullable=True)
    email_verified = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)


class MFAAttempt(Base):
    """MFA verification attempts log"""
    __tablename__ = "mfa_attempts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    mfa_config_id = Column(UUID(as_uuid=True), ForeignKey("mfa_configs.id"), nullable=True)
    
    # Attempt details
    method = Column(String(50), nullable=False)
    code_used = Column(String(10), nullable=True)  # Last 4 digits for security
    success = Column(Boolean, nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Metadata
    attempted_at = Column(DateTime, default=datetime.utcnow, index=True)

