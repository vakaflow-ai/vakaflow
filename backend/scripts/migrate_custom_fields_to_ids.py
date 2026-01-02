"""
Migration script to convert custom_fields JSON to custom_field_ids references

This script:
1. Reads all FormLayout records with custom_fields
2. For each custom field, checks if it exists in CustomFieldCatalog
3. If exists, uses its ID; if not, creates it in the catalog
4. Updates FormLayout with custom_field_ids array
5. Preserves custom_fields for backward compatibility during transition
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.form_layout import FormLayout
from app.models.custom_field import CustomFieldCatalog
from uuid import UUID
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def find_or_create_custom_field(
    db: Session,
    tenant_id: UUID,
    custom_field_data: dict,
    created_by: UUID = None
) -> UUID:
    """
    Find existing custom field in catalog or create new one
    
    Args:
        db: Database session
        tenant_id: Tenant ID
        custom_field_data: Custom field data from FormLayout.custom_fields
        created_by: User ID who created the original field
    
    Returns:
        CustomFieldCatalog ID
    """
    field_name = custom_field_data.get("field_name")
    if not field_name:
        logger.warning(f"Custom field missing field_name: {custom_field_data}")
        return None
    
    # Try to find existing field by field_name and tenant_id
    existing_field = db.query(CustomFieldCatalog).filter(
        CustomFieldCatalog.tenant_id == tenant_id,
        CustomFieldCatalog.field_name == field_name
    ).first()
    
    if existing_field:
        logger.info(f"Found existing custom field: {field_name} (ID: {existing_field.id})")
        return existing_field.id
    
    # Create new field in catalog
    logger.info(f"Creating new custom field in catalog: {field_name}")
    new_field = CustomFieldCatalog(
        tenant_id=tenant_id,
        field_name=field_name,
        field_type=custom_field_data.get("field_type", "text"),
        label=custom_field_data.get("label", field_name),
        description=custom_field_data.get("description"),
        placeholder=custom_field_data.get("placeholder"),
        is_required=custom_field_data.get("is_required", False),
        accepted_file_types=custom_field_data.get("accepted_file_types"),
        link_text=custom_field_data.get("link_text"),
        master_data_list_id=UUID(custom_field_data["master_data_list_id"]) if custom_field_data.get("master_data_list_id") else None,
        options=custom_field_data.get("options"),
        role_permissions=custom_field_data.get("role_permissions", {}),
        is_enabled=custom_field_data.get("is_enabled", True),
        is_standard=False,  # These are user-created fields
        field_source="custom",
        created_by=created_by
    )
    
    db.add(new_field)
    db.flush()  # Flush to get the ID
    
    logger.info(f"Created custom field: {field_name} (ID: {new_field.id})")
    return new_field.id


def migrate_layout_custom_fields(db: Session, layout: FormLayout) -> bool:
    """
    Migrate custom_fields to custom_field_ids for a single layout
    
    Returns:
        True if migration was successful, False otherwise
    """
    if not layout.custom_fields:
        # No custom fields to migrate
        if not layout.custom_field_ids:
            # Set empty array if both are None
            layout.custom_field_ids = []
        return True
    
    # Already migrated?
    if layout.custom_field_ids and len(layout.custom_field_ids) > 0:
        logger.info(f"Layout {layout.id} already has custom_field_ids, skipping")
        return True
    
    try:
        custom_field_ids = []
        
        # Process each custom field
        for custom_field_data in layout.custom_fields:
            if not isinstance(custom_field_data, dict):
                logger.warning(f"Invalid custom field data type in layout {layout.id}: {type(custom_field_data)}")
                continue
            
            field_id = find_or_create_custom_field(
                db=db,
                tenant_id=layout.tenant_id,
                custom_field_data=custom_field_data,
                created_by=layout.created_by
            )
            
            if field_id:
                custom_field_ids.append(str(field_id))
        
        # Update layout with custom_field_ids
        layout.custom_field_ids = custom_field_ids
        db.commit()
        
        logger.info(f"Migrated layout {layout.id}: {len(custom_field_ids)} custom fields")
        return True
        
    except Exception as e:
        logger.error(f"Error migrating layout {layout.id}: {e}", exc_info=True)
        db.rollback()
        return False


def migrate_all_custom_fields():
    """Migrate all FormLayout custom_fields to custom_field_ids"""
    db: Session = SessionLocal()
    
    try:
        # Get all layouts with custom_fields
        layouts = db.query(FormLayout).filter(
            FormLayout.custom_fields.isnot(None)
        ).all()
        
        logger.info(f"Found {len(layouts)} layouts with custom_fields to migrate")
        
        migrated_count = 0
        error_count = 0
        
        for layout in layouts:
            if migrate_layout_custom_fields(db, layout):
                migrated_count += 1
            else:
                error_count += 1
        
        logger.info(f"Migration complete: {migrated_count} migrated, {error_count} errors")
        
        return {
            "total": len(layouts),
            "migrated": migrated_count,
            "errors": error_count
        }
        
    except Exception as e:
        logger.error(f"Error during migration: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("Starting custom_fields to custom_field_ids migration...")
    result = migrate_all_custom_fields()
    logger.info(f"Migration result: {result}")

