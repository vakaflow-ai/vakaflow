"""rename_screen_type_to_request_type

Revision ID: rename_screen_type_to_request_type
Revises: df1caed9234b
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'rename_screen_to_request'
down_revision = '1736428800'  # Update to latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename screen_type to request_type in form_layouts table
    op.alter_column('form_layouts', 'screen_type', new_column_name='request_type', existing_type=sa.String(50), existing_nullable=False)
    
    # Rename screen_type to request_type in form_field_access table
    op.alter_column('form_field_access', 'screen_type', new_column_name='request_type', existing_type=sa.String(50), existing_nullable=False)


def downgrade() -> None:
    # Rename request_type back to screen_type in form_field_access table
    op.alter_column('form_field_access', 'request_type', new_column_name='screen_type', existing_type=sa.String(50), existing_nullable=False)
    
    # Rename request_type back to screen_type in form_layouts table
    op.alter_column('form_layouts', 'request_type', new_column_name='screen_type', existing_type=sa.String(50), existing_nullable=False)
