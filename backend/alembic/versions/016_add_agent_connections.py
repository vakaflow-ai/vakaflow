"""Add agent connections table

Revision ID: 016
Revises: 015
Create Date: 2025-12-06 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'agent_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('app_name', sa.String(255), nullable=False),
        sa.Column('app_type', sa.String(100), nullable=False),
        sa.Column('connection_type', sa.String(50), nullable=False),
        sa.Column('protocol', sa.String(50), nullable=True),
        sa.Column('endpoint_url', sa.Text(), nullable=True),
        sa.Column('authentication_method', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_required', sa.Boolean(), default=True),
        sa.Column('is_encrypted', sa.Boolean(), default=True),
        sa.Column('data_classification', sa.String(100), nullable=True),
        sa.Column('compliance_requirements', postgresql.JSON(), nullable=True),
        sa.Column('data_types_exchanged', postgresql.JSON(), nullable=True),
        sa.Column('data_flow_direction', sa.String(50), nullable=True),
        sa.Column('data_format', sa.String(100), nullable=True),
        sa.Column('data_volume', sa.String(100), nullable=True),
        sa.Column('exchange_frequency', sa.String(100), nullable=True),
        sa.Column('source_system', sa.String(255), nullable=True),
        sa.Column('destination_system', sa.String(255), nullable=True),
        sa.Column('data_schema', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_agent_connections_agent_id', 'agent_connections', ['agent_id'])


def downgrade():
    op.drop_index('ix_agent_connections_agent_id', table_name='agent_connections')
    op.drop_table('agent_connections')

