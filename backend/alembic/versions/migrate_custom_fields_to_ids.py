"""migrate_custom_fields_to_ids

Revision ID: migrate_custom_fields_to_ids
Revises: add_custom_field_ids
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

This migration runs the data migration script to convert custom_fields JSON to custom_field_ids references.
The actual data migration is handled by the Python script: backend/scripts/migrate_custom_fields_to_ids.py
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.form_layout import FormLayout
from app.models.custom_field import CustomFieldCatalog
from uuid import UUID
import logging

# revision identifiers, used by Alembic.
revision = 'migrate_custom_fields_to_ids'
down_revision = 'add_custom_field_ids'
branch_labels = None
depends_on = None

logger = logging.getLogger(__name__)


def upgrade() -> None:
    """
    Migrate custom_fields JSON to custom_field_ids references
    
    This runs the data migration to convert existing custom_fields to references.
    The custom_fields column is kept for backward compatibility.
    """
    # Import the migration function
    import sys
    from pathlib import Path
    # Add scripts directory to path
    scripts_dir = Path(__file__).parent.parent.parent / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    
    from migrate_custom_fields_to_ids import migrate_all_custom_fields
    
    logger.info("Starting custom_fields to custom_field_ids data migration...")
    
    try:
        result = migrate_all_custom_fields()
        logger.info(f"Data migration completed: {result}")
    except Exception as e:
        logger.error(f"Data migration failed: {e}", exc_info=True)
        # Don't fail the migration - allow manual fix
        logger.warning("Migration script failed, but schema migration continues. Please run the script manually.")


def downgrade() -> None:
    """
    Downgrade: Clear custom_field_ids (but keep custom_fields for backward compatibility)
    
    Note: We don't delete the CustomFieldCatalog entries as they may be used elsewhere.
    """
    # Clear custom_field_ids but keep custom_fields
    # This allows rollback without data loss
    bind = op.get_bind()
    bind.execute(
        sa.text("UPDATE form_layouts SET custom_field_ids = NULL WHERE custom_field_ids IS NOT NULL")
    )
    logger.info("Cleared custom_field_ids (custom_fields preserved for backward compatibility)")

