"""
MFA Service for TOTP-based multi-factor authentication
"""
import pyotp
import qrcode
import io
import base64
import secrets
import json
from typing import Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.mfa import MFAConfig, MFAAttempt, MFAMethod, MFAStatus
import logging

logger = logging.getLogger(__name__)


class MFAService:
    """Service for MFA operations"""
    
    @staticmethod
    def generate_totp_secret() -> str:
        """Generate a new TOTP secret"""
        return pyotp.random_base32()
    
    @staticmethod
    def generate_backup_codes(count: int = 10) -> list:
        """Generate backup codes"""
        return [secrets.token_hex(4).upper() for _ in range(count)]
    
    @staticmethod
    def generate_qr_code(secret: str, email: str, issuer: str = "VAKA Platform") -> str:
        """
        Generate QR code for TOTP setup
        
        Args:
            secret: TOTP secret
            email: User email
            issuer: Issuer name
        
        Returns:
            Base64 encoded QR code image
        """
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=email,
            issuer_name=issuer
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        # Convert to base64
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_base64}"
    
    @staticmethod
    def verify_totp(secret: str, code: str) -> bool:
        """
        Verify TOTP code
        
        Args:
            secret: TOTP secret
            code: Code to verify
        
        Returns:
            True if valid, False otherwise
        """
        try:
            totp = pyotp.TOTP(secret)
            return totp.verify(code, valid_window=1)  # Allow 1 time step window
        except Exception as e:
            logger.error(f"TOTP verification error: {e}")
            return False
    
    @staticmethod
    def verify_backup_code(backup_codes: str, code: str) -> Tuple[bool, Optional[str]]:
        """
        Verify backup code and remove it if valid
        
        Args:
            backup_codes: JSON string of backup codes
            code: Code to verify
        
        Returns:
            Tuple of (is_valid, updated_backup_codes_json)
        """
        try:
            codes = json.loads(backup_codes) if backup_codes else []
            code_upper = code.upper().strip()
            
            if code_upper in codes:
                codes.remove(code_upper)
                return True, json.dumps(codes)
            return False, backup_codes
        except Exception as e:
            logger.error(f"Backup code verification error: {e}")
            return False, backup_codes
    
    @staticmethod
    async def setup_mfa(
        db: Session,
        user_id: str,
        method: str = MFAMethod.TOTP.value
    ) -> dict:
        """
        Set up MFA for a user
        
        Args:
            db: Database session
            user_id: User ID
            method: MFA method (TOTP, SMS, EMAIL)
        
        Returns:
            Setup information (secret, QR code, backup codes)
        """
        # Get or create MFA config
        from uuid import UUID
        # Convert user_id string to UUID if needed
        user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
        mfa_config = db.query(MFAConfig).filter(MFAConfig.user_id == user_uuid).first()
        
        if not mfa_config:
            mfa_config = MFAConfig(
                user_id=user_uuid,
                method=method,
                status=MFAStatus.PENDING.value
            )
            db.add(mfa_config)
        else:
            mfa_config.method = method
            mfa_config.status = MFAStatus.PENDING.value
        
        if method == MFAMethod.TOTP.value:
            # Generate TOTP secret
            secret = MFAService.generate_totp_secret()
            mfa_config.totp_secret = secret
            
            # Generate backup codes
            backup_codes = MFAService.generate_backup_codes()
            mfa_config.totp_backup_codes = json.dumps(backup_codes)
            
            # Generate QR code
            from app.models.user import User
            user = db.query(User).filter(User.id == user_uuid).first()
            qr_code = MFAService.generate_qr_code(secret, user.email if user else "user")
            
            db.commit()
            
            return {
                "secret": secret,  # Only for initial setup, should be removed after
                "qr_code": qr_code,
                "backup_codes": backup_codes,
                "method": method
            }
        
        db.commit()
        return {"method": method, "status": "pending"}
    
    @staticmethod
    async def verify_mfa(
        db: Session,
        user_id: str,
        code: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """
        Verify MFA code
        
        Args:
            db: Database session
            user_id: User ID
            code: MFA code to verify
            ip_address: IP address
            user_agent: User agent
        
        Returns:
            True if valid, False otherwise
        """
        from uuid import UUID
        # Convert user_id string to UUID if needed
        user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
        mfa_config = db.query(MFAConfig).filter(
            MFAConfig.user_id == user_uuid,
            MFAConfig.is_enabled == True
        ).first()
        
        if not mfa_config:
            return False
        
        is_valid = False
        code_used = code[-4:] if len(code) > 4 else "****"  # Store last 4 digits only
        
        if mfa_config.method == MFAMethod.TOTP.value:
            # Try TOTP first
            if mfa_config.totp_secret:
                is_valid = MFAService.verify_totp(mfa_config.totp_secret, code)
            
            # If TOTP fails, try backup code
            if not is_valid and mfa_config.totp_backup_codes:
                is_valid, updated_codes = MFAService.verify_backup_code(
                    mfa_config.totp_backup_codes,
                    code
                )
                if is_valid:
                    mfa_config.totp_backup_codes = updated_codes
        
        # Log attempt
        attempt = MFAAttempt(
            user_id=user_uuid,
            mfa_config_id=mfa_config.id,
            method=mfa_config.method,
            code_used=code_used,
            success=is_valid,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(attempt)
        
        if is_valid:
            mfa_config.last_used_at = datetime.utcnow()
            if mfa_config.status == MFAStatus.PENDING.value:
                mfa_config.status = MFAStatus.VERIFIED.value
        
        db.commit()
        return is_valid
    
    @staticmethod
    async def enable_mfa(db: Session, user_id: str) -> bool:
        """Enable MFA for a user"""
        from uuid import UUID
        # Convert user_id string to UUID if needed
        user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
        mfa_config = db.query(MFAConfig).filter(MFAConfig.user_id == user_uuid).first()
        if not mfa_config or not mfa_config.totp_secret:
            return False
        
        mfa_config.is_enabled = True
        mfa_config.status = MFAStatus.VERIFIED.value
        db.commit()
        return True
    
    @staticmethod
    async def disable_mfa(db: Session, user_id: str) -> bool:
        """Disable MFA for a user"""
        from uuid import UUID
        # Convert user_id string to UUID if needed
        user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
        mfa_config = db.query(MFAConfig).filter(MFAConfig.user_id == user_uuid).first()
        if not mfa_config:
            return False
        
        mfa_config.is_enabled = False
        mfa_config.status = MFAStatus.DISABLED.value
        db.commit()
        return True

