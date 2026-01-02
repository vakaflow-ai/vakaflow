"""Add submission requirements

Revision ID: 013_add_submission_requirements
Revises: 012_add_vendor_logo_agent_enhancements
Create Date: 2025-12-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '013_add_submission_requirements'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade():
    # Create submission_requirements table
    op.create_table(
        'submission_requirements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('label', sa.String(255), nullable=False),
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('placeholder', sa.String(255), nullable=True),
        sa.Column('is_required', sa.Boolean(), default=False),
        sa.Column('min_length', sa.Integer(), nullable=True),
        sa.Column('max_length', sa.Integer(), nullable=True),
        sa.Column('min_value', sa.Integer(), nullable=True),
        sa.Column('max_value', sa.Integer(), nullable=True),
        sa.Column('pattern', sa.String(255), nullable=True),
        sa.Column('options', postgresql.JSON(), nullable=True),
        sa.Column('category', sa.String(50), nullable=False, server_default='general'),
        sa.Column('section', sa.String(100), nullable=True),
        sa.Column('order', sa.Integer(), default=0),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_submission_requirements_tenant_id', 'submission_requirements', ['tenant_id'])
    
    # Create submission_requirement_responses table
    op.create_table(
        'submission_requirement_responses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('requirement_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('value', postgresql.JSON(), nullable=True),
        sa.Column('file_path', sa.Text(), nullable=True),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('file_type', sa.String(100), nullable=True),
        sa.Column('submitted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['requirement_id'], ['submission_requirements.id']),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id']),
    )
    op.create_index('ix_submission_requirement_responses_agent_id', 'submission_requirement_responses', ['agent_id'])
    op.create_index('ix_submission_requirement_responses_requirement_id', 'submission_requirement_responses', ['requirement_id'])


def downgrade():
    op.drop_index('ix_submission_requirement_responses_requirement_id', 'submission_requirement_responses')
    op.drop_index('ix_submission_requirement_responses_agent_id', 'submission_requirement_responses')
    op.drop_table('submission_requirement_responses')
    op.drop_index('ix_submission_requirements_tenant_id', 'submission_requirements')
    op.drop_table('submission_requirements')

