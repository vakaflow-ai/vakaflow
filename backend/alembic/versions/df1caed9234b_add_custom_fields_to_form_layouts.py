"""add_custom_fields_to_form_layouts

Revision ID: df1caed9234b
Revises: 019_add_cluster_nodes
Create Date: 2025-12-09 17:20:36.822606

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'df1caed9234b'
down_revision = '019_add_cluster_nodes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add custom_fields column to form_layouts table
    op.add_column('form_layouts', sa.Column('custom_fields', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove custom_fields column from form_layouts table
    op.drop_column('form_layouts', 'custom_fields')

