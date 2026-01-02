"""
Seed Standard Form Layouts
Creates standard layouts for all workflow stages and request types

This script creates:
- Submission layouts (new stage) for vendors/users
- Approver layouts (pending_approval, pending_review stages) for reviewers
- Review layouts (needs_revision stage) for resubmission
- Final state layouts (approved, rejected, closed stages) for viewing
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


# Standard field groups for different stages
STANDARD_FIELDS = {
    "basic_info": ["name", "type", "category", "description", "version"],
    "ai_config": ["llm_vendor", "llm_model", "llm_model_custom", "deployment_type"],
    "data_ops": ["data_types", "regions", "data_sharing_scope", "data_usage_purpose"],
    "capabilities": ["capabilities", "use_cases", "personas", "features"],
    "security": ["security_controls", "compliance_frameworks", "risk_level"],
    "architecture": ["mermaid_diagram", "connection_diagram", "connections"],
    "review": ["review_notes", "approval_notes", "rejection_reason", "status"],
}


def create_standard_layouts_for_tenant(db: Session, tenant_id: UUID, created_by: UUID = None):
    """
    Create standard layouts for a tenant
    
    Args:
        db: Database session
        tenant_id: Tenant ID
        created_by: User ID who creates the layouts (optional)
    """
    layouts_created = 0
    
    # Request types
    request_types = [
        "agent_onboarding_workflow",
        "vendor_submission_workflow"
    ]
    
    # Workflow stages with their layouts
    stage_layouts = {
        "new": {
            "name_suffix": "Submission Form",
            "description": "Form for initial submission by vendor/user",
            "sections": [
                {
                    "id": "basic-info",
                    "title": "Basic Information",
                    "order": 1,
                    "description": "Essential details about the agent",
                    "fields": STANDARD_FIELDS["basic_info"]
                },
                {
                    "id": "ai-config",
                    "title": "AI Configuration",
                    "order": 2,
                    "description": "LLM vendor and model details",
                    "fields": STANDARD_FIELDS["ai_config"]
                },
                {
                    "id": "capabilities",
                    "title": "Capabilities & Use Cases",
                    "order": 3,
                    "description": "What the agent can do",
                    "fields": STANDARD_FIELDS["capabilities"]
                },
                {
                    "id": "data-operations",
                    "title": "Data & Operations",
                    "order": 4,
                    "description": "Data types, regions, and sharing scope",
                    "fields": STANDARD_FIELDS["data_ops"]
                },
                {
                    "id": "architecture",
                    "title": "Architecture & Connections",
                    "order": 5,
                    "description": "System architecture and integrations",
                    "fields": STANDARD_FIELDS["architecture"]
                }
            ]
        },
        "pending_approval": {
            "name_suffix": "Approver Review",
            "description": "Layout for approvers to review and make decisions",
            "sections": [
                {
                    "id": "overview",
                    "title": "Overview",
                    "order": 1,
                    "description": "Quick overview of the submission",
                    "fields": ["name", "type", "category", "status", "submitted_by", "submitted_at"]
                },
                {
                    "id": "basic-info",
                    "title": "Basic Information",
                    "order": 2,
                    "description": "Essential details about the agent",
                    "fields": STANDARD_FIELDS["basic_info"]
                },
                {
                    "id": "ai-config",
                    "title": "AI Configuration",
                    "order": 3,
                    "description": "LLM vendor and model details",
                    "fields": STANDARD_FIELDS["ai_config"]
                },
                {
                    "id": "security-compliance",
                    "title": "Security & Compliance",
                    "order": 4,
                    "description": "Security controls and compliance information",
                    "fields": STANDARD_FIELDS["security"]
                },
                {
                    "id": "data-operations",
                    "title": "Data & Operations",
                    "order": 5,
                    "description": "Data types, regions, and sharing scope",
                    "fields": STANDARD_FIELDS["data_ops"]
                },
                {
                    "id": "capabilities",
                    "title": "Capabilities & Use Cases",
                    "order": 6,
                    "description": "What the agent can do",
                    "fields": STANDARD_FIELDS["capabilities"]
                },
                {
                    "id": "architecture",
                    "title": "Architecture & Connections",
                    "order": 7,
                    "description": "System architecture and integrations",
                    "fields": STANDARD_FIELDS["architecture"]
                },
                {
                    "id": "review-actions",
                    "title": "Review & Decision",
                    "order": 8,
                    "description": "Review notes and approval decision",
                    "fields": ["review_notes", "approval_notes", "rejection_reason"]
                }
            ]
        },
        "pending_review": {
            "name_suffix": "Review",
            "description": "Layout for reviewers to assess the submission",
            "sections": [
                {
                    "id": "overview",
                    "title": "Overview",
                    "order": 1,
                    "description": "Quick overview of the submission",
                    "fields": ["name", "type", "category", "status"]
                },
                {
                    "id": "basic-info",
                    "title": "Basic Information",
                    "order": 2,
                    "description": "Essential details about the agent",
                    "fields": STANDARD_FIELDS["basic_info"]
                },
                {
                    "id": "security-compliance",
                    "title": "Security & Compliance",
                    "order": 3,
                    "description": "Security controls and compliance information",
                    "fields": STANDARD_FIELDS["security"]
                },
                {
                    "id": "review-notes",
                    "title": "Review Notes",
                    "order": 4,
                    "description": "Reviewer assessment and notes",
                    "fields": ["review_notes"]
                }
            ]
        },
        "needs_revision": {
            "name_suffix": "Revision Required",
            "description": "Layout for resubmission after revision request",
            "sections": [
                {
                    "id": "revision-notes",
                    "title": "Revision Request",
                    "order": 1,
                    "description": "What needs to be revised",
                    "fields": ["revision_notes", "revision_reason"]
                },
                {
                    "id": "basic-info",
                    "title": "Basic Information",
                    "order": 2,
                    "description": "Essential details about the agent",
                    "fields": STANDARD_FIELDS["basic_info"]
                },
                {
                    "id": "ai-config",
                    "title": "AI Configuration",
                    "order": 3,
                    "description": "LLM vendor and model details",
                    "fields": STANDARD_FIELDS["ai_config"]
                },
                {
                    "id": "data-operations",
                    "title": "Data & Operations",
                    "order": 4,
                    "description": "Data types, regions, and sharing scope",
                    "fields": STANDARD_FIELDS["data_ops"]
                }
            ]
        },
        "approved": {
            "name_suffix": "Approved",
            "description": "View for approved submissions",
            "sections": [
                {
                    "id": "overview",
                    "title": "Overview",
                    "order": 1,
                    "description": "Approved submission overview",
                    "fields": ["name", "type", "category", "status", "approved_by", "approved_at", "approval_notes"]
                },
                {
                    "id": "basic-info",
                    "title": "Basic Information",
                    "order": 2,
                    "description": "Essential details about the agent",
                    "fields": STANDARD_FIELDS["basic_info"]
                },
                {
                    "id": "ai-config",
                    "title": "AI Configuration",
                    "order": 3,
                    "description": "LLM vendor and model details",
                    "fields": STANDARD_FIELDS["ai_config"]
                }
            ]
        },
        "rejected": {
            "name_suffix": "Rejected",
            "description": "View for rejected submissions",
            "sections": [
                {
                    "id": "overview",
                    "title": "Overview",
                    "order": 1,
                    "description": "Rejected submission overview",
                    "fields": ["name", "type", "category", "status", "rejected_by", "rejected_at", "rejection_reason"]
                },
                {
                    "id": "basic-info",
                    "title": "Basic Information",
                    "order": 2,
                    "description": "Essential details about the agent",
                    "fields": STANDARD_FIELDS["basic_info"]
                }
            ]
        },
        "in_progress": {
            "name_suffix": "In Progress",
            "description": "View for submissions being processed",
            "sections": [
                {
                    "id": "overview",
                    "title": "Overview",
                    "order": 1,
                    "description": "Submission status",
                    "fields": ["name", "type", "category", "status", "current_step"]
                },
                {
                    "id": "basic-info",
                    "title": "Basic Information",
                    "order": 2,
                    "description": "Essential details about the agent",
                    "fields": STANDARD_FIELDS["basic_info"]
                }
            ]
        },
        "closed": {
            "name_suffix": "Closed",
            "description": "View for closed/completed submissions",
            "sections": [
                {
                    "id": "overview",
                    "title": "Overview",
                    "order": 1,
                    "description": "Closed submission overview",
                    "fields": ["name", "type", "category", "status", "closed_at"]
                },
                {
                    "id": "basic-info",
                    "title": "Basic Information",
                    "order": 2,
                    "description": "Essential details about the agent",
                    "fields": STANDARD_FIELDS["basic_info"]
                }
            ]
        }
    }
    
    for request_type in request_types:
        for stage, layout_config in stage_layouts.items():
            # Create layout name first
            layout_name = f"Standard {request_type.replace('_', ' ').title()} - {layout_config['name_suffix']}"

            # Check if layout already exists
            existing = db.query(FormLayout).filter(
                FormLayout.tenant_id == tenant_id,
                FormLayout.request_type == request_type,
                FormLayout.workflow_stage == stage,
                FormLayout.is_default == True
            ).first()

            if existing:
                logger.info(f"Layout already exists for {request_type} - {stage}, updating...")
                # Update existing layout
                existing.name = layout_name
                existing.description = layout_config["description"]
                existing.sections = layout_config["sections"]
                existing.is_active = True
                if created_by:
                    existing.updated_by = created_by
            else:
                # Create new layout
                layout = FormLayout(
                    tenant_id=tenant_id,
                    name=layout_name,
                    request_type=request_type,
                    workflow_stage=stage,
                    description=layout_config["description"],
                    sections=layout_config["sections"],
                    is_default=(stage == "new"),  # Only submission is global default
                    is_active=True,
                    created_by=created_by
                )
                db.add(layout)
                layouts_created += 1
                logger.info(f"Created layout: {layout_name}")
    
    db.commit()
    logger.info(f"Created {layouts_created} standard layouts for tenant {tenant_id}")
    
    return layouts_created


def seed_standard_layouts_for_all_tenants():
    """Seed standard layouts for all tenants"""
    db: Session = SessionLocal()
    
    try:
        tenants = db.query(Tenant).all()
        total_created = 0
        
        for tenant in tenants:
            logger.info(f"Seeding layouts for tenant: {tenant.id}")
            created = create_standard_layouts_for_tenant(db, tenant.id)
            total_created += created
        
        logger.info(f"Total layouts created: {total_created}")
        return {"tenants_processed": len(tenants), "layouts_created": total_created}
        
    except Exception as e:
        logger.error(f"Error seeding layouts: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


def seed_standard_layouts_for_tenant_id(tenant_id: str):
    """Seed standard layouts for a specific tenant"""
    db: Session = SessionLocal()
    
    try:
        tenant_uuid = UUID(tenant_id)
        created = create_standard_layouts_for_tenant(db, tenant_uuid)
        return {"layouts_created": created}
    except Exception as e:
        logger.error(f"Error seeding layouts: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed standard form layouts")
    parser.add_argument("--tenant-id", type=str, help="Specific tenant ID to seed (optional)")
    args = parser.parse_args()
    
    if args.tenant_id:
        logger.info(f"Seeding layouts for tenant: {args.tenant_id}")
        result = seed_standard_layouts_for_tenant_id(args.tenant_id)
        logger.info(f"Result: {result}")
    else:
        logger.info("Seeding layouts for all tenants...")
        result = seed_standard_layouts_for_all_tenants()
        logger.info(f"Result: {result}")
