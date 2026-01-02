"""add_workflow_configuration_tables

Revision ID: ec79cec05667
Revises: 3d4e89b376d8
Create Date: 2025-12-06 07:57:58.060327

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'ec79cec05667'
down_revision = '3d4e89b376d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create workflow_configurations table
    op.create_table(
        'workflow_configurations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('workflow_engine', sa.Enum('internal', 'servicenow', 'jira', 'custom', name='workflowenginetype'), nullable=False),
        sa.Column('integration_id', postgresql.UUID(as_uuid=True), nullable=True),  # Foreign key constraint removed to avoid dependency issues
        sa.Column('integration_config', sa.JSON(), nullable=True),
        sa.Column('workflow_steps', sa.JSON(), nullable=True),
        sa.Column('assignment_rules', sa.JSON(), nullable=True),
        sa.Column('conditions', sa.JSON(), nullable=True),
        sa.Column('status', sa.Enum('active', 'inactive', 'draft', name='workflowconfigstatus'), nullable=False),
        sa.Column('is_default', sa.Boolean(), default=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['integration_id'], ['integrations.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    )
    op.create_index('ix_workflow_configurations_tenant_id', 'workflow_configurations', ['tenant_id'])
    
    # Create onboarding_requests table
    op.create_table(
        'onboarding_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('request_type', sa.String(50), nullable=False, default='onboarding'),
        sa.Column('workflow_config_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('workflow_engine', sa.Enum('internal', 'servicenow', 'jira', 'custom', name='workflowenginetype'), nullable=False),
        sa.Column('external_workflow_id', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, default='pending'),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('current_step', sa.Integer(), default=0),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('approval_notes', sa.Text(), nullable=True),
        sa.Column('rejected_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('rejected_at', sa.DateTime(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('request_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
        sa.ForeignKeyConstraint(['workflow_config_id'], ['workflow_configurations.id'], ),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], ),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['rejected_by'], ['users.id'], ),
    )
    op.create_index('ix_onboarding_requests_agent_id', 'onboarding_requests', ['agent_id'])
    op.create_index('ix_onboarding_requests_tenant_id', 'onboarding_requests', ['tenant_id'])
    op.create_index('ix_onboarding_requests_requested_by', 'onboarding_requests', ['requested_by'])
    op.create_index('ix_onboarding_requests_assigned_to', 'onboarding_requests', ['assigned_to'])


def downgrade() -> None:
    op.drop_index('ix_onboarding_requests_assigned_to', table_name='onboarding_requests')
    op.drop_index('ix_onboarding_requests_requested_by', table_name='onboarding_requests')
    op.drop_index('ix_onboarding_requests_tenant_id', table_name='onboarding_requests')
    op.drop_index('ix_onboarding_requests_agent_id', table_name='onboarding_requests')
    op.drop_table('onboarding_requests')
    op.drop_index('ix_workflow_configurations_tenant_id', table_name='workflow_configurations')
    op.drop_table('workflow_configurations')
    op.execute("DROP TYPE IF EXISTS workflowenginetype")
    op.execute("DROP TYPE IF EXISTS workflowconfigstatus")
