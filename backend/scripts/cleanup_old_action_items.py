#!/usr/bin/env python3
"""
Cleanup script to mark old action items as completed if their underlying assignments are completed/approved.

This script identifies action items that are still marked as "pending" but whose underlying
assessment assignments are already completed, approved, or rejected, and marks them as completed.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.action_item import ActionItem, ActionItemStatus
from app.models.assessment_assignment import AssessmentAssignment
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def cleanup_old_action_items(db: Session, dry_run: bool = True):
    """
    Mark action items as completed if their underlying assignments are completed/approved/rejected.
    
    Args:
        db: Database session
        dry_run: If True, only log what would be changed without making changes
    """
    logger.info("=" * 80)
    logger.info("Starting cleanup of old action items")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE RUN'}")
    logger.info("=" * 80)
    
    # Find action items that are pending but their assignments are completed/approved/rejected
    action_items_to_cleanup = db.query(ActionItem).join(
        AssessmentAssignment,
        (ActionItem.source_id == AssessmentAssignment.id) &
        (ActionItem.source_type.in_(["assessment_assignment", "assessment_approval", "assessment_review"]))
    ).filter(
        ActionItem.status == ActionItemStatus.PENDING,
        AssessmentAssignment.status.in_(["completed", "approved", "rejected"])
    ).all()
    
    logger.info(f"Found {len(action_items_to_cleanup)} action items to cleanup")
    
    if len(action_items_to_cleanup) == 0:
        logger.info("No action items need cleanup. Exiting.")
        return
    
    # Group by assignment status for reporting
    by_status = {}
    for item in action_items_to_cleanup:
        assignment = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.id == item.source_id
        ).first()
        if assignment:
            status = assignment.status
            by_status[status] = by_status.get(status, 0) + 1
    
    logger.info("Action items by assignment status:")
    for status, count in by_status.items():
        logger.info(f"  - {status}: {count} items")
    
    # Show sample items
    logger.info("\nSample items to cleanup (first 10):")
    for item in action_items_to_cleanup[:10]:
        assignment = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.id == item.source_id
        ).first()
        logger.info(
            f"  - ActionItem {item.id}: "
            f"source_type={item.source_type}, "
            f"source_id={item.source_id}, "
            f"assignment_status={assignment.status if assignment else 'N/A'}, "
            f"assigned_to={item.assigned_to}"
        )
    
    if dry_run:
        logger.info("\n" + "=" * 80)
        logger.info("DRY RUN: No changes made. Run with --live to apply changes.")
        logger.info("=" * 80)
        return
    
    # Mark items as completed
    updated_count = 0
    for item in action_items_to_cleanup:
        try:
            item.status = ActionItemStatus.COMPLETED
            item.completed_at = datetime.utcnow()
            updated_count += 1
        except Exception as e:
            logger.error(f"Error updating action item {item.id}: {e}")
            db.rollback()
            continue
    
    try:
        db.commit()
        logger.info(f"\n✅ Successfully marked {updated_count} action items as completed")
    except Exception as e:
        logger.error(f"Error committing changes: {e}")
        db.rollback()
        raise
    
    logger.info("=" * 80)
    logger.info("Cleanup completed")
    logger.info("=" * 80)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Cleanup old action items")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Actually make changes (default is dry run)"
    )
    
    args = parser.parse_args()
    
    db = SessionLocal()
    try:
        cleanup_old_action_items(db, dry_run=not args.live)
    finally:
        db.close()

