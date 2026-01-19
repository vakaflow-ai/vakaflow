"""add_missing_agent_metadata_columns

Revision ID: 3040cabc85a1
Revises: d86cbbccb89c
Create Date: 2026-01-18 14:10:54.744666

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3040cabc85a1'
down_revision = 'd86cbbccb89c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing columns to agent_metadata table
    op.add_column('agent_metadata', sa.Column('data_retention_period', sa.String(50), nullable=True))
    op.add_column('agent_metadata', sa.Column('incident_response_plan', sa.Boolean(), nullable=True))


def downgrade() -> None:
    # Remove the added columns
    op.drop_column('agent_metadata', 'incident_response_plan')
    op.drop_column('agent_metadata', 'data_retention_period')

