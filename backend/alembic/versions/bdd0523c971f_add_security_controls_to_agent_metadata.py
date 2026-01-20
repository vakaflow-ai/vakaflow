"""add_security_controls_to_agent_metadata

Revision ID: bdd0523c971f
Revises: fc3cca1e21a6
Create Date: 2026-01-19 14:30:15.703203

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bdd0523c971f'
down_revision = 'fc3cca1e21a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add security_controls column to agent_metadata table
    op.add_column('agent_metadata', sa.Column('security_controls', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove security_controls column from agent_metadata table
    op.drop_column('agent_metadata', 'security_controls')

