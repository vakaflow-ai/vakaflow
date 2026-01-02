"""Add ticket tracking tables

Revision ID: 011
Revises: 010
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tickets table
    op.create_table(
        'tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ticket_number', sa.String(50), nullable=False, unique=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='open'),
        sa.Column('current_stage', sa.String(50), nullable=False, server_default='submitted'),
        sa.Column('submitted_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('stage_progress', postgresql.JSONB(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=False),
        sa.Column('last_updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('ticket_metadata', postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id']),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
    )
    op.create_index('ix_tickets_agent_id', 'tickets', ['agent_id'])
    op.create_index('ix_tickets_tenant_id', 'tickets', ['tenant_id'])
    op.create_index('ix_tickets_ticket_number', 'tickets', ['ticket_number'])
    op.create_index('ix_tickets_status', 'tickets', ['status'])
    op.create_index('ix_tickets_submitted_by', 'tickets', ['submitted_by'])
    op.create_index('ix_tickets_assigned_to', 'tickets', ['assigned_to'])
    
    # Create ticket_activities table
    op.create_table(
        'ticket_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('activity_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('old_value', sa.String(255), nullable=True),
        sa.Column('new_value', sa.String(255), nullable=True),
        sa.Column('activity_metadata', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index('ix_ticket_activities_ticket_id', 'ticket_activities', ['ticket_id'])
    op.create_index('ix_ticket_activities_user_id', 'ticket_activities', ['user_id'])
    op.create_index('ix_ticket_activities_created_at', 'ticket_activities', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_ticket_activities_created_at', table_name='ticket_activities')
    op.drop_index('ix_ticket_activities_user_id', table_name='ticket_activities')
    op.drop_index('ix_ticket_activities_ticket_id', table_name='ticket_activities')
    op.drop_table('ticket_activities')
    op.drop_index('ix_tickets_assigned_to', table_name='tickets')
    op.drop_index('ix_tickets_submitted_by', table_name='tickets')
    op.drop_index('ix_tickets_status', table_name='tickets')
    op.drop_index('ix_tickets_ticket_number', table_name='tickets')
    op.drop_index('ix_tickets_tenant_id', table_name='tickets')
    op.drop_index('ix_tickets_agent_id', table_name='tickets')
    op.drop_table('tickets')

