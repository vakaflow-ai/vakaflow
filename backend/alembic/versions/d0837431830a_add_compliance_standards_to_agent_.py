"""add_compliance_standards_to_agent_metadata

Revision ID: d0837431830a
Revises: bdd0523c971f
Create Date: 2026-01-19 14:31:01.328730

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd0837431830a'
down_revision = 'bdd0523c971f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add compliance_standards column to agent_metadata table
    op.add_column('agent_metadata', sa.Column('compliance_standards', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove compliance_standards column from agent_metadata table
    op.drop_column('agent_metadata', 'compliance_standards')

