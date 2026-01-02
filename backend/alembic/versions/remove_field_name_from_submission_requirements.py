"""remove_field_name_from_submission_requirements

Revision ID: remove_field_name
Revises: add_catalog_id
Create Date: 2025-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'remove_field_name'
down_revision = 'add_catalog_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Remove field_name column from submission_requirements table.
    
    field_name is now a computed property derived from catalog_id in the model.
    Entity design: Entity has Title (label) and Description, field_name is computed from catalog_id.
    
    Before dropping:
    1. Ensure all records have catalog_id (should be done by add_catalog_id migration)
    2. Verify no indexes or constraints depend on field_name
    """
    # Check if field_name column exists (for safety)
    # Note: This migration assumes catalog_id migration has already run
    # and all records have catalog_id populated
    
    # Drop any indexes on field_name if they exist
    # (Checking if index exists before dropping to avoid errors)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE tablename = 'submission_requirements' 
                AND indexname LIKE '%field_name%'
            ) THEN
                DROP INDEX IF EXISTS ix_submission_requirements_field_name;
            END IF;
        END $$;
    """)
    
    # Drop the field_name column
    # Note: This will fail if there are any foreign key constraints or other dependencies
    op.drop_column('submission_requirements', 'field_name')


def downgrade() -> None:
    """
    Restore field_name column (for rollback purposes).
    Note: field_name values will need to be regenerated from catalog_id or other sources.
    """
    # Add field_name column back (nullable initially)
    op.add_column('submission_requirements', sa.Column('field_name', sa.String(100), nullable=True))
    
    # Populate field_name from catalog_id for existing records
    # Convert catalog_id (e.g., "REQ-COM-01") to field_name (e.g., "req_com_01")
    op.execute("""
        UPDATE submission_requirements
        SET field_name = LOWER(REPLACE(COALESCE(catalog_id, 'REQ-GEN-00'), '-', '_'))
        WHERE field_name IS NULL AND catalog_id IS NOT NULL
    """)
    
    # For records without catalog_id, generate a fallback
    op.execute("""
        UPDATE submission_requirements
        SET field_name = 'req_' || REPLACE(id::text, '-', '_')
        WHERE field_name IS NULL
    """)
    
    # Make field_name NOT NULL after populating
    op.alter_column('submission_requirements', 'field_name', nullable=False)
    
    # Optionally create index on field_name
    op.create_index('ix_submission_requirements_field_name', 'submission_requirements', ['field_name'])

