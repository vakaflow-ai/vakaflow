"""
Utility for generating workflow ticket IDs for assessments
"""
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from app.models.assessment import AssessmentAssignment


def generate_assessment_ticket_id(db: Session, tenant_id: UUID) -> str:
    """Generate unique assessment workflow ticket ID (e.g., ASMT-2025-001)
    
    Args:
        db: Database session
        tenant_id: Tenant UUID
        
    Returns:
        Unique ticket ID string (e.g., "ASMT-2025-001")
    """
    year = datetime.utcnow().year
    # Get the last ticket number for this year and tenant
    last_assignment = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.tenant_id == tenant_id,
        AssessmentAssignment.workflow_ticket_id.like(f"ASMT-{year}-%")
    ).order_by(AssessmentAssignment.workflow_ticket_id.desc()).first()
    
    if last_assignment and last_assignment.workflow_ticket_id:
        # Extract number and increment
        try:
            last_num = int(last_assignment.workflow_ticket_id.split('-')[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    
    return f"ASMT-{year}-{next_num:03d}"

