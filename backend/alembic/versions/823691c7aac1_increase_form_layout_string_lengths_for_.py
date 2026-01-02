"""increase_form_layout_string_lengths_for_multiple_stages

Revision ID: 823691c7aac1
Revises: add_layout_type
Create Date: 2025-12-25 19:33:00.939395

This migration increases the size of workflow_stage and layout_type columns
from VARCHAR(50) to VARCHAR(255) to support comma-separated values for
multiple stages/types.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '823691c7aac1'
down_revision = 'add_layout_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Increase workflow_stage column size from VARCHAR(50) to VARCHAR(255)
    op.alter_column('form_layouts', 'workflow_stage',
                    existing_type=sa.String(50),
                    type_=sa.String(255),
                    existing_nullable=False)
    
    # Increase layout_type column size from VARCHAR(50) to VARCHAR(255)
    op.alter_column('form_layouts', 'layout_type',
                    existing_type=sa.String(50),
                    type_=sa.String(255),
                    existing_nullable=True)


def downgrade() -> None:
    # Revert workflow_stage column size back to VARCHAR(50)
    op.alter_column('form_layouts', 'workflow_stage',
                    existing_type=sa.String(255),
                    type_=sa.String(50),
                    existing_nullable=False)
    
    # Revert layout_type column size back to VARCHAR(50)
    op.alter_column('form_layouts', 'layout_type',
                    existing_type=sa.String(255),
                    type_=sa.String(50),
                    existing_nullable=True)

