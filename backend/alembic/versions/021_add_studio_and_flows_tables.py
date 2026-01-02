"""add_studio_and_flows_tables

Revision ID: 021_add_studio_flows
Revises: 020_add_agentic_agents
Create Date: 2025-01-15 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '021_add_studio_flows'
down_revision = '020_add_agentic_agents'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create agentic_flows table
    op.create_table(
        'agentic_flows',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('flow_definition', postgresql.JSON, nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('tags', postgresql.JSON, nullable=True),
        sa.Column('max_concurrent_executions', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('timeout_seconds', sa.Integer(), nullable=True),
        sa.Column('retry_on_failure', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_agentic_flows_tenant_id', 'agentic_flows', ['tenant_id'])
    
    # Create flow_executions table
    op.create_table(
        'flow_executions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('flow_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('context_id', sa.String(255), nullable=True),
        sa.Column('context_type', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('current_node_id', sa.String(100), nullable=True),
        sa.Column('execution_data', postgresql.JSON, nullable=True),
        sa.Column('result', postgresql.JSON, nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('triggered_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('trigger_data', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['flow_id'], ['agentic_flows.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['triggered_by'], ['users.id']),
    )
    op.create_index('ix_flow_executions_flow_id', 'flow_executions', ['flow_id'])
    op.create_index('ix_flow_executions_tenant_id', 'flow_executions', ['tenant_id'])
    op.create_index('ix_flow_executions_context_id', 'flow_executions', ['context_id'])
    
    # Create flow_node_executions table
    op.create_table(
        'flow_node_executions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('execution_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('node_id', sa.String(100), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('input_data', postgresql.JSON, nullable=True),
        sa.Column('output_data', postgresql.JSON, nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('skill_used', sa.String(100), nullable=True),
        sa.Column('interaction_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['execution_id'], ['flow_executions.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_flow_node_executions_execution_id', 'flow_node_executions', ['execution_id'])
    op.create_index('ix_flow_node_executions_node_id', 'flow_node_executions', ['node_id'])
    
    # Create studio_agents table
    op.create_table(
        'studio_agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('agent_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('source_agent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('mcp_connection_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('skills', postgresql.JSON, nullable=False, server_default='[]'),
        sa.Column('capabilities', postgresql.JSON, nullable=True),
        sa.Column('icon_url', sa.String(500), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('tags', postgresql.JSON, nullable=True),
        sa.Column('is_available', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_featured', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['mcp_connection_id'], ['mcp_connections.id']),
    )
    op.create_index('ix_studio_agents_tenant_id', 'studio_agents', ['tenant_id'])


def downgrade() -> None:
    op.drop_table('studio_agents')
    op.drop_table('flow_node_executions')
    op.drop_table('flow_executions')
    op.drop_table('agentic_flows')
