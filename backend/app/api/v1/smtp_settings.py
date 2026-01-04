"""
SMTP Email Settings API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from app.core.database import get_db
from app.models.user import User
from app.models.integration import Integration, IntegrationType, IntegrationStatus
from app.api.v1.auth import get_current_user
from app.services.email_service import email_service
from app.core.audit import audit_service, AuditAction

router = APIRouter(prefix="/smtp-settings", tags=["smtp-settings"])


class SMTPConfig(BaseModel):
    """SMTP configuration schema"""
    smtp_host: str = Field(..., min_length=1, max_length=255)
    smtp_port: int = Field(..., ge=1, le=65535)
    smtp_user: EmailStr
    smtp_password: str = Field(..., min_length=1)
    smtp_use_tls: bool = Field(default=True)
    from_email: EmailStr
    from_name: str = Field(..., min_length=1, max_length=255)


class SMTPConfigResponse(BaseModel):
    """SMTP configuration response schema"""
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_use_tls: bool
    from_email: str
    from_name: str
    is_configured: bool
    integration_id: Optional[str] = None


@router.get("", response_model=SMTPConfigResponse)
async def get_smtp_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get SMTP settings (admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view SMTP settings"
        )
    
    # Try to get SMTP integration from database
    integration = db.query(Integration).filter(
        Integration.integration_type == IntegrationType.SMTP.value,
        Integration.tenant_id == current_user.tenant_id
    ).first()
    
    if integration and integration.config:
        config = integration.config
        return SMTPConfigResponse(
            smtp_host=config.get("smtp_host", ""),
            smtp_port=config.get("smtp_port", 587),
            smtp_user=config.get("smtp_user", ""),
            smtp_use_tls=config.get("smtp_use_tls", True),
            from_email=config.get("from_email", ""),
            from_name=config.get("from_name", ""),
            is_configured=True,
            integration_id=str(integration.id)
        )
    
    # Fallback to environment variables
    import os
    return SMTPConfigResponse(
        smtp_host=os.getenv("SMTP_HOST", ""),
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_user=os.getenv("SMTP_USER", ""),
        smtp_use_tls=os.getenv("SMTP_USE_TLS", "true").lower() == "true",
        from_email=os.getenv("SMTP_FROM") or os.getenv("FROM_EMAIL", ""),
        from_name=os.getenv("SMTP_FROM_NAME") or os.getenv("FROM_NAME", ""),
        is_configured=bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_HOST") != "localhost"),
        integration_id=None
    )


@router.post("", response_model=SMTPConfigResponse)
async def update_smtp_settings(
    config: SMTPConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update SMTP settings (admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update SMTP settings"
        )
    
    # Check if SMTP integration already exists
    integration = db.query(Integration).filter(
        Integration.integration_type == IntegrationType.SMTP.value,
        Integration.tenant_id == current_user.tenant_id
    ).first()
    
    config_dict = {
        "smtp_host": config.smtp_host,
        "smtp_port": config.smtp_port,
        "smtp_user": config.smtp_user,
        "smtp_password": config.smtp_password,  # In production, this should be encrypted
        "smtp_use_tls": config.smtp_use_tls,
        "from_email": config.from_email,
        "from_name": config.from_name
    }
    
    if integration:
        # Update existing integration
        integration.config = config_dict
        integration.status = IntegrationStatus.ACTIVE.value
        integration.is_active = True
        integration.health_status = "healthy"
    else:
        # Create new integration
        integration = Integration(
            tenant_id=current_user.tenant_id,
            name="SMTP Email Configuration",
            integration_type=IntegrationType.SMTP.value,
            config=config_dict,
            description="SMTP email server configuration",
            status=IntegrationStatus.ACTIVE.value,
            is_active=True,
            health_status="healthy",
            created_by=current_user.id
        )
        db.add(integration)
    
    db.commit()
    db.refresh(integration)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE if integration else AuditAction.CREATE,
        resource_type="smtp_settings",
        resource_id=str(integration.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"smtp_host": config.smtp_host, "from_email": config.from_email}
    )
    
    return SMTPConfigResponse(
        smtp_host=config.smtp_host,
        smtp_port=config.smtp_port,
        smtp_user=config.smtp_user,
        smtp_use_tls=config.smtp_use_tls,
        from_email=config.from_email,
        from_name=config.from_name,
        is_configured=True,
        integration_id=str(integration.id)
    )


@router.post("/test")
async def test_smtp_settings(
    config: Optional[SMTPConfig] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test SMTP connection (admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can test SMTP settings"
        )
    
    # If config provided, use it; otherwise get from database
    if config:
        test_config = {
            "smtp_host": config.smtp_host,
            "smtp_port": config.smtp_port,
            "smtp_user": config.smtp_user,
            "smtp_password": config.smtp_password,
            "smtp_use_tls": config.smtp_use_tls,
            "from_email": config.from_email,
            "from_name": config.from_name
        }
    else:
        # Get from database
        integration = db.query(Integration).filter(
            Integration.integration_type == IntegrationType.SMTP.value,
            Integration.tenant_id == current_user.tenant_id
        ).first()
        
        if not integration or not integration.config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="SMTP settings not configured"
            )
        
        test_config = integration.config
    
    # Test email sending
    try:
        # Create a temporary email service instance with test config
        from app.services.email_service import EmailService
        test_email_service = EmailService()
        test_email_service.smtp_host = test_config["smtp_host"]
        test_email_service.smtp_port = test_config["smtp_port"]
        test_email_service.smtp_user = test_config["smtp_user"]
        test_email_service.smtp_password = test_config["smtp_password"]
        test_email_service.smtp_use_tls = test_config.get("smtp_use_tls", True)
        test_email_service.from_email = test_config["from_email"]
        test_email_service.from_name = test_config.get("from_name", "VAKA Platform")
        
        # Send test email to the configured email address
        test_result, error_msg = await test_email_service.send_email(
            to_email=test_config["smtp_user"],  # Send test email to the SMTP user
            subject="SMTP Configuration Test",
            html_body="""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2563eb;">SMTP Configuration Test</h2>
                    <p>This is a test email to verify your SMTP configuration is working correctly.</p>
                    <p>If you received this email, your SMTP settings are configured properly!</p>
                </div>
            </body>
            </html>
            """,
            text_body="SMTP Configuration Test\n\nThis is a test email to verify your SMTP configuration is working correctly.\n\nIf you received this email, your SMTP settings are configured properly!"
        )
        
        if test_result:
            return {
                "status": "success",
                "message": "Test email sent successfully. Please check your inbox."
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send test email. Please check your SMTP settings."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SMTP test failed: {str(e)}"
        )

