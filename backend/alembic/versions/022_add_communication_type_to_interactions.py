"""add_communication_type_to_interactions

Revision ID: 022_add_communication_type
Revises: 021_add_studio_flows
Create Date: 2025-01-15 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '022_add_communication_type'
down_revision = '021_add_studio_flows'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add communication_type and target_tenant_id to agentic_agent_interactions
    op.add_column(
        'agentic_agent_interactions',
        sa.Column('communication_type', sa.String(50), nullable=True)
    )
    op.add_column(
        'agentic_agent_interactions',
        sa.Column('target_tenant_id', postgresql.UUID(as_uuid=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('agentic_agent_interactions', 'target_tenant_id')
    op.drop_column('agentic_agent_interactions', 'communication_type')
