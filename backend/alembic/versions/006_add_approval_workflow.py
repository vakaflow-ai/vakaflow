"""Add approval workflow tables

Revision ID: 006
Revises: 005
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create approval_workflows table
    op.create_table(
        'approval_workflows',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('agent_type', sa.String(100), nullable=True),
        sa.Column('risk_level', sa.String(50), nullable=True),
        sa.Column('workflow_config', sa.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_approval_workflows_tenant_id', 'approval_workflows', ['tenant_id'])
    
    # Create approval_instances table
    op.create_table(
        'approval_instances',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('current_step', sa.Integer(), default=0),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approval_notes', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['workflow_id'], ['approval_workflows.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
    )
    op.create_index('ix_approval_instances_agent_id', 'approval_instances', ['agent_id'])
    op.create_index('ix_approval_instances_status', 'approval_instances', ['status'])
    
    # Create approval_steps table
    op.create_table(
        'approval_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('instance_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('step_type', sa.String(50), nullable=False),
        sa.Column('step_name', sa.String(255), nullable=True),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assigned_role', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('completed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['instance_id'], ['approval_instances.id']),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id']),
        sa.ForeignKeyConstraint(['completed_by'], ['users.id']),
    )
    op.create_index('ix_approval_steps_instance_id', 'approval_steps', ['instance_id'])
    op.create_index('ix_approval_steps_assigned_to', 'approval_steps', ['assigned_to'])
    op.create_index('ix_approval_steps_status', 'approval_steps', ['status'])


def downgrade() -> None:
    op.drop_index('ix_approval_steps_status', table_name='approval_steps')
    op.drop_index('ix_approval_steps_assigned_to', table_name='approval_steps')
    op.drop_index('ix_approval_steps_instance_id', table_name='approval_steps')
    op.drop_table('approval_steps')
    op.drop_index('ix_approval_instances_status', table_name='approval_instances')
    op.drop_index('ix_approval_instances_agent_id', table_name='approval_instances')
    op.drop_table('approval_instances')
    op.drop_index('ix_approval_workflows_tenant_id', table_name='approval_workflows')
    op.drop_table('approval_workflows')

