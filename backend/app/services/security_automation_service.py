"""
Security Automation Service - Automates tasks, alerts, assessments, and workflows
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import logging
import uuid
import asyncio
from app.models.security_incident import (
    VendorSecurityTracking,
    SecurityMonitoringConfig,
    SecurityAlert
)
from app.models.vendor import Vendor
from app.models.user import User, UserRole
from app.models.action_item import ActionItem, ActionItemPriority, ActionItemStatus, ActionItemType
from app.models.assessment import AssessmentAssignment
from app.services.email_service import EmailService
from app.services.integrations.slack_client import SlackClient
from app.services.integrations.teams_client import TeamsClient

logger = logging.getLogger(__name__)


class SecurityAutomationService:
    """Service for automating security incident responses"""
    
    def __init__(self, db: Session):
        self.db = db
        self.email_service = EmailService()
    
    def process_vendor_tracking(
        self,
        tracking: VendorSecurityTracking,
        config: SecurityMonitoringConfig,
        incident: Any  # SecurityIncident
    ) -> Dict[str, Any]:
        """
        Process a vendor tracking and trigger automated actions based on configuration
        
        Args:
            tracking: VendorSecurityTracking to process
            config: SecurityMonitoringConfig with automation settings
            incident: SecurityIncident associated with the tracking
        
        Returns:
            Dictionary with actions taken
        """
        actions_taken = {
            "task_created": False,
            "alert_sent": False,
            "assessment_triggered": False,
            "workflow_started": False
        }
        
        try:
            # Get vendor
            vendor = self.db.query(Vendor).filter(Vendor.id == tracking.vendor_id).first()
            if not vendor:
                logger.warning(f"Vendor not found for tracking {tracking.id}")
                return actions_taken
            
            # Auto-create task
            if config.auto_create_tasks:
                task = self._create_risk_qualification_task(tracking, vendor, incident, config)
                if task:
                    actions_taken["task_created"] = True
                    tracking.task_created = True
                    tracking.task_id = task.id
            
            # Auto-send alerts
            if config.auto_send_alerts:
                alert_sent = self._send_security_alert(tracking, vendor, incident, config)
                if alert_sent:
                    actions_taken["alert_sent"] = True
                    tracking.alert_sent = True
            
            # Auto-trigger assessment
            if config.auto_trigger_assessments and config.default_assessment_id:
                assessment = self._trigger_security_assessment(tracking, vendor, incident, config)
                if assessment:
                    actions_taken["assessment_triggered"] = True
                    tracking.assessment_triggered = True
                    tracking.assessment_id = assessment.id
            
            # Auto-start workflow
            if config.auto_start_workflows and config.default_workflow_id:
                workflow = self._start_security_workflow(tracking, vendor, incident, config)
                if workflow:
                    actions_taken["workflow_started"] = True
                    tracking.workflow_triggered = True
                    tracking.workflow_id = workflow.id
            
            self.db.commit()
            
        except Exception as e:
            logger.error(f"Error processing vendor tracking {tracking.id}: {str(e)}", exc_info=True)
            self.db.rollback()
        
        return actions_taken
    
    def _create_risk_qualification_task(
        self,
        tracking: VendorSecurityTracking,
        vendor: Vendor,
        incident: Any,
        config: SecurityMonitoringConfig
    ) -> Optional[ActionItem]:
        """Create a risk qualification task"""
        try:
            # Determine priority based on incident severity
            priority = ActionItemPriority.MEDIUM
            if hasattr(incident, 'severity') and incident.severity:
                # Handle both enum and string severity values
                if hasattr(incident.severity, 'value'):
                    severity_str = incident.severity.value
                else:
                    severity_str = str(incident.severity)
                
                if severity_str == "critical":
                    priority = ActionItemPriority.URGENT
                elif severity_str == "high":
                    priority = ActionItemPriority.HIGH
            
            # Find security reviewer or assessment owner
            assignee = self._find_security_reviewer(tracking.tenant_id)
            
            # If no assignee found, get tenant admin as fallback
            if not assignee:
                assignee = self.db.query(User).filter(
                    User.tenant_id == tracking.tenant_id,
                    User.role == UserRole.TENANT_ADMIN
                ).first()
            
            # If still no assignee, we can't create the task
            if not assignee:
                logger.warning(f"No assignee found for risk qualification task for vendor {vendor.name}")
                return None
            
            # Calculate due date (3 days for critical/high, 7 days for others)
            from datetime import datetime, timedelta
            due_date = datetime.utcnow() + timedelta(days=3 if priority == ActionItemPriority.URGENT else 7)
            
            # Ensure tenant_id and source_id are UUIDs, not strings
            tenant_id = tracking.tenant_id
            if isinstance(tenant_id, str):
                tenant_id = uuid.UUID(tenant_id)
            
            source_id = tracking.id
            if isinstance(source_id, str):
                source_id = uuid.UUID(str(source_id))
            
            task = ActionItem(
                tenant_id=tenant_id,
                title=f"Risk Qualification Required: {vendor.name} - {incident.external_id}",
                description=f"Security incident {getattr(incident, 'external_id', 'Unknown')} has been matched to vendor {vendor.name}.\n\n"
                          f"Match Confidence: {tracking.match_confidence * 100:.0f}%\n"
                          f"Match Method: {tracking.match_method}\n"
                          f"Severity: {incident.severity.value if hasattr(incident, 'severity') and incident.severity and hasattr(incident.severity, 'value') else (str(incident.severity) if hasattr(incident, 'severity') and incident.severity else 'Unknown')}\n"
                          f"CVSS Score: {getattr(incident, 'cvss_score', None) or 'N/A'}\n\n"
                          f"Please review and qualify the risk level.",
                priority=priority,
                status=ActionItemStatus.PENDING,
                assigned_to=assignee.id,
                due_date=due_date,
                action_type=ActionItemType.REVIEW,
                source_type="vendor_security_tracking",
                source_id=source_id,
                item_metadata={
                    "vendor_id": str(vendor.id),
                    "incident_id": str(incident.id),
                    "tracking_id": str(tracking.id),
                    "match_confidence": tracking.match_confidence,
                    "match_method": tracking.match_method
                }
            )
            
            self.db.add(task)
            self.db.flush()
            
            logger.info(f"Created risk qualification task {task.id} for vendor {vendor.name} and incident {incident.external_id}")
            return task
            
        except Exception as e:
            logger.error(f"Error creating risk qualification task: {str(e)}", exc_info=True)
            return None
    
    def _send_security_alert(
        self,
        tracking: VendorSecurityTracking,
        vendor: Vendor,
        incident: Any,
        config: SecurityMonitoringConfig
    ) -> bool:
        """Send security alert through configured channels"""
        try:
            # Get alert recipients
            recipients = self._get_alert_recipients(config)
            if not recipients:
                logger.warning(f"No alert recipients configured for tenant {tracking.tenant_id}")
                return False
            
            # Create alert message
            subject = f"Security Alert: {incident.external_id} - {vendor.name}"
            message = f"""
Security Incident Detected

Vendor: {vendor.name}
Incident: {incident.external_id}
Severity: {incident.severity.value if incident.severity else 'Unknown'}
CVSS Score: {incident.cvss_score or 'N/A'}
Match Confidence: {tracking.match_confidence * 100:.0f}%

Description:
{incident.description or 'No description available'}

Please review and take appropriate action.

View Details: {incident.source_url or 'N/A'}
"""
            
            # Send through configured channels
            channels = config.alert_channels or ["email", "in_app"]
            alert_sent = False
            
            for channel in channels:
                try:
                    if channel == "email":
                        # Load email config from database for tenant
                        self.email_service.load_config_from_db(self.db, tenant_id=str(tracking.tenant_id))
                        
                        # Send email alerts
                        for recipient in recipients:
                            if recipient.get("email"):
                                # Convert plain text message to HTML
                                html_message = message.replace('\n', '<br>')
                                try:
                                    # Try to get existing event loop
                                    try:
                                        loop = asyncio.get_running_loop()
                                        # If we're in an async context, we can't use asyncio.run()
                                        # Instead, we'll schedule it (but this won't wait for completion)
                                        # For now, log a warning and continue
                                        logger.warning("Cannot send email synchronously from async context. Email will be sent asynchronously.")
                                        # Schedule the coroutine (fire and forget)
                                        loop.create_task(
                                            sent, _ = self.email_service.send_email(
                                                to_email=recipient["email"],
                                                subject=subject,
                                                html_body=html_message,
                                                text_body=message
                                            )
                                        )
                                    except RuntimeError:
                                        # No event loop running, we can use asyncio.run()
                                        asyncio.run(
                                            sent, _ = self.email_service.send_email(
                                                to_email=recipient["email"],
                                                subject=subject,
                                                html_body=html_message,
                                                text_body=message
                                            )
                                        )
                                except Exception as e:
                                    logger.error(f"Error sending email to {recipient.get('email')}: {str(e)}", exc_info=True)
                        alert_sent = True
                    
                    elif channel == "slack":
                        # Send Slack alerts (if configured)
                        # This would use Integration API to get Slack config
                        logger.info("Slack alerts not yet implemented")
                    
                    elif channel == "teams":
                        # Send Teams alerts (if configured)
                        logger.info("Teams alerts not yet implemented")
                    
                    elif channel == "in_app":
                        # Create in-app SecurityAlert record for each recipient
                        # Get severity value safely
                        severity_value = "medium"
                        if hasattr(incident, 'severity') and incident.severity:
                            if hasattr(incident.severity, 'value'):
                                severity_value = incident.severity.value
                            else:
                                severity_value = str(incident.severity)
                        
                        # SecurityAlert requires alert_type and priority, not severity
                        # Create one alert per recipient (or one if no specific recipients)
                        for recipient in recipients:
                            recipient_id = None
                            if recipient.get("id"):
                                try:
                                    recipient_id = uuid.UUID(recipient["id"]) if isinstance(recipient["id"], str) else recipient["id"]
                                except (ValueError, TypeError):
                                    logger.warning(f"Invalid recipient ID format: {recipient.get('id')}")
                            
                            alert = SecurityAlert(
                                tenant_id=tracking.tenant_id,
                                alert_type="cve_detected",  # Required field
                                priority=severity_value,  # Required field (maps to severity)
                                title=subject,
                                message=message,
                                incident_id=incident.id,
                                tracking_id=tracking.id,
                                recipient_id=recipient_id,
                                recipient_role=recipient.get("role"),
                                channels=channels,
                                status="sent"
                            )
                            self.db.add(alert)
                        alert_sent = True
                    
                except Exception as e:
                    logger.error(f"Error sending alert via {channel}: {str(e)}", exc_info=True)
            
            if alert_sent:
                logger.info(f"Sent security alert for incident {incident.external_id} to vendor {vendor.name}")
            
            return alert_sent
            
        except Exception as e:
            logger.error(f"Error sending security alert: {str(e)}", exc_info=True)
            return False
    
    def _trigger_security_assessment(
        self,
        tracking: VendorSecurityTracking,
        vendor: Vendor,
        incident: Any,
        config: SecurityMonitoringConfig
    ) -> Optional[AssessmentAssignment]:
        """Trigger security assessment for vendor"""
        try:
            from app.services.assessment_service import AssessmentService
            from datetime import datetime, timedelta
            
            assessment_service = AssessmentService(self.db)
            
            # Create assessment assignment
            due_date = datetime.utcnow() + timedelta(days=14)  # Default 14 days
            
            assignment_data = {
                "assignment_type": "security_incident",
                "status": "pending",
                "vendor_id": str(vendor.id),
                "due_date": due_date,
                "metadata": {
                    "incident_id": str(incident.id),
                    "tracking_id": str(tracking.id),
                    "incident_external_id": incident.external_id,
                    "severity": incident.severity.value if incident.severity else None,
                    "cvss_score": incident.cvss_score
                }
            }
            
            # Get assessment owner (security reviewer or tenant admin)
            owner = self._find_security_reviewer(tracking.tenant_id)
            if not owner:
                # Fallback to tenant admin
                owner = self.db.query(User).filter(
                    User.tenant_id == tracking.tenant_id,
                    User.role == UserRole.TENANT_ADMIN
                ).first()
            
            assignment = assessment_service.create_assignment(
                assessment_id=config.default_assessment_id,
                assignment_data=assignment_data,
                tenant_id=str(tracking.tenant_id),
                assigned_by=owner.id if owner else None,
                schedule_id=None
            )
            
            logger.info(f"Triggered security assessment {assignment.id} for vendor {vendor.name}")
            return assignment
            
        except Exception as e:
            logger.error(f"Error triggering security assessment: {str(e)}", exc_info=True)
            return None
    
    def _start_security_workflow(
        self,
        tracking: VendorSecurityTracking,
        vendor: Vendor,
        incident: Any,
        config: SecurityMonitoringConfig
    ) -> Optional[Any]:  # WorkflowInstance
        """Start TPRM/VRM/Risk workflow for vendor"""
        try:
            # This would integrate with the workflow system
            # For now, just log that it would be started
            logger.info(f"Would start workflow {config.default_workflow_id} for vendor {vendor.name} and incident {incident.external_id}")
            # TODO: Implement workflow integration
            return None
            
        except Exception as e:
            logger.error(f"Error starting security workflow: {str(e)}", exc_info=True)
            return None
    
    def _find_security_reviewer(self, tenant_id: str) -> Optional[User]:
        """Find a security reviewer user for the tenant"""
        # Try to find a user with security_reviewer role or similar
        reviewer = self.db.query(User).filter(
            User.tenant_id == tenant_id,
            User.role.in_([UserRole.BUSINESS_REVIEWER, UserRole.TENANT_ADMIN]),
            User.is_active == True
        ).first()
        
        return reviewer
    
    def _get_alert_recipients(self, config: SecurityMonitoringConfig) -> List[Dict[str, Any]]:
        """Get alert recipients based on configuration"""
        recipients = []
        
        if not config.alert_recipients:
            # Default: get all tenant admins and business reviewers
            users = self.db.query(User).filter(
                User.tenant_id == config.tenant_id,
                User.role.in_([UserRole.TENANT_ADMIN, UserRole.BUSINESS_REVIEWER]),
                User.is_active == True
            ).all()
            
            for user in users:
                recipients.append({
                    "id": str(user.id),
                    "email": user.email,
                    "name": user.name,
                    "role": user.role.value
                })
        else:
            # Use configured recipients
            for recipient_id in config.alert_recipients:
                user = self.db.query(User).filter(User.id == recipient_id).first()
                if user:
                    recipients.append({
                        "id": str(user.id),
                        "email": user.email,
                        "name": user.name,
                        "role": user.role.value
                    })
        
        return recipients

