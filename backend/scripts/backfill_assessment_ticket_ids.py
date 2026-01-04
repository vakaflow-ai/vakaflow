#!/usr/bin/env python3
"""
Backfill workflow ticket IDs for assessment assignments that don't have them.

This script generates ticket IDs for existing assignments that were created
before ticket ID generation was implemented at assignment creation time.
"""
import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.assessment import AssessmentAssignment
from app.core.ticket_id_generator import generate_assessment_ticket_id
from sqlalchemy import and_
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def backfill_ticket_ids():
    """Backfill workflow ticket IDs for assignments without them"""
    db = SessionLocal()
    try:
        # Find all assignments without workflow_ticket_id
        assignments_without_ticket = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.workflow_ticket_id.is_(None)
        ).all()
        
        logger.info(f"Found {len(assignments_without_ticket)} assignments without ticket IDs")
        
        updated_count = 0
        error_count = 0
        
        for assignment in assignments_without_ticket:
            try:
                # Generate ticket ID
                ticket_id = generate_assessment_ticket_id(db, assignment.tenant_id)
                assignment.workflow_ticket_id = ticket_id
                updated_count += 1
                
                if updated_count % 10 == 0:
                    db.commit()  # Commit in batches
                    logger.info(f"Updated {updated_count} assignments so far...")
                    
            except Exception as e:
                logger.error(f"Error generating ticket ID for assignment {assignment.id}: {e}")
                error_count += 1
                db.rollback()
                continue
        
        # Final commit
        if updated_count % 10 != 0:
            db.commit()
        
        logger.info(f"✅ Backfill complete: Updated {updated_count} assignments, {error_count} errors")
        
        return updated_count, error_count
        
    except Exception as e:
        logger.error(f"Error in backfill: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Starting backfill of assessment ticket IDs...")
    updated, errors = backfill_ticket_ids()
    print(f"✅ Backfill complete: {updated} updated, {errors} errors")
    sys.exit(0 if errors == 0 else 1)

