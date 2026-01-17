"""
Generic Workflow Orchestration Service
Orchestrates entity workflows with automatic view generation, business rules, email notifications, and reminders.

This service provides a generic framework where:
- Any entity can be a workflow process
- Views are auto-generated from layouts + permissions
- Business rules are evaluated at each stage
- Email notifications and reminders are sent automatically
- Everything is configuration-driven (no hardcoding)
"""
from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging
import asyncio

from app.models.workflow_config import WorkflowConfiguration, OnboardingRequest
from app.models.form_layout import FormLayout
from app.models.entity_field import EntityPermission, EntityFieldPermission, EntityFieldRegistry
from app.models.custom_field import CustomFieldCatalog
from app.models.business_rule import BusinessRule
from app.models.agentic_agent import AgenticAgent
from app.services.permission_resolution import resolve_field_permissions, get_effective_permission
from app.services.business_rules_engine import BusinessRulesEngine
from app.services.email_service import EmailService
from app.services.layout_type_mapper import get_layout_type_for_stage
from app.services.studio_service import StudioService
from app.models.user import User

logger = logging.getLogger(__name__)


class WorkflowOrchestrationService:
    """
    Generic workflow orchestration service
    
    Orchestrates workflows for any entity with:
    - Automatic view generation (layouts + permissions)
    - Business rule evaluation
    - Email notifications
    - Reminders
    """
    
    def __init__(self, db: Session, tenant_id: UUID):
        """
        Initialize workflow orchestration service
        
        Args:
            db: Database session
            tenant_id: Tenant ID
        """
        self.db = db
        self.tenant_id = tenant_id
        self.rules_engine = BusinessRulesEngine(db, tenant_id)
        self.email_service = EmailService()
        # Load email config from database (Integration API)
        self.email_service.load_config_from_db(db, str(tenant_id))
    
    def get_workflow_for_entity(
        self,
        entity_type: str,  # "agent", "vendor", "assessment", etc.
        entity_data: Dict[str, Any],  # Entity attributes (type, category, risk_level, etc.)
        request_type: Optional[str] = None  # "agent_onboarding_workflow", "vendor_submission_workflow", etc.
    ) -> Optional[WorkflowConfiguration]:
        """
        Determine which workflow configuration to use for an entity
        
        Uses trigger_rules and conditions to match entity to workflow.
        
        Args:
            entity_type: Type of entity (e.g., "agent", "vendor")
            entity_data: Entity attributes for matching
            request_type: Optional request type to filter workflows
        
        Returns:
            Matching WorkflowConfiguration or None
        """
        # Build query
        query = self.db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.tenant_id == self.tenant_id,
            WorkflowConfiguration.status == "active"
        )
        
        if request_type:
            # If request_type provided, match workflows that handle this request type
            # This is a simplified match - in practice, you might have a request_type field
            pass
        
        workflows = query.all()
        
        # Match workflows based on trigger_rules and conditions
        for workflow in workflows:
            if self._matches_workflow(workflow, entity_type, entity_data):
                return workflow
        
        # Return default workflow if exists
        default_workflow = self.db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.tenant_id == self.tenant_id,
            WorkflowConfiguration.is_default == True,
            WorkflowConfiguration.status == "active"
        ).first()
        
        return default_workflow
    
    def _matches_workflow(
        self,
        workflow: WorkflowConfiguration,
        entity_type: str,
        entity_data: Dict[str, Any]
    ) -> bool:
        """Check if entity matches workflow trigger rules and conditions"""
        conditions = workflow.conditions or {}
        trigger_rules = workflow.trigger_rules or {}
        
        # Check entity_type first (if specified in conditions or trigger_rules)
        if conditions.get("entity_types"):
            if entity_type not in conditions["entity_types"]:
                return False
        
        if trigger_rules.get("entity_types"):
            if entity_type not in trigger_rules["entity_types"]:
                return False
        
        # Check conditions
        if conditions:
            match_all = conditions.get("match_all", False)
            matches = []
            
            # Check agent_types (for backward compatibility)
            if "agent_types" in conditions and conditions["agent_types"] is not None:
                entity_type_value = entity_data.get("type") or entity_data.get("agent_type")
                if entity_type_value:
                    matches.append(entity_type_value in conditions["agent_types"])
                else:
                    matches.append(False)
            
            # Check risk_levels
            if "risk_levels" in conditions:
                risk_level = entity_data.get("risk_level") or entity_data.get("risk_score")
                if risk_level:
                    # Convert numeric risk_score to level if needed
                    if isinstance(risk_level, (int, float)):
                        if risk_level >= 80:
                            risk_level = "critical"
                        elif risk_level >= 60:
                            risk_level = "high"
                        elif risk_level >= 40:
                            risk_level = "medium"
                        else:
                            risk_level = "low"
                    matches.append(risk_level in conditions["risk_levels"])
                else:
                    matches.append(False)
            
            # Check categories
            if "categories" in conditions:
                category = entity_data.get("category")
                matches.append(category in conditions["categories"] if category else False)
            
            if matches:
                if match_all:
                    if not all(matches):
                        return False
                else:
                    if not any(matches):
                        return False
        
        # Check trigger_rules (similar logic)
        if trigger_rules:
            match_all = trigger_rules.get("match_all", False)
            matches = []
            
            if "agent_types" in trigger_rules:
                entity_type_value = entity_data.get("type") or entity_data.get("agent_type")
                if entity_type_value:
                    matches.append(entity_type_value in trigger_rules["agent_types"])
            
            if "risk_levels" in trigger_rules:
                risk_level = entity_data.get("risk_level") or entity_data.get("risk_score")
                if risk_level:
                    # Convert numeric risk_score to level if needed
                    if isinstance(risk_level, (int, float)):
                        if risk_level >= 80:
                            risk_level = "critical"
                        elif risk_level >= 60:
                            risk_level = "high"
                        elif risk_level >= 40:
                            risk_level = "medium"
                        else:
                            risk_level = "low"
                    matches.append(risk_level in trigger_rules["risk_levels"])
            
            if matches:
                if match_all:
                    if not all(matches):
                        return False
                else:
                    if not any(matches):
                        return False
        
        return True
    
    def get_layout_for_stage(
        self,
        request_type: str,
        workflow_stage: str,
        agent_type: Optional[str] = None,
        agent_category: Optional[str] = None
    ) -> Optional[FormLayout]:
        """
        Get active layout for a workflow stage using simplified layout types
        
        Maps workflow stages to layout types:
        - submission: new, needs_revision
        - approver: pending_approval, pending_review, in_progress
        - completed: approved, rejected, closed, cancelled
        
        Permissions control what users see based on their role.
        
        Args:
            request_type: Request type (e.g., "agent_onboarding_workflow")
            workflow_stage: Workflow stage (e.g., "new", "pending_approval")
            agent_type: Optional agent type filter
            agent_category: Optional agent category filter
        
        Returns:
            Active FormLayout for the stage or None
        """
        # Map workflow stage to layout type
        layout_type = get_layout_type_for_stage(workflow_stage)
        
        # Try to find layout by layout_type first (new simplified system)
        # NEVER use template layouts for actual workflows
        query = self.db.query(FormLayout).filter(
            FormLayout.tenant_id == self.tenant_id,
            FormLayout.request_type == request_type,
            FormLayout.layout_type == layout_type,
            FormLayout.is_active == True,
            FormLayout.is_template == False
        )
        
        # Filter by agent type/category if provided
        if agent_type:
            query = query.filter(
                or_(
                    FormLayout.agent_type == agent_type,
                    FormLayout.agent_type.is_(None)
                )
            )
        else:
            query = query.filter(FormLayout.agent_type.is_(None))
        
        if agent_category:
            query = query.filter(
                or_(
                    FormLayout.agent_category == agent_category,
                    FormLayout.agent_category.is_(None)
                )
            )
        
        # Prefer default layout
        layout = query.filter(FormLayout.is_default == True).first()
        if not layout:
            layout = query.first()
        
        # Fallback: If no layout_type-based layout found, try workflow_stage (backward compatibility)
        if not layout:
            # NEVER use template layouts for actual workflows
            query = self.db.query(FormLayout).filter(
                FormLayout.tenant_id == self.tenant_id,
                FormLayout.request_type == request_type,
                FormLayout.workflow_stage == workflow_stage,
                FormLayout.is_active == True,
                FormLayout.is_template == False
            )
            
            if agent_type:
                query = query.filter(
                    or_(
                        FormLayout.agent_type == agent_type,
                        FormLayout.agent_type.is_(None)
                    )
                )
            else:
                query = query.filter(FormLayout.agent_type.is_(None))
            
            if agent_category:
                query = query.filter(
                    or_(
                        FormLayout.agent_category == agent_category,
                        FormLayout.agent_category.is_(None)
                    )
                )
            
            layout = query.filter(FormLayout.is_default == True).first()
            if not layout:
                layout = query.first()
        
        return layout
    
    def generate_view_structure(
        self,
        entity_name: str,
        request_type: str,
        workflow_stage: str,
        user_role: str,
        agent_type: Optional[str] = None,
        agent_category: Optional[str] = None,
        entity_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Generate view structure (tabs/sections) automatically from layout + permissions
        
        This is the core of automatic view generation - no hardcoding!
        
        If layout is empty or has no sections, falls back to loading all entity fields
        from EntityFieldRegistry to ensure approvers always see entity details.
        
        Args:
            entity_name: Entity name (e.g., "agents", "vendors")
            request_type: Request type
            workflow_stage: Current workflow stage
            user_role: User's role
            agent_type: Optional agent type
            agent_category: Optional agent category
        
        Returns:
            View structure with tabs, sections, and fields with permissions
        """
        # Get layout for this stage
        layout = self.get_layout_for_stage(request_type, workflow_stage, agent_type, agent_category)
        
        tabs = []
        sections = []
        all_fields = []
        
        # If layout exists and has sections, use them
        if layout and layout.sections:
            logger.info(f"Processing layout {layout.id} with {len(layout.sections)} sections for role {user_role}")
            for section in layout.sections:
                # Resolve permissions for each field in section
                section_fields = []
                section_id = section.get("id", "unknown")
                section_title = section.get("title", "Unknown")
                logger.debug(f"Processing section {section_id} ({section_title}) with {len(section.get('fields', []))} fields")
                
                for field_name in (section.get("fields", []) or []):
                    # Determine field source and get metadata
                    field_registry = None
                    field_source = "entity"
                    field_label = field_name.replace("_", " ").title()
                    field_type = "text"
                    is_required = False
                    
                    # First, try to find in EntityFieldRegistry (entity fields)
                    field_registry = self.db.query(EntityFieldRegistry).filter(
                        or_(
                            EntityFieldRegistry.tenant_id == self.tenant_id,
                            EntityFieldRegistry.tenant_id.is_(None)
                        ),
                        EntityFieldRegistry.entity_name == entity_name,
                        EntityFieldRegistry.field_name == field_name,
                        EntityFieldRegistry.is_enabled == True
                    ).first()
                    
                    if field_registry:
                        field_label = field_registry.field_label
                        field_type = field_registry.field_type_display or "text"
                        is_required = field_registry.is_required or False
                        field_source = "entity"
                    else:
                        # Check if it's a submission requirement
                        from app.models.submission_requirement import SubmissionRequirement
                        requirements = self.db.query(SubmissionRequirement).filter(
                            SubmissionRequirement.tenant_id == self.tenant_id,
                            SubmissionRequirement.is_active == True,
                            SubmissionRequirement.is_enabled == True
                        ).all()
                        
                        # Find requirement with matching field_name (computed from catalog_id)
                        matching_req = None
                        for req in requirements:
                            if req.field_name == field_name:
                                matching_req = req
                                break
                        
                        if matching_req:
                            field_label = matching_req.label
                            field_type = matching_req.field_type or "text"
                            is_required = matching_req.is_required or False
                            field_source = "submission_requirement"
                        else:
                            # Check if it's a custom field
                            from app.models.custom_field import CustomFieldCatalog
                            custom_field = self.db.query(CustomFieldCatalog).filter(
                                CustomFieldCatalog.tenant_id == self.tenant_id,
                                CustomFieldCatalog.field_name == field_name,
                                CustomFieldCatalog.is_enabled == True
                            ).first()
                            
                            if custom_field:
                                field_label = custom_field.field_label or field_name.replace("_", " ").title()
                                field_type = custom_field.field_type or "text"
                                is_required = custom_field.is_required or False
                                field_source = "custom_field"
                    
                    # Resolve permissions using hierarchical system
                    custom_field_id = None
                    if field_source == "custom_field":
                        # Get custom field ID for permission resolution
                        from app.models.custom_field import CustomFieldCatalog
                        custom_field = self.db.query(CustomFieldCatalog).filter(
                            CustomFieldCatalog.tenant_id == self.tenant_id,
                            CustomFieldCatalog.field_name == field_name,
                            CustomFieldCatalog.is_enabled == True
                        ).first()
                        if custom_field:
                            custom_field_id = custom_field.id
                    
                    permissions = resolve_field_permissions(
                        db=self.db,
                        tenant_id=self.tenant_id,
                        entity_name=entity_name if field_source == "entity" else None,
                        field_name=field_name,
                        field_source=field_source,
                        custom_field_id=custom_field_id,
                        request_type=request_type,
                        workflow_stage=workflow_stage,
                        role=user_role
                    )
                    
                    role_perms = permissions.get(user_role, {})
                    can_edit = role_perms.get("edit", False)
                    
                    # For approvers, ALWAYS show fields from layout (they need to see what was submitted)
                    # Override can_view for approvers regardless of permission resolution
                    # This ensures all submitted fields are visible to approvers
                    is_approver_role = user_role in ["tenant_admin", "platform_admin", "approver", "business_reviewer", 
                                                    "security_reviewer", "compliance_reviewer", "technical_reviewer"]
                    if is_approver_role:
                        # Force can_view=True for all approvers - they need to see everything that was submitted
                        can_view = True
                        logger.debug(f"Forcing can_view=True for approver role {user_role} on field {field_name} (from layout)")
                    else:
                        # For non-approvers, use permission resolution result
                        can_view = role_perms.get("view")
                        if can_view is None:
                            # If no explicit permission, default to False for non-approvers
                            can_view = False
                        else:
                            can_view = bool(can_view)
                    
                    # Only include fields user can view
                    if can_view:
                        section_fields.append({
                            "field_name": field_name,
                            "label": field_label,
                            "can_view": can_view,
                            "can_edit": can_edit,
                            "is_required": is_required,
                            "field_type": field_type
                        })
                        all_fields.append(field_name)
                        logger.debug(f"Including field {field_name} in section {section_id}")
                    else:
                        logger.debug(f"Filtering out field {field_name} from section {section_id} - can_view={can_view} for role {user_role}")
                
                # Only include sections with visible fields
                if section_fields:
                    logger.info(f"Adding section {section_id} with {len(section_fields)} fields")
                    section_data = {
                        "id": section.get("id"),
                        "title": section.get("title"),
                        "order": section.get("order", 0),
                        "description": section.get("description"),
                        "fields": section_fields
                    }
                    sections.append(section_data)
                    
                    # Sections become tabs
                    tabs.append({
                        "id": section.get("id"),
                        "label": section.get("title"),
                        "order": section.get("order", 0)
                    })
                else:
                    logger.warning(f"Skipping section {section_id} ({section_title}) - no visible fields (all {len(section.get('fields', []))} fields filtered out)")
        
        # If no layout or no sections, fall back to loading all entity fields
        if not sections:
            logger.info(f"No layout sections found for {entity_name} at stage {workflow_stage}, loading all entity fields")
            
            # Load all enabled fields for this entity from EntityFieldRegistry
            entity_fields = self.db.query(EntityFieldRegistry).filter(
                or_(
                    EntityFieldRegistry.tenant_id == self.tenant_id,
                    EntityFieldRegistry.tenant_id.is_(None)
                ),
                EntityFieldRegistry.entity_name == entity_name,
                EntityFieldRegistry.is_enabled == True,
                EntityFieldRegistry.is_visible == True,
                EntityFieldRegistry.is_system == False  # Exclude system fields like id, created_at, etc.
            ).order_by(EntityFieldRegistry.display_order, EntityFieldRegistry.field_label).all()
            
            # Group fields by category or create default sections
            fields_by_category: Dict[str, List[EntityFieldRegistry]] = {}
            uncategorized_fields = []
            
            for field in entity_fields:
                # Resolve permissions
                permissions = resolve_field_permissions(
                    db=self.db,
                    tenant_id=self.tenant_id,
                    entity_name=entity_name,
                    field_name=field.field_name,
                    field_source="entity",
                    request_type=request_type,
                    workflow_stage=workflow_stage,
                    role=user_role
                )
                
                role_perms = permissions.get(user_role, {})
                # Default to True for approvers/tenant_admins if no explicit permission is set
                # This ensures all submitted fields are visible to approvers
                can_view = role_perms.get("view")
                if can_view is None:
                    # If no explicit permission, default based on role
                    # Approvers and admins should see all fields by default
                    if user_role in ["tenant_admin", "platform_admin", "approver", "business_reviewer", 
                                    "security_reviewer", "compliance_reviewer", "technical_reviewer"]:
                        can_view = True
                    else:
                        can_view = False
                else:
                    can_view = bool(can_view)
                
                can_edit = role_perms.get("edit", False)
                
                # Only include fields user can view
                if can_view:
                    category = field.entity_category or "general"
                    if category not in fields_by_category:
                        fields_by_category[category] = []
                    fields_by_category[category].append(field)
                    all_fields.append(field.field_name)
            
            # Create sections from categorized fields
            order = 0
            for category, category_fields in fields_by_category.items():
                section_fields = []
                for field in category_fields:
                    permissions = resolve_field_permissions(
                        db=self.db,
                        tenant_id=self.tenant_id,
                        entity_name=entity_name,
                        field_name=field.field_name,
                        field_source="entity",
                        request_type=request_type,
                        workflow_stage=workflow_stage,
                        role=user_role
                    )
                    role_perms = permissions.get(user_role, {})
                    # Default to True for approvers/tenant_admins if no explicit permission is set
                    can_view = role_perms.get("view")
                    if can_view is None:
                        # If no explicit permission, default based on role
                        if user_role in ["tenant_admin", "platform_admin", "approver", "business_reviewer", 
                                        "security_reviewer", "compliance_reviewer", "technical_reviewer"]:
                            can_view = True
                        else:
                            can_view = False
                    else:
                        can_view = bool(can_view)
                    
                    can_edit = role_perms.get("edit", False)
                    
                    section_fields.append({
                        "field_name": field.field_name,
                        "label": field.field_label,
                        "can_view": can_view,
                        "can_edit": can_edit,
                        "is_required": field.is_required,
                        "field_type": field.field_type_display
                    })
                
                if section_fields:
                    section_id = f"section_{category}"
                    section_title = category.replace("_", " ").title()
                    
                    sections.append({
                        "id": section_id,
                        "title": section_title,
                        "order": order,
                        "description": f"{section_title} fields for {entity_name}",
                        "fields": section_fields
                    })
                    
                    tabs.append({
                        "id": section_id,
                        "label": section_title,
                        "order": order
                    })
                    order += 1
        
        # Sort tabs and sections by order
        tabs.sort(key=lambda x: x["order"])
        sections.sort(key=lambda x: x["order"])
        
        # Generate connection diagram for agents if entity_id is provided
        connection_diagram = None
        if entity_name == "agents" and entity_id:
            try:
                from app.models.agent import Agent, AgentMetadata
                from app.models.agent_connection import AgentConnection
                from app.services.connection_diagram_service import ConnectionDiagramService
                
                agent = self.db.query(Agent).filter(Agent.id == entity_id).first()
                if agent:
                    connections_dict = []
                    
                    # First, try to get connections from agent_connections table
                    connections = self.db.query(AgentConnection).filter(
                        AgentConnection.agent_id == entity_id
                    ).all()
                    
                    if connections:
                        # Convert connections to dict format
                        for conn in connections:
                            connections_dict.append({
                                "name": conn.name or "",
                                "app_name": conn.app_name or "",
                                "app_type": conn.app_type or "",
                                "data_flow_direction": conn.data_flow_direction or "bidirectional",
                                "source_system": conn.source_system or "Agent",
                                "destination_system": conn.destination_system or conn.app_name or conn.name or "Unknown"
                            })
                    else:
                        # Fallback: Check integrations in AgentMetadata
                        metadata = self.db.query(AgentMetadata).filter(
                            AgentMetadata.agent_id == entity_id
                        ).first()
                        
                        if metadata and metadata.integrations:
                            # Convert integrations to connection format
                            integrations = metadata.integrations
                            if isinstance(integrations, list):
                                for integration in integrations:
                                    if isinstance(integration, dict):
                                        connections_dict.append({
                                            "name": integration.get("name") or integration.get("app_name") or "Integration",
                                            "app_name": integration.get("app_name") or integration.get("name") or "Unknown",
                                            "app_type": integration.get("app_type") or integration.get("type") or "",
                                            "data_flow_direction": integration.get("data_flow_direction") or integration.get("direction") or "bidirectional",
                                            "source_system": integration.get("source_system") or "Agent",
                                            "destination_system": integration.get("destination_system") or integration.get("app_name") or integration.get("name") or "Unknown"
                                        })
                    
                    # Generate diagram if we have connections, or generate a basic diagram showing just the agent
                    if connections_dict:
                        connection_diagram = ConnectionDiagramService.generate_mermaid_diagram(
                            agent.name or "Agent",
                            connections_dict
                        )
                    else:
                        # Generate a basic diagram showing just the agent (no connections)
                        connection_diagram = f"""graph LR
    AGENT["🤖 Agent({agent.name or 'Agent'})"]
    style AGENT fill:#3b82f6,stroke:#1e40af,stroke-width:2px,color:#fff"""
                    
                    # Always add Diagram tab for agents (even if no connections, show basic diagram)
                    diagram_tab_exists = any(tab.get("id") == "diagram" for tab in tabs)
                    if not diagram_tab_exists and connection_diagram:
                        # Find the highest order to place diagram after other tabs
                        max_order = max([tab.get("order", 0) for tab in tabs], default=-1)
                        
                        tabs.append({
                            "id": "diagram",
                            "label": "Diagram",
                            "order": max_order + 1,
                            "icon": "network"
                        })
                        
                        sections.append({
                            "id": "diagram",
                            "title": "Connection Diagram",
                            "order": max_order + 1,
                            "description": "Visual representation of agent connections" if connections_dict else "Agent architecture diagram",
                            "fields": [],
                            "connection_diagram": connection_diagram
                        })
            except Exception as e:
                logger.warning(f"Failed to generate connection diagram: {e}", exc_info=True)
                # Don't fail the entire request if diagram generation fails
        
        return {
            "layout_id": str(layout.id) if layout else None,
            "layout_name": layout.name if layout else "Default Entity View",
            "tabs": tabs,
            "sections": sections,
            "fields": all_fields,
            "workflow_stage": workflow_stage,
            "request_type": request_type,
            "connection_diagram": connection_diagram
        }
    
    def evaluate_business_rules_for_stage(
        self,
        entity_type: str,
        entity_id: UUID,
        entity_data: Dict[str, Any],
        request_type: str,
        workflow_stage: str,
        user: User,
        auto_execute: bool = True
    ) -> Dict[str, Any]:
        """
        Evaluate business rules for a workflow stage
        
        Args:
            entity_type: Entity type (e.g., "agent", "vendor")
            entity_id: Entity ID
            entity_data: Entity data
            request_type: Request type
            workflow_stage: Current workflow stage
            user: Current user
            auto_execute: Whether to automatically execute actions
        
        Returns:
            Rule evaluation results
        """
        # Build context for rule evaluation
        context = {
            "entity": {
                "id": str(entity_id),
                "type": entity_type,
                **entity_data
            },
            "workflow": {
                "request_type": request_type,
                "workflow_stage": workflow_stage
            },
            "user": {
                "id": str(user.id),
                "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
                "email": user.email,
                "department": getattr(user, 'department', None),
                "business_unit": getattr(user, 'business_unit', None)
            },
            "tenant": {
                "id": str(self.tenant_id)
            }
        }
        
        # Evaluate rules
        rule_results = self.rules_engine.evaluate_rules(
            context=context,
            entity_type=entity_type,
            screen=f"{request_type}_{workflow_stage}",  # e.g., "agent_onboarding_workflow_pending_approval"
            rule_type="workflow"
        )
        
        # Execute actions if auto_execute
        action_results = {}
        if rule_results and auto_execute:
            action_results = self.rules_engine.execute_actions(
                rule_results,
                context,
                auto_execute=auto_execute
            )
        
        return {
            "matched_rules": len(rule_results),
            "rule_results": rule_results,
            "action_results": action_results
        }
    
    async def send_stage_notifications(
        self,
        workflow_config: WorkflowConfiguration,
        workflow_stage: str,
        entity_type: str,
        entity_id: UUID,
        entity_data: Dict[str, Any],
        user: User,
        recipients_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send email notifications for a workflow stage
        
        Args:
            workflow_config: Workflow configuration
            workflow_stage: Current workflow stage
            entity_type: Entity type
            entity_id: Entity ID
            entity_data: Entity data
            user: Current user (triggering the stage)
            recipients_config: Optional custom recipients config (overrides stage_settings)
        
        Returns:
            Notification results
        """
        # Get email notifications config from workflow stage settings
        stage_settings = self._get_stage_settings(workflow_config, workflow_stage)
        email_config = stage_settings.get("email_notifications", {}) if stage_settings else {}
        
        # Override with custom config if provided
        if recipients_config:
            email_config = {**email_config, **recipients_config}
        
        if not email_config.get("enabled", False):
            return {"sent": False, "reason": "Email notifications disabled for this stage"}
        
        # Resolve recipients
        recipients = self._resolve_email_recipients(
            email_config.get("recipients", []),
            entity_data,
            user,
            workflow_stage
        )
        
        if not recipients:
            return {"sent": False, "reason": "No valid recipients found"}
        
        # Build email content
        subject = email_config.get("subject", f"{entity_type.title()} - {workflow_stage.replace('_', ' ').title()}")
        subject = self._replace_variables(subject, entity_data, user, workflow_stage)
        
        html_body = self._build_email_body(
            email_config,
            entity_type,
            entity_id,
            entity_data,
            user,
            workflow_stage
        )
        
        # Send emails
        results = []
        for recipient in recipients:
            try:
                sent, _ = await self.email_service.send_email(
                    to_email=recipient["email"],
                    subject=subject,
                    html_body=html_body,
                    text_body=html_body.replace("<br>", "\n").replace("<p>", "").replace("</p>", "\n")
                )
                results.append({
                    "recipient": recipient["email"],
                    "sent": sent,
                    "role": recipient.get("role")
                })
            except Exception as e:
                logger.error(f"Failed to send email to {recipient['email']}: {e}", exc_info=True)
                results.append({
                    "recipient": recipient["email"],
                    "sent": False,
                    "error": str(e)
                })
        
        return {
            "sent": any(r["sent"] for r in results),
            "results": results
        }
    
    def schedule_reminders(
        self,
        workflow_config: WorkflowConfiguration,
        workflow_stage: str,
        entity_type: str,
        entity_id: UUID,
        entity_data: Dict[str, Any],
        user: User,
        request_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Schedule reminders for a workflow stage
        
        Args:
            workflow_config: Workflow configuration
            workflow_stage: Current workflow stage
            entity_type: Entity type
            entity_id: Entity ID
            entity_data: Entity data
            user: Current user
            request_type: Request type (for reminder storage)
        
        Returns:
            List of scheduled reminders
        """
        # Get reminders config from workflow stage settings
        stage_settings = self._get_stage_settings(workflow_config, workflow_stage)
        email_config = stage_settings.get("email_notifications", {}) if stage_settings else {}
        reminder_days = email_config.get("reminders", [])
        
        if not reminder_days:
            return []
        
        # Use ReminderService to store reminders in database
        try:
            from app.services.reminder_service import ReminderService
            reminder_service = ReminderService(self.db, self.tenant_id)
            
            reminders = reminder_service.schedule_reminders(
                entity_type=entity_type,
                entity_id=entity_id,
                request_type=request_type or "unknown",
                workflow_stage=workflow_stage,
                reminder_days=reminder_days,
                recipients=email_config.get("recipients", []),
                scheduled_by=user.id
            )
            
            # Return reminder info for response
            return [
                {
                    "id": str(r.id),
                    "entity_type": r.entity_type,
                    "entity_id": str(r.entity_id),
                    "workflow_stage": r.workflow_stage,
                    "reminder_days": r.reminder_days,
                    "reminder_date": r.reminder_date.isoformat(),
                    "recipients": r.recipients,
                    "scheduled_by": str(r.scheduled_by) if r.scheduled_by else None
                }
                for r in reminders
            ]
        except Exception as e:
            logger.error(f"Error scheduling reminders: {e}", exc_info=True)
            # Fallback to returning reminder info without storing
            return [
                {
                    "entity_type": entity_type,
                    "entity_id": str(entity_id),
                    "workflow_stage": workflow_stage,
                    "reminder_days": days,
                    "reminder_date": (datetime.utcnow() + timedelta(days=days)).isoformat(),
                    "recipients": email_config.get("recipients", []),
                    "scheduled_by": str(user.id),
                    "error": "Failed to store reminder in database"
                }
                for days in reminder_days
            ]
    
    def _get_stage_settings(
        self,
        workflow_config: WorkflowConfiguration,
        workflow_stage: str
    ) -> Optional[Dict[str, Any]]:
        """Get stage settings from workflow configuration"""
        workflow_steps = workflow_config.workflow_steps or []
        
        for step in workflow_steps:
            if step.get("workflow_stage") == workflow_stage:
                return step.get("stage_settings", {})
        
        return None
    
    def _resolve_email_recipients(
        self,
        recipients_config: List[str],
        entity_data: Dict[str, Any],
        user: User,
        workflow_stage: str
    ) -> List[Dict[str, str]]:
        """
        Resolve email recipients from configuration
        
        Recipients can be:
        - "user" - Current user
        - "vendor" - Vendor user (if applicable)
        - "next_approver" - Next approver in workflow
        - "tenant_admin" - Tenant admin
        - Email addresses
        - Role names (e.g., "security_reviewer")
        """
        recipients = []
        
        for recipient in recipients_config:
            if recipient == "user":
                if user.email:
                    recipients.append({"email": user.email, "role": "user"})
            
            elif recipient == "vendor":
                # Get vendor user from entity_data
                vendor_email = entity_data.get("vendor_email") or entity_data.get("contact_email")
                if vendor_email:
                    recipients.append({"email": vendor_email, "role": "vendor"})
            
            elif recipient == "next_approver":
                # TODO: Determine next approver from workflow configuration
                # For now, get tenant admin
                tenant_admin = self.db.query(User).filter(
                    User.tenant_id == self.tenant_id,
                    User.role == "tenant_admin"
                ).first()
                if tenant_admin and tenant_admin.email:
                    recipients.append({"email": tenant_admin.email, "role": "next_approver"})
            
            elif recipient == "tenant_admin":
                tenant_admin = self.db.query(User).filter(
                    User.tenant_id == self.tenant_id,
                    User.role == "tenant_admin"
                ).first()
                if tenant_admin and tenant_admin.email:
                    recipients.append({"email": tenant_admin.email, "role": "tenant_admin"})
            
            elif "@" in recipient:
                # Direct email address
                recipients.append({"email": recipient, "role": "custom"})
            
            else:
                # Role name - get users with this role
                role_users = self.db.query(User).filter(
                    User.tenant_id == self.tenant_id,
                    User.role == recipient
                ).all()
                for role_user in role_users:
                    if role_user.email:
                        recipients.append({"email": role_user.email, "role": recipient})
        
        # Deduplicate by email
        seen = set()
        unique_recipients = []
        for recipient in recipients:
            if recipient["email"] not in seen:
                seen.add(recipient["email"])
                unique_recipients.append(recipient)
        
        return unique_recipients
    
    def _replace_variables(
        self,
        text: str,
        entity_data: Dict[str, Any],
        user: User,
        workflow_stage: str
    ) -> str:
        """Replace variables in text (e.g., {{entity.name}}, {{user.email}})"""
        # Simple variable replacement
        text = text.replace("{{entity.name}}", entity_data.get("name", "Entity"))
        text = text.replace("{{entity.type}}", entity_data.get("type", ""))
        text = text.replace("{{user.email}}", user.email or "")
        text = text.replace("{{workflow_stage}}", workflow_stage.replace("_", " ").title())
        
        return text
    
    def _build_email_body(
        self,
        email_config: Dict[str, Any],
        entity_type: str,
        entity_id: UUID,
        entity_data: Dict[str, Any],
        user: User,
        workflow_stage: str
    ) -> str:
        """Build HTML email body"""
        template = email_config.get("template", "default")
        
        if template == "default":
            body = f"""
            <html>
            <body>
                <h2>{entity_type.title()} - {workflow_stage.replace('_', ' ').title()}</h2>
                <p>Entity: <strong>{{{{entity.name}}}}</strong></p>
                <p>Stage: <strong>{workflow_stage.replace('_', ' ').title()}</strong></p>
                <p>Triggered by: {user.email}</p>
                <p>Please review and take appropriate action.</p>
            </body>
            </html>
            """
        else:
            body = email_config.get("body", "")
        
        # Replace variables
        body = self._replace_variables(body, entity_data, user, workflow_stage)
        
        return body
    
    def transition_to_stage(
        self,
        entity_type: str,
        entity_id: UUID,
        entity_data: Dict[str, Any],
        request_type: str,
        current_stage: str,
        target_stage: str,
        user: User,
        transition_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Transition entity to a new workflow stage
        
        This orchestrates the entire transition:
        1. Evaluate business rules
        2. Validate transition
        3. Update entity state
        4. Send notifications
        5. Schedule reminders
        6. Return new view structure
        
        Args:
            entity_type: Entity type
            entity_id: Entity ID
            entity_data: Entity data
            request_type: Request type
            current_stage: Current workflow stage
            target_stage: Target workflow stage
            user: User making the transition
            transition_data: Optional transition data (approval notes, etc.)
        
        Returns:
            Transition results including new view structure
        """
        # Get workflow configuration
        workflow_config = self.get_workflow_for_entity(entity_type, entity_data, request_type)
        
        if not workflow_config:
            return {
                "success": False,
                "error": "No workflow configuration found"
            }
        
        # Evaluate business rules before transition
        rule_results = self.evaluate_business_rules_for_stage(
            entity_type=entity_type,
            entity_id=entity_id,
            entity_data=entity_data,
            request_type=request_type,
            workflow_stage=current_stage,
            user=user,
            auto_execute=True
        )
        
        # TODO: Update entity state to target_stage
        # This would update the entity's workflow_stage field
        
        # Send notifications for new stage
        notification_results = {}
        try:
            # Run async notification in background
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Schedule in background
                asyncio.create_task(
                    self.send_stage_notifications(
                        workflow_config,
                        target_stage,
                        entity_type,
                        entity_id,
                        entity_data,
                        user
                    )
                )
            else:
                notification_results = asyncio.run(
                    self.send_stage_notifications(
                        workflow_config,
                        target_stage,
                        entity_type,
                        entity_id,
                        entity_data,
                        user
                    )
                )
        except Exception as e:
            logger.error(f"Error sending notifications: {e}", exc_info=True)
            notification_results = {"error": str(e)}
        
        # Schedule reminders
        reminders = self.schedule_reminders(
            workflow_config,
            target_stage,
            entity_type,
            entity_id,
            entity_data,
            user,
            request_type=request_type
        )
        
        # Generate new view structure for target stage
        view_structure = self.generate_view_structure(
            entity_name=entity_type + "s",  # Pluralize (agents, vendors, etc.)
            request_type=request_type,
            workflow_stage=target_stage,
            user_role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            agent_type=entity_data.get("type"),
            agent_category=entity_data.get("category")
        )
        
        return {
            "success": True,
            "current_stage": current_stage,
            "target_stage": target_stage,
            "rule_results": rule_results,
            "notifications": notification_results,
            "reminders": reminders,
            "view_structure": view_structure
        }

