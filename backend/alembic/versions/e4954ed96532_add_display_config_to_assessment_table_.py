"""add_display_config_to_assessment_table_layouts

Revision ID: e4954ed96532
Revises: 51f0b0e64f3c
Create Date: 2026-01-10 12:05:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = 'e4954ed96532'
down_revision = '51f0b0e64f3c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add display_config column to assessment_table_layouts table
    op.add_column(
        'assessment_table_layouts',
        sa.Column('display_config', JSON, nullable=True)
    )
    
    # Set default display_config for existing rows
    op.execute("""
        UPDATE assessment_table_layouts
        SET display_config = '{"default_expanded": true, "group_by": "category", "show_attachments_by_default": true, "enable_collapse": true}'::jsonb
        WHERE display_config IS NULL
    """)


def downgrade() -> None:
    op.drop_column('assessment_table_layouts', 'display_config')
