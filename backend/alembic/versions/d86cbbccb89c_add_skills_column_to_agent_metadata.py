"""add_skills_column_to_agent_metadata

Revision ID: d86cbbccb89c
Revises: b1e8903c0094
Create Date: 2026-01-18 13:59:16.479599

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd86cbbccb89c'
down_revision = 'b1e8903c0094'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add skills column to agent_metadata table
    op.add_column('agent_metadata', sa.Column('skills', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove skills column from agent_metadata table
    op.drop_column('agent_metadata', 'skills')

