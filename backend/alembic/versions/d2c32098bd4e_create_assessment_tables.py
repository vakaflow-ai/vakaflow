"""create_assessment_tables

Revision ID: d2c32098bd4e
Revises: add_catalog_id
Create Date: 2025-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd2c32098bd4e'
down_revision = 'add_catalog_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create assessments table
    op.create_table(
        'assessments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('assessment_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('team_ids', postgresql.JSON, nullable=True),
        sa.Column('assignment_rules', postgresql.JSON, nullable=True),
        sa.Column('schedule_enabled', sa.Boolean(), server_default='false'),
        sa.Column('schedule_frequency', sa.String(50), nullable=True),
        sa.Column('schedule_interval_months', sa.Integer(), nullable=True),
        sa.Column('last_scheduled_date', sa.DateTime(), nullable=True),
        sa.Column('next_scheduled_date', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
    )
    op.create_index('ix_assessments_tenant_id', 'assessments', ['tenant_id'])
    
    # Create assessment_questions table
    op.create_table(
        'assessment_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('assessment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('question_type', sa.String(50), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=True),
        sa.Column('field_type', sa.String(50), nullable=True),
        sa.Column('is_required', sa.Boolean(), server_default='false'),
        sa.Column('options', postgresql.JSON, nullable=True),
        sa.Column('validation_rules', postgresql.JSON, nullable=True),
        sa.Column('requirement_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('order', sa.Integer(), server_default='0'),
        sa.Column('section', sa.String(100), nullable=True),
        sa.Column('is_reusable', sa.Boolean(), server_default='false'),
        sa.Column('reusable_question_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['assessment_id'], ['assessments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requirement_id'], ['submission_requirements.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reusable_question_id'], ['assessment_questions.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_assessment_questions_assessment_id', 'assessment_questions', ['assessment_id'])
    op.create_index('ix_assessment_questions_tenant_id', 'assessment_questions', ['tenant_id'])
    op.create_index('ix_assessment_questions_requirement_id', 'assessment_questions', ['requirement_id'])
    
    # Create assessment_schedules table
    op.create_table(
        'assessment_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('assessment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scheduled_date', sa.DateTime(), nullable=False),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('frequency', sa.String(50), nullable=False),
        sa.Column('selected_vendor_ids', postgresql.JSON, nullable=True),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('triggered_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['assessment_id'], ['assessments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
    )
    op.create_index('ix_assessment_schedules_assessment_id', 'assessment_schedules', ['assessment_id'])
    op.create_index('ix_assessment_schedules_tenant_id', 'assessment_schedules', ['tenant_id'])
    
    # Create assessment_assignments table
    op.create_table(
        'assessment_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('assessment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('schedule_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assignment_type', sa.String(50), nullable=False),
        sa.Column('assigned_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('assigned_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['assessment_id'], ['assessments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['schedule_id'], ['assessment_schedules.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], ondelete='RESTRICT'),
    )
    op.create_index('ix_assessment_assignments_assessment_id', 'assessment_assignments', ['assessment_id'])
    op.create_index('ix_assessment_assignments_schedule_id', 'assessment_assignments', ['schedule_id'])
    op.create_index('ix_assessment_assignments_tenant_id', 'assessment_assignments', ['tenant_id'])
    op.create_index('ix_assessment_assignments_vendor_id', 'assessment_assignments', ['vendor_id'])
    op.create_index('ix_assessment_assignments_agent_id', 'assessment_assignments', ['agent_id'])


def downgrade() -> None:
    op.drop_index('ix_assessment_assignments_agent_id', table_name='assessment_assignments')
    op.drop_index('ix_assessment_assignments_vendor_id', table_name='assessment_assignments')
    op.drop_index('ix_assessment_assignments_tenant_id', table_name='assessment_assignments')
    op.drop_index('ix_assessment_assignments_schedule_id', table_name='assessment_assignments')
    op.drop_index('ix_assessment_assignments_assessment_id', table_name='assessment_assignments')
    op.drop_table('assessment_assignments')
    
    op.drop_index('ix_assessment_schedules_tenant_id', table_name='assessment_schedules')
    op.drop_index('ix_assessment_schedules_assessment_id', table_name='assessment_schedules')
    op.drop_table('assessment_schedules')
    
    op.drop_index('ix_assessment_questions_requirement_id', table_name='assessment_questions')
    op.drop_index('ix_assessment_questions_tenant_id', table_name='assessment_questions')
    op.drop_index('ix_assessment_questions_assessment_id', table_name='assessment_questions')
    op.drop_table('assessment_questions')
    
    op.drop_index('ix_assessments_tenant_id', table_name='assessments')
    op.drop_table('assessments')
