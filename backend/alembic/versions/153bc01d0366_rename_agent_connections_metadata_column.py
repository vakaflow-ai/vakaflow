"""rename_agent_connections_metadata_column

Revision ID: 153bc01d0366
Revises: bc7b085384cf
Create Date: 2025-12-05 22:37:04.016450

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '153bc01d0366'
down_revision = 'bc7b085384cf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('agent_connections', 'metadata', new_column_name='connection_metadata')


def downgrade() -> None:
    op.alter_column('agent_connections', 'connection_metadata', new_column_name='metadata')

