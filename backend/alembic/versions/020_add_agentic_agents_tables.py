"""add_agentic_agents_tables

Revision ID: 020_add_agentic_agents
Revises: 019_add_cluster_nodes
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '020_add_agentic_agents'
down_revision = '019_add_cluster_nodes'  # Will be updated to actual revision ID after migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create agentic_agents table
    op.create_table(
        'agentic_agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('agent_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('version', sa.String(50), nullable=False, server_default='1.0.0'),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('skills', postgresql.JSON, nullable=False, server_default='[]'),
        sa.Column('capabilities', postgresql.JSON, nullable=True),
        sa.Column('configuration', postgresql.JSON, nullable=True),
        sa.Column('rag_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('llm_provider', sa.String(100), nullable=True),
        sa.Column('llm_model', sa.String(100), nullable=True),
        sa.Column('embedding_model', sa.String(100), nullable=True),
        sa.Column('mcp_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('mcp_server_url', sa.String(500), nullable=True),
        sa.Column('mcp_api_key', sa.String(500), nullable=True),
        sa.Column('total_interactions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('success_rate', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('average_response_time', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('learning_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('feedback_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('improvement_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_agentic_agents_tenant_id', 'agentic_agents', ['tenant_id'])
    
    # Create agentic_agent_sessions table
    op.create_table(
        'agentic_agent_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('context_id', sa.String(255), nullable=True),
        sa.Column('context_type', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('current_step', sa.String(100), nullable=True),
        sa.Column('session_data', postgresql.JSON, nullable=True),
        sa.Column('initiated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agentic_agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['initiated_by'], ['users.id']),
    )
    op.create_index('ix_agentic_agent_sessions_agent_id', 'agentic_agent_sessions', ['agent_id'])
    op.create_index('ix_agentic_agent_sessions_tenant_id', 'agentic_agent_sessions', ['tenant_id'])
    op.create_index('ix_agentic_agent_sessions_context_id', 'agentic_agent_sessions', ['context_id'])
    
    # Create agentic_agent_interactions table
    op.create_table(
        'agentic_agent_interactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('interaction_type', sa.String(50), nullable=False),
        sa.Column('skill_used', sa.String(50), nullable=True),
        sa.Column('input_data', postgresql.JSON, nullable=True),
        sa.Column('output_data', postgresql.JSON, nullable=True),
        sa.Column('rag_query', sa.Text(), nullable=True),
        sa.Column('rag_results', postgresql.JSON, nullable=True),
        sa.Column('rag_context_used', postgresql.JSON, nullable=True),
        sa.Column('agent_called', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('mcp_protocol_used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('response_time_ms', sa.Float(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('feedback_provided', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('feedback_score', sa.Integer(), nullable=True),
        sa.Column('feedback_notes', sa.Text(), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['agent_id'], ['agentic_agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['agentic_agent_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['agent_called'], ['agentic_agents.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index('ix_agentic_agent_interactions_agent_id', 'agentic_agent_interactions', ['agent_id'])
    op.create_index('ix_agentic_agent_interactions_session_id', 'agentic_agent_interactions', ['session_id'])
    op.create_index('ix_agentic_agent_interactions_tenant_id', 'agentic_agent_interactions', ['tenant_id'])
    
    # Create agentic_agent_learning table
    op.create_table(
        'agentic_agent_learning',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('learning_type', sa.String(50), nullable=False),
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('source_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('pattern_data', postgresql.JSON, nullable=False),
        sa.Column('pattern_signature', sa.String(500), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('success_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('validated', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('validated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('validated_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['agent_id'], ['agentic_agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['validated_by'], ['users.id']),
    )
    op.create_index('ix_agentic_agent_learning_agent_id', 'agentic_agent_learning', ['agent_id'])
    op.create_index('ix_agentic_agent_learning_tenant_id', 'agentic_agent_learning', ['tenant_id'])
    op.create_index('ix_agentic_agent_learning_pattern_signature', 'agentic_agent_learning', ['pattern_signature'])
    
    # Create mcp_connections table
    op.create_table(
        'mcp_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('connection_name', sa.String(255), nullable=False),
        sa.Column('platform_name', sa.String(255), nullable=False),
        sa.Column('mcp_server_url', sa.String(500), nullable=False),
        sa.Column('api_key', sa.String(500), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('configuration', postgresql.JSON, nullable=True),
        sa.Column('supported_skills', postgresql.JSON, nullable=True),
        sa.Column('supported_agents', postgresql.JSON, nullable=True),
        sa.Column('total_requests', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_mcp_connections_tenant_id', 'mcp_connections', ['tenant_id'])


def downgrade() -> None:
    op.drop_table('mcp_connections')
    op.drop_table('agentic_agent_learning')
    op.drop_table('agentic_agent_interactions')
    op.drop_table('agentic_agent_sessions')
    op.drop_table('agentic_agents')
