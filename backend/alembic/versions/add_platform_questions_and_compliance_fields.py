"""add_platform_questions_and_compliance_fields

Revision ID: add_platform_questions_compliance
Revises: dc17987cba32
Create Date: 2025-01-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_platform_q_compliance'
down_revision = 'add_assignment_id_approval'  # Current head
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make tenant_id nullable to support platform-wide questions
    op.alter_column('question_library', 'tenant_id',
                    existing_type=postgresql.UUID(as_uuid=True),
                    nullable=True,
                    existing_nullable=False)
    
    # Add new fields for compliance and risk framework mapping
    op.add_column('question_library', sa.Column('risk_framework_ids', postgresql.JSON, nullable=True))
    op.add_column('question_library', sa.Column('applicable_vendor_types', postgresql.JSON, nullable=True))
    op.add_column('question_library', sa.Column('pass_fail_criteria', postgresql.JSON, nullable=True))
    
    # Add index for platform-wide questions (tenant_id IS NULL)
    op.create_index('ix_question_library_platform_questions', 'question_library', ['tenant_id'], 
                    unique=False, postgresql_where=sa.text('tenant_id IS NULL'))


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_question_library_platform_questions', table_name='question_library')
    
    # Remove new columns
    op.drop_column('question_library', 'pass_fail_criteria')
    op.drop_column('question_library', 'applicable_vendor_types')
    op.drop_column('question_library', 'risk_framework_ids')
    
    # Make tenant_id non-nullable again (set default for any null values first)
    # Note: This will fail if there are null tenant_ids, so handle carefully
    op.execute("UPDATE question_library SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL")
    op.alter_column('question_library', 'tenant_id',
                    existing_type=postgresql.UUID(as_uuid=True),
                    nullable=False,
                    existing_nullable=True)
