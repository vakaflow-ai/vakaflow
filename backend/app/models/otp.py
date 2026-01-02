"""
OTP (One-Time Password) model
"""
from sqlalchemy import Column, String, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class OTPStatus(str, enum.Enum):
    """OTP status"""
    PENDING = "pending"
    VERIFIED = "verified"
    EXPIRED = "expired"


class OTPCode(Base):
    """OTP code model"""
    __tablename__ = "otp_codes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    purpose = Column(String(50), nullable=False, index=True)  # email_verification, password_reset, etc.
    otp_hash = Column(String(255), nullable=False)  # Hashed OTP (never store plain text)
    status = Column(Enum(OTPStatus), nullable=False, default=OTPStatus.PENDING)
    expires_at = Column(DateTime, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

