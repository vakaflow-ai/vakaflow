"""
Service to seed default workflow configurations for tenants
"""
from sqlalchemy.orm import Session
from app.models.workflow_config import WorkflowConfiguration, WorkflowEngineType, WorkflowConfigStatus
from app.models.tenant import Tenant
from uuid import UUID
import logging

logger = logging.getLogger(__name__)


def get_default_workflow_steps():
    """Get default workflow steps for standard onboarding
    Steps are executed in sequential order based on step_number (1, 2, 3, 4, 5)
    All steps are now approval steps - simplified workflow engine
    """
    return [
        {
            "step_number": 1,
            "step_type": "approval",  # Changed from "review" - everything is approval now
            "step_name": "Security Approval",
            "assigned_role": "security_reviewer",
            "required": True,
            "can_skip": False,
            "auto_assign": True
        },
        {
            "step_number": 2,
            "step_type": "approval",  # Changed from "review"
            "step_name": "Compliance Approval",
            "assigned_role": "compliance_reviewer",
            "required": True,
            "can_skip": False,
            "auto_assign": True
        },
        {
            "step_number": 3,
            "step_type": "approval",  # Changed from "review"
            "step_name": "Technical Approval",
            "assigned_role": "technical_reviewer",
            "required": True,
            "can_skip": False,
            "auto_assign": True
        },
        {
            "step_number": 4,
            "step_type": "approval",  # Changed from "review"
            "step_name": "Business Approval",
            "assigned_role": "business_reviewer",
            "required": True,
            "can_skip": False,
            "auto_assign": True
        },
        {
            "step_number": 5,
            "step_type": "approval",
            "step_name": "Final Approval",
            "assigned_role": "approver",
            "required": True,
            "can_skip": False,
            "auto_assign": True
        }
    ]


def get_default_assignment_rules():
    """Get default assignment rules"""
    return {
        "approver_selection": "role_based",
        "reviewer_auto_assign": True,
        "escalation_rules": {
            "timeout_hours": 48,
            "escalate_to": "tenant_admin"
        }
    }


def get_default_conditions():
    """Get default workflow conditions"""
    return {
        "agent_types": None,  # Applies to all agent types
        "risk_levels": None,  # Applies to all risk levels
        "categories": None,  # Applies to all categories
        "priority": 1
    }


def create_default_workflow_for_tenant(db: Session, tenant_id: UUID, created_by: UUID = None):
    """Create default workflow configuration for a tenant"""
    # Check if tenant already has a default workflow
    existing_default = db.query(WorkflowConfiguration).filter(
        WorkflowConfiguration.tenant_id == tenant_id,
        WorkflowConfiguration.is_default == True
    ).first()
    
    if existing_default:
        logger.info(f"Tenant {tenant_id} already has a default workflow. Skipping.")
        return existing_default
    
    # Create default workflow
    default_workflow = WorkflowConfiguration(
        tenant_id=tenant_id,
        name="Standard Onboarding Workflow",
        description="Default workflow for agent onboarding with security, compliance, technical, business, and final approvals",
        workflow_engine=WorkflowEngineType.INTERNAL.value,  # Use .value to get 'internal' string
        integration_id=None,
        integration_config=None,
        workflow_steps=get_default_workflow_steps(),
        assignment_rules=get_default_assignment_rules(),
        conditions=get_default_conditions(),
        status=WorkflowConfigStatus.ACTIVE.value,
        is_default=True,
        created_by=created_by
    )
    
    db.add(default_workflow)
    db.commit()
    db.refresh(default_workflow)
    
    logger.info(f"Created default workflow for tenant {tenant_id}: {default_workflow.id}")
    return default_workflow


def seed_default_workflows_for_all_tenants(db: Session, created_by: UUID = None):
    """Seed default workflows for all existing tenants that don't have one"""
    tenants = db.query(Tenant).all()
    created_count = 0
    
    for tenant in tenants:
        existing_default = db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.tenant_id == tenant.id,
            WorkflowConfiguration.is_default == True
        ).first()
        
        if not existing_default:
            create_default_workflow_for_tenant(db, tenant.id, created_by)
            created_count += 1
    
    logger.info(f"Seeded default workflows for {created_count} tenants")
    return created_count


def ensure_default_workflow_exists(db: Session, tenant_id: UUID, created_by: UUID = None):
    """Ensure a default workflow exists for a tenant (create if missing)"""
    default_workflow = db.query(WorkflowConfiguration).filter(
        WorkflowConfiguration.tenant_id == tenant_id,
        WorkflowConfiguration.is_default == True
    ).first()
    
    if not default_workflow:
        return create_default_workflow_for_tenant(db, tenant_id, created_by)
    
    return default_workflow

