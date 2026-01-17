"""
Workflow Templates Service - Pre-built workflow templates for common use cases
"""
import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.workflow_config import WorkflowConfiguration, WorkflowConfigStatus
from app.models.form_layout import FormLayout, FormType

logger = logging.getLogger(__name__)

# Standard field groups for form layouts
STANDARD_FIELDS = {
    "basic_info": ["name", "type", "category", "subcategory", "description", "version"],
    "ai_config": ["llm_vendor", "llm_model", "deployment_type"],
    "data_ops": ["data_types", "regions", "data_sharing_scope", "data_usage_purpose"],
    "capabilities": ["capabilities", "use_cases", "personas", "features"],
    "security": ["security_controls", "compliance_frameworks", "risk_level"],
    "architecture": ["mermaid_diagram", "connection_diagram", "connections"],
    "review": ["review_notes", "approval_notes", "rejection_reason", "status"],
}

# Default visible fields for review/approval stages (comprehensive set)
DEFAULT_VISIBLE_FIELDS = [
    "name",
    "type",
    "category",
    "subcategory",
    "status",
    "submitted_by",
    "submitted_at",
    "description",
    "version",
    "llm_vendor",
    "llm_model",
    "deployment_type",
    "data_sharing_scope",
    "data_usage_purpose",
    "capabilities",
    "data_types",
    "regions",
    "use_cases",
    "features",
    "personas",
    "security_controls",
    "compliance_frameworks",
    "risk_level",
    "connections",
    "review_notes",
    "approval_notes",
    "rejection_reason"
]

# Simplified layout definitions
SIMPLIFIED_LAYOUTS = {
    "submission": {
        "name": "Submission Layout",
        "description": "Layout for initial submission and resubmission (new, needs_revision stages)",
        "sections": [
            {
                "id": "basic-info",
                "title": "Basic Information",
                "order": 1,
                "description": "Essential details",
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
                "description": "What the entity can do",
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
        "description": "Layout for review and approval (pending_approval, pending_review, in_progress stages)",
        "sections": [
            {
                "id": "overview",
                "title": "Overview",
                "order": 1,
                "description": "Quick overview of the submission",
                "fields": ["name", "type", "category", "subcategory", "status", "submitted_by", "submitted_at"]
            },
            {
                "id": "basic-info",
                "title": "Basic Information",
                "order": 2,
                "description": "Essential details",
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
            },
            {
                "id": "capabilities",
                "title": "Capabilities & Use Cases",
                "order": 5,
                "description": "What the entity can do",
                "fields": STANDARD_FIELDS["capabilities"]
            },
            {
                "id": "security-compliance",
                "title": "Security & Compliance",
                "order": 6,
                "description": "Security controls and compliance information",
                "fields": STANDARD_FIELDS["security"]
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
    }
}


class WorkflowTemplatesService:
    """Service for managing workflow templates"""
    
    @staticmethod
    def get_soc2_compliance_template() -> Dict[str, Any]:
        """Get SOC 2 compliance workflow template"""
        return {
            "name": "SOC 2 Compliance Workflow",
            "description": "Multi-stage workflow for SOC 2 compliance assessment",
            "workflow_steps": [
                {
                    "step_number": 1,
                    "step_type": "review",
                    "step_name": "Vendor/Product Information Collection",
                    "assigned_role": "vendor_coordinator",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 2,
                    "step_type": "ai_agent",
                    "step_name": "Security Controls Assessment",
                    "ai_agent_id": None,  # Will be set based on available GRC agent
                    "skill": "compliance_check",
                    "input_data": {
                        "framework": "SOC2",
                        "assessment_type": "comprehensive"
                    },
                    "on_success": "continue",
                    "on_failure": "escalate_to_human",
                    "required": True
                },
                {
                    "step_number": 3,
                    "step_type": "review",
                    "step_name": "Compliance Reviewer Assessment",
                    "assigned_role": "compliance_reviewer",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 4,
                    "step_type": "review",
                    "step_name": "Evidence Collection",
                    "assigned_role": "vendor_coordinator",
                    "required": True,
                    "can_skip": False
                },
                {
                    "step_number": 5,
                    "step_type": "approval",
                    "step_name": "Final Approval",
                    "assigned_role": "tenant_admin",
                    "required": True,
                    "can_skip": False
                }
            ],
            "conditions": {
                "entity_types": ["agent", "product", "service", "vendor"],
                "categories": ["security", "compliance"],
                "priority": 1
            },
            "trigger_rules": {
                "entity_types": ["agent", "product", "service", "vendor"],
                "match_all": False
            }
        }
    
    @staticmethod
    def get_iso27001_compliance_template() -> Dict[str, Any]:
        """Get ISO 27001 compliance workflow template"""
        return {
            "name": "ISO 27001 Compliance Workflow",
            "description": "Multi-stage workflow for ISO 27001 compliance assessment",
            "workflow_steps": [
                {
                    "step_number": 1,
                    "step_type": "review",
                    "step_name": "ISMS Documentation Review",
                    "assigned_role": "compliance_reviewer",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 2,
                    "step_type": "ai_agent",
                    "step_name": "Risk Assessment",
                    "ai_agent_id": None,
                    "skill": "risk_assessment",
                    "input_data": {
                        "framework": "ISO27001",
                        "assessment_type": "comprehensive"
                    },
                    "on_success": "continue",
                    "on_failure": "escalate_to_human",
                    "required": True
                },
                {
                    "step_number": 3,
                    "step_type": "review",
                    "step_name": "Control Implementation Review",
                    "assigned_role": "security_reviewer",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 4,
                    "step_type": "review",
                    "step_name": "Certification Validation",
                    "assigned_role": "compliance_reviewer",
                    "required": True,
                    "can_skip": False
                },
                {
                    "step_number": 5,
                    "step_type": "approval",
                    "step_name": "Approval",
                    "assigned_role": "tenant_admin",
                    "required": True,
                    "can_skip": False
                }
            ],
            "conditions": {
                "entity_types": ["agent", "product", "service", "vendor"],
                "categories": ["security", "compliance"],
                "priority": 1
            }
        }
    
    @staticmethod
    def get_gdpr_compliance_template() -> Dict[str, Any]:
        """Get GDPR compliance workflow template"""
        return {
            "name": "GDPR Compliance Workflow",
            "description": "Multi-stage workflow for GDPR compliance assessment",
            "workflow_steps": [
                {
                    "step_number": 1,
                    "step_type": "review",
                    "step_name": "Data Processing Assessment",
                    "assigned_role": "compliance_reviewer",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 2,
                    "step_type": "ai_agent",
                    "step_name": "Privacy Impact Assessment",
                    "ai_agent_id": None,
                    "skill": "compliance_check",
                    "input_data": {
                        "framework": "GDPR",
                        "assessment_type": "privacy_impact"
                    },
                    "on_success": "continue",
                    "on_failure": "escalate_to_human",
                    "required": True
                },
                {
                    "step_number": 3,
                    "step_type": "review",
                    "step_name": "Legal Review",
                    "assigned_role": "compliance_reviewer",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 4,
                    "step_type": "review",
                    "step_name": "Data Protection Officer Review",
                    "assigned_role": "compliance_reviewer",
                    "required": True,
                    "can_skip": False
                },
                {
                    "step_number": 5,
                    "step_type": "approval",
                    "step_name": "Approval",
                    "assigned_role": "tenant_admin",
                    "required": True,
                    "can_skip": False
                }
            ],
            "conditions": {
                "entity_types": ["agent", "product", "service", "vendor"],
                "categories": ["compliance", "privacy"],
                "priority": 1
            }
        }
    
    @staticmethod
    def get_vendor_onboarding_template() -> Dict[str, Any]:
        """Get enhanced vendor onboarding workflow template"""
        return {
            "name": "Enhanced Vendor Onboarding",
            "description": "Multi-stage vendor onboarding workflow with AI agent steps",
            "workflow_steps": [
                {
                    "step_number": 1,
                    "step_type": "review",
                    "step_name": "Vendor Registration",
                    "assigned_role": "vendor_coordinator",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 2,
                    "step_type": "ai_agent",
                    "step_name": "Initial Qualification",
                    "ai_agent_id": None,
                    "skill": "vendor_qualification",
                    "input_data": {
                        "assessment_type": "initial"
                    },
                    "on_success": "continue",
                    "on_failure": "escalate_to_human",
                    "required": True
                },
                {
                    "step_number": 3,
                    "step_type": "review",
                    "step_name": "Security Assessment",
                    "assigned_role": "security_reviewer",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 4,
                    "step_type": "ai_agent",
                    "step_name": "Compliance Check",
                    "ai_agent_id": None,
                    "skill": "compliance_check",
                    "input_data": {
                        "assessment_type": "comprehensive"
                    },
                    "on_success": "continue",
                    "on_failure": "escalate_to_human",
                    "required": True
                },
                {
                    "step_number": 5,
                    "step_type": "review",
                    "step_name": "Business Review",
                    "assigned_role": "business_reviewer",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 6,
                    "step_type": "approval",
                    "step_name": "Final Approval",
                    "assigned_role": "tenant_admin",
                    "required": True,
                    "can_skip": False
                }
            ],
            "conditions": {
                "entity_types": ["vendor"],
                "priority": 1
            }
        }
    
    @staticmethod
    def get_risk_assessment_template() -> Dict[str, Any]:
        """Get AI-powered risk assessment workflow template"""
        return {
            "name": "AI-Powered Risk Assessment",
            "description": "Automated risk assessment workflow with AI agent analysis",
            "workflow_steps": [
                {
                    "step_number": 1,
                    "step_type": "review",
                    "step_name": "Entity Information Collection",
                    "assigned_role": "vendor_coordinator",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 2,
                    "step_type": "ai_agent",
                    "step_name": "Automated Risk Scoring",
                    "ai_agent_id": None,
                    "skill": "risk_assessment",
                    "input_data": {
                        "assessment_type": "comprehensive",
                        "use_rag": True
                    },
                    "on_success": "continue",
                    "on_failure": "escalate_to_human",
                    "required": True
                },
                {
                    "step_number": 3,
                    "step_type": "review",
                    "step_name": "Risk Categorization",
                    "assigned_role": "security_reviewer",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 4,
                    "step_type": "ai_agent",
                    "step_name": "Mitigation Plan Generation",
                    "ai_agent_id": None,
                    "skill": "risk_assessment",
                    "input_data": {
                        "action": "generate_mitigation_plan"
                    },
                    "on_success": "continue",
                    "on_failure": "escalate_to_human",
                    "required": True
                },
                {
                    "step_number": 5,
                    "step_type": "review",
                    "step_name": "Risk Owner Review",
                    "assigned_role": "security_reviewer",
                    "required": True,
                    "can_skip": False,
                    "auto_assign": True
                },
                {
                    "step_number": 6,
                    "step_type": "approval",
                    "step_name": "Approval/Rejection",
                    "assigned_role": "tenant_admin",
                    "required": True,
                    "can_skip": False
                }
            ],
            "conditions": {
                "entity_types": ["agent", "product", "service", "vendor"],
                "priority": 1
            }
        }
    
    @staticmethod
    def create_workflow_from_template(
        template_name: str,
        tenant_id: UUID,
        created_by: UUID,
        db: Session,
        customizations: Optional[Dict[str, Any]] = None
    ) -> WorkflowConfiguration:
        """
        Create a workflow configuration from a template
        
        This method applies to ALL workflow templates:
        - SOC 2 Compliance Workflow
        - ISO 27001 Compliance Workflow
        - GDPR Compliance Workflow
        - Enhanced Vendor Onboarding
        - AI-Powered Risk Assessment
        
        For each template, this method creates:
        1. Workflow configuration with all steps
        2. Submission form layout (for new/needs_revision stages)
        3. Approver form layout (for pending_approval/pending_review/in_progress stages)
        4. Workflow layout group (FormType) mapping workflow to form layouts
        5. Stage settings for all review/approval steps with:
           - Layout ID linked to approver form layout
           - All visible fields pre-selected (27 standard fields)
           - Email notifications configured
        """
        templates = {
            "soc2": WorkflowTemplatesService.get_soc2_compliance_template(),
            "iso27001": WorkflowTemplatesService.get_iso27001_compliance_template(),
            "gdpr": WorkflowTemplatesService.get_gdpr_compliance_template(),
            "vendor_onboarding": WorkflowTemplatesService.get_vendor_onboarding_template(),
            "risk_assessment": WorkflowTemplatesService.get_risk_assessment_template()
        }
        
        template = templates.get(template_name.lower())
        if not template:
            raise ValueError(f"Unknown template: {template_name}")
        
        # Apply customizations if provided
        if customizations:
            if "name" in customizations:
                template["name"] = customizations["name"]
            if "description" in customizations:
                template["description"] = customizations["description"]
            if "workflow_steps" in customizations:
                template["workflow_steps"] = customizations["workflow_steps"]
            if "conditions" in customizations:
                template["conditions"].update(customizations["conditions"])
        
        # Create workflow configuration
        workflow = WorkflowConfiguration(
            tenant_id=tenant_id,
            name=template["name"],
            description=template["description"],
            workflow_steps=template["workflow_steps"],
            conditions=template.get("conditions"),
            trigger_rules=template.get("trigger_rules"),
            status=WorkflowConfigStatus.DRAFT.value,
            created_by=created_by
        )
        
        db.add(workflow)
        db.flush()  # Flush to get workflow.id without committing
        
        # Map template names to request types
        request_type_mapping = {
            "soc2": "soc2_compliance_workflow",
            "iso27001": "iso27001_compliance_workflow",
            "gdpr": "gdpr_compliance_workflow",
            "vendor_onboarding": "vendor_onboarding_workflow",
            "risk_assessment": "risk_assessment_workflow"
        }
        request_type = request_type_mapping.get(template_name.lower(), "assessment_workflow")
        
        # Create form layouts for submission and approver stages
        submission_layout = FormLayout(
            tenant_id=tenant_id,
            name=f"{template['name']} - Submission Form",
            request_type=request_type,
            workflow_stage="new,needs_revision",
            layout_type="submission",
            description=f"Submission form for {template['name']}",
            sections=SIMPLIFIED_LAYOUTS["submission"]["sections"],
            is_default=True,
            created_by=created_by
        )
        db.add(submission_layout)
        db.flush()
        
        approver_layout = FormLayout(
            tenant_id=tenant_id,
            name=f"{template['name']} - Approver Review",
            request_type=request_type,
            workflow_stage="pending_approval,pending_review,in_progress",
            layout_type="approver",
            description=f"Approver review form for {template['name']}",
            sections=SIMPLIFIED_LAYOUTS["approver"]["sections"],
            is_default=True,
            created_by=created_by
        )
        db.add(approver_layout)
        db.flush()
        
        # Create workflow layout group (FormType) to map workflow to layouts
        # This links the workflow to form layouts in Process Designer (Workflow Layout Manager)
        workflow_layout_group = FormType(
            tenant_id=tenant_id,
            name=f"{template['name']} Layout Group",
            request_type=request_type,
            description=f"Form layouts for {template['name']}",
            workflow_config_id=workflow.id,
            covered_entities=template.get("conditions", {}).get("entity_types", ["agent", "vendor"]),
            stage_mappings={
                "submission": {
                    "layout_id": str(submission_layout.id),
                    "name": submission_layout.name
                },
                "approval": {
                    "layout_id": str(approver_layout.id),
                    "name": approver_layout.name
                },
                "rejection": {
                    "layout_id": str(submission_layout.id),
                    "name": submission_layout.name
                },
                "completion": {
                    "layout_id": str(approver_layout.id),
                    "name": approver_layout.name
                }
            },
            is_active=True,
            is_default=True,
            created_by=created_by
        )
        db.add(workflow_layout_group)
        
        # Update workflow steps with stage settings (layout_id for approver steps)
        # This applies to ALL templates: soc2, iso27001, gdpr, vendor_onboarding, risk_assessment
        updated_steps = []
        review_approval_steps_count = 0
        for step in template["workflow_steps"]:
            step_copy = step.copy()
            # Add stage settings for review and approval steps
            # All review and approval steps get:
            # - Layout ID linked to approver form layout
            # - All visible fields pre-selected
            # - Email notifications configured
            if step.get("step_type") in ["review", "approval"]:
                review_approval_steps_count += 1
                step_copy["stage_settings"] = {
                    "layout_id": str(approver_layout.id),
                    "visible_fields": DEFAULT_VISIBLE_FIELDS.copy(),  # Pre-select all standard fields
                    "email_notifications": {
                        "enabled": True,
                        "recipients": ["next_approver"],
                        "reminders": []
                    }
                }
            updated_steps.append(step_copy)
        
        # Update workflow with steps that have stage settings
        workflow.workflow_steps = updated_steps
        
        logger.info(
            f"Configured {review_approval_steps_count} review/approval steps with stage settings "
            f"(layout_id, visible_fields, email_notifications) for template {template_name}"
        )
        
        db.commit()
        db.refresh(workflow)
        
        logger.info(
            f"Created workflow {workflow.id} from template {template_name} for tenant {tenant_id}. "
            f"Created: 1 submission layout ({submission_layout.id}), 1 approver layout ({approver_layout.id}), "
            f"1 workflow layout group ({workflow_layout_group.id}), "
            f"and configured {review_approval_steps_count} review/approval steps with visible fields."
        )
        
        return workflow
    
    @staticmethod
    def list_available_templates() -> List[Dict[str, Any]]:
        """List all available workflow templates"""
        return [
            {
                "id": "soc2",
                "name": "SOC 2 Compliance Workflow",
                "description": "Multi-stage workflow for SOC 2 compliance assessment",
                "category": "compliance",
                "entity_types": ["agent", "product", "service", "vendor"]
            },
            {
                "id": "iso27001",
                "name": "ISO 27001 Compliance Workflow",
                "description": "Multi-stage workflow for ISO 27001 compliance assessment",
                "category": "compliance",
                "entity_types": ["agent", "product", "service", "vendor"]
            },
            {
                "id": "gdpr",
                "name": "GDPR Compliance Workflow",
                "description": "Multi-stage workflow for GDPR compliance assessment",
                "category": "compliance",
                "entity_types": ["agent", "product", "service", "vendor"]
            },
            {
                "id": "vendor_onboarding",
                "name": "Enhanced Vendor Onboarding",
                "description": "Multi-stage vendor onboarding workflow with AI agent steps",
                "category": "onboarding",
                "entity_types": ["vendor"]
            },
            {
                "id": "risk_assessment",
                "name": "AI-Powered Risk Assessment",
                "description": "Automated risk assessment workflow with AI agent analysis",
                "category": "risk",
                "entity_types": ["agent", "product", "service", "vendor"]
            }
        ]
