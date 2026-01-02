"""
Vendor invitation API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
import secrets
import logging

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.models.vendor_invitation import VendorInvitation, InvitationStatus
from app.models.tenant import Tenant
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
from app.services.email_service import email_service

router = APIRouter(prefix="/vendor-invitations", tags=["vendor-invitations"])
logger = logging.getLogger(__name__)


class InvitationCreate(BaseModel):
    """Invitation creation schema"""
    email: EmailStr
    message: Optional[str] = Field(None, max_length=1000)


class InvitationResponse(BaseModel):
    """Invitation response schema"""
    id: Optional[str] = None  # May be None for existing vendors
    email: str
    status: Optional[str] = None  # May be None for existing vendors
    expires_at: Optional[str] = None  # May be None for existing vendors
    created_at: Optional[str] = None  # May be None for existing vendors
    invited_by: Optional[str] = None  # May be None for existing vendors
    invited_by_name: Optional[str] = None
    message: Optional[str] = None
    tenant_name: Optional[str] = None
    # For existing vendors
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    notification_sent: Optional[bool] = None
    # Email sending status
    email_sent: Optional[bool] = None
    email_error: Optional[str] = None
    
    class Config:
        from_attributes = True


class InvitationAcceptRequest(BaseModel):
    """Invitation acceptance schema"""
    token: str
    email: EmailStr
    otp: str  # OTP for email verification
    vendor_name: str = Field(..., min_length=1, max_length=255)
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    registration_number: Optional[str] = None
    password: str = Field(..., min_length=8)  # Password for vendor user account
    name: str = Field(..., min_length=1, max_length=255)  # Vendor user name
    tenant_id: Optional[str] = None  # Tenant ID from URL for validation
    tenant_slug: Optional[str] = None  # Tenant slug from URL for validation


@router.post("", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    invitation_data: InvitationCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a vendor invitation (tenant admin or business user only)"""
    # Check permissions - tenant admin or business users can invite
    if current_user.role.value not in ["tenant_admin", "business_reviewer", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins and business users can invite vendors"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a tenant to invite vendors"
        )
    
    # Check if vendor already exists
    existing_vendor = db.query(Vendor).filter(
        Vendor.contact_email == invitation_data.email.lower(),
        Vendor.tenant_id == effective_tenant_id
    ).first()
    
    if existing_vendor:
        # Vendor already exists - send notification instead of creating new invitation
        logger.info(f"Vendor {existing_vendor.id} already exists, sending notification for new request")
        
        # Load SMTP config from database if available
        email_service.load_config_from_db(db, str(effective_tenant_id) if effective_tenant_id else None)
        
        # Send notification email to existing vendor
        try:
            # Get tenant info
            tenant = db.query(Tenant).filter(Tenant.id == effective_tenant_id).first()
            tenant_name = tenant.name if tenant else "Organization"
            
            # Send notification email
            notification_sent = await email_service.send_email(
                to_email=invitation_data.email.lower(),
                subject=f"New Agent Submission Request from {tenant_name}",
                html_body=f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2563eb;">New Agent Submission Request</h2>
                        <p>Hello,</p>
                        <p>{current_user.name} from {tenant_name} has requested that you submit a new AI Agent solution.</p>
                        {f'<p><strong>Message:</strong> {invitation_data.message}</p>' if invitation_data.message else ''}
                        <p>Please log in to your vendor portal to submit your agent:</p>
                        <p style="margin: 20px 0;">
                            <a href="{request.headers.get('Origin') or 'http://localhost:3000'}/vendor-dashboard" 
                               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Go to Vendor Portal
                            </a>
                        </p>
                        <p style="font-size: 12px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                            If you did not expect this request, you can safely ignore this email.
                        </p>
                    </div>
                </body>
                </html>
                """,
                text_body=f"""
                New Agent Submission Request
                
                {current_user.name} from {tenant_name} has requested that you submit a new AI Agent solution.
                
                {f'Message: {invitation_data.message}' if invitation_data.message else ''}
                
                Please log in to your vendor portal to submit your agent:
                {(request.headers.get('Origin') or 'http://localhost:3000')}/vendor-dashboard
                
                If you did not expect this request, you can safely ignore this email.
                """
            )
            
            if notification_sent:
                return InvitationResponse(
                    email=invitation_data.email.lower(),
                    vendor_id=str(existing_vendor.id),
                    vendor_name=existing_vendor.name,
                    notification_sent=True,
                    invited_by_name=current_user.name,
                    tenant_name=tenant_name,
                    message=invitation_data.message
                )
            else:
                logger.warning(f"Failed to send notification to existing vendor {existing_vendor.id}")
        except Exception as e:
            logger.error(f"Error sending notification to existing vendor: {e}", exc_info=True)
        
        # Return existing vendor info even if email failed
        return InvitationResponse(
            email=invitation_data.email.lower(),
            vendor_id=str(existing_vendor.id),
            vendor_name=existing_vendor.name,
            notification_sent=False,
            invited_by_name=current_user.name,
            tenant_name=tenant_name,
            message=invitation_data.message
        )
    
    # Check if there's a pending invitation
    existing_invitation = db.query(VendorInvitation).filter(
        VendorInvitation.email == invitation_data.email.lower(),
        VendorInvitation.tenant_id == effective_tenant_id,
        VendorInvitation.status == InvitationStatus.PENDING
    ).first()
    
    if existing_invitation:
        if existing_invitation.expires_at > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An active invitation already exists for this email"
            )
        else:
            # Mark expired invitation as expired
            existing_invitation.status = InvitationStatus.EXPIRED
    
    # Generate unique token
    token = secrets.token_urlsafe(32)
    
    # Create invitation
    invitation = VendorInvitation(
        tenant_id=effective_tenant_id,
        invited_by=current_user.id,
        email=invitation_data.email.lower(),
        token=token,
        status=InvitationStatus.PENDING,
        expires_at=datetime.utcnow() + timedelta(days=7),
        message=invitation_data.message
    )
    
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    
    # Get tenant information (required for tenant-scoped invitation)
    tenant = db.query(Tenant).filter(Tenant.id == effective_tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not found. Cannot send invitation without valid tenant."
        )
    
    tenant_name = tenant.name
    tenant_slug = tenant.slug
    tenant_id = str(effective_tenant_id)
    
    # Send invitation email with tenant information in URL
    frontend_url = request.headers.get("Origin") or "http://localhost:3000"
    # Include tenant slug and tenant_id in the registration URL for proper tenant scoping
    invitation_url = f"{frontend_url}/vendor/register?token={token}&email={invitation_data.email.lower()}&tenant_id={tenant_id}&tenant_slug={tenant_slug}"
    
    # Load SMTP config from database if available
    email_service.load_config_from_db(db, str(effective_tenant_id) if effective_tenant_id else None)
    
    # Send invitation email
    email_sent = False
    email_error = None
    try:
        email_sent = await email_service.send_vendor_invitation(
            to_email=invitation_data.email.lower(),
            inviter_name=current_user.name,
            tenant_name=tenant_name,
            invitation_token=token,
            invitation_url=invitation_url,
            message=invitation_data.message
        )
        
        if not email_sent:
            logger.warning(f"Failed to send invitation email to {invitation_data.email}, but invitation was created")
            email_error = "Email service is not configured. Please configure SMTP settings in Integration Management."
    except ConnectionRefusedError as e:
        logger.error(f"SMTP connection refused: {e}", exc_info=True)
        email_error = "SMTP server connection failed. Please check your SMTP configuration in Integration Management."
    except Exception as e:
        logger.error(f"Error sending invitation email: {e}", exc_info=True)
        email_error = f"Failed to send email: {str(e)}. Please check your SMTP configuration."
    
    # Audit log
    audit_details = {
        "email": invitation_data.email.lower(),
        "email_sent": email_sent
    }
    if email_error:
        audit_details["email_error"] = email_error
    
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="vendor_invitation",
        resource_id=str(invitation.id),
        tenant_id=str(effective_tenant_id),
        details=audit_details,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Include email status in response
    response = InvitationResponse(
        id=str(invitation.id),
        email=invitation.email,
        status=invitation.status.value,
        expires_at=invitation.expires_at.isoformat(),
        created_at=invitation.created_at.isoformat(),
        invited_by=str(invitation.invited_by),
        invited_by_name=current_user.name,
        message=invitation.message,
        tenant_name=tenant_name,
        email_sent=email_sent,
        email_error=email_error if not email_sent else None
    )
    
    # If email failed, log the warning
    if not email_sent and email_error:
        logger.warning(f"Invitation created but email not sent: {email_error}")
    
    return response


@router.get("", response_model=List[InvitationResponse])
async def list_invitations(
    status_filter: Optional[str] = Query(None, regex="^(pending|accepted|expired|cancelled)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List vendor invitations (tenant admin or business user only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "business_reviewer", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins and business users can view invitations"
        )
    
    query = db.query(VendorInvitation)
    
    # Filter by tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if current_user.role.value != "platform_admin":
        if not effective_tenant_id:
            return []
        query = query.filter(VendorInvitation.tenant_id == effective_tenant_id)
    
    # Filter by status
    if status_filter:
        query = query.filter(VendorInvitation.status == InvitationStatus[status_filter.upper()])
    
    # Update expired invitations
    expired = query.filter(
        VendorInvitation.status == InvitationStatus.PENDING,
        VendorInvitation.expires_at < datetime.utcnow()
    ).all()
    for inv in expired:
        inv.status = InvitationStatus.EXPIRED
    db.commit()
    
    invitations = query.order_by(VendorInvitation.created_at.desc()).all()
    
    # Batch fetch users and tenants to avoid N+1 queries
    inviter_ids = {inv.invited_by for inv in invitations if inv.invited_by}
    tenant_ids = {inv.tenant_id for inv in invitations if inv.tenant_id}
    
    # Fetch all users in one query
    inviters = {str(user.id): user for user in db.query(User).filter(User.id.in_(inviter_ids)).all()} if inviter_ids else {}
    
    # Fetch all tenants in one query
    tenants = {str(tenant.id): tenant for tenant in db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all()} if tenant_ids else {}
    
    # Build result using cached lookups
    result = []
    for inv in invitations:
        inviter = inviters.get(str(inv.invited_by)) if inv.invited_by else None
        tenant = tenants.get(str(inv.tenant_id)) if inv.tenant_id else None
        
        result.append(InvitationResponse(
            id=str(inv.id),
            email=inv.email,
            status=inv.status.value,
            expires_at=inv.expires_at.isoformat(),
            created_at=inv.created_at.isoformat(),
            invited_by=str(inv.invited_by),
            invited_by_name=inviter.name if inviter else None,
            message=inv.message,
            tenant_name=tenant.name if tenant else None
        ))
    
    return result


@router.get("/{invitation_id}", response_model=InvitationResponse)
async def get_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get invitation details by token (for vendor registration)"""
    invitation = db.query(VendorInvitation).filter(VendorInvitation.id == invitation_id).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    # Check if expired
    if invitation.status == InvitationStatus.PENDING and invitation.expires_at < datetime.utcnow():
        invitation.status = InvitationStatus.EXPIRED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired"
        )
    
    # Get inviter and tenant info
    inviter = db.query(User).filter(User.id == invitation.invited_by).first()
    tenant = db.query(Tenant).filter(Tenant.id == invitation.tenant_id).first()
    
    return InvitationResponse(
        id=str(invitation.id),
        email=invitation.email,
        status=invitation.status.value,
        expires_at=invitation.expires_at.isoformat(),
        created_at=invitation.created_at.isoformat(),
        invited_by=str(invitation.invited_by),
        invited_by_name=inviter.name if inviter else None,
        message=invitation.message,
        tenant_name=tenant.name if tenant else None
    )


@router.get("/by-token/{token}", response_model=InvitationResponse)
async def get_invitation_by_token(
    token: str,
    db: Session = Depends(get_db)
):
    """Get invitation by token (public endpoint for vendor registration)"""
    invitation = db.query(VendorInvitation).filter(VendorInvitation.token == token).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invitation token"
        )
    
    # Check if expired
    if invitation.status == InvitationStatus.PENDING and invitation.expires_at < datetime.utcnow():
        invitation.status = InvitationStatus.EXPIRED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired"
        )
    
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation has been {invitation.status.value}"
        )
    
    # Get inviter and tenant info
    inviter = db.query(User).filter(User.id == invitation.invited_by).first()
    tenant = db.query(Tenant).filter(Tenant.id == invitation.tenant_id).first()
    
    return InvitationResponse(
        id=str(invitation.id),
        email=invitation.email,
        status=invitation.status.value,
        expires_at=invitation.expires_at.isoformat(),
        created_at=invitation.created_at.isoformat(),
        invited_by=str(invitation.invited_by),
        invited_by_name=inviter.name if inviter else None,
        message=invitation.message,
        tenant_name=tenant.name if tenant else None
    )


@router.post("/accept", response_model=dict)
async def accept_invitation(
    accept_data: InvitationAcceptRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Accept vendor invitation and create vendor account"""
    # Find invitation
    invitation = db.query(VendorInvitation).filter(
        VendorInvitation.token == accept_data.token,
        VendorInvitation.email == accept_data.email.lower()
    ).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invitation token or email"
        )
    
    # Check status
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation has been {invitation.status.value}"
        )
    
    # Check expiration
    if invitation.expires_at < datetime.utcnow():
        invitation.status = InvitationStatus.EXPIRED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired"
        )
    
    # Validate tenant_id if provided (ensures tenant scoping)
    if accept_data.tenant_id:
        if str(invitation.tenant_id) != accept_data.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant ID mismatch. This invitation belongs to a different tenant."
            )
        
        # Validate tenant_slug if provided
        if accept_data.tenant_slug:
            tenant = db.query(Tenant).filter(Tenant.id == invitation.tenant_id).first()
            if tenant and tenant.slug != accept_data.tenant_slug:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tenant slug mismatch. This invitation belongs to a different tenant."
                )
    
    # Verify OTP - check if already verified or verify now
    from app.services.otp_service import OTPService
    
    # First check if OTP was already verified (from step 1)
    is_already_verified = await OTPService.is_otp_verified(
        db=db,
        email=accept_data.email.lower(),
        purpose="email_verification"
    )
    
    # If not already verified, try to verify the provided OTP
    if not is_already_verified:
        is_otp_valid = await OTPService.verify_otp(
            db=db,
            email=accept_data.email.lower(),
            otp=accept_data.otp,
            purpose="email_verification"
        )
        
        if not is_otp_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP code. Please verify your email first."
            )
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == accept_data.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Create vendor user
    from app.core.security import get_password_hash
    hashed_password = get_password_hash(accept_data.password)
    
    vendor_user = User(
        email=accept_data.email.lower(),
        name=accept_data.name,
        role=UserRole.VENDOR_USER,
        tenant_id=invitation.tenant_id,
        hashed_password=hashed_password,
        is_active=True
    )
    
    db.add(vendor_user)
    db.flush()
    
    # Create vendor
    vendor = Vendor(
        tenant_id=invitation.tenant_id,
        name=accept_data.vendor_name,
        contact_email=accept_data.email.lower(),
        contact_phone=accept_data.contact_phone,
        address=accept_data.address,
        website=accept_data.website,
        description=accept_data.description,
        registration_number=accept_data.registration_number
    )
    
    db.add(vendor)
    db.flush()
    
    # Update invitation
    invitation.status = InvitationStatus.ACCEPTED
    invitation.accepted_at = datetime.utcnow()
    invitation.vendor_id = vendor.id
    
    db.commit()
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(vendor_user.id),
        action=AuditAction.CREATE,
        resource_type="vendor",
        resource_id=str(vendor.id),
        tenant_id=str(invitation.tenant_id),
        details={"invitation_id": str(invitation.id), "vendor_name": accept_data.vendor_name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    logger.info(f"Vendor invitation accepted: {accept_data.email} -> vendor {vendor.id}")
    
    return {
        "message": "Vendor account created successfully",
        "vendor_id": str(vendor.id),
        "user_id": str(vendor_user.id)
    }


@router.post("/{invitation_id}/resend")
async def resend_invitation(
    invitation_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resend invitation email"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "business_reviewer", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins and business users can resend invitations"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    invitation = db.query(VendorInvitation).filter(VendorInvitation.id == invitation_id).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    # Check tenant access
    if current_user.role.value != "platform_admin":
        if not effective_tenant_id or invitation.tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Get tenant and inviter info (required for tenant-scoped invitation)
    tenant = db.query(Tenant).filter(Tenant.id == invitation.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found for this invitation"
        )
    
    inviter = db.query(User).filter(User.id == invitation.invited_by).first()
    
    tenant_name = tenant.name
    tenant_slug = tenant.slug
    tenant_id = str(invitation.tenant_id)
    
    # Load SMTP config from database if available
    email_service.load_config_from_db(db, tenant_id)
    
    # Send invitation email with tenant information in URL
    frontend_url = request.headers.get("Origin") or "http://localhost:3000"
    # Include tenant slug and tenant_id in the registration URL for proper tenant scoping
    invitation_url = f"{frontend_url}/vendor/register?token={invitation.token}&email={invitation.email}&tenant_id={tenant_id}&tenant_slug={tenant_slug}"
    
    try:
        email_sent = await email_service.send_vendor_invitation(
            to_email=invitation.email,
            inviter_name=inviter.name if inviter else "Administrator",
            tenant_name=tenant.name if tenant else "Organization",
            invitation_token=invitation.token,
            invitation_url=invitation_url,
            message=invitation.message
        )
        
        if not email_sent:
            logger.warning(f"Failed to send invitation email to {invitation.email}, but invitation exists")
            # In development, allow resend to succeed even if email fails
            # Return success with a warning message
            return {
                "message": "Invitation resend attempted. Email may not have been sent (SMTP not configured).",
                "invitation_url": invitation_url,
                "email_sent": False
            }
    except Exception as e:
        logger.error(f"Error sending invitation email: {e}", exc_info=True)
        # In development, don't fail the request if email fails
        # Return the invitation URL so user can manually share it
        return {
            "message": "Invitation resend attempted. Email service unavailable. Use the invitation URL below:",
            "invitation_url": invitation_url,
            "email_sent": False,
            "error": "Email service not configured or unavailable"
        }
    
    return {"message": "Invitation email resent successfully", "email_sent": True}


@router.post("/{invitation_id}/cancel")
async def cancel_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel an invitation"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "business_reviewer", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins and business users can cancel invitations"
        )
    
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    invitation = db.query(VendorInvitation).filter(VendorInvitation.id == invitation_id).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    # Check tenant access
    if current_user.role.value != "platform_admin":
        if not effective_tenant_id or invitation.tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel invitation with status {invitation.status.value}"
        )
    
    invitation.status = InvitationStatus.CANCELLED
    db.commit()
    
    return {"message": "Invitation cancelled successfully"}

