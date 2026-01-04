#!/usr/bin/env python3
"""
Diagnostic script to check if action items are being created for vendor users
when assessments are assigned.

Usage:
    python scripts/check_vendor_action_items.py
    python scripts/check_vendor_action_items.py --assignment-id <uuid>
"""

import sys
from pathlib import Path
from uuid import UUID
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.assessment import AssessmentAssignment
from app.models.action_item import ActionItem, ActionItemStatus
from app.models.user import User, UserRole
from app.models.vendor import Vendor
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def check_vendor_action_items(assignment_id: UUID = None):
    """Check action items for vendor users"""
    db = SessionLocal()
    try:
        logger.info("=" * 80)
        logger.info("Checking vendor action items for assessment assignments")
        logger.info("=" * 80)
        
        # Get assignments
        if assignment_id:
            assignments = db.query(AssessmentAssignment).filter(
                AssessmentAssignment.id == assignment_id
            ).all()
        else:
            # Get recent assignments (last 7 days)
            from datetime import timedelta
            cutoff = datetime.utcnow() - timedelta(days=7)
            assignments = db.query(AssessmentAssignment).filter(
                AssessmentAssignment.created_at >= cutoff
            ).order_by(AssessmentAssignment.created_at.desc()).limit(20).all()
        
        logger.info(f"Found {len(assignments)} assignment(s) to check")
        logger.info("")
        
        for assignment in assignments:
            logger.info(f"Assignment ID: {assignment.id}")
            logger.info(f"  - Assessment ID: {assignment.assessment_id}")
            logger.info(f"  - Vendor ID: {assignment.vendor_id}")
            logger.info(f"  - Status: {assignment.status}")
            logger.info(f"  - Created: {assignment.created_at}")
            logger.info(f"  - Assignment Type: {assignment.assignment_type}")
            
            # Check vendor
            vendor = None
            if assignment.vendor_id:
                vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
                if vendor:
                    logger.info(f"  - Vendor: {vendor.name} (email: {vendor.contact_email})")
                else:
                    logger.warning(f"  - ⚠️ Vendor {assignment.vendor_id} not found")
            
            # Check action items for this assignment
            action_items = db.query(ActionItem).filter(
                ActionItem.source_type == "assessment_assignment",
                ActionItem.source_id == assignment.id
            ).all()
            
            logger.info(f"  - Action Items: {len(action_items)}")
            
            if action_items:
                for item in action_items:
                    user = db.query(User).filter(User.id == item.assigned_to).first()
                    logger.info(f"    ✅ Action Item {item.id}:")
                    logger.info(f"       - Assigned to: {user.email if user else 'Unknown'} (ID: {item.assigned_to})")
                    logger.info(f"       - Status: {item.status.value if hasattr(item.status, 'value') else item.status}")
                    logger.info(f"       - Created: {item.created_at if hasattr(item, 'created_at') else 'N/A'}")
            else:
                logger.warning(f"    ❌ NO ACTION ITEMS FOUND for assignment {assignment.id}")
                
                # Check if vendor users exist
                if vendor:
                    vendor_users = db.query(User).filter(
                        User.tenant_id == assignment.tenant_id,
                        User.role == UserRole.VENDOR_USER,
                        User.is_active == True
                    ).all()
                    logger.info(f"    - Vendor users in tenant: {len(vendor_users)}")
                    for vu in vendor_users:
                        email_match = "✅ MATCH" if vendor.contact_email and vu.email.lower() == vendor.contact_email.lower() else "❌ NO MATCH"
                        logger.info(f"      - {vu.email} (ID: {vu.id}) {email_match} with vendor email {vendor.contact_email}")
                else:
                    logger.warning(f"    - Cannot check vendor users (vendor not found)")
            
            logger.info("")
        
        logger.info("=" * 80)
        logger.info("Check completed")
        logger.info("=" * 80)
        
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Check vendor action items for assignments")
    parser.add_argument(
        "--assignment-id",
        type=str,
        help="Specific assignment ID to check (UUID format)"
    )
    
    args = parser.parse_args()
    
    assignment_id = None
    if args.assignment_id:
        try:
            assignment_id = UUID(args.assignment_id)
        except ValueError:
            logger.error(f"Invalid assignment ID format: {args.assignment_id}")
            sys.exit(1)
    
    check_vendor_action_items(assignment_id)

