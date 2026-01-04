#!/usr/bin/env python3
"""
Script to diagnose and fix assessment assignment completion issues.

Usage:
    python scripts/fix_assessment_completion.py ASS-TPRM-20251230-D1OH
    python scripts/fix_assessment_completion.py <assignment_id>
"""

import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.assessment import Assessment, AssessmentAssignment, AssessmentQuestion, AssessmentQuestionResponse
from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus
from app.models.user import User
from datetime import datetime
from uuid import UUID
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def find_assignment_by_assessment_id(assessment_id: str, db: Session):
    """Find assignment by assessment ID (human-readable like ASS-TPRM-20251230-D1OH)"""
    # First try to find assessment by assessment_id
    assessment = db.query(Assessment).filter(Assessment.assessment_id == assessment_id).first()
    
    if assessment:
        logger.info(f"Found assessment: {assessment.id} ({assessment.name})")
        # Get the most recent assignment for this assessment
        assignment = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.assessment_id == assessment.id
        ).order_by(AssessmentAssignment.assigned_at.desc()).first()
        
        if assignment:
            logger.info(f"Found assignment: {assignment.id}, status: {assignment.status}")
            return assignment
    
    # If not found by assessment_id, try as UUID
    try:
        assignment_id = UUID(assessment_id)
        assignment = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.id == assignment_id
        ).first()
        if assignment:
            logger.info(f"Found assignment by UUID: {assignment.id}, status: {assignment.status}")
            return assignment
    except ValueError:
        pass
    
    return None


def check_completion_status(assignment: AssessmentAssignment, db: Session):
    """Check if assignment should be marked as completed"""
    logger.info(f"\n=== Checking completion status for assignment {assignment.id} ===")
    
    # Get all questions for this assessment
    questions = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.assessment_id == assignment.assessment_id,
        AssessmentQuestion.tenant_id == assignment.tenant_id
    ).all()
    
    if len(questions) == 0:
        logger.warning("No questions found. Trying without tenant filter...")
        questions = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.assessment_id == assignment.assessment_id
        ).all()
    
    logger.info(f"Total questions: {len(questions)}")
    
    required_questions = [q for q in questions if q.is_required]
    logger.info(f"Required questions: {len(required_questions)}")
    
    # Check responses
    questions_to_check = required_questions if len(required_questions) > 0 else questions
    
    answered_count = 0
    unanswered = []
    
    for q in questions_to_check:
        response = db.query(AssessmentQuestionResponse).filter(
            AssessmentQuestionResponse.assignment_id == assignment.id,
            AssessmentQuestionResponse.question_id == q.id,
            AssessmentQuestionResponse.value.isnot(None)
        ).first()
        
        if response and response.value:
            # Check if value is not empty
            value = response.value
            is_empty = (
                (isinstance(value, str) and value.strip() == "") or
                (isinstance(value, dict) and len(value) == 0) or
                (isinstance(value, list) and len(value) == 0) or
                (isinstance(value, dict) and value.get('value') in [None, ""])
            )
            
            if not is_empty:
                answered_count += 1
                logger.info(f"  ✓ Question {q.id} ({q.question_number or 'N/A'}): Answered")
            else:
                unanswered.append(q.id)
                logger.warning(f"  ✗ Question {q.id} ({q.question_number or 'N/A'}): Empty response")
        else:
            unanswered.append(q.id)
            logger.warning(f"  ✗ Question {q.id} ({q.question_number or 'N/A'}): No response")
    
    logger.info(f"\nAnswered: {answered_count}/{len(questions_to_check)}")
    
    # Determine if should be completed
    if len(required_questions) > 0:
        should_be_completed = len(unanswered) == 0
    else:
        # If no required questions, all questions must be answered
        should_be_completed = answered_count == len(questions)
    
    logger.info(f"Should be completed: {should_be_completed}")
    logger.info(f"Current status: {assignment.status}")
    
    return should_be_completed, unanswered


def fix_assignment_completion(assignment: AssessmentAssignment, db: Session):
    """Fix assignment completion status and trigger workflow"""
    logger.info(f"\n=== Fixing assignment {assignment.id} ===")
    
    should_be_completed, unanswered = check_completion_status(assignment, db)
    
    if not should_be_completed:
        logger.error(f"Cannot mark as completed: {len(unanswered)} questions still unanswered")
        return False
    
    if assignment.status == 'completed':
        logger.info("Assignment is already marked as completed")
        
        # Check if workflow was triggered
        approval_items = db.query(ActionItem).filter(
            ActionItem.source_id == assignment.id,
            ActionItem.source_type == "assessment_approval",
            ActionItem.action_type == ActionItemType.APPROVAL,
            ActionItem.status.in_([ActionItemStatus.PENDING, ActionItemStatus.IN_PROGRESS])
        ).count()
        
        if approval_items == 0:
            logger.warning("Assignment is completed but no approval workflow items found.")
            logger.info("To trigger workflow, use the API endpoint:")
            logger.info(f"  POST /api/v1/assessments/assignments/{assignment.id}/trigger-approval-workflow")
            logger.info("Or re-submit the assignment responses to trigger it automatically.")
            return False
        else:
            logger.info(f"✅ Approval workflow already exists ({approval_items} items)")
            return True
    
    # Mark as completed
    logger.info("Marking assignment as completed...")
    assignment.status = 'completed'
    if not assignment.completed_at:
        assignment.completed_at = datetime.utcnow()
    
    # Generate workflow ticket ID if not set
    if not assignment.workflow_ticket_id:
        from app.api.v1.assessments import _generate_assessment_ticket_id
        try:
            assignment.workflow_ticket_id = _generate_assessment_ticket_id(db, assignment.tenant_id)
            logger.info(f"Generated workflow ticket ID: {assignment.workflow_ticket_id}")
        except Exception as e:
            logger.warning(f"Could not generate ticket ID: {e}")
    
    db.flush()
    
    # Note: Workflow will be triggered automatically when responses are saved via API
    # Or can be triggered manually using:
    # POST /api/v1/assessments/assignments/{assignment.id}/trigger-approval-workflow
    logger.info("Workflow will be triggered automatically on next response save, or use API endpoint to trigger manually.")
    
    # Update vendor assignment items
    vendor_items = db.query(ActionItem).filter(
        ActionItem.source_id == assignment.id,
        ActionItem.source_type == "assessment_assignment",
        ActionItem.action_type == ActionItemType.ASSESSMENT,
        ActionItem.status.in_([ActionItemStatus.PENDING, ActionItemStatus.IN_PROGRESS])
    ).all()
    
    for item in vendor_items:
        item.status = ActionItemStatus.COMPLETED.value
        item.completed_at = datetime.utcnow()
        logger.info(f"Updated vendor action item {item.id} to completed")
    
    try:
        db.commit()
        logger.info("✅ Assignment fixed and committed successfully")
        return True
    except Exception as e:
        logger.error(f"Error committing changes: {e}", exc_info=True)
        db.rollback()
        return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/fix_assessment_completion.py <assessment_id_or_assignment_id>")
        print("Example: python scripts/fix_assessment_completion.py ASS-TPRM-20251230-D1OH")
        sys.exit(1)
    
    assessment_id = sys.argv[1]
    
    db = SessionLocal()
    try:
        assignment = find_assignment_by_assessment_id(assessment_id, db)
        
        if not assignment:
            logger.error(f"Assignment not found for: {assessment_id}")
            sys.exit(1)
        
        # Check status
        should_be_completed, unanswered = check_completion_status(assignment, db)
        
        # Ask for confirmation
        if should_be_completed and assignment.status != 'completed':
            print(f"\nAssignment {assignment.id} should be marked as completed.")
            response = input("Fix it? (y/n): ")
            if response.lower() == 'y':
                fix_assignment_completion(assignment, db)
            else:
                print("Cancelled.")
        elif assignment.status == 'completed':
            # Check workflow
            approval_items = db.query(ActionItem).filter(
                ActionItem.source_id == assignment.id,
                ActionItem.source_type == "assessment_approval",
                ActionItem.action_type == ActionItemType.APPROVAL
            ).count()
            
            print(f"\nAssignment is already completed.")
            print(f"Approval workflow items: {approval_items}")
            
            if approval_items == 0:
                response = input("No approval workflow found. Trigger it? (y/n): ")
                if response.lower() == 'y':
                    fix_assignment_completion(assignment, db)
        else:
            print(f"\nAssignment should NOT be completed yet.")
            print(f"Unanswered questions: {len(unanswered)}")
    
    finally:
        db.close()


if __name__ == "__main__":
    main()

