"""add_custom_field_ids_to_form_layouts

Revision ID: add_custom_field_ids
Revises: ad6800c388bc
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_custom_field_ids'
down_revision = 'ad6800c388bc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add custom_field_ids column to form_layouts table
    # This stores only UUID references to CustomFieldCatalog (no duplication)
    op.add_column('form_layouts', sa.Column('custom_field_ids', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove custom_field_ids column from form_layouts table
    op.drop_column('form_layouts', 'custom_field_ids')

