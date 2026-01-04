#!/usr/bin/env python3
"""
Cleanup script for transaction/activity data in the database.

This script cleans up old transaction data from various tables:
- audit_logs: User action audit trails
- assessment_workflow_history: Workflow action history
- messages: User messages/notifications
- action_items: Completed action items
- workflow_audit_trail: Workflow audit records

Usage:
    # Dry run (preview what would be deleted)
    python scripts/cleanup_transaction_data.py
    
    # Actually delete data older than 90 days
    python scripts/cleanup_transaction_data.py --days 90 --live
    
    # Delete data older than 1 year
    python scripts/cleanup_transaction_data.py --years 1 --live
    
    # Cleanup specific tenant only
    python scripts/cleanup_transaction_data.py --days 180 --tenant-id <uuid> --live
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.db.session import SessionLocal
from app.models.audit import AuditLog
from app.models.assessment_workflow_history import AssessmentWorkflowHistory
from app.models.message import Message
from app.models.action_item import ActionItem, ActionItemStatus
try:
    from app.models.workflow_stage import WorkflowAuditTrail
except ImportError:
    # WorkflowAuditTrail might not exist in all versions
    WorkflowAuditTrail = None
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def cleanup_transaction_data(
    db: Session,
    older_than_days: int = 90,
    tenant_id: Optional[UUID] = None,
    dry_run: bool = True
):
    """
    Cleanup old transaction/activity data from the database.
    
    Args:
        db: Database session
        older_than_days: Delete data older than this many days (default: 90)
        tenant_id: Optional tenant ID to filter by (None = all tenants)
        dry_run: If True, only log what would be deleted without making changes
    """
    logger.info("=" * 80)
    logger.info("Starting cleanup of transaction/activity data")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE RUN'}")
    logger.info(f"Retention period: {older_than_days} days")
    if tenant_id:
        logger.info(f"Tenant filter: {tenant_id}")
    else:
        logger.info("Tenant filter: All tenants")
    logger.info("=" * 80)
    
    cutoff_date = datetime.utcnow() - timedelta(days=older_than_days)
    logger.info(f"Cutoff date: {cutoff_date.isoformat()}")
    logger.info("")
    
    total_deleted = 0
    results = {}
    
    # 1. Cleanup Audit Logs
    try:
        logger.info("1. Cleaning up audit_logs...")
        query = db.query(AuditLog).filter(AuditLog.created_at < cutoff_date)
        if tenant_id:
            query = query.filter(AuditLog.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} audit log entries to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} audit log entries")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} audit log entries")
        
        results['audit_logs'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up audit_logs: {e}")
        results['audit_logs'] = 0
    
    # 2. Cleanup Assessment Workflow History
    try:
        logger.info("2. Cleaning up assessment_workflow_history...")
        query = db.query(AssessmentWorkflowHistory).filter(AssessmentWorkflowHistory.action_at < cutoff_date)
        if tenant_id:
            query = query.filter(AssessmentWorkflowHistory.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} workflow history entries to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} workflow history entries")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} workflow history entries")
        
        results['workflow_history'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up assessment_workflow_history: {e}")
        results['workflow_history'] = 0
    
    # 3. Cleanup Old Messages
    try:
        logger.info("3. Cleaning up messages...")
        query = db.query(Message).filter(Message.created_at < cutoff_date)
        if tenant_id:
            query = query.filter(Message.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} message entries to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} message entries")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} message entries")
        
        results['messages'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up messages: {e}")
        results['messages'] = 0
    
    # 4. Cleanup Completed Action Items
    try:
        logger.info("4. Cleaning up completed action_items...")
        query = db.query(ActionItem).filter(
            and_(
                ActionItem.status == ActionItemStatus.COMPLETED,
                ActionItem.completed_at.isnot(None),
                ActionItem.completed_at < cutoff_date
            )
        )
        if tenant_id:
            query = query.filter(ActionItem.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} completed action items to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} completed action items")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} completed action items")
        
        results['action_items'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up action_items: {e}")
        results['action_items'] = 0
    
    # 5. Cleanup Workflow Audit Trail (if model exists)
    if WorkflowAuditTrail is not None:
        try:
            logger.info("5. Cleaning up workflow_audit_trail...")
            query = db.query(WorkflowAuditTrail).filter(WorkflowAuditTrail.created_at < cutoff_date)
            if tenant_id:
                # WorkflowAuditTrail might not have tenant_id, check if it exists
                if hasattr(WorkflowAuditTrail, 'tenant_id'):
                    query = query.filter(WorkflowAuditTrail.tenant_id == tenant_id)
            
            count = query.count()
            logger.info(f"   Found {count} workflow audit trail entries to delete")
            
            if count > 0 and not dry_run:
                query.delete(synchronize_session=False)
                db.flush()
                logger.info(f"   ✅ Deleted {count} workflow audit trail entries")
            else:
                logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} workflow audit trail entries")
            
            results['workflow_audit_trail'] = count
            total_deleted += count
        except Exception as e:
            logger.error(f"   ❌ Error cleaning up workflow_audit_trail: {e}")
            results['workflow_audit_trail'] = 0
    else:
        logger.info("5. Skipping workflow_audit_trail (model not available)")
        results['workflow_audit_trail'] = 0
    
    # Summary
    logger.info("")
    logger.info("=" * 80)
    logger.info("CLEANUP SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Total records {'that would be' if dry_run else ''} deleted: {total_deleted}")
    logger.info("")
    logger.info("Breakdown by table:")
    for table, count in results.items():
        logger.info(f"  - {table}: {count} records")
    
    if dry_run:
        logger.info("")
        logger.info("=" * 80)
        logger.info("DRY RUN: No changes made. Run with --live to apply changes.")
        logger.info("=" * 80)
        return results
    
    # Commit all changes
    try:
        db.commit()
        logger.info("")
        logger.info("✅ All changes committed successfully")
    except Exception as e:
        logger.error(f"❌ Error committing changes: {e}")
        db.rollback()
        raise
    
    logger.info("=" * 80)
    logger.info("Cleanup completed successfully")
    logger.info("=" * 80)
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Cleanup old transaction/activity data from database")
    parser.add_argument(
        "--days",
        type=int,
        default=90,
        help="Delete data older than this many days (default: 90)"
    )
    parser.add_argument(
        "--years",
        type=float,
        help="Delete data older than this many years (overrides --days)"
    )
    parser.add_argument(
        "--tenant-id",
        type=str,
        help="Optional tenant ID to filter cleanup (UUID format)"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Actually delete data (default is dry run)"
    )
    
    args = parser.parse_args()
    
    # Calculate days from years if provided
    if args.years:
        older_than_days = int(args.years * 365)
        logger.info(f"Converting {args.years} years to {older_than_days} days")
    else:
        older_than_days = args.days
    
    # Parse tenant_id if provided
    tenant_id = None
    if args.tenant_id:
        try:
            tenant_id = UUID(args.tenant_id)
        except ValueError:
            logger.error(f"Invalid tenant ID format: {args.tenant_id}")
            sys.exit(1)
    
    db = SessionLocal()
    try:
        cleanup_transaction_data(
            db=db,
            older_than_days=older_than_days,
            tenant_id=tenant_id,
            dry_run=not args.live
        )
    except Exception as e:
        logger.error(f"Cleanup failed: {e}", exc_info=True)
        sys.exit(1)
    finally:
        db.close()

