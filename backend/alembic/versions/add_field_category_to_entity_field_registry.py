"""add_field_category_to_entity_field_registry

Revision ID: add_field_category
Revises: 
Create Date: 2025-01-23 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_field_category'
down_revision = 'add_workflow_reminders'  # Latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Add field_category column to entity_field_registry
    op.add_column('entity_field_registry', 
        sa.Column('field_category', sa.String(length=50), nullable=True, server_default='business')
    )
    
    # Create index on field_category
    op.create_index('ix_entity_field_registry_field_category', 'entity_field_registry', ['field_category'])
    
    # Update existing records: set business fields based on field names
    op.execute("""
        UPDATE entity_field_registry 
        SET field_category = CASE
            WHEN field_name IN ('id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'tenant_id') THEN 'system'
            WHEN field_name IN ('name', 'description', 'category', 'subcategory', 'type', 'version', 'status', 
                               'use_cases', 'features', 'capabilities', 'personas', 'version_info',
                               'llm_vendor', 'llm_model', 'deployment_type', 'data_usage_purpose',
                               'data_types', 'regions', 'data_sharing_scope', 'title', 'label', 'notes', 
                               'comments', 'summary', 'overview', 'vendor_name', 'contact_email', 
                               'contact_phone', 'website', 'industry', 'requirement_text', 'requirement_type',
                               'is_required', 'help_text') THEN 'business'
            WHEN is_foreign_key = true OR field_name IN ('vendor_id', 'agent_id', 'user_id', 'created_by', 
                                                         'updated_by', 'external_id', 'integration_id', 
                                                         'workflow_id', 'request_id', 'metadata', 'extra_data',
                                                         'config', 'settings', 'options') THEN 'advanced'
            ELSE 'business'
        END
        WHERE field_category IS NULL
    """)


def downgrade():
    # Drop index
    op.drop_index('ix_entity_field_registry_field_category', table_name='entity_field_registry')
    
    # Drop column
    op.drop_column('entity_field_registry', 'field_category')

