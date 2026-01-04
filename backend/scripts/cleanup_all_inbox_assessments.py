#!/usr/bin/env python3
"""
Cleanup script for ALL inbox items and assessment data.

This script deletes:
- ALL action items (inbox items)
- ALL assessment assignments
- ALL assessment responses
- ALL assessment reviews
- Assessment workflow history

WARNING: This is a destructive operation. Use with caution.

Usage:
    # Dry run (preview what would be deleted)
    python scripts/cleanup_all_inbox_assessments.py
    
    # Actually delete all data
    python scripts/cleanup_all_inbox_assessments.py --live
"""

import sys
import os
from pathlib import Path
from typing import Optional
from uuid import UUID

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.core.database import SessionLocal
from app.models.action_item import ActionItem
from app.models.assessment import AssessmentAssignment, AssessmentQuestionResponse
from app.models.assessment_review import AssessmentReview, AssessmentQuestionReview, AssessmentReviewAudit
from app.models.assessment_workflow_history import AssessmentWorkflowHistory
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def cleanup_all_inbox_assessments(
    db: Session,
    tenant_id: Optional[UUID] = None,
    dry_run: bool = True
):
    """
    Cleanup ALL inbox items and assessment data.
    
    Args:
        db: Database session
        tenant_id: Optional tenant ID to filter by (None = all tenants)
        dry_run: If True, only log what would be deleted without making changes
    """
    logger.info("=" * 80)
    logger.info("Starting cleanup of ALL inbox items and assessment data")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE RUN'}")
    if tenant_id:
        logger.info(f"Tenant filter: {tenant_id}")
    else:
        logger.info("Tenant filter: All tenants")
    logger.info("=" * 80)
    logger.info("")
    
    total_deleted = 0
    results = {}
    
    # 1. Cleanup ALL Action Items (Inbox Items)
    try:
        logger.info("1. Cleaning up ALL action items (inbox items)...")
        query = db.query(ActionItem)
        if tenant_id:
            query = query.filter(ActionItem.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} action items to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} action items")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} action items")
        
        results['action_items'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up action_items: {e}", exc_info=True)
        results['action_items'] = 0
    
    # 2. Cleanup ALL Assessment Review Audits (must be deleted before reviews)
    try:
        logger.info("2. Cleaning up assessment review audits...")
        query = db.query(AssessmentReviewAudit)
        if tenant_id:
            # Join through AssessmentReview to get tenant_id
            query = query.join(AssessmentReview).filter(AssessmentReview.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} review audit entries to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} review audit entries")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} review audit entries")
        
        results['review_audits'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up review_audits: {e}", exc_info=True)
        results['review_audits'] = 0
        if not dry_run:
            db.rollback()
    
    # 3. Cleanup ALL Assessment Question Reviews
    try:
        logger.info("3. Cleaning up assessment question reviews...")
        query = db.query(AssessmentQuestionReview)
        if tenant_id:
            # Join through AssessmentReview to get tenant_id
            query = query.join(AssessmentReview).filter(AssessmentReview.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} question reviews to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} question reviews")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} question reviews")
        
        results['question_reviews'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up question_reviews: {e}", exc_info=True)
        results['question_reviews'] = 0
        if not dry_run:
            db.rollback()
    
    # 4. Cleanup ALL Assessment Reviews
    try:
        logger.info("4. Cleaning up assessment reviews...")
        query = db.query(AssessmentReview)
        if tenant_id:
            query = query.filter(AssessmentReview.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} assessment reviews to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} assessment reviews")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} assessment reviews")
        
        results['assessment_reviews'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up assessment_reviews: {e}", exc_info=True)
        results['assessment_reviews'] = 0
        if not dry_run:
            db.rollback()
    
    # 5. Cleanup ALL Assessment Question Responses
    try:
        logger.info("4. Cleaning up assessment question responses...")
        query = db.query(AssessmentQuestionResponse)
        if tenant_id:
            # Join through AssessmentAssignment to get tenant_id
            query = query.join(AssessmentAssignment).filter(AssessmentAssignment.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} question responses to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} question responses")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} question responses")
        
        results['question_responses'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up question_responses: {e}", exc_info=True)
        results['question_responses'] = 0
    
    # 6. Cleanup ALL Assessment Assignments
    try:
        logger.info("5. Cleaning up assessment assignments...")
        query = db.query(AssessmentAssignment)
        if tenant_id:
            query = query.filter(AssessmentAssignment.tenant_id == tenant_id)
        
        count = query.count()
        logger.info(f"   Found {count} assessment assignments to delete")
        
        if count > 0 and not dry_run:
            query.delete(synchronize_session=False)
            db.flush()
            logger.info(f"   ✅ Deleted {count} assessment assignments")
        else:
            logger.info(f"   {'Would delete' if dry_run else 'Deleted'} {count} assessment assignments")
        
        results['assignments'] = count
        total_deleted += count
    except Exception as e:
        logger.error(f"   ❌ Error cleaning up assignments: {e}", exc_info=True)
        results['assignments'] = 0
    
    # 7. Cleanup ALL Assessment Workflow History
    try:
        logger.info("6. Cleaning up assessment workflow history...")
        query = db.query(AssessmentWorkflowHistory)
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
        logger.error(f"   ❌ Error cleaning up workflow_history: {e}", exc_info=True)
        results['workflow_history'] = 0
    
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
        logger.error(f"❌ Error committing changes: {e}", exc_info=True)
        db.rollback()
        raise
    
    logger.info("=" * 80)
    logger.info("Cleanup completed successfully")
    logger.info("=" * 80)
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Cleanup ALL inbox items and assessment data")
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
        cleanup_all_inbox_assessments(
            db=db,
            tenant_id=tenant_id,
            dry_run=not args.live
        )
    except Exception as e:
        logger.error(f"Cleanup failed: {e}", exc_info=True)
        sys.exit(1)
    finally:
        db.close()

