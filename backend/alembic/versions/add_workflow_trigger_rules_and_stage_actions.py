"""add workflow trigger rules and stage actions

Revision ID: add_workflow_features
Revises: 
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_workflow_features'
down_revision = 'ec79cec05667'  # After workflow_configuration_tables
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add trigger_rules column to workflow_configurations
    op.add_column('workflow_configurations', sa.Column('trigger_rules', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Create workflow_stage_actions table
    op.create_table(
        'workflow_stage_actions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('onboarding_request_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_config_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('action_type', sa.Enum('approve', 'reject', 'forward', 'comment', 'request_revision', 'escalate', name='workflowactiontype'), nullable=False),
        sa.Column('performed_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('performed_at', sa.DateTime(), nullable=False),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('forwarded_to', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('action_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['onboarding_request_id'], ['onboarding_requests.id']),
        sa.ForeignKeyConstraint(['workflow_config_id'], ['workflow_configurations.id']),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['forwarded_to'], ['users.id']),
    )
    op.create_index(op.f('ix_workflow_stage_actions_onboarding_request_id'), 'workflow_stage_actions', ['onboarding_request_id'], unique=False)
    op.create_index(op.f('ix_workflow_stage_actions_workflow_config_id'), 'workflow_stage_actions', ['workflow_config_id'], unique=False)
    op.create_index(op.f('ix_workflow_stage_actions_step_number'), 'workflow_stage_actions', ['step_number'], unique=False)
    op.create_index(op.f('ix_workflow_stage_actions_action_type'), 'workflow_stage_actions', ['action_type'], unique=False)
    op.create_index(op.f('ix_workflow_stage_actions_performed_by'), 'workflow_stage_actions', ['performed_by'], unique=False)
    
    # Create workflow_audit_trails table
    op.create_table(
        'workflow_audit_trails',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('onboarding_request_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('workflow_config_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('step_number', sa.Integer(), nullable=True),
        sa.Column('step_name', sa.String(255), nullable=True),
        sa.Column('action_details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('previous_status', sa.String(50), nullable=True),
        sa.Column('new_status', sa.String(50), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['onboarding_request_id'], ['onboarding_requests.id']),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['workflow_config_id'], ['workflow_configurations.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index(op.f('ix_workflow_audit_trails_tenant_id'), 'workflow_audit_trails', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_workflow_audit_trails_onboarding_request_id'), 'workflow_audit_trails', ['onboarding_request_id'], unique=False)
    op.create_index(op.f('ix_workflow_audit_trails_agent_id'), 'workflow_audit_trails', ['agent_id'], unique=False)
    op.create_index(op.f('ix_workflow_audit_trails_user_id'), 'workflow_audit_trails', ['user_id'], unique=False)
    op.create_index(op.f('ix_workflow_audit_trails_action'), 'workflow_audit_trails', ['action'], unique=False)
    op.create_index(op.f('ix_workflow_audit_trails_created_at'), 'workflow_audit_trails', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_workflow_audit_trails_created_at'), table_name='workflow_audit_trails')
    op.drop_index(op.f('ix_workflow_audit_trails_action'), table_name='workflow_audit_trails')
    op.drop_index(op.f('ix_workflow_audit_trails_user_id'), table_name='workflow_audit_trails')
    op.drop_index(op.f('ix_workflow_audit_trails_agent_id'), table_name='workflow_audit_trails')
    op.drop_index(op.f('ix_workflow_audit_trails_onboarding_request_id'), table_name='workflow_audit_trails')
    op.drop_index(op.f('ix_workflow_audit_trails_tenant_id'), table_name='workflow_audit_trails')
    op.drop_table('workflow_audit_trails')
    
    op.drop_index(op.f('ix_workflow_stage_actions_performed_by'), table_name='workflow_stage_actions')
    op.drop_index(op.f('ix_workflow_stage_actions_action_type'), table_name='workflow_stage_actions')
    op.drop_index(op.f('ix_workflow_stage_actions_step_number'), table_name='workflow_stage_actions')
    op.drop_index(op.f('ix_workflow_stage_actions_workflow_config_id'), table_name='workflow_stage_actions')
    op.drop_index(op.f('ix_workflow_stage_actions_onboarding_request_id'), table_name='workflow_stage_actions')
    op.drop_table('workflow_stage_actions')
    
    op.drop_column('workflow_configurations', 'trigger_rules')
    sa.Enum(name='workflowactiontype').drop(op.get_bind())

