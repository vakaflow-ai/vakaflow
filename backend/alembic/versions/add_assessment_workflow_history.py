"""Add assessment_workflow_history table

Revision ID: add_assessment_workflow_history
Revises: add_workflow_ticket_id
Create Date: 2025-01-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_assessment_workflow_history'
down_revision = 'add_workflow_ticket_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create assessment_workflow_history table
    op.create_table(
        'assessment_workflow_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('assignment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assessment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('action_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action_at', sa.DateTime(), nullable=False),
        sa.Column('forwarded_to', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('question_ids', postgresql.JSON, nullable=True),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('decision_comment', sa.Text(), nullable=True),
        sa.Column('previous_status', sa.String(50), nullable=True),
        sa.Column('new_status', sa.String(50), nullable=True),
        sa.Column('action_metadata', postgresql.JSON, nullable=True),
        sa.Column('workflow_ticket_id', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['assignment_id'], ['assessment_assignments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assessment_id'], ['assessments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['action_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['forwarded_to'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_assessment_workflow_history_assignment_id', 'assessment_workflow_history', ['assignment_id'])
    op.create_index('ix_assessment_workflow_history_action_by', 'assessment_workflow_history', ['action_by'])
    op.create_index('ix_assessment_workflow_history_action_at', 'assessment_workflow_history', ['action_at'])
    op.create_index('ix_assessment_workflow_history_forwarded_to', 'assessment_workflow_history', ['forwarded_to'])


def downgrade() -> None:
    op.drop_index('ix_assessment_workflow_history_forwarded_to', table_name='assessment_workflow_history')
    op.drop_index('ix_assessment_workflow_history_action_at', table_name='assessment_workflow_history')
    op.drop_index('ix_assessment_workflow_history_action_by', table_name='assessment_workflow_history')
    op.drop_index('ix_assessment_workflow_history_assignment_id', table_name='assessment_workflow_history')
    op.drop_table('assessment_workflow_history')

