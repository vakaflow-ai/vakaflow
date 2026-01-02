#!/usr/bin/env python3
"""
Seed System Master Data Lists
Creates system-level master data lists for enums that should be managed via master data:
- User Roles
- Agent Types, Statuses, Skills
- Assessment Types, Statuses, Schedule Frequencies
- Approval Statuses
- Workflow Statuses, Engine Types, Stages

These are seeded as SYSTEM lists (is_system=True) so they cannot be deleted but can be edited.
"""
import sys
import os

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_dir)

from app.core.database import SessionLocal
from app.models.master_data_list import MasterDataList
from app.models.tenant import Tenant
from datetime import datetime
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# System Master Data Lists - These map to enums that should be managed via master data
SYSTEM_MASTER_DATA_LISTS = {
    "user_role": {
        "name": "User Roles",
        "description": "User roles and permissions in the system",
        "list_type": "user_role",
        "is_system": True,
        "values": [
            {"value": "platform_admin", "label": "Platform Admin", "order": 1, "is_active": True},
            {"value": "tenant_admin", "label": "Tenant Admin", "order": 2, "is_active": True},
            {"value": "policy_admin", "label": "Policy Admin", "order": 3, "is_active": True},
            {"value": "integration_admin", "label": "Integration Admin", "order": 4, "is_active": True},
            {"value": "user_admin", "label": "User Admin", "order": 5, "is_active": True},
            {"value": "security_reviewer", "label": "Security Reviewer", "order": 6, "is_active": True},
            {"value": "compliance_reviewer", "label": "Compliance Reviewer", "order": 7, "is_active": True},
            {"value": "technical_reviewer", "label": "Technical Reviewer", "order": 8, "is_active": True},
            {"value": "business_reviewer", "label": "Business Reviewer", "order": 9, "is_active": True},
            {"value": "approver", "label": "Approver", "order": 10, "is_active": True},
            {"value": "vendor_user", "label": "Vendor User", "order": 11, "is_active": True},
            {"value": "end_user", "label": "End User", "order": 12, "is_active": True},
        ]
    },
    "agent_type": {
        "name": "Agent Types",
        "description": "Types of AI agents in the system",
        "list_type": "agent_type",
        "is_system": True,
        "values": [
            {"value": "ai_grc", "label": "AI GRC", "order": 1, "is_active": True},
            {"value": "assessment", "label": "Assessment", "order": 2, "is_active": True},
            {"value": "vendor", "label": "Vendor", "order": 3, "is_active": True},
            {"value": "compliance_reviewer", "label": "Compliance Reviewer", "order": 4, "is_active": True},
            {"value": "questionnaire_reviewer", "label": "Questionnaire Reviewer", "order": 5, "is_active": True},
        ]
    },
    "agent_status": {
        "name": "Agent Statuses",
        "description": "Status values for AI agents",
        "list_type": "agent_status",
        "is_system": True,
        "values": [
            {"value": "active", "label": "Active", "order": 1, "is_active": True},
            {"value": "inactive", "label": "Inactive", "order": 2, "is_active": True},
            {"value": "training", "label": "Training", "order": 3, "is_active": True},
            {"value": "error", "label": "Error", "order": 4, "is_active": True},
        ]
    },
    "agent_skill": {
        "name": "Agent Skills",
        "description": "Skills that AI agents can have",
        "list_type": "agent_skill",
        "is_system": True,
        "values": [
            {"value": "tprm", "label": "TPRM", "order": 1, "is_active": True},
            {"value": "vendor_qualification", "label": "Vendor Qualification", "order": 2, "is_active": True},
            {"value": "onboarding", "label": "Onboarding", "order": 3, "is_active": True},
            {"value": "offboarding", "label": "Offboarding", "order": 4, "is_active": True},
            {"value": "ai_agent_onboarding", "label": "AI Agent Onboarding", "order": 5, "is_active": True},
            {"value": "marketplace_reviews", "label": "Marketplace Reviews", "order": 6, "is_active": True},
            {"value": "realtime_risk_analysis", "label": "Real-time Risk Analysis", "order": 7, "is_active": True},
            {"value": "questionnaire_review", "label": "Questionnaire Review", "order": 8, "is_active": True},
            {"value": "flag_risks", "label": "Flag Risks", "order": 9, "is_active": True},
            {"value": "send_followup", "label": "Send Follow-up", "order": 10, "is_active": True},
        ]
    },
    "assessment_type": {
        "name": "Assessment Types",
        "description": "Types of assessments in the system",
        "list_type": "assessment_type",
        "is_system": True,
        "values": [
            {"value": "tprm", "label": "TPRM", "order": 1, "is_active": True},
            {"value": "vendor_qualification", "label": "Vendor Qualification", "order": 2, "is_active": True},
            {"value": "risk_assessment", "label": "Risk Assessment", "order": 3, "is_active": True},
            {"value": "ai_vendor_qualification", "label": "AI Vendor Qualification", "order": 4, "is_active": True},
            {"value": "security_assessment", "label": "Security Assessment", "order": 5, "is_active": True},
            {"value": "compliance_assessment", "label": "Compliance Assessment", "order": 6, "is_active": True},
            {"value": "custom", "label": "Custom", "order": 7, "is_active": True},
        ]
    },
    "assessment_status": {
        "name": "Assessment Statuses",
        "description": "Status values for assessments",
        "list_type": "assessment_status",
        "is_system": True,
        "values": [
            {"value": "draft", "label": "Draft", "order": 1, "is_active": True},
            {"value": "active", "label": "Active", "order": 2, "is_active": True},
            {"value": "archived", "label": "Archived", "order": 3, "is_active": True},
            {"value": "scheduled", "label": "Scheduled", "order": 4, "is_active": True},
        ]
    },
    "schedule_frequency": {
        "name": "Schedule Frequencies",
        "description": "Assessment schedule frequency options",
        "list_type": "schedule_frequency",
        "is_system": True,
        "values": [
            {"value": "quarterly", "label": "Quarterly", "order": 1, "is_active": True},
            {"value": "yearly", "label": "Yearly", "order": 2, "is_active": True},
            {"value": "monthly", "label": "Monthly", "order": 3, "is_active": True},
            {"value": "bi_annual", "label": "Bi-Annual", "order": 4, "is_active": True},
            {"value": "one_time", "label": "One Time", "order": 5, "is_active": True},
            {"value": "custom", "label": "Custom", "order": 6, "is_active": True},
        ]
    },
    "approval_status": {
        "name": "Approval Statuses",
        "description": "Status values for approval workflows",
        "list_type": "approval_status",
        "is_system": True,
        "values": [
            {"value": "pending", "label": "Pending", "order": 1, "is_active": True},
            {"value": "in_progress", "label": "In Progress", "order": 2, "is_active": True},
            {"value": "approved", "label": "Approved", "order": 3, "is_active": True},
            {"value": "rejected", "label": "Rejected", "order": 4, "is_active": True},
            {"value": "cancelled", "label": "Cancelled", "order": 5, "is_active": True},
        ]
    },
    "workflow_status": {
        "name": "Workflow Statuses",
        "description": "Status values for workflow configurations",
        "list_type": "workflow_status",
        "is_system": True,
        "values": [
            {"value": "active", "label": "Active", "order": 1, "is_active": True},
            {"value": "inactive", "label": "Inactive", "order": 2, "is_active": True},
            {"value": "draft", "label": "Draft", "order": 3, "is_active": True},
        ]
    },
    "workflow_engine_type": {
        "name": "Workflow Engine Types",
        "description": "Types of workflow engines",
        "list_type": "workflow_engine_type",
        "is_system": True,
        "values": [
            {"value": "internal", "label": "Internal", "order": 1, "is_active": True},
            {"value": "servicenow", "label": "ServiceNow", "order": 2, "is_active": True},
            {"value": "jira", "label": "Jira", "order": 3, "is_active": True},
            {"value": "custom", "label": "Custom", "order": 4, "is_active": True},
        ]
    },
    "workflow_stage": {
        "name": "Workflow Stages",
        "description": "Stages/states within workflow requests",
        "list_type": "workflow_stage",
        "is_system": True,
        "values": [
            {"value": "new", "label": "New", "order": 1, "is_active": True},
            {"value": "in_progress", "label": "In Progress", "order": 2, "is_active": True},
            {"value": "pending_approval", "label": "Pending Approval", "order": 3, "is_active": True},
            {"value": "approved", "label": "Approved", "order": 4, "is_active": True},
            {"value": "rejected", "label": "Rejected", "order": 5, "is_active": True},
            {"value": "closed", "label": "Closed", "order": 6, "is_active": True},
            {"value": "cancelled", "label": "Cancelled", "order": 7, "is_active": True},
            {"value": "pending_review", "label": "Pending Review", "order": 8, "is_active": True},
            {"value": "needs_revision", "label": "Needs Revision", "order": 9, "is_active": True},
        ]
    },
    "workflow_type": {
        "name": "Workflow Types",
        "description": "Types of workflows for form layouts (request types)",
        "list_type": "workflow_type",
        "is_system": True,
        "values": [
            {"value": "vendor_submission_workflow", "label": "Vendor Submission Workflow", "order": 1, "is_active": True},
            {"value": "agent_onboarding_workflow", "label": "Agent Onboarding Workflow", "order": 2, "is_active": True},
            {"value": "assessment_workflow", "label": "Assessment Workflow", "order": 3, "is_active": True},
        ]
    },
}


def seed_system_master_data_for_tenant(tenant_id: uuid.UUID, created_by: uuid.UUID = None):
    """Seed system master data lists for a specific tenant"""
    db = SessionLocal()
    try:
        logger.info(f"Seeding system master data for tenant {tenant_id}...")
        
        seeded_count = 0
        updated_count = 0
        
        for list_type, list_data in SYSTEM_MASTER_DATA_LISTS.items():
            # Check if list already exists for this tenant
            existing = db.query(MasterDataList).filter(
                MasterDataList.tenant_id == tenant_id,
                MasterDataList.list_type == list_type,
                MasterDataList.is_active == True
            ).first()
            
            if existing:
                # Update existing list - merge values but preserve user customizations
                logger.info(f"  Updating existing list: {list_data['name']}")
                existing_values = {v.get('value'): v for v in existing.values if isinstance(v, dict)}
                new_values = {v['value']: v for v in list_data['values']}
                
                # Merge: keep existing values (user may have modified labels), add new ones
                merged_values = []
                seen_values = set()
                
                # First, add all existing values (preserve user customizations)
                for value_data in existing.values:
                    if isinstance(value_data, dict) and value_data.get('value'):
                        merged_values.append(value_data)
                        seen_values.add(value_data['value'])
                
                # Then, add any new values from system defaults
                for value_data in list_data['values']:
                    if value_data['value'] not in seen_values:
                        merged_values.append(value_data)
                        seen_values.add(value_data['value'])
                
                existing.values = merged_values
                existing.updated_at = datetime.utcnow()
                # Ensure is_system flag is set
                existing.is_system = list_data.get('is_system', True)
                updated_count += 1
            else:
                # Create new list
                logger.info(f"  Creating new list: {list_data['name']}")
                master_list = MasterDataList(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    name=list_data['name'],
                    description=list_data['description'],
                    list_type=list_type,
                    values=list_data['values'],
                    is_active=True,
                    is_system=list_data.get('is_system', True),
                    created_by=created_by,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(master_list)
                seeded_count += 1
        
        db.commit()
        logger.info(f"✅ Seeded {seeded_count} new lists, updated {updated_count} existing lists for tenant {tenant_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error seeding system master data for tenant {tenant_id}: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()


def seed_all_tenants():
    """Seed system master data lists for all tenants"""
    db = SessionLocal()
    try:
        logger.info("=" * 60)
        logger.info("Seeding System Master Data Lists")
        logger.info("=" * 60)
        
        tenants = db.query(Tenant).filter(Tenant.status == "active").all()
        
        if not tenants:
            logger.warning("⚠️  No active tenants found. Create a tenant first.")
            return False
        
        logger.info(f"\nFound {len(tenants)} active tenant(s)")
        
        # Get platform admin for created_by
        from app.models.user import User, UserRole
        platform_admin = db.query(User).filter(
            User.role == UserRole.PLATFORM_ADMIN
        ).first()
        created_by = platform_admin.id if platform_admin else None
        
        success_count = 0
        for tenant in tenants:
            logger.info(f"\n📋 Processing tenant: {tenant.name} ({tenant.slug})")
            if seed_system_master_data_for_tenant(tenant.id, created_by=created_by):
                success_count += 1
        
        logger.info("\n" + "=" * 60)
        logger.info(f"✅ System master data seeding complete!")
        logger.info(f"   Processed: {len(tenants)} tenant(s)")
        logger.info(f"   Successful: {success_count}")
        logger.info("=" * 60)
        logger.info("\n📋 Seeded System Master Data Lists:")
        logger.info("   - User Roles (12 roles)")
        logger.info("   - Agent Types (5 types)")
        logger.info("   - Agent Statuses (4 statuses)")
        logger.info("   - Agent Skills (10 skills)")
        logger.info("   - Assessment Types (7 types)")
        logger.info("   - Assessment Statuses (4 statuses)")
        logger.info("   - Schedule Frequencies (6 frequencies)")
        logger.info("   - Approval Statuses (5 statuses)")
        logger.info("   - Workflow Statuses (3 statuses)")
        logger.info("   - Workflow Engine Types (4 types)")
        logger.info("   - Workflow Stages (9 stages)")
        logger.info("   - Workflow Types (3 types)")
        logger.info("\n💡 Note: These are SYSTEM lists (cannot be deleted but can be edited).")
        logger.info("=" * 60)
        
        return success_count == len(tenants)
        
    except Exception as e:
        logger.error(f"❌ Error seeding system master data: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    try:
        success = seed_all_tenants()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"❌ Script failed: {e}", exc_info=True)
        sys.exit(1)
