"""
Entity Field Discovery Service
Auto-discovers fields from all SQLAlchemy models and registers them in EntityFieldRegistry
"""
from typing import List, Dict, Any, Optional
from sqlalchemy import inspect, String, Integer, Boolean, DateTime, Text, JSON, Date, Numeric, Float
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Session
from sqlalchemy.orm import DeclarativeBase
from app.core.database import Base
from app.models.entity_field import EntityFieldRegistry, EntityPermission
# Import all models to ensure they're registered with Base.metadata
# This is done via __init__.py imports, so we don't need to import here
# The discovery service uses Base.metadata.tables which includes all registered models
import logging
from datetime import datetime
from uuid import UUID

logger = logging.getLogger(__name__)

# Entity categorization mapping
ENTITY_CATEGORIES = {
    # Core Platform
    "users": "core",
    "tenants": "core",
    "vendors": "core",
    "agents": "core",
    "agent_metadata": "core",
    "agent_artifacts": "core",
    "agent_connections": "core",
    
    # Compliance & Security
    "compliance_frameworks": "compliance",
    "framework_rules": "compliance",
    "framework_risks": "compliance",
    "policies": "compliance",
    "compliance_checks": "compliance",
    "submission_requirements": "compliance",
    "submission_requirement_responses": "compliance",
    "security_incidents": "security",
    "security_alerts": "security",
    "security_monitoring_configs": "security",
    
    # Assessments
    "assessments": "assessment",
    "assessment_questions": "assessment",
    "assessment_templates": "assessment",
    "assessment_schedules": "assessment",
    "assessment_assignments": "assessment",
    "question_library": "assessment",
    
    # Workflows
    "workflow_configurations": "workflow",
    "onboarding_requests": "workflow",
    "approval_workflows": "workflow",
    "approval_instances": "workflow",
    "approval_steps": "workflow",
    
    # Forms & Fields
    "form_layouts": "form",
    "form_field_access": "form",
    "custom_field_catalog": "form",
    "entity_field_registry": "form",
    
    # Integrations
    "integrations": "integration",
    "webhooks": "integration",
    "api_tokens": "integration",
    
    # And more...
}


# Entity user level mapping: which entities are exposed to business users vs advanced users
ENTITY_USER_LEVELS = {
    # Business Entities (Recommended for form design)
    "agents": "business",
    "vendors": "business",
    "users": "business",
    "submission_requirements": "business",
    "assessments": "business",
    "security_incidents": "business",
    
    # Advanced Entities
    "agent_metadata": "advanced",
    "agent_artifacts": "advanced",
    "agent_connections": "advanced",
    "compliance_frameworks": "advanced",
    "framework_rules": "advanced",
    "policies": "advanced",
    "onboarding_requests": "advanced",
    "approval_workflows": "advanced",
    "form_layouts": "advanced",
    "integrations": "advanced",
    "webhooks": "advanced",
    "api_tokens": "advanced",
}


# Field type mapping: SQLAlchemy type -> Display type
FIELD_TYPE_MAPPING = {
    String: "text",
    Text: "textarea",
    Integer: "number",
    Float: "number",
    Numeric: "number",
    Boolean: "boolean",
    DateTime: "date",
    Date: "date",
    JSON: "json",
    PostgresUUID: "text",  # UUID displayed as text
}

# System fields that should be marked as system fields
SYSTEM_FIELDS = {"id", "created_at", "updated_at", "created_by", "updated_by", "tenant_id"}

# Special field types that should be preserved during sync
# These fields have custom rendering logic and should not be overwritten
SPECIAL_FIELD_TYPES = {
    "dependent_select", "llm_vendor", "llm_model", 
    "mermaid_diagram", "architecture_diagram", "visualization",
    "file_upload", "external_link", "rich_text"
}

# Field name to special field type mapping for known special fields
# These are fields that should always have their special type preserved
SPECIAL_FIELD_NAME_MAPPING = {
    "llm_vendor": "select",  # Should be select with options
    "llm_model": "dependent_select",  # Should be dependent_select
    "connection_diagram": "mermaid_diagram",
    "architecture_diagram": "architecture_diagram",
    "data_sharing_scope": "json",  # Special JSON field with custom rendering
    "data_usage_purpose": "textarea",
    "data_types": "json",  # Special JSON field with custom rendering
    "regions": "json",  # Special JSON field with custom rendering
}



def get_entity_label(entity_name: str) -> str:
    """Convert entity name to human-readable label"""
    # Convert snake_case to Title Case
    return " ".join(word.capitalize() for word in entity_name.split("_"))


def get_field_label(field_name: str) -> str:
    """Convert field name to human-readable label"""
    # Convert snake_case to Title Case
    return " ".join(word.capitalize() for word in field_name.split("_"))


def get_field_display_type(sqlalchemy_type) -> str:
    """Map SQLAlchemy type to display type"""
    # Check JSON type first (needs special handling)
    # SQLAlchemy JSON type can be checked by class name, isinstance, or type name string
    type_name = type(sqlalchemy_type).__name__
    if type_name == "JSON" or isinstance(sqlalchemy_type, JSON):
        return "json"
    
    # Also check if the type string contains "JSON" (for dialect-specific JSON types)
    type_str = str(sqlalchemy_type)
    if "JSON" in type_str.upper() or "jsonb" in type_str.lower():
        return "json"
    
    # Check other types
    for sa_type, display_type in FIELD_TYPE_MAPPING.items():
        if sa_type == JSON:  # Skip JSON as we already handled it
            continue
        if isinstance(sqlalchemy_type, sa_type):
            return display_type
    
    return "text"  # Default


def is_system_field(field_name: str) -> bool:
    """Check if field is a system field"""
    return field_name in SYSTEM_FIELDS


def discover_entity_fields(entity_class, entity_name: str) -> List[Dict[str, Any]]:
    """Discover all fields from a SQLAlchemy model class"""
    fields = []
    
    # Get table name
    table_name = entity_class.__tablename__ if hasattr(entity_class, '__tablename__') else entity_name
    
    # Inspect the model
    mapper = inspect(entity_class)
    
    for column in mapper.columns:
        is_fk = len(column.foreign_keys) > 0
        
        field_info = {
            "field_name": column.name,
            "field_label": get_field_label(column.name),
            "field_type": get_field_display_type(column.type),  # Use display type for field_type (matches CustomFieldCatalog pattern)
            "field_type_display": get_field_display_type(column.type),
            "is_nullable": column.nullable,
            "is_primary_key": column.primary_key,
            "is_foreign_key": is_fk,
            "foreign_key_table": None,
            "max_length": getattr(column.type, 'length', None),
            "is_system": is_system_field(column.name),
            "is_auto_discovered": True,
            "is_custom": False,
        }
        
        # Get foreign key table if applicable
        if column.foreign_keys:
            fk = list(column.foreign_keys)[0]
            if hasattr(fk, 'column'):
                field_info["foreign_key_table"] = fk.column.table.name
        
        fields.append(field_info)
    
    return fields


def discover_all_entities() -> Dict[str, Dict[str, Any]]:
    """Discover all entities and their fields from Base.metadata"""
    entities = {}
    
    for table_name, table in Base.metadata.tables.items():
        # Skip alembic version table
        if table_name == "alembic_version":
            continue
        
        # Get entity class from table
        entity_class = None
        for mapper in Base.registry.mappers:
            if mapper.class_.__tablename__ == table_name:
                entity_class = mapper.class_
                break
        
        if not entity_class:
            logger.warning(f"Could not find model class for table: {table_name}")
            continue
        
        # Discover fields
        fields = discover_entity_fields(entity_class, table_name)
        
        entities[table_name] = {
            "entity_name": table_name,
            "entity_label": get_entity_label(table_name),
            "entity_category": ENTITY_CATEGORIES.get(table_name, "other"),
            "fields": fields,
            "entity_class": entity_class,
        }
    
    return entities


def sync_entity_fields(
    db: Session,
    tenant_id: Optional[UUID] = None,
    entity_names: Optional[List[str]] = None,
    created_by: Optional[UUID] = None
) -> Dict[str, Any]:
    """Sync discovered fields to EntityFieldRegistry
    
    Args:
        db: Database session
        tenant_id: Tenant ID (None for platform-wide)
        entity_names: Optional list of entity names to sync (all if None)
        created_by: User ID who triggered sync
    
    Returns:
        Dictionary with sync results
    """
    logger.info(f"Starting entity field discovery sync (tenant_id={tenant_id})")
    
    # Discover all entities
    discovered_entities = discover_all_entities()
    
    # Filter by entity_names if provided
    if entity_names:
        discovered_entities = {
            name: data for name, data in discovered_entities.items()
            if name in entity_names
        }
    
    results = {
        "entities_processed": 0,
        "fields_discovered": 0,
        "fields_created": 0,
        "fields_updated": 0,
        "entities": {}
    }
    
    for entity_name, entity_data in discovered_entities.items():
        entity_results = {
            "fields_discovered": len(entity_data["fields"]),
            "fields_created": 0,
            "fields_updated": 0,
        }
        
        # Create or update entity permission baseline
        entity_permission = db.query(EntityPermission).filter(
            EntityPermission.tenant_id == tenant_id,
            EntityPermission.entity_name == entity_name
        ).first()
        
        if not entity_permission:
            entity_permission = EntityPermission(
                tenant_id=tenant_id,
                entity_name=entity_name,
                entity_label=entity_data["entity_label"],
                entity_category=entity_data["entity_category"],
                role_permissions={},
                is_active=True,
                created_by=created_by
            )
            db.add(entity_permission)
            logger.info(f"Created entity permission baseline for {entity_name}")
        else:
            # Update entity label/category if changed
            entity_permission.entity_label = entity_data["entity_label"]
            entity_permission.entity_category = entity_data["entity_category"]
            entity_permission.updated_at = datetime.utcnow()
        
        # Get entity user level
        entity_user_level = ENTITY_USER_LEVELS.get(entity_name, "advanced")
        
        # Process each field
        for field_info in entity_data["fields"]:
            # Check if field already exists
            # First check for exact match (same tenant_id)
            existing_field = db.query(EntityFieldRegistry).filter(
                EntityFieldRegistry.tenant_id == tenant_id,
                EntityFieldRegistry.entity_name == entity_name,
                EntityFieldRegistry.field_name == field_info["field_name"]
            ).first()
            
            if existing_field:
                # Update existing field with latest discovery
                existing_field.entity_label = entity_data["entity_label"]
                existing_field.entity_category = entity_data["entity_category"]
                existing_field.entity_user_level = entity_user_level
                
                # Preserve special field types and field_config for custom/special fields
                existing_field_config = existing_field.field_config or {}
                has_special_type = existing_field.field_type_display in SPECIAL_FIELD_TYPES
                has_custom_config = existing_field_config.get("is_special") or existing_field_config.get("depends_on") or existing_field_config.get("dependent_options")
                is_known_special_field = field_info["field_name"] in SPECIAL_FIELD_NAME_MAPPING
                
                # Only update field_type if it's not a special/custom field
                if has_special_type or has_custom_config:
                    # Preserve the special field type - don't overwrite
                    # Ensure field_type matches field_type_display for special fields
                    existing_field.field_type = existing_field.field_type_display
                    logger.debug(f"Preserved special field type '{existing_field.field_type_display}' for {entity_name}.{field_info['field_name']}")
                elif is_known_special_field:
                    # Field name is known to be special - set the correct type
                    special_type = SPECIAL_FIELD_NAME_MAPPING[field_info["field_name"]]
                    existing_field.field_type = special_type
                    existing_field.field_type_display = special_type
                    logger.info(f"Set special field type '{special_type}' for {entity_name}.{field_info['field_name']}")
                else:
                    # Regular field - update with discovered type
                    existing_field.field_type = field_info["field_type"]
                    existing_field.field_type_display = field_info["field_type_display"]
                
                # Preserve field_config if it exists (don't overwrite custom configurations)
                if existing_field_config and (has_special_type or has_custom_config):
                    # Keep existing field_config - don't overwrite
                    logger.debug(f"Preserved field_config for {entity_name}.{field_info['field_name']}")
                # Note: field_config is not updated during sync - it's managed separately
                
                existing_field.is_nullable = field_info["is_nullable"]
                existing_field.is_primary_key = field_info["is_primary_key"]
                existing_field.is_foreign_key = field_info["is_foreign_key"]
                existing_field.foreign_key_table = field_info["foreign_key_table"]
                existing_field.max_length = field_info["max_length"]
                existing_field.is_system = field_info["is_system"]
                # Ensure field is enabled if it was previously disabled
                if not existing_field.is_enabled and not field_info["is_system"]:
                    existing_field.is_enabled = True
                existing_field.last_discovered_at = datetime.utcnow()
                existing_field.updated_at = datetime.utcnow()
                entity_results["fields_updated"] += 1
            else:
                # Before creating, check if a duplicate exists with different tenant_id
                # This prevents creating duplicates when syncing both tenant and platform-wide
                duplicate_check = db.query(EntityFieldRegistry).filter(
                    EntityFieldRegistry.entity_name == entity_name,
                    EntityFieldRegistry.field_name == field_info["field_name"]
                ).filter(
                    EntityFieldRegistry.tenant_id != tenant_id
                ).first()
                
                if duplicate_check:
                    # Field exists with different tenant_id - skip creating duplicate
                    # Log this case for debugging
                    logger.debug(
                        f"Skipping duplicate field {field_info['field_name']} for entity {entity_name} "
                        f"(exists with tenant_id={duplicate_check.tenant_id}, syncing with tenant_id={tenant_id})"
                    )
                    continue
                
                # Create new field
                # Check if this field should have a special type
                field_type = field_info["field_type"]
                field_type_display = field_info["field_type_display"]
                
                if field_info["field_name"] in SPECIAL_FIELD_NAME_MAPPING:
                    # Set the correct special field type for known special fields
                    special_type = SPECIAL_FIELD_NAME_MAPPING[field_info["field_name"]]
                    field_type = special_type
                    field_type_display = special_type
                    logger.info(f"Setting special field type '{special_type}' for new field {entity_name}.{field_info['field_name']}")
                
                # Initialize field_config for special fields that need options
                field_config = None
                if entity_name == "agents":
                    if field_info["field_name"] == "type":
                        field_config = {"options": [
                            {"value": "AI_AGENT", "label": "AI Agent"},
                            {"value": "BOT", "label": "Bot"},
                            {"value": "AUTOMATION", "label": "Automation"},
                            {"value": "API_SERVICE", "label": "API Service"}
                        ]}
                        field_type = "select"
                        field_type_display = "select"
                    elif field_info["field_name"] == "category":
                        field_config = {"options": [
                            {"value": "Security & Compliance", "label": "Security & Compliance"},
                            {"value": "Financial Trading", "label": "Financial Trading"},
                            {"value": "Healthcare", "label": "Healthcare"},
                            {"value": "Customer Support", "label": "Customer Support"},
                            {"value": "Sales & Marketing", "label": "Sales & Marketing"},
                            {"value": "Human Resources", "label": "Human Resources"},
                            {"value": "IT Operations", "label": "IT Operations"},
                            {"value": "Data Analytics", "label": "Data Analytics"},
                            {"value": "E-commerce", "label": "E-commerce"},
                            {"value": "Education", "label": "Education"},
                            {"value": "Legal", "label": "Legal"},
                            {"value": "Real Estate", "label": "Real Estate"},
                            {"value": "Manufacturing", "label": "Manufacturing"},
                            {"value": "Supply Chain", "label": "Supply Chain"},
                            {"value": "Energy & Utilities", "label": "Energy & Utilities"},
                            {"value": "Telecommunications", "label": "Telecommunications"},
                            {"value": "Transportation", "label": "Transportation"},
                            {"value": "Government", "label": "Government"},
                            {"value": "Non-Profit", "label": "Non-Profit"},
                            {"value": "Research & Development", "label": "Research & Development"},
                            {"value": "Entertainment", "label": "Entertainment"},
                            {"value": "Media & Publishing", "label": "Media & Publishing"},
                            {"value": "Insurance", "label": "Insurance"},
                            {"value": "Banking", "label": "Banking"},
                            {"value": "Retail", "label": "Retail"},
                            {"value": "Hospitality", "label": "Hospitality"},
                            {"value": "Agriculture", "label": "Agriculture"},
                            {"value": "Construction", "label": "Construction"},
                            {"value": "Aerospace", "label": "Aerospace"},
                            {"value": "Defense", "label": "Defense"},
                            {"value": "Automotive", "label": "Automotive"},
                            {"value": "Pharmaceuticals", "label": "Pharmaceuticals"},
                            {"value": "Biotechnology", "label": "Biotechnology"},
                            {"value": "Other", "label": "Other"}
                        ]}
                        field_type = "select"
                        field_type_display = "select"
                    elif field_info["field_name"] == "subcategory":
                        # Subcategory is a dependent select - will be configured by seed script
                        field_type = "dependent_select"
                        field_type_display = "dependent_select"
                        field_config = {
                            "depends_on": "category",
                            "depends_on_label": "Category",
                            "dependent_options": {},  # Will be populated by seed script
                            "allow_custom": False,
                            "clear_on_parent_change": True
                        }
                
                new_field = EntityFieldRegistry(
                    tenant_id=tenant_id,
                    entity_name=entity_name,
                    entity_label=entity_data["entity_label"],
                    entity_category=entity_data["entity_category"],
                    entity_user_level=entity_user_level,
                    field_name=field_info["field_name"],
                    field_label=field_info["field_label"],
                    field_type=field_type,
                    field_type_display=field_type_display,
                    is_nullable=field_info["is_nullable"],
                    is_primary_key=field_info["is_primary_key"],
                    is_foreign_key=field_info["is_foreign_key"],
                    foreign_key_table=field_info["foreign_key_table"],
                    max_length=field_info["max_length"],
                    is_enabled=True,
                    is_required=not field_info["is_nullable"] and not field_info["is_system"],
                    is_auto_discovered=True,
                    is_custom=False,
                    is_system=field_info["is_system"],
                    field_config=field_config,
                    last_discovered_at=datetime.utcnow(),
                    created_by=created_by
                )
                db.add(new_field)
                entity_results["fields_created"] += 1
        
        results["entities_processed"] += 1
        results["fields_discovered"] += entity_results["fields_discovered"]
        results["fields_created"] += entity_results["fields_created"]
        results["fields_updated"] += entity_results["fields_updated"]
        results["entities"][entity_name] = entity_results
        
        logger.info(
            f"Processed {entity_name}: "
            f"{entity_results['fields_discovered']} fields, "
            f"{entity_results['fields_created']} created, "
            f"{entity_results['fields_updated']} updated"
        )
    
    try:
        db.commit()
        logger.info(f"✅ Entity field sync completed: {results['entities_processed']} entities, {results['fields_discovered']} fields")
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error syncing entity fields: {e}", exc_info=True)
        raise
    
    return results

