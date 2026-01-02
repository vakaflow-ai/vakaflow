"""
Seed Simplified Form Layouts
Creates only 3 reusable layouts per request type:
- Submission layout (for new and needs_revision stages)
- Approver layout (for pending_approval, pending_review, in_progress stages)
- Completed layout (for approved, rejected, closed, cancelled stages)

Permissions control what users see based on their role - no need for separate layouts per stage.
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


# Standard field groups
STANDARD_FIELDS = {
    "basic_info": ["name", "type", "category", "description", "version"],
    "ai_config": ["llm_vendor", "llm_model", "llm_model_custom", "deployment_type"],
    "data_ops": ["data_types", "regions", "data_sharing_scope", "data_usage_purpose"],
    "capabilities": ["capabilities", "use_cases", "personas", "features"],
    "security": ["security_controls", "compliance_frameworks", "risk_level"],
    "architecture": ["mermaid_diagram", "connection_diagram", "connections"],
    "review": ["review_notes", "approval_notes", "rejection_reason", "status"],
}


# Simplified layout definitions - only 3 layouts per request type
SIMPLIFIED_LAYOUTS = {
    "submission": {
        "name": "Submission Layout",
        "description": "Layout for initial submission and resubmission (new, needs_revision stages). Permissions control field visibility.",
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
    "approver": {
        "name": "Approver Layout",
        "description": "Layout for review and approval (pending_approval, pending_review, in_progress stages). Permissions control field visibility.",
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
                "fields": STANDARD_FIELDS["review"]
            }
        ]
    },
    "completed": {
        "name": "Completed Items Layout",
        "description": "Layout for final states (approved, rejected, closed, cancelled stages). Permissions control field visibility.",
        "sections": [
            {
                "id": "overview",
                "title": "Overview",
                "order": 1,
                "description": "Final state overview",
                "fields": ["name", "type", "category", "status", "approved_by", "approved_at", "rejected_by", "rejected_at"]
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
                "id": "review-actions",
                "title": "Review & Decision",
                "order": 4,
                "description": "Review notes and decision details",
                "fields": STANDARD_FIELDS["review"]
            }
        ]
    }
}


def create_simplified_layouts_for_tenant(db: Session, tenant_id: UUID, created_by: UUID = None):
    """
    Create simplified layouts for a tenant (only 3 layouts per request type)
    
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
    
    for request_type in request_types:
        for layout_type, layout_def in SIMPLIFIED_LAYOUTS.items():
            # Check if layout already exists
            existing = db.query(FormLayout).filter(
                FormLayout.tenant_id == tenant_id,
                FormLayout.request_type == request_type,
                FormLayout.layout_type == layout_type,
                FormLayout.is_active == True
            ).first()
            
            if existing:
                logger.info(f"Layout already exists for tenant {tenant_id}, request_type {request_type}, layout_type {layout_type}")
                continue
            
            # Create layout
            layout = FormLayout(
                tenant_id=tenant_id,
                name=f"{layout_def['name']} - {request_type.replace('_', ' ').title()}",
                request_type=request_type,
                workflow_stage="new",  # Default for backward compatibility
                layout_type=layout_type,  # NEW: simplified layout type
                description=layout_def["description"],
                sections=layout_def["sections"],
                is_default=(layout_type == "submission"),  # Only submission is global default
                is_active=True,
                created_by=created_by
            )
            
            db.add(layout)
            layouts_created += 1
            
            logger.info(
                f"Created layout: {layout.name} "
                f"(tenant={tenant_id}, request_type={request_type}, layout_type={layout_type})"
            )
    
    db.commit()
    logger.info(f"Created {layouts_created} simplified layouts for tenant {tenant_id}")
    
    return layouts_created


def seed_simplified_layouts_for_all_tenants():
    """Seed simplified layouts for all tenants"""
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        total_layouts = 0
        
        for tenant in tenants:
            logger.info(f"Seeding simplified layouts for tenant: {tenant.name} ({tenant.id})")
            layouts = create_simplified_layouts_for_tenant(db, tenant.id)
            total_layouts += layouts
        
        logger.info(f"✅ Seeded {total_layouts} simplified layouts across {len(tenants)} tenants")
    except Exception as e:
        logger.error(f"Error seeding simplified layouts: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_simplified_layouts_for_all_tenants()

