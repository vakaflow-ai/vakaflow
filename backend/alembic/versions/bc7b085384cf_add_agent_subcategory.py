"""add_agent_subcategory

Revision ID: bc7b085384cf
Revises: 018
Create Date: 2025-12-05 22:09:52.692221

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bc7b085384cf'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('agents', sa.Column('subcategory', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('agents', 'subcategory')

