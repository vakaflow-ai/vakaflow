"""
Role Permission Service - Business logic for role permissions
"""
from sqlalchemy.orm import Session
from app.models.role_permission import RolePermission
from app.models.user import UserRole
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class RolePermissionService:
    """Service for managing role permissions"""
    
    # Default permissions structure: category -> permission_key -> (label, description)
    DEFAULT_PERMISSIONS = {
        "agent_management": {
            "agents.view": ("View Agents", "View agent catalog and details"),
            "agents.create": ("Create Agents", "Submit new agents for review"),
            "agents.edit": ("Edit Agents", "Edit agent details"),
            "agents.delete": ("Delete Agents", "Delete agents"),
            "agents.approve": ("Approve Agents", "Approve agent submissions"),
            "agents.reject": ("Reject Agents", "Reject agent submissions"),
        },
        "review_approval": {
            "reviews.view": ("View Reviews", "View review requests and status"),
            "reviews.create": ("Create Reviews", "Create review requests"),
            "reviews.edit": ("Edit Reviews", "Edit review details"),
            "reviews.approve": ("Approve Reviews", "Approve reviews"),
            "reviews.reject": ("Reject Reviews", "Reject reviews"),
            "approvals.view": ("View Approvals", "View approval requests"),
            "approvals.approve": ("Approve Requests", "Approve requests"),
            "approvals.reject": ("Reject Requests", "Reject requests"),
        },
        "compliance": {
            "policies.view": ("View Policies", "View compliance policies"),
            "policies.create": ("Create Policies", "Create new policies"),
            "policies.edit": ("Edit Policies", "Edit policies"),
            "policies.delete": ("Delete Policies", "Delete policies"),
            "assessments.view": ("View Assessments", "View assessments"),
            "assessments.create": ("Create Assessments", "Create assessments"),
            "assessments.edit": ("Edit Assessments", "Edit assessments"),
            "assessments.assign": ("Assign Assessments", "Assign assessments to vendors"),
            "requirements.view": ("View Requirements", "View submission requirements"),
            "requirements.create": ("Create Requirements", "Create requirements"),
            "requirements.edit": ("Edit Requirements", "Edit requirements"),
        },
        "administration": {
            "users.view": ("View Users", "View user list and details"),
            "users.create": ("Create Users", "Create new users"),
            "users.edit": ("Edit Users", "Edit user details"),
            "users.delete": ("Delete Users", "Delete users"),
            "tenants.view": ("View Tenants", "View tenant list"),
            "tenants.create": ("Create Tenants", "Create new tenants"),
            "tenants.edit": ("Edit Tenants", "Edit tenant details"),
            "tenants.delete": ("Delete Tenants", "Delete tenants"),
            "workflows.view": ("View Workflows", "View workflow configurations"),
            "workflows.create": ("Create Workflows", "Create workflow configurations"),
            "workflows.edit": ("Edit Workflows", "Edit workflow configurations"),
            "workflows.delete": ("Delete Workflows", "Delete workflows"),
            "settings.view": ("View Settings", "View tenant/platform settings"),
            "settings.edit": ("Edit Settings", "Edit tenant/platform settings"),
        },
        "analytics": {
            "analytics.view": ("View Analytics", "View analytics dashboards"),
            "analytics.export": ("Export Analytics", "Export analytics data"),
            "reports.view": ("View Reports", "View reports"),
            "reports.create": ("Create Reports", "Create custom reports"),
        },
        "integrations": {
            "integrations.view": ("View Integrations", "View integration configurations"),
            "integrations.create": ("Create Integrations", "Create new integrations"),
            "integrations.edit": ("Edit Integrations", "Edit integration configurations"),
            "integrations.delete": ("Delete Integrations", "Delete integrations"),
        },
        "vendor_management": {
            "vendors.view": ("View Vendors", "View vendor list and details"),
            "vendors.create": ("Create Vendors", "Create new vendors"),
            "vendors.edit": ("Edit Vendors", "Edit vendor details"),
            "vendors.delete": ("Delete Vendors", "Delete vendors"),
            "vendors.invite": ("Invite Vendors", "Invite vendors to the platform"),
        },
        "menu": {
            "menu.my_actions": ("My Actions", "Access to My Actions page"),
            "menu.vendor_dashboard": ("Vendor Dashboard", "Access to Vendor Dashboard"),
            "menu.catalog": ("Agent Catalog", "Access to Agent Catalog"),
            "menu.marketplace": ("Marketplace", "Access to Marketplace"),
            "menu.invite_vendor": ("Invite Vendor", "Access to Invite Vendor page"),
            "menu.my_vendors": ("MyAI-Vendors", "Access to MyAI-Vendors page"),
            "menu.analytics": ("Analytics Dashboard", "Access to Analytics Dashboard"),
            "menu.assessment_analytics": ("Assessment Analytics", "Access to Assessment Analytics"),
            "menu.ai_posture": ("AI Posture", "Access to AI Posture page"),
            "menu.ecosystem_map": ("Ecosystem Map", "Access to Ecosystem Map"),
            "menu.submit_agent": ("Submit Agent", "Access to Submit Agent page"),
            "menu.my_submissions": ("My Submissions", "Access to My Submissions page"),
            "menu.trust_center": ("Trust Center", "Access to Trust Center"),
            "menu.tickets": ("Tickets", "Access to Tickets page"),
            "menu.reviews": ("Reviews", "Access to Reviews page"),
            "menu.approvals": ("Approvals", "Access to Approvals page"),
            "menu.policies": ("Policies & Rules", "Access to Policies & Rules page"),
            "menu.business_rules": ("Business Rules", "Access to Business Rules page"),
            "menu.compliance_checks": ("Compliance Checks", "Access to Compliance Checks page"),
            "menu.cve_tracking": ("CVE Tracking", "Access to CVE Tracking page"),
            "menu.question_library": ("Question Library", "Access to Question Library"),
            "menu.submission_requirements": ("Submission Requirements", "Access to Submission Requirements page"),
            "menu.assessments": ("Assessments", "Access to Assessments page"),
            "menu.admin_panel": ("Admin Panel", "Access to Admin Panel"),
            "menu.users": ("Users", "Access to Users management page"),
            "menu.role_permissions": ("Role & Permissions", "Access to Role & Permissions page"),
            "menu.entity_fields_catalog": ("Entity and Fields Catalog", "Access to Entity and Fields Catalog"),
            "menu.tenant_settings": ("Tenant Settings", "Access to Tenant Settings page"),
            "menu.tenants": ("Tenants", "Access to Tenants management page"),
            "menu.workflows": ("Workflows", "Access to Workflows page"),
            "menu.screen_designer": ("Process Designer", "Access to Process Designer"),
            "menu.master_data": ("Master Data", "Access to Master Data page"),
            "menu.platform_config": ("Platform Config", "Access to Platform Config page"),
            "menu.cluster_nodes": ("Cluster Nodes", "Access to Cluster Nodes page"),
            "menu.audit_trail": ("Audit Trail", "Access to Audit Trail page"),
            "menu.studio": ("VAKA Studio", "Access to VAKA Studio"),
            "menu.offboarding": ("Offboarding", "Access to Offboarding page"),
            "menu.export_data": ("Export Data", "Access to Export Data page"),
            "menu.integrations": ("Integrations", "Access to Integrations page"),
            "menu.webhooks": ("Webhooks", "Access to Webhooks page"),
            "menu.application_logs": ("Application Logs", "Access to Application Logs page"),
            "menu.messages": ("Messages", "Access to Messages page"),
            "menu.mfa_settings": ("MFA Settings", "Access to MFA Settings page"),
        },
        "forms_and_data_fields": {
            # Submission Data Level - Agent Core Fields
            "submission.field.name": ("Submission: Name Field", "View/edit agent name field"),
            "submission.field.type": ("Submission: Type Field", "View/edit agent type field"),
            "submission.field.category": ("Submission: Category Field", "View/edit agent category field"),
            "submission.field.subcategory": ("Submission: Subcategory Field", "View/edit agent subcategory field"),
            "submission.field.description": ("Submission: Description Field", "View/edit agent description field"),
            "submission.field.version": ("Submission: Version Field", "View/edit agent version field"),
            "submission.field.status": ("Submission: Status Field", "View/edit agent status field"),
            "submission.field.vendor_id": ("Submission: Vendor ID Field", "View/edit vendor ID field"),
            "submission.field.submission_date": ("Submission: Submission Date Field", "View/edit submission date field"),
            "submission.field.approval_date": ("Submission: Approval Date Field", "View/edit approval date field"),
            "submission.field.compliance_score": ("Submission: Compliance Score Field", "View/edit compliance score field"),
            "submission.field.risk_score": ("Submission: Risk Score Field", "View/edit risk score field"),
            # Submission Data Level - Agent Metadata Fields
            "submission.field.capabilities": ("Submission: Capabilities Field", "View/edit agent capabilities field"),
            "submission.field.data_types": ("Submission: Data Types Field", "View/edit data types field"),
            "submission.field.regions": ("Submission: Regions Field", "View/edit regions field"),
            "submission.field.integrations": ("Submission: Integrations Field", "View/edit integrations field"),
            "submission.field.dependencies": ("Submission: Dependencies Field", "View/edit dependencies field"),
            "submission.field.architecture_info": ("Submission: Architecture Info Field", "View/edit architecture information field"),
            "submission.field.use_cases": ("Submission: Use Cases Field", "View/edit use cases field"),
            "submission.field.features": ("Submission: Features Field", "View/edit features field"),
            "submission.field.personas": ("Submission: Personas Field", "View/edit target personas field"),
            "submission.field.version_info": ("Submission: Version Info Field", "View/edit version information field"),
            "submission.field.llm_vendor": ("Submission: LLM Vendor Field", "View/edit LLM vendor field"),
            "submission.field.llm_model": ("Submission: LLM Model Field", "View/edit LLM model field"),
            "submission.field.deployment_type": ("Submission: Deployment Type Field", "View/edit deployment type field"),
            "submission.field.data_sharing_scope": ("Submission: Data Sharing Scope Field", "View/edit data sharing scope field"),
            "submission.field.data_usage_purpose": ("Submission: Data Usage Purpose Field", "View/edit data usage purpose field"),
            # Submission Data Level - Agent Artifacts
            "submission.field.artifacts": ("Submission: Artifacts Field", "View/edit agent artifacts field"),
            "submission.field.artifact_type": ("Submission: Artifact Type Field", "View/edit artifact type field"),
            "submission.field.artifact_file": ("Submission: Artifact File Field", "View/edit artifact file field"),
            # Submission Data Level - Submission Requirements Fields
            "submission.field.requirement_responses": ("Submission: Requirement Responses Field", "View/edit submission requirement responses field"),
            "submission.field.custom_fields": ("Submission: Custom Fields Field", "View/edit custom form fields field"),
            # Approval Data Level - Approval Instance Fields
            "approval.field.status": ("Approval: Status Field", "View/edit approval status field"),
            "approval.field.current_step": ("Approval: Current Step Field", "View/edit current approval step field"),
            "approval.field.approved_by": ("Approval: Approved By Field", "View/edit approved by field"),
            "approval.field.approval_notes": ("Approval: Approval Notes Field", "View/edit approval notes field"),
            "approval.field.started_at": ("Approval: Started At Field", "View/edit approval start date field"),
            "approval.field.completed_at": ("Approval: Completed At Field", "View/edit approval completion date field"),
            "approval.field.workflow_id": ("Approval: Workflow ID Field", "View/edit approval workflow ID field"),
            # Approval Data Level - Approval Step Fields
            "approval.field.step_number": ("Approval: Step Number Field", "View/edit approval step number field"),
            "approval.field.step_type": ("Approval: Step Type Field", "View/edit approval step type field"),
            "approval.field.step_name": ("Approval: Step Name Field", "View/edit approval step name field"),
            "approval.field.assigned_to": ("Approval: Assigned To Field", "View/edit approval step assigned to field"),
            "approval.field.assigned_role": ("Approval: Assigned Role Field", "View/edit approval step assigned role field"),
            "approval.field.step_status": ("Approval: Step Status Field", "View/edit approval step status field"),
            "approval.field.completed_by": ("Approval: Completed By Field", "View/edit approval step completed by field"),
            "approval.field.completed_at": ("Approval: Step Completed At Field", "View/edit approval step completion date field"),
            "approval.field.step_notes": ("Approval: Step Notes Field", "View/edit approval step notes field"),
            # Approval Data Level - Approval Workflow Fields
            "approval.field.workflow_name": ("Approval: Workflow Name Field", "View/edit approval workflow name field"),
            "approval.field.workflow_description": ("Approval: Workflow Description Field", "View/edit approval workflow description field"),
            "approval.field.workflow_config": ("Approval: Workflow Config Field", "View/edit approval workflow configuration field"),
            "approval.field.agent_type": ("Approval: Agent Type Filter Field", "View/edit approval workflow agent type filter field"),
            "approval.field.risk_level": ("Approval: Risk Level Filter Field", "View/edit approval workflow risk level filter field"),
        },
    }
    
    # Role-based default permissions (role -> list of permission keys that should be enabled)
    ROLE_DEFAULT_PERMISSIONS: Dict[str, Dict[str, list]] = {
        "platform_admin": {
            "menu": [
                "menu.my_actions", "menu.vendor_dashboard", "menu.catalog", "menu.marketplace", "menu.invite_vendor",
                "menu.my_vendors", "menu.analytics", "menu.assessment_analytics", "menu.ai_posture", "menu.ecosystem_map",
                "menu.submit_agent", "menu.my_submissions", "menu.trust_center", "menu.tickets", "menu.reviews",
                "menu.approvals", "menu.policies", "menu.business_rules", "menu.compliance_checks", "menu.cve_tracking",
                "menu.question_library", "menu.submission_requirements", "menu.assessments", "menu.admin_panel",
                "menu.users", "menu.role_permissions", "menu.entity_fields_catalog", "menu.tenant_settings",
                "menu.tenants", "menu.workflows", "menu.screen_designer", "menu.master_data", "menu.platform_config",
                "menu.cluster_nodes", "menu.audit_trail", "menu.studio", "menu.offboarding", "menu.export_data",
                "menu.integrations", "menu.webhooks", "menu.application_logs", "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view", "agents.create", "agents.edit", "agents.delete", "agents.approve", "agents.reject"],
            "review_approval": ["reviews.view", "reviews.create", "reviews.edit", "reviews.approve", "reviews.reject", "approvals.view", "approvals.approve", "approvals.reject"],
            "compliance": ["policies.view", "policies.create", "policies.edit", "policies.delete", "assessments.view", "assessments.create", "assessments.edit", "assessments.assign", "requirements.view", "requirements.create", "requirements.edit"],
            "administration": ["users.view", "users.create", "users.edit", "users.delete", "tenants.view", "tenants.create", "tenants.edit", "tenants.delete", "workflows.view", "workflows.create", "workflows.edit", "workflows.delete", "settings.view", "settings.edit"],
            "analytics": ["analytics.view", "analytics.export", "reports.view", "reports.create"],
            "integrations": ["integrations.view", "integrations.create", "integrations.edit", "integrations.delete"],
            "vendor_management": ["vendors.view", "vendors.create", "vendors.edit", "vendors.delete", "vendors.invite"],
            "forms_and_data_fields": [
                # All submission fields
                "submission.field.name", "submission.field.type", "submission.field.category", "submission.field.subcategory",
                "submission.field.description", "submission.field.version", "submission.field.status", "submission.field.vendor_id",
                "submission.field.submission_date", "submission.field.approval_date", "submission.field.compliance_score",
                "submission.field.risk_score", "submission.field.capabilities", "submission.field.data_types", "submission.field.regions",
                "submission.field.integrations", "submission.field.dependencies", "submission.field.architecture_info",
                "submission.field.use_cases", "submission.field.features", "submission.field.personas", "submission.field.version_info",
                "submission.field.llm_vendor", "submission.field.llm_model", "submission.field.deployment_type",
                "submission.field.data_sharing_scope", "submission.field.data_usage_purpose", "submission.field.artifacts",
                "submission.field.artifact_type", "submission.field.artifact_file", "submission.field.requirement_responses",
                "submission.field.custom_fields",
                # All approval fields
                "approval.field.status", "approval.field.current_step", "approval.field.approved_by", "approval.field.approval_notes",
                "approval.field.started_at", "approval.field.completed_at", "approval.field.workflow_id", "approval.field.step_number",
                "approval.field.step_type", "approval.field.step_name", "approval.field.assigned_to", "approval.field.assigned_role",
                "approval.field.step_status", "approval.field.completed_by", "approval.field.completed_at", "approval.field.step_notes",
                "approval.field.workflow_name", "approval.field.workflow_description", "approval.field.workflow_config",
                "approval.field.agent_type", "approval.field.risk_level"
            ],
        },
        "tenant_admin": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.invite_vendor", "menu.my_vendors",
                "menu.analytics", "menu.assessment_analytics", "menu.ai_posture", "menu.ecosystem_map",
                "menu.tickets", "menu.reviews", "menu.approvals", "menu.policies", "menu.business_rules",
                "menu.compliance_checks", "menu.cve_tracking", "menu.question_library", "menu.submission_requirements",
                "menu.assessments", "menu.admin_panel", "menu.users", "menu.role_permissions",
                "menu.entity_fields_catalog", "menu.tenant_settings", "menu.workflows", "menu.screen_designer",
                "menu.master_data", "menu.audit_trail", "menu.studio", "menu.offboarding", "menu.export_data",
                "menu.integrations", "menu.webhooks", "menu.application_logs", "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view", "agents.create", "agents.edit", "agents.approve", "agents.reject"],
            "review_approval": ["reviews.view", "reviews.create", "reviews.edit", "reviews.approve", "reviews.reject", "approvals.view", "approvals.approve", "approvals.reject"],
            "compliance": ["policies.view", "policies.create", "policies.edit", "assessments.view", "assessments.create", "assessments.edit", "assessments.assign", "requirements.view", "requirements.create", "requirements.edit"],
            "administration": ["users.view", "users.create", "users.edit", "workflows.view", "workflows.create", "workflows.edit", "settings.view", "settings.edit"],
            "analytics": ["analytics.view", "analytics.export", "reports.view", "reports.create"],
            "integrations": ["integrations.view", "integrations.create", "integrations.edit"],
            "vendor_management": ["vendors.view", "vendors.create", "vendors.edit", "vendors.invite"],
            "forms_and_data_fields": [
                # All submission fields
                "submission.field.name", "submission.field.type", "submission.field.category", "submission.field.subcategory",
                "submission.field.description", "submission.field.version", "submission.field.status", "submission.field.vendor_id",
                "submission.field.submission_date", "submission.field.approval_date", "submission.field.compliance_score",
                "submission.field.risk_score", "submission.field.capabilities", "submission.field.data_types", "submission.field.regions",
                "submission.field.integrations", "submission.field.dependencies", "submission.field.architecture_info",
                "submission.field.use_cases", "submission.field.features", "submission.field.personas", "submission.field.version_info",
                "submission.field.llm_vendor", "submission.field.llm_model", "submission.field.deployment_type",
                "submission.field.data_sharing_scope", "submission.field.data_usage_purpose", "submission.field.artifacts",
                "submission.field.artifact_type", "submission.field.artifact_file", "submission.field.requirement_responses",
                "submission.field.custom_fields",
                # All approval fields
                "approval.field.status", "approval.field.current_step", "approval.field.approved_by", "approval.field.approval_notes",
                "approval.field.started_at", "approval.field.completed_at", "approval.field.workflow_id", "approval.field.step_number",
                "approval.field.step_type", "approval.field.step_name", "approval.field.assigned_to", "approval.field.assigned_role",
                "approval.field.step_status", "approval.field.completed_by", "approval.field.completed_at", "approval.field.step_notes",
                "approval.field.workflow_name", "approval.field.workflow_description", "approval.field.workflow_config",
                "approval.field.agent_type", "approval.field.risk_level"
            ],
        },
        "vendor_coordinator": {
            "menu": [
                "menu.my_actions", "menu.vendor_dashboard", "menu.catalog", "menu.marketplace",
                "menu.submit_agent", "menu.my_submissions", "menu.my_assessments", "menu.trust_center", "menu.tickets",
                "menu.offboarding", "menu.messages", "menu.mfa_settings", "menu.users",
                "menu.analytics", "menu.assessment_analytics"
            ],
            "agent_management": ["agents.view", "agents.create", "agents.edit"],
            "review_approval": ["reviews.view"],
            "compliance": ["assessments.view"],
            "vendor_management": ["vendors.view", "vendors.edit"],  # Can edit their own vendor
            "administration": ["users.view", "users.create", "users.edit"],  # Can manage vendor users
            "analytics": ["analytics.view", "reports.view"],  # Can view vendor analytics
            "forms_and_data_fields": [
                # Submission fields - vendor coordinators can view/edit all submissions from their vendor
                "submission.field.name", "submission.field.type", "submission.field.category", "submission.field.subcategory",
                "submission.field.description", "submission.field.version", "submission.field.capabilities", "submission.field.data_types",
                "submission.field.regions", "submission.field.integrations", "submission.field.dependencies", "submission.field.architecture_info",
                "submission.field.use_cases", "submission.field.features", "submission.field.personas", "submission.field.version_info",
                "submission.field.llm_vendor", "submission.field.llm_model", "submission.field.deployment_type",
                "submission.field.data_sharing_scope", "submission.field.data_usage_purpose", "submission.field.artifacts",
                "submission.field.artifact_type", "submission.field.artifact_file", "submission.field.requirement_responses",
                "submission.field.custom_fields",
                # Approval fields - view only
                "approval.field.status", "approval.field.current_step", "approval.field.approved_by", "approval.field.approval_notes",
                "approval.field.started_at", "approval.field.completed_at", "approval.field.step_number", "approval.field.step_type",
                "approval.field.step_name", "approval.field.step_status", "approval.field.completed_at"
            ],
        },
        "vendor_user": {
            "menu": [
                "menu.my_actions", "menu.vendor_dashboard", "menu.catalog", "menu.marketplace",
                "menu.submit_agent", "menu.my_submissions", "menu.my_assessments", "menu.trust_center", "menu.tickets",
                "menu.offboarding", "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view", "agents.create", "agents.edit"],
            "review_approval": ["reviews.view"],
            "compliance": ["assessments.view"],
            "vendor_management": ["vendors.view"],
            "forms_and_data_fields": [
                # Submission fields - vendor users can view/edit their own submissions
                "submission.field.name", "submission.field.type", "submission.field.category", "submission.field.subcategory",
                "submission.field.description", "submission.field.version", "submission.field.capabilities", "submission.field.data_types",
                "submission.field.regions", "submission.field.integrations", "submission.field.dependencies", "submission.field.architecture_info",
                "submission.field.use_cases", "submission.field.features", "submission.field.personas", "submission.field.version_info",
                "submission.field.llm_vendor", "submission.field.llm_model", "submission.field.deployment_type",
                "submission.field.data_sharing_scope", "submission.field.data_usage_purpose", "submission.field.artifacts",
                "submission.field.artifact_type", "submission.field.artifact_file", "submission.field.requirement_responses",
                "submission.field.custom_fields",
                # Approval fields - view only
                "approval.field.status", "approval.field.current_step", "approval.field.approved_by", "approval.field.approval_notes",
                "approval.field.started_at", "approval.field.completed_at", "approval.field.step_number", "approval.field.step_type",
                "approval.field.step_name", "approval.field.step_status", "approval.field.completed_at"
            ],
        },
        "security_reviewer": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.tickets",
                "menu.reviews", "menu.policies", "menu.compliance_checks", "menu.cve_tracking",
                "menu.question_library", "menu.submission_requirements", "menu.assessments",
                "menu.audit_trail", "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view"],
            "review_approval": ["reviews.view", "reviews.edit", "reviews.approve", "reviews.reject"],
            "compliance": ["policies.view", "assessments.view"],
            "forms_and_data_fields": [
                # Submission fields - view all, edit security-related
                "submission.field.name", "submission.field.type", "submission.field.category", "submission.field.subcategory",
                "submission.field.description", "submission.field.version", "submission.field.status", "submission.field.compliance_score",
                "submission.field.risk_score", "submission.field.deployment_type", "submission.field.data_sharing_scope",
                "submission.field.data_usage_purpose", "submission.field.llm_vendor", "submission.field.llm_model",
                "submission.field.artifacts", "submission.field.requirement_responses",
                # Approval fields - view and edit
                "approval.field.status", "approval.field.current_step", "approval.field.approved_by", "approval.field.approval_notes",
                "approval.field.step_status", "approval.field.step_notes"
            ],
        },
        "compliance_reviewer": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.tickets",
                "menu.reviews", "menu.policies", "menu.compliance_checks", "menu.cve_tracking",
                "menu.question_library", "menu.submission_requirements", "menu.assessments",
                "menu.audit_trail", "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view"],
            "review_approval": ["reviews.view", "reviews.edit", "reviews.approve", "reviews.reject"],
            "compliance": ["policies.view", "assessments.view", "assessments.edit"],
            "forms_and_data_fields": [
                # Submission fields - view all, edit compliance-related
                "submission.field.name", "submission.field.type", "submission.field.category", "submission.field.description",
                "submission.field.version", "submission.field.status", "submission.field.compliance_score", "submission.field.risk_score",
                "submission.field.requirement_responses", "submission.field.custom_fields",
                # Approval fields - view and edit
                "approval.field.status", "approval.field.current_step", "approval.field.approval_notes", "approval.field.step_notes"
            ],
        },
        "technical_reviewer": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.tickets",
                "menu.reviews", "menu.compliance_checks", "menu.question_library",
                "menu.submission_requirements", "menu.assessments", "menu.audit_trail",
                "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view"],
            "review_approval": ["reviews.view", "reviews.edit", "reviews.approve", "reviews.reject"],
            "compliance": ["assessments.view"],
            "forms_and_data_fields": [
                # Submission fields - view all, edit technical fields
                "submission.field.name", "submission.field.type", "submission.field.category", "submission.field.description",
                "submission.field.version", "submission.field.capabilities", "submission.field.data_types", "submission.field.integrations",
                "submission.field.dependencies", "submission.field.architecture_info", "submission.field.llm_vendor",
                "submission.field.llm_model", "submission.field.deployment_type", "submission.field.artifacts",
                # Approval fields - view and edit
                "approval.field.status", "approval.field.current_step", "approval.field.approval_notes", "approval.field.step_notes"
            ],
        },
        "business_reviewer": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.invite_vendor",
                "menu.my_vendors", "menu.tickets", "menu.reviews", "menu.compliance_checks",
                "menu.question_library", "menu.submission_requirements", "menu.assessments",
                "menu.audit_trail", "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view"],
            "review_approval": ["reviews.view", "reviews.edit", "reviews.approve", "reviews.reject"],
            "compliance": ["assessments.view"],
            "forms_and_data_fields": [
                # Submission fields - view all, edit business-related
                "submission.field.name", "submission.field.type", "submission.field.category", "submission.field.description",
                "submission.field.use_cases", "submission.field.features", "submission.field.personas", "submission.field.version_info",
                # Approval fields - view and edit
                "approval.field.status", "approval.field.current_step", "approval.field.approval_notes", "approval.field.step_notes"
            ],
        },
        "approver": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.tickets",
                "menu.reviews", "menu.approvals", "menu.audit_trail", "menu.messages",
                "menu.mfa_settings"
            ],
            "agent_management": ["agents.view"],
            "review_approval": ["reviews.view", "approvals.view", "approvals.approve", "approvals.reject"],
            "forms_and_data_fields": [
                # Submission fields - view only
                "submission.field.name", "submission.field.type", "submission.field.category", "submission.field.description",
                "submission.field.version", "submission.field.status", "submission.field.compliance_score", "submission.field.risk_score",
                # Approval fields - view and edit
                "approval.field.status", "approval.field.current_step", "approval.field.approved_by", "approval.field.approval_notes",
                "approval.field.step_status", "approval.field.completed_by", "approval.field.step_notes"
            ],
        },
        "policy_admin": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.tickets",
                "menu.policies", "menu.business_rules", "menu.compliance_checks",
                "menu.question_library", "menu.submission_requirements", "menu.assessments",
                "menu.audit_trail", "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view"],
            "compliance": ["policies.view", "policies.create", "policies.edit", "policies.delete", "assessments.view"],
        },
        "integration_admin": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.tickets",
                "menu.integrations", "menu.webhooks", "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view"],
            "integrations": ["integrations.view", "integrations.create", "integrations.edit", "integrations.delete"],
        },
        "user_admin": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.tickets",
                "menu.users", "menu.messages", "menu.mfa_settings"
            ],
            "agent_management": ["agents.view"],
            "administration": ["users.view", "users.create", "users.edit", "users.delete"],
        },
        "end_user": {
            "menu": [
                "menu.my_actions", "menu.catalog", "menu.marketplace", "menu.messages",
                "menu.mfa_settings"
            ],
            "agent_management": ["agents.view"],
        },
    }
    
    @staticmethod
    async def seed_default_permissions(db: Session) -> Dict[str, int]:
        """Seed default permissions for all roles (platform-wide)
        
        This method ensures all permissions defined in DEFAULT_PERMISSIONS exist
        for all roles. It will:
        - Create missing permissions
        - Update existing permissions if default enabled state changed
        - Always ensure new permissions added to DEFAULT_PERMISSIONS are created
        """
        created_count = 0
        updated_count = 0
        
        # Create permissions for each role and category
        for role in UserRole:
            role_str = role.value
            role_defaults = RolePermissionService.ROLE_DEFAULT_PERMISSIONS.get(role_str, {})
            
            for category, permissions in RolePermissionService.DEFAULT_PERMISSIONS.items():
                for perm_key, (perm_label, perm_desc) in permissions.items():
                    # Check if permission already exists (platform-wide)
                    existing = db.query(RolePermission).filter(
                        RolePermission.tenant_id.is_(None),
                        RolePermission.role == role_str,
                        RolePermission.category == category,
                        RolePermission.permission_key == perm_key
                    ).first()
                    
                    # Determine if this permission should be enabled by default
                    is_enabled = perm_key in role_defaults.get(category, [])
                    
                    if existing:
                        # Update label/description if they changed (for new permissions added to defaults)
                        needs_update = False
                        if existing.permission_label != perm_label:
                            existing.permission_label = perm_label
                            needs_update = True
                        if existing.permission_description != perm_desc:
                            existing.permission_description = perm_desc
                            needs_update = True
                        # Update if default enabled state changed
                        if existing.is_enabled != is_enabled:
                            existing.is_enabled = is_enabled
                            needs_update = True
                        
                        if needs_update:
                            updated_count += 1
                    else:
                        # Create new permission (missing or newly added to DEFAULT_PERMISSIONS)
                        permission = RolePermission(
                            tenant_id=None,  # Platform-wide
                            role=role_str,
                            category=category,
                            permission_key=perm_key,
                            permission_label=perm_label,
                            permission_description=perm_desc,
                            is_enabled=is_enabled,
                        )
                        db.add(permission)
                        created_count += 1
                        logger.debug(f"Created permission: {role_str}.{category}.{perm_key}")
        
        db.commit()
        
        if created_count > 0 or updated_count > 0:
            logger.info(f"Permission seeding completed: {created_count} created, {updated_count} updated")
        
        return {
            "created": created_count,
            "updated": updated_count,
            "total": created_count + updated_count
        }

    @staticmethod
    async def seed_tenant_permissions(db: Session, tenant_id: UUID) -> Dict[str, int]:
        """Seed default permissions for a specific tenant
        
        This copies defaults from the platform-wide permissions or DEFAULT_PERMISSIONS
        to the specific tenant.
        """
        created_count = 0
        
        for role in UserRole:
            role_str = role.value
            role_defaults = RolePermissionService.ROLE_DEFAULT_PERMISSIONS.get(role_str, {})
            
            for category, permissions in RolePermissionService.DEFAULT_PERMISSIONS.items():
                for perm_key, (perm_label, perm_desc) in permissions.items():
                    # Check if permission already exists for this tenant
                    existing = db.query(RolePermission).filter(
                        RolePermission.tenant_id == tenant_id,
                        RolePermission.role == role_str,
                        RolePermission.category == category,
                        RolePermission.permission_key == perm_key
                    ).first()
                    
                    if not existing:
                        # Determine if this permission should be enabled by default
                        is_enabled = perm_key in role_defaults.get(category, [])
                        
                        # Create new tenant-specific permission
                        permission = RolePermission(
                            tenant_id=tenant_id,
                            role=role_str,
                            category=category,
                            permission_key=perm_key,
                            permission_label=perm_label,
                            permission_description=perm_desc,
                            is_enabled=is_enabled,
                        )
                        db.add(permission)
                        created_count += 1
        
        db.commit()
        if created_count > 0:
            logger.info(f"Seeded {created_count} permissions for tenant {tenant_id}")
            
        return {"created": created_count}
