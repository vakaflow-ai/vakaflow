"""Add is_template to form_layouts

Revision ID: add_is_template
Revises: 8a312587702d
Create Date: 2025-12-26 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_is_template'
down_revision = '8a312587702d'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_template column
    op.add_column('form_layouts', sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'))
    
    # Mark existing auto-created layouts as templates
    op.execute("""
        UPDATE form_layouts
        SET is_template = true
        WHERE name IN ('Vendor Submission Layout (Default)-External', 'Inhouse Developed Agent layout')
    """)


def downgrade():
    # Drop column
    op.drop_column('form_layouts', 'is_template')

