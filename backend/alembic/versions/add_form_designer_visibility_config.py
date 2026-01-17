"""add_form_designer_visibility_config

Revision ID: add_form_designer_visibility
Revises: add_architecture_landscape
Create Date: 2025-01-20 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_form_designer_visibility'
down_revision = 'add_architecture_landscape'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add visibility configuration fields to entity_field_registry
    op.add_column('entity_field_registry', sa.Column('visible_in_form_designer', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('entity_field_registry', sa.Column('form_designer_category', sa.String(100), nullable=True))
    
    # Create indexes
    op.create_index('ix_entity_field_registry_visible_in_form_designer', 'entity_field_registry', ['visible_in_form_designer'])
    op.create_index('ix_entity_field_registry_form_designer_category', 'entity_field_registry', ['form_designer_category'])
    
    # Set default visibility: hide system fields and technical fields
    op.execute("""
        UPDATE entity_field_registry
        SET visible_in_form_designer = false
        WHERE is_system = true OR entity_user_level = 'system'
    """)


def downgrade() -> None:
    op.drop_index('ix_entity_field_registry_form_designer_category', 'entity_field_registry')
    op.drop_index('ix_entity_field_registry_visible_in_form_designer', 'entity_field_registry')
    op.drop_column('entity_field_registry', 'form_designer_category')
    op.drop_column('entity_field_registry', 'visible_in_form_designer')
