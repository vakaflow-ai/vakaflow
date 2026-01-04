"""
Seed Assessment Form Layouts
Creates default form layouts for assessment workflows

This script creates:
- Approver layouts (pending_approval stage) that show assessment questions and responses
- Uses assessment_response_grid field type to display questions and responses
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.form_layout import FormLayout
from app.models.tenant import Tenant
from uuid import UUID
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_assessment_layouts_for_tenant(db: Session, tenant_id: UUID, created_by: UUID = None):
    """
    Create assessment form layouts for a tenant
    
    Args:
        db: Database session
        tenant_id: Tenant ID
        created_by: User ID who creates the layouts (optional)
    """
    layouts_created = 0
    
    # Assessment workflow layouts
    assessment_layouts = {
        "pending_approval": {
            "name": "Standard Assessment Workflow - Approver Review",
            "description": "Default layout for approvers to review assessment questions and responses",
            "sections": [
                {
                    "id": "assessment-overview",
                    "title": "Assessment Overview",
                    "order": 1,
                    "description": "Basic information about the assessment",
                    "fields": ["assessment_name", "assessment_type", "workflow_ticket_id", "status", "submitted_by", "submitted_at"]
                },
                {
                    "id": "assessment-responses",
                    "title": "Assessment Questions & Responses",
                    "order": 2,
                    "description": "Review all assessment questions and vendor responses",
                    "fields": ["assessment_response_grid"]  # Special field type that renders AssessmentResponseGrid
                },
                {
                    "id": "review-decision",
                    "title": "Review & Decision",
                    "order": 3,
                    "description": "Review notes and decision",
                    "fields": ["review_notes", "approval_notes", "rejection_reason"]
                }
            ]
        },
        "approved": {
            "name": "Standard Assessment Workflow - Approved View",
            "description": "View for approved assessments",
            "sections": [
                {
                    "id": "assessment-overview",
                    "title": "Assessment Overview",
                    "order": 1,
                    "description": "Basic information about the assessment",
                    "fields": ["assessment_name", "assessment_type", "workflow_ticket_id", "status", "approved_by", "approved_at"]
                },
                {
                    "id": "assessment-responses",
                    "title": "Assessment Questions & Responses",
                    "order": 2,
                    "description": "View all assessment questions and vendor responses",
                    "fields": ["assessment_response_grid"]
                }
            ]
        },
        "rejected": {
            "name": "Standard Assessment Workflow - Rejected View",
            "description": "View for rejected assessments",
            "sections": [
                {
                    "id": "assessment-overview",
                    "title": "Assessment Overview",
                    "order": 1,
                    "description": "Basic information about the assessment",
                    "fields": ["assessment_name", "assessment_type", "workflow_ticket_id", "status", "rejected_by", "rejected_at", "rejection_reason"]
                },
                {
                    "id": "assessment-responses",
                    "title": "Assessment Questions & Responses",
                    "order": 2,
                    "description": "View all assessment questions and vendor responses",
                    "fields": ["assessment_response_grid"]
                }
            ]
        }
    }
    
    request_type = "assessment_workflow"
    
    for stage, layout_config in assessment_layouts.items():
        # Check if layout already exists
        existing = db.query(FormLayout).filter(
            FormLayout.tenant_id == tenant_id,
            FormLayout.request_type == request_type,
            FormLayout.workflow_stage == stage,
            FormLayout.is_default == True
        ).first()

        if existing:
            logger.info(f"Assessment layout already exists for {request_type} - {stage}, updating...")
            # Update existing layout
            existing.name = layout_config["name"]
            existing.description = layout_config["description"]
            existing.sections = layout_config["sections"]
            existing.is_active = True
            if created_by:
                existing.updated_by = created_by
        else:
            # Create new layout
            layout = FormLayout(
                tenant_id=tenant_id,
                name=layout_config["name"],
                request_type=request_type,
                workflow_stage=stage,
                description=layout_config["description"],
                sections=layout_config["sections"],
                is_default=True,  # Mark as default for assessment workflows
                is_active=True,
                created_by=created_by
            )
            db.add(layout)
            layouts_created += 1
            logger.info(f"Created assessment layout: {layout_config['name']}")
    
    db.commit()
    logger.info(f"Created {layouts_created} assessment layouts for tenant {tenant_id}")
    
    return layouts_created


def seed_assessment_layouts_for_all_tenants():
    """Seed assessment layouts for all tenants"""
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        total_layouts = 0
        
        for tenant in tenants:
            logger.info(f"Seeding assessment layouts for tenant: {tenant.id} ({tenant.name})")
            layouts_created = create_assessment_layouts_for_tenant(db, tenant.id)
            total_layouts += layouts_created
        
        logger.info(f"✅ Seeded assessment layouts for {len(tenants)} tenants. Total layouts created: {total_layouts}")
        return total_layouts
    except Exception as e:
        logger.error(f"Error seeding assessment layouts: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding assessment form layouts for all tenants...")
    seed_assessment_layouts_for_all_tenants()
    print("✅ Done!")

