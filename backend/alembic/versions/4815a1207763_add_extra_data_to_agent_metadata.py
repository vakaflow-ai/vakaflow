"""add extra_data to agent_metadata

Revision ID: 4815a1207763
Revises: add_is_template
Create Date: 2025-12-26 14:10:44.589310

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4815a1207763'
down_revision = 'add_is_template'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('agent_metadata', sa.Column('extra_data', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('agent_metadata', 'extra_data')

