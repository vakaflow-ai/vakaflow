"""
OTP (One-Time Password) service for email verification
"""
import secrets
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.otp import OTPCode, OTPStatus
import logging

logger = logging.getLogger(__name__)


class OTPService:
    """Service for OTP generation and verification"""
    
    @staticmethod
    def generate_otp(length: int = 6) -> str:
        """Generate a random OTP code"""
        # Generate numeric OTP
        otp = ''.join([str(secrets.randbelow(10)) for _ in range(length)])
        return otp
    
    @staticmethod
    def hash_otp(otp: str) -> str:
        """Hash OTP for storage"""
        return hashlib.sha256(otp.encode()).hexdigest()
    
    @staticmethod
    async def create_otp(
        db: Session,
        email: str,
        purpose: str = "email_verification",
        expires_in_minutes: int = 10
    ) -> str:
        """
        Create and store an OTP code
        
        Args:
            db: Database session
            email: Email address to send OTP to
            purpose: Purpose of OTP (email_verification, password_reset, etc.)
            expires_in_minutes: OTP expiration time in minutes
            
        Returns:
            The OTP code (plain text, should be sent to user)
        """
        # Generate OTP
        otp = OTPService.generate_otp()
        otp_hash = OTPService.hash_otp(otp)
        
        # Expire any existing OTPs for this email and purpose
        existing_otps = db.query(OTPCode).filter(
            and_(
                OTPCode.email == email.lower(),
                OTPCode.purpose == purpose,
                OTPCode.status == OTPStatus.PENDING
            )
        ).all()
        
        for existing_otp in existing_otps:
            existing_otp.status = OTPStatus.EXPIRED
        
        # Create new OTP
        otp_code = OTPCode(
            email=email.lower(),
            purpose=purpose,
            otp_hash=otp_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=expires_in_minutes),
            status=OTPStatus.PENDING
        )
        
        db.add(otp_code)
        db.commit()
        db.refresh(otp_code)
        
        logger.info(f"OTP created for {email} (purpose: {purpose})")
        return otp
    
    @staticmethod
    async def verify_otp(
        db: Session,
        email: str,
        otp: str,
        purpose: str = "email_verification"
    ) -> bool:
        """
        Verify an OTP code
        
        Args:
            db: Database session
            email: Email address
            otp: OTP code to verify
            purpose: Purpose of OTP
            
        Returns:
            True if valid, False otherwise
        """
        otp_hash = OTPService.hash_otp(otp)
        
        # Find pending OTP
        otp_code = db.query(OTPCode).filter(
            and_(
                OTPCode.email == email.lower(),
                OTPCode.purpose == purpose,
                OTPCode.otp_hash == otp_hash,
                OTPCode.status == OTPStatus.PENDING
            )
        ).first()
        
        if not otp_code:
            logger.warning(f"OTP not found or already used for {email}")
            return False
        
        # Check expiration
        if datetime.utcnow() > otp_code.expires_at:
            otp_code.status = OTPStatus.EXPIRED
            db.commit()
            logger.warning(f"OTP expired for {email}")
            return False
        
        # Mark as used
        otp_code.status = OTPStatus.VERIFIED
        otp_code.verified_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"OTP verified successfully for {email}")
        return True
    
    @staticmethod
    async def is_otp_verified(
        db: Session,
        email: str,
        purpose: str = "email_verification",
        max_age_minutes: int = 30
    ) -> bool:
        """
        Check if email has a verified OTP (within the last max_age_minutes)
        
        Args:
            db: Database session
            email: Email address
            purpose: Purpose of OTP
            max_age_minutes: Maximum age of verification in minutes (default 30)
            
        Returns:
            True if email has a recent verified OTP, False otherwise
        """
        verified_otp = db.query(OTPCode).filter(
            and_(
                OTPCode.email == email.lower(),
                OTPCode.purpose == purpose,
                OTPCode.status == OTPStatus.VERIFIED
            )
        ).order_by(OTPCode.verified_at.desc()).first()
        
        if not verified_otp:
            return False
        
        # Check if verification is still valid (within max_age_minutes)
        if verified_otp.verified_at:
            age = datetime.utcnow() - verified_otp.verified_at
            if age.total_seconds() > (max_age_minutes * 60):
                logger.info(f"OTP verification expired for {email} (age: {age.total_seconds() / 60:.1f} minutes)")
                return False
        
        return True

