"""
Email notification service
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any
import logging
import os

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending email notifications"""
    
    def __init__(self):
        """Initialize email service with configuration"""
        self._load_config_from_env()
    
    def _load_config_from_env(self):
        """Load configuration from environment variables"""
        self.smtp_host = os.getenv("SMTP_HOST", "localhost")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        # Support both SMTP_PASS and SMTP_PASSWORD for compatibility
        self.smtp_password = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD", "")
        self.smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        # Support both FROM_EMAIL and SMTP_FROM
        self.from_email = os.getenv("SMTP_FROM") or os.getenv("FROM_EMAIL", "noreply@vaka.ai")
        self.from_name = os.getenv("SMTP_FROM_NAME") or os.getenv("FROM_NAME", "VAKA Platform")
        
        # Log configuration status (without exposing password)
        is_configured = bool(self.smtp_host and self.smtp_host != "localhost" and 
                            self.smtp_user and self.smtp_password)
        if is_configured:
            logger.info(f"Email service configured: Host={self.smtp_host}, Port={self.smtp_port}, User={self.smtp_user}, From={self.from_email}")
        else:
            logger.warning(f"Email service not fully configured: Host={self.smtp_host}, Port={self.smtp_port}, User={'***' if self.smtp_user else 'NOT SET'}, Password={'***' if self.smtp_password else 'NOT SET'}")
    
    def load_config_from_db(self, db, tenant_id: Optional[str] = None):
        """Load SMTP configuration from database integration (overrides env vars)
        
        Always uses integration from /integrations page, never falls back to env vars
        if integration exists.
        """
        try:
            from app.models.integration import Integration, IntegrationType, IntegrationStatus
            from uuid import UUID
            
            # Check if db has query method (SQLAlchemy session)
            if not hasattr(db, 'query'):
                logger.warning("Invalid database session provided to load_config_from_db")
                return False
            
            # Query for SMTP integration
            # Priority: 1) Tenant-specific active integration, 2) Platform-wide active integration
            integration = None
            
            if tenant_id:
                # First try tenant-specific integration
                tenant_uuid = UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
                integration = db.query(Integration).filter(
                    Integration.integration_type == IntegrationType.SMTP.value,
                    Integration.is_active == True,
                    Integration.status == IntegrationStatus.ACTIVE.value,
                    Integration.tenant_id == tenant_uuid
                ).first()
            
            # If no tenant-specific integration, try platform-wide (tenant_id is None)
            if not integration:
                integration = db.query(Integration).filter(
                    Integration.integration_type == IntegrationType.SMTP.value,
                    Integration.is_active == True,
                    Integration.status == IntegrationStatus.ACTIVE.value,
                    Integration.tenant_id.is_(None)
                ).first()
            
            if integration and integration.config:
                config = integration.config
                self.smtp_host = config.get("smtp_host", self.smtp_host)
                self.smtp_port = int(config.get("smtp_port", self.smtp_port))
                self.smtp_user = config.get("smtp_user", self.smtp_user)
                self.smtp_password = config.get("smtp_password", self.smtp_password)
                self.smtp_use_tls = config.get("smtp_use_tls", self.smtp_use_tls)
                self.from_email = config.get("from_email", self.from_email)
                self.from_name = config.get("from_name", self.from_name)
                
                logger.info(f"Email service loaded config from database integration: Host={self.smtp_host}, User={self.smtp_user}, From={self.from_email}, Integration ID={integration.id}")
                return True
            else:
                logger.warning(f"No active SMTP integration found in database for tenant {tenant_id}. Please configure SMTP in /integrations page.")
                return False
        except Exception as e:
            logger.error(f"Failed to load SMTP config from database: {e}. Please ensure SMTP is configured in /integrations page.", exc_info=True)
            return False
    
    def _get_smtp_connection(self):
        """Get SMTP connection"""
        try:
            server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10)
            if self.smtp_use_tls:
                server.starttls()
            if self.smtp_user and self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)
            return server
        except Exception as e:
            logger.error(f"Failed to connect to SMTP server {self.smtp_host}:{self.smtp_port}: {e}")
            raise
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> bool:
        """
        Send an email
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (optional)
            cc: CC recipients (optional)
            bcc: BCC recipients (optional)
        
        Returns:
            True if sent successfully, False otherwise
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            if cc:
                msg['Cc'] = ', '.join(cc)
            
            # Add text and HTML parts
            if text_body:
                text_part = MIMEText(text_body, 'plain')
                msg.attach(text_part)
            
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
            
            # Send email
            server = self._get_smtp_connection()
            recipients = [to_email]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)
            
            server.send_message(msg, from_addr=self.from_email, to_addrs=recipients)
            server.quit()
            
            logger.info(f"Email sent to {to_email}: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}", exc_info=True)
            logger.error(f"SMTP Config - Host: {self.smtp_host}, Port: {self.smtp_port}, User: {self.smtp_user}, TLS: {self.smtp_use_tls}")
            return False
    
    async def send_agent_status_notification(
        self,
        to_email: str,
        agent_name: str,
        status: str,
        agent_id: str,
        details: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send agent status change notification"""
        subject = f"Agent {agent_name} - Status: {status.title()}"
        
        html_body = f"""
        <html>
        <body>
            <h2>Agent Status Update</h2>
            <p>The status of agent <strong>{agent_name}</strong> has been updated to <strong>{status}</strong>.</p>
            <p><strong>Agent ID:</strong> {agent_id}</p>
            {f"<p><strong>Details:</strong> {details}</p>" if details else ""}
            <p><a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/agents/{agent_id}">View Agent</a></p>
        </body>
        </html>
        """
        
        text_body = f"""
        Agent Status Update
        
        The status of agent {agent_name} has been updated to {status}.
        
        Agent ID: {agent_id}
        {f"Details: {details}" if details else ""}
        
        View Agent: {os.getenv('FRONTEND_URL', 'http://localhost:3000')}/agents/{agent_id}
        """
        
        return await self.send_email(to_email, subject, html_body, text_body)
    
    async def send_review_assignment_notification(
        self,
        to_email: str,
        agent_name: str,
        review_stage: str,
        agent_id: str
    ) -> bool:
        """Send review assignment notification"""
        subject = f"Review Assignment: {agent_name} - {review_stage.title()} Review"
        
        html_body = f"""
        <html>
        <body>
            <h2>Review Assignment</h2>
            <p>You have been assigned to review agent <strong>{agent_name}</strong> for <strong>{review_stage}</strong> review.</p>
            <p><strong>Agent ID:</strong> {agent_id}</p>
            <p><a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/reviews?agent_id={agent_id}">Start Review</a></p>
        </body>
        </html>
        """
        
        text_body = f"""
        Review Assignment
        
        You have been assigned to review agent {agent_name} for {review_stage} review.
        
        Agent ID: {agent_id}
        
        Start Review: {os.getenv('FRONTEND_URL', 'http://localhost:3000')}/reviews?agent_id={agent_id}
        """
        
        return await self.send_email(to_email, subject, html_body, text_body)
    
    async def send_approval_request_notification(
        self,
        to_email: str,
        agent_name: str,
        agent_id: str
    ) -> bool:
        """Send approval request notification"""
        subject = f"Approval Request: {agent_name}"
        
        html_body = f"""
        <html>
        <body>
            <h2>Approval Request</h2>
            <p>Agent <strong>{agent_name}</strong> is ready for final approval.</p>
            <p><strong>Agent ID:</strong> {agent_id}</p>
            <p><a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/approvals?agent_id={agent_id}">Review for Approval</a></p>
        </body>
        </html>
        """
        
        text_body = f"""
        Approval Request
        
        Agent {agent_name} is ready for final approval.
        
        Agent ID: {agent_id}
        
        Review for Approval: {os.getenv('FRONTEND_URL', 'http://localhost:3000')}/approvals?agent_id={agent_id}
        """
        
        return await self.send_email(to_email, subject, html_body, text_body)
    
    async def send_vendor_invitation(
        self,
        to_email: str,
        inviter_name: str,
        tenant_name: str,
        invitation_token: str,
        invitation_url: str,
        message: Optional[str] = None
    ) -> bool:
        """Send vendor invitation email"""
        subject = f"Invitation to Access Vendor Portal - {tenant_name}"
        
        # Extract base URL for vendor portal link
        base_url = invitation_url.split('/vendor/register')[0]
        vendor_portal_url = f"{base_url}/vendor-dashboard"
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">You're Invited to the Vendor Portal!</h2>
                <p>Hello,</p>
                <p><strong>{inviter_name}</strong> from <strong>{tenant_name}</strong> has invited you to access their <strong>Vendor Portal</strong> to submit your AI Agent solutions.</p>
                {f'<p style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;"><em>{message}</em></p>' if message else ''}
                
                <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1e40af; margin-top: 0;">What is the Vendor Portal?</h3>
                    <p style="margin-bottom: 0;">The Vendor Portal is your dedicated space where you can:</p>
                    <ul style="margin-top: 10px; padding-left: 20px;">
                        <li>Register and manage your vendor profile</li>
                        <li>Submit AI Agent solutions for review</li>
                        <li>Track the status of your submissions</li>
                        <li>View feedback and compliance requirements</li>
                        <li>Manage your agent portfolio</li>
                    </ul>
                </div>
                
                <p><strong>To get started:</strong></p>
                <ol>
                    <li>Click the registration link below to accept the invitation</li>
                    <li>Complete your vendor account registration with email verification (OTP)</li>
                    <li>Set up your vendor profile</li>
                    <li>Access the Vendor Portal and start submitting your AI Agent solutions</li>
                </ol>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{invitation_url}" style="background-color: #2563eb; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Register & Access Vendor Portal</a>
                </div>
                
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #374151;">
                        <strong>Registration Link:</strong><br>
                        <a href="{invitation_url}" style="color: #2563eb; word-break: break-all; text-decoration: underline;">{invitation_url}</a>
                    </p>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
                    <strong>After Registration:</strong> Once you complete registration, you can access the Vendor Portal at:<br>
                    <a href="{vendor_portal_url}" style="color: #2563eb; word-break: break-all;">{vendor_portal_url}</a>
                </p>
                
                <p style="font-size: 12px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <strong>Important:</strong> This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.
                </p>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        You're Invited to the Vendor Portal!
        
        {inviter_name} from {tenant_name} has invited you to access their Vendor Portal to submit your AI Agent solutions.
        
        {f'Message: {message}' if message else ''}
        
        What is the Vendor Portal?
        The Vendor Portal is your dedicated space where you can:
        - Register and manage your vendor profile
        - Submit AI Agent solutions for review
        - Track the status of your submissions
        - View feedback and compliance requirements
        - Manage your agent portfolio
        
        To get started:
        1. Click the registration link below to accept the invitation
        2. Complete your vendor account registration with email verification (OTP)
        3. Set up your vendor profile
        4. Access the Vendor Portal and start submitting your AI Agent solutions
        
        Registration Link:
        {invitation_url}
        
        After Registration:
        Once you complete registration, you can access the Vendor Portal at:
        {vendor_portal_url}
        
        Important: This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.
        1. Click the link below to accept the invitation
        2. Register your vendor account with email verification (OTP)
        3. Complete your vendor profile
        4. Start submitting your AI Agent solutions
        
        Accept Invitation: {invitation_url}
        
        This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.
        """
        
        return await self.send_email(to_email, subject, html_body, text_body)
    
    async def send_otp_email(
        self,
        to_email: str,
        otp_code: str,
        purpose: str = "email_verification"
    ) -> bool:
        """Send OTP code via email"""
        if purpose == "email_verification":
            subject = "Verify Your Email - VAKA Platform"
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2563eb;">Verify Your Email</h2>
                    <p>Hello,</p>
                    <p>Please use the following code to verify your email address:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; display: inline-block;">
                            <div style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px;">{otp_code}</div>
                        </div>
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
                        If you did not request this code, please ignore this email.
                    </p>
                </div>
            </body>
            </html>
            """
            text_body = f"""
            Verify Your Email
            
            Please use the following code to verify your email address:
            
            {otp_code}
            
            This code will expire in 10 minutes.
            
            If you did not request this code, please ignore this email.
            """
        else:
            subject = f"Your Verification Code - VAKA Platform"
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2563eb;">Verification Code</h2>
                    <p>Your verification code is:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; display: inline-block;">
                            <div style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px;">{otp_code}</div>
                        </div>
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                </div>
            </body>
            </html>
            """
            text_body = f"""
            Your Verification Code
            
            Your verification code is: {otp_code}
            
            This code will expire in 10 minutes.
            """
        
        return await self.send_email(to_email, subject, html_body, text_body)


# Global email service instance
email_service = EmailService()

