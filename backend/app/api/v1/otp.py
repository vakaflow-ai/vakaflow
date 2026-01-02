"""
OTP (One-Time Password) API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from app.core.database import get_db
from app.services.otp_service import OTPService
from app.services.email_service import email_service
import logging

router = APIRouter(prefix="/otp", tags=["otp"])
logger = logging.getLogger(__name__)


class OTPRequest(BaseModel):
    """OTP request schema"""
    email: EmailStr
    purpose: str = Field(default="email_verification", pattern="^(email_verification|password_reset)$")


class OTPVerifyRequest(BaseModel):
    """OTP verification schema"""
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    purpose: str = Field(default="email_verification", pattern="^(email_verification|password_reset)$")


@router.post("/send")
async def send_otp(
    otp_data: OTPRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Send OTP code to email (public endpoint)"""
    try:
        # Generate and store OTP
        otp_code = await OTPService.create_otp(
            db=db,
            email=otp_data.email.lower(),
            purpose=otp_data.purpose,
            expires_in_minutes=10
        )
        
        # Load SMTP config from database if available
        email_service.load_config_from_db(db)
        
        # Send OTP via email
        email_sent = await email_service.send_otp_email(
            to_email=otp_data.email.lower(),
            otp_code=otp_code,
            purpose=otp_data.purpose
        )
        
        if not email_sent:
            logger.warning(f"Failed to send OTP email to {otp_data.email}, but OTP was generated")
            # Still return success - OTP is generated, email delivery might be delayed
            return {
                "message": "OTP code generated. Please check your email.",
                "note": "If you don't receive the email, please check your spam folder or try again."
            }
        
        return {
            "message": "OTP code sent to your email",
            "expires_in_minutes": 10
        }
    except Exception as e:
        logger.error(f"Error sending OTP: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP code"
        )


@router.post("/verify")
async def verify_otp(
    verify_data: OTPVerifyRequest,
    db: Session = Depends(get_db)
):
    """Verify OTP code (public endpoint)"""
    is_valid = await OTPService.verify_otp(
        db=db,
        email=verify_data.email.lower(),
        otp=verify_data.otp,
        purpose=verify_data.purpose
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code"
        )
    
    return {
        "message": "OTP verified successfully",
        "verified": True
    }

