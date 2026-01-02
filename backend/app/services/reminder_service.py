"""
Workflow Reminder Service
Handles scheduling and sending workflow reminders
"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging
import asyncio

from app.models.workflow_reminder import WorkflowReminder
from app.services.workflow_orchestration import WorkflowOrchestrationService
from app.models.workflow_config import WorkflowConfiguration
from app.models.user import User

logger = logging.getLogger(__name__)


class ReminderService:
    """Service for managing workflow reminders"""
    
    def __init__(self, db: Session, tenant_id: UUID):
        """
        Initialize reminder service
        
        Args:
            db: Database session
            tenant_id: Tenant ID
        """
        self.db = db
        self.tenant_id = tenant_id
        self.orchestration = WorkflowOrchestrationService(db, tenant_id)
    
    def schedule_reminders(
        self,
        entity_type: str,
        entity_id: UUID,
        request_type: str,
        workflow_stage: str,
        reminder_days: List[int],
        recipients: List[str],
        scheduled_by: Optional[UUID] = None
    ) -> List[WorkflowReminder]:
        """
        Schedule reminders for a workflow stage
        
        Args:
            entity_type: Entity type (e.g., "agent", "vendor")
            entity_id: Entity ID
            request_type: Request type
            workflow_stage: Workflow stage
            reminder_days: List of days after stage entry to send reminders
            recipients: List of recipient configs (e.g., ["user", "next_approver"])
            scheduled_by: User ID who scheduled the reminders
        
        Returns:
            List of created WorkflowReminder records
        """
        reminders = []
        base_date = datetime.utcnow()
        
        for days in reminder_days:
            reminder_date = base_date + timedelta(days=days)
            
            reminder = WorkflowReminder(
                tenant_id=self.tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                request_type=request_type,
                workflow_stage=workflow_stage,
                reminder_days=days,
                reminder_date=reminder_date,
                recipients=recipients,
                scheduled_by=scheduled_by,
                is_sent=False
            )
            
            self.db.add(reminder)
            reminders.append(reminder)
        
        self.db.commit()
        
        logger.info(f"Scheduled {len(reminders)} reminders for {entity_type} {entity_id} at stage {workflow_stage}")
        
        return reminders
    
    def get_due_reminders(
        self,
        limit: int = 100
    ) -> List[WorkflowReminder]:
        """
        Get reminders that are due to be sent
        
        Args:
            limit: Maximum number of reminders to return
        
        Returns:
            List of due reminders
        """
        now = datetime.utcnow()
        
        reminders = self.db.query(WorkflowReminder).filter(
            WorkflowReminder.tenant_id == self.tenant_id,
            WorkflowReminder.is_sent == False,
            WorkflowReminder.reminder_date <= now
        ).limit(limit).all()
        
        return reminders
    
    async def send_reminder(
        self,
        reminder: WorkflowReminder
    ) -> Dict[str, Any]:
        """
        Send a reminder email
        
        Args:
            reminder: WorkflowReminder to send
        
        Returns:
            Send result
        """
        try:
            # Get entity data (this would need to be implemented per entity type)
            entity_data = await self._get_entity_data(reminder.entity_type, reminder.entity_id)
            
            if not entity_data:
                logger.warning(f"Entity {reminder.entity_type} {reminder.entity_id} not found for reminder {reminder.id}")
                reminder.is_sent = True
                reminder.last_error = "Entity not found"
                self.db.commit()
                return {"sent": False, "error": "Entity not found"}
            
            # Get workflow configuration
            workflow_config = self.orchestration.get_workflow_for_entity(
                reminder.entity_type,
                entity_data,
                reminder.request_type
            )
            
            if not workflow_config:
                logger.warning(f"No workflow config found for reminder {reminder.id}")
                reminder.is_sent = True
                reminder.last_error = "Workflow configuration not found"
                self.db.commit()
                return {"sent": False, "error": "Workflow configuration not found"}
            
            # Get user who scheduled the reminder (or use system user)
            user = None
            if reminder.scheduled_by:
                user = self.db.query(User).filter(User.id == reminder.scheduled_by).first()
            
            if not user:
                # Use tenant admin as fallback
                user = self.db.query(User).filter(
                    User.tenant_id == self.tenant_id,
                    User.role == "tenant_admin"
                ).first()
            
            if not user:
                logger.error(f"No user found to send reminder {reminder.id}")
                reminder.is_sent = True
                reminder.last_error = "No user found"
                self.db.commit()
                return {"sent": False, "error": "No user found"}
            
            # Send notification using orchestration service
            notification_result = await self.orchestration.send_stage_notifications(
                workflow_config=workflow_config,
                workflow_stage=reminder.workflow_stage,
                entity_type=reminder.entity_type,
                entity_id=reminder.entity_id,
                entity_data=entity_data,
                user=user,
                recipients_config={"recipients": reminder.recipients}
            )
            
            # Update reminder status
            if notification_result.get("sent", False):
                reminder.is_sent = True
                reminder.sent_at = datetime.utcnow()
                reminder.last_error = None
            else:
                reminder.send_attempts += 1
                reminder.last_error = notification_result.get("reason", "Unknown error")
            
            self.db.commit()
            
            logger.info(f"Reminder {reminder.id} sent: {notification_result.get('sent', False)}")
            
            return notification_result
            
        except Exception as e:
            logger.error(f"Error sending reminder {reminder.id}: {e}", exc_info=True)
            reminder.send_attempts += 1
            reminder.last_error = str(e)
            self.db.commit()
            return {"sent": False, "error": str(e)}
    
    async def process_due_reminders(
        self,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Process all due reminders
        
        Args:
            limit: Maximum number of reminders to process
        
        Returns:
            Processing results
        """
        due_reminders = self.get_due_reminders(limit)
        
        results = {
            "processed": 0,
            "sent": 0,
            "failed": 0,
            "errors": []
        }
        
        for reminder in due_reminders:
            result = await self.send_reminder(reminder)
            results["processed"] += 1
            
            if result.get("sent", False):
                results["sent"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({
                    "reminder_id": str(reminder.id),
                    "error": result.get("error", "Unknown error")
                })
        
        logger.info(f"Processed {results['processed']} reminders: {results['sent']} sent, {results['failed']} failed")
        
        return results
    
    async def _get_entity_data(
        self,
        entity_type: str,
        entity_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get entity data for reminder
        
        This needs to be implemented per entity type.
        For now, we'll support agents.
        """
        if entity_type == "agent":
            from app.models.agent import Agent
            agent = self.db.query(Agent).filter(Agent.id == entity_id).first()
            if agent:
                return {
                    "id": str(agent.id),
                    "name": agent.name,
                    "type": agent.type,
                    "category": agent.category,
                    "status": agent.status,
                }
        elif entity_type == "vendor":
            from app.models.vendor import Vendor
            vendor = self.db.query(Vendor).filter(Vendor.id == entity_id).first()
            if vendor:
                return {
                    "id": str(vendor.id),
                    "name": vendor.name,
                    "type": vendor.type,
                    "status": vendor.status,
                }
        # Add more entity types as needed
        
        return None
    
    def cancel_reminders(
        self,
        entity_type: str,
        entity_id: UUID,
        workflow_stage: Optional[str] = None
    ) -> int:
        """
        Cancel pending reminders for an entity
        
        Args:
            entity_type: Entity type
            entity_id: Entity ID
            workflow_stage: Optional workflow stage filter
        
        Returns:
            Number of reminders cancelled
        """
        query = self.db.query(WorkflowReminder).filter(
            WorkflowReminder.tenant_id == self.tenant_id,
            WorkflowReminder.entity_type == entity_type,
            WorkflowReminder.entity_id == entity_id,
            WorkflowReminder.is_sent == False
        )
        
        if workflow_stage:
            query = query.filter(WorkflowReminder.workflow_stage == workflow_stage)
        
        reminders = query.all()
        count = len(reminders)
        
        for reminder in reminders:
            self.db.delete(reminder)
        
        self.db.commit()
        
        logger.info(f"Cancelled {count} reminders for {entity_type} {entity_id}")
        
        return count

