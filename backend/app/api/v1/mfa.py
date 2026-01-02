"""
MFA API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from app.core.database import get_db
from app.models.user import User
from app.models.mfa import MFAConfig, MFAMethod
from app.api.v1.auth import get_current_user
from app.services.mfa_service import MFAService
from app.core.audit import audit_service, AuditAction

router = APIRouter(prefix="/mfa", tags=["mfa"])


class MFASetupRequest(BaseModel):
    """MFA setup request"""
    method: str = Field(default="totp", pattern="^(totp|sms|email)$")


class MFAVerifyRequest(BaseModel):
    """MFA verification request"""
    code: str = Field(..., min_length=6, max_length=10)


class MFASetupResponse(BaseModel):
    """MFA setup response"""
    secret: Optional[str] = None
    qr_code: Optional[str] = None
    backup_codes: Optional[list] = None
    method: str
    message: str


@router.post("/setup", response_model=MFASetupResponse)
async def setup_mfa(
    request_data: MFASetupRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set up MFA for current user"""
    try:
        result = await MFAService.setup_mfa(
            db=db,
            user_id=str(current_user.id),
            method=request_data.method
        )
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.UPDATE,
            resource_type="mfa_config",
            resource_id=str(current_user.id),
            tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
            details={"method": request_data.method, "action": "setup"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return MFASetupResponse(
            secret=result.get("secret"),
            qr_code=result.get("qr_code"),
            backup_codes=result.get("backup_codes"),
            method=result.get("method"),
            message="MFA setup initiated. Scan QR code with authenticator app and verify with a code."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MFA setup failed: {str(e)}"
        )


@router.post("/verify", response_model=dict)
async def verify_mfa(
    request_data: MFAVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify MFA code"""
    is_valid = await MFAService.verify_mfa(
        db=db,
        user_id=str(current_user.id),
        code=request_data.code,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA code"
        )
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="mfa_config",
        resource_id=str(current_user.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"action": "verify", "success": True},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"verified": True, "message": "MFA verified successfully"}


@router.post("/enable")
async def enable_mfa(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enable MFA for current user"""
    success = await MFAService.enable_mfa(db, str(current_user.id))
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA not set up. Please set up MFA first."
        )
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="mfa_config",
        resource_id=str(current_user.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"action": "enable"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"enabled": True, "message": "MFA enabled successfully"}


@router.post("/disable")
async def disable_mfa(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disable MFA for current user"""
    success = await MFAService.disable_mfa(db, str(current_user.id))
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA not configured"
        )
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="mfa_config",
        resource_id=str(current_user.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"action": "disable"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"enabled": False, "message": "MFA disabled successfully"}


@router.get("/status")
async def get_mfa_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get MFA status for current user"""
    mfa_config = db.query(MFAConfig).filter(MFAConfig.user_id == current_user.id).first()
    
    if not mfa_config:
        return {
            "enabled": False,
            "method": None,
            "status": "not_configured"
        }
    
    return {
        "enabled": mfa_config.is_enabled,
        "method": mfa_config.method,
        "status": mfa_config.status,
        "has_backup_codes": bool(mfa_config.totp_backup_codes)
    }

