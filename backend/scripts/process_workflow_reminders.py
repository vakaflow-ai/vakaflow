"""
Background job script to process workflow reminders

This script should be run periodically (e.g., via cron or scheduler) to:
1. Find all due reminders
2. Send reminder emails
3. Update reminder status

Usage:
    python -m backend.scripts.process_workflow_reminders
    or
    python backend/scripts/process_workflow_reminders.py
"""
import sys
import os
import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.services.reminder_service import ReminderService
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def process_all_reminders():
    """Process all due reminders for all tenants"""
    db: Session = SessionLocal()
    
    try:
        # Get all unique tenant IDs that have pending reminders
        from app.models.workflow_reminder import WorkflowReminder
        from datetime import datetime
        
        now = datetime.utcnow()
        pending_reminders = db.query(WorkflowReminder).filter(
            WorkflowReminder.is_sent == False,
            WorkflowReminder.reminder_date <= now
        ).all()
        
        if not pending_reminders:
            logger.info("No due reminders to process")
            return
        
        # Group by tenant
        tenants_with_reminders = {}
        for reminder in pending_reminders:
            tenant_id = reminder.tenant_id
            if tenant_id not in tenants_with_reminders:
                tenants_with_reminders[tenant_id] = []
            tenants_with_reminders[tenant_id].append(reminder)
        
        logger.info(f"Found {len(pending_reminders)} due reminders across {len(tenants_with_reminders)} tenants")
        
        # Process reminders for each tenant
        total_processed = 0
        total_sent = 0
        total_failed = 0
        
        for tenant_id, reminders in tenants_with_reminders.items():
            logger.info(f"Processing {len(reminders)} reminders for tenant {tenant_id}")
            
            # Create service for this tenant
            service = ReminderService(db, tenant_id)
            
            # Process reminders
            result = await service.process_due_reminders(limit=len(reminders))
            
            total_processed += result["processed"]
            total_sent += result["sent"]
            total_failed += result["failed"]
            
            if result["errors"]:
                logger.warning(f"Errors processing reminders for tenant {tenant_id}: {result['errors']}")
        
        logger.info(f"Reminder processing complete: {total_processed} processed, {total_sent} sent, {total_failed} failed")
        
        return {
            "processed": total_processed,
            "sent": total_sent,
            "failed": total_failed
        }
        
    except Exception as e:
        logger.error(f"Error processing reminders: {e}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("Starting workflow reminder processing job...")
    result = asyncio.run(process_all_reminders())
    logger.info(f"Job completed: {result}")

