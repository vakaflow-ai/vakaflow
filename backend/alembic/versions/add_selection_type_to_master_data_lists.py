"""add_selection_type_to_master_data_lists

Revision ID: add_selection_type
Revises: add_field_category
Create Date: 2025-12-26 20:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_selection_type'
down_revision = '823691c7aac1'  # increase_form_layout_string_lengths_for_
branch_labels = None
depends_on = None


def upgrade():
    # Add selection_type column to master_data_lists
    op.add_column('master_data_lists', 
        sa.Column('selection_type', sa.String(length=20), nullable=False, server_default='single')
    )


def downgrade():
    # Remove selection_type column
    op.drop_column('master_data_lists', 'selection_type')

