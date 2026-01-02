"""Add offboarding, adoption, and integrations tables

Revision ID: 007
Revises: 006
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create offboarding_requests table
    op.create_table(
        'offboarding_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reason', sa.String(100), nullable=False),
        sa.Column('reason_details', sa.Text(), nullable=True),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('replacement_agent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='initiated'),
        sa.Column('impact_analysis', postgresql.JSONB(), nullable=True),
        sa.Column('dependency_mapping', postgresql.JSONB(), nullable=True),
        sa.Column('knowledge_extracted', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['replacement_agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id']),
    )
    op.create_index('ix_offboarding_requests_agent_id', 'offboarding_requests', ['agent_id'])
    op.create_index('ix_offboarding_requests_tenant_id', 'offboarding_requests', ['tenant_id'])
    op.create_index('ix_offboarding_requests_requested_by', 'offboarding_requests', ['requested_by'])
    op.create_index('ix_offboarding_requests_status', 'offboarding_requests', ['status'])
    
    # Create knowledge_extractions table
    op.create_table(
        'knowledge_extractions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('offboarding_request_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('extraction_type', sa.String(100), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('extraction_metadata', postgresql.JSONB(), nullable=True),
        sa.Column('rag_context', postgresql.JSONB(), nullable=True),
        sa.Column('source_type', sa.String(100), nullable=True),
        sa.Column('source_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('extracted_at', sa.DateTime(), nullable=False),
        sa.Column('extracted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['offboarding_request_id'], ['offboarding_requests.id']),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['extracted_by'], ['users.id']),
    )
    op.create_index('ix_knowledge_extractions_offboarding_request_id', 'knowledge_extractions', ['offboarding_request_id'])
    op.create_index('ix_knowledge_extractions_agent_id', 'knowledge_extractions', ['agent_id'])
    
    # Create adoption_metrics table
    op.create_table(
        'adoption_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='not_started'),
        sa.Column('user_count', sa.Integer(), default=0),
        sa.Column('usage_count', sa.Integer(), default=0),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('roi', sa.Numeric(10, 2), nullable=True),
        sa.Column('cost_savings', sa.Numeric(10, 2), nullable=True),
        sa.Column('efficiency_gain', sa.Numeric(5, 2), nullable=True),
        sa.Column('user_satisfaction', sa.Numeric(3, 2), nullable=True),
        sa.Column('feedback_count', sa.Integer(), default=0),
        sa.Column('deployed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
    )
    op.create_index('ix_adoption_metrics_agent_id', 'adoption_metrics', ['agent_id'])
    op.create_index('ix_adoption_metrics_tenant_id', 'adoption_metrics', ['tenant_id'])
    op.create_index('ix_adoption_metrics_status', 'adoption_metrics', ['status'])
    
    # Create adoption_events table
    op.create_table(
        'adoption_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_metadata', postgresql.JSONB(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index('ix_adoption_events_agent_id', 'adoption_events', ['agent_id'])
    op.create_index('ix_adoption_events_tenant_id', 'adoption_events', ['tenant_id'])
    op.create_index('ix_adoption_events_event_type', 'adoption_events', ['event_type'])
    op.create_index('ix_adoption_events_occurred_at', 'adoption_events', ['occurred_at'])
    
    # Create integrations table
    op.create_table(
        'integrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('integration_type', sa.String(100), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='inactive'),
        sa.Column('config', postgresql.JSONB(), nullable=False),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('error_count', sa.Integer(), default=0),
        sa.Column('health_status', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_integrations_tenant_id', 'integrations', ['tenant_id'])
    op.create_index('ix_integrations_integration_type', 'integrations', ['integration_type'])
    op.create_index('ix_integrations_status', 'integrations', ['status'])
    
    # Create integration_events table
    op.create_table(
        'integration_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('integration_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(100), nullable=True),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('request_data', postgresql.JSONB(), nullable=True),
        sa.Column('response_data', postgresql.JSONB(), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['integration_id'], ['integrations.id']),
    )
    op.create_index('ix_integration_events_integration_id', 'integration_events', ['integration_id'])
    op.create_index('ix_integration_events_tenant_id', 'integration_events', ['tenant_id'])
    op.create_index('ix_integration_events_event_type', 'integration_events', ['event_type'])
    op.create_index('ix_integration_events_occurred_at', 'integration_events', ['occurred_at'])


def downgrade() -> None:
    op.drop_index('ix_integration_events_occurred_at', table_name='integration_events')
    op.drop_index('ix_integration_events_event_type', table_name='integration_events')
    op.drop_index('ix_integration_events_tenant_id', table_name='integration_events')
    op.drop_index('ix_integration_events_integration_id', table_name='integration_events')
    op.drop_table('integration_events')
    op.drop_index('ix_integrations_status', table_name='integrations')
    op.drop_index('ix_integrations_integration_type', table_name='integrations')
    op.drop_index('ix_integrations_tenant_id', table_name='integrations')
    op.drop_table('integrations')
    op.drop_index('ix_adoption_events_occurred_at', table_name='adoption_events')
    op.drop_index('ix_adoption_events_event_type', table_name='adoption_events')
    op.drop_index('ix_adoption_events_tenant_id', table_name='adoption_events')
    op.drop_index('ix_adoption_events_agent_id', table_name='adoption_events')
    op.drop_table('adoption_events')
    op.drop_index('ix_adoption_metrics_status', table_name='adoption_metrics')
    op.drop_index('ix_adoption_metrics_tenant_id', table_name='adoption_metrics')
    op.drop_index('ix_adoption_metrics_agent_id', table_name='adoption_metrics')
    op.drop_table('adoption_metrics')
    op.drop_index('ix_knowledge_extractions_agent_id', table_name='knowledge_extractions')
    op.drop_index('ix_knowledge_extractions_offboarding_request_id', table_name='knowledge_extractions')
    op.drop_table('knowledge_extractions')
    op.drop_index('ix_offboarding_requests_status', table_name='offboarding_requests')
    op.drop_index('ix_offboarding_requests_requested_by', table_name='offboarding_requests')
    op.drop_index('ix_offboarding_requests_tenant_id', table_name='offboarding_requests')
    op.drop_index('ix_offboarding_requests_agent_id', table_name='offboarding_requests')
    op.drop_table('offboarding_requests')

