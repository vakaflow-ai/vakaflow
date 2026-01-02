"""Add assessment fields and question library

Revision ID: add_assessment_fields
Revises: 
Create Date: 2025-12-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_assessment_fields'
down_revision = 'add_industry_filtering'  # After industry filtering migration (current head)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new fields to assessments table
    op.add_column('assessments', sa.Column('assessment_id', sa.String(100), nullable=True))
    op.add_column('assessments', sa.Column('business_purpose', sa.Text(), nullable=True))
    op.add_column('assessments', sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Create index on assessment_id
    op.create_index('ix_assessments_assessment_id', 'assessments', ['assessment_id'], unique=True)
    
    # Add foreign key for updated_by
    op.create_foreign_key('fk_assessments_updated_by', 'assessments', 'users', ['updated_by'], ['id'])
    
    # Add new fields to assessment_questions table
    op.add_column('assessment_questions', sa.Column('title', sa.String(255), nullable=True))
    op.add_column('assessment_questions', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('assessment_questions', sa.Column('response_type', sa.String(50), nullable=True))
    op.add_column('assessment_questions', sa.Column('category', sa.String(100), nullable=True))
    
    # Create question_library table
    op.create_table(
        'question_library',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('assessment_type', sa.String(50), nullable=False),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('response_type', sa.String(50), nullable=False),
        sa.Column('is_required', sa.Boolean(), default=False),
        sa.Column('options', postgresql.JSON, nullable=True),
        sa.Column('validation_rules', postgresql.JSON, nullable=True),
        sa.Column('requirement_ids', postgresql.JSON, nullable=True),
        sa.Column('compliance_framework_ids', postgresql.JSON, nullable=True),
        sa.Column('applicable_industries', postgresql.JSON, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('usage_count', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_question_library_tenant_id', 'question_library', ['tenant_id'])
    op.create_foreign_key('fk_question_library_tenant', 'question_library', 'tenants', ['tenant_id'], ['id'])
    op.create_foreign_key('fk_question_library_created_by', 'question_library', 'users', ['created_by'], ['id'])
    op.create_foreign_key('fk_question_library_updated_by', 'question_library', 'users', ['updated_by'], ['id'])
    
    # Create assessment_rules table
    op.create_table(
        'assessment_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('rule_type', sa.String(50), nullable=False),
        sa.Column('match_conditions', postgresql.JSON, nullable=False),
        sa.Column('question_ids', postgresql.JSON, nullable=True),
        sa.Column('requirement_ids', postgresql.JSON, nullable=True),
        sa.Column('priority', sa.Integer(), default=100),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_automatic', sa.Boolean(), default=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_assessment_rules_tenant_id', 'assessment_rules', ['tenant_id'])
    op.create_foreign_key('fk_assessment_rules_tenant', 'assessment_rules', 'tenants', ['tenant_id'], ['id'])
    op.create_foreign_key('fk_assessment_rules_created_by', 'assessment_rules', 'users', ['created_by'], ['id'])
    op.create_foreign_key('fk_assessment_rules_updated_by', 'assessment_rules', 'users', ['updated_by'], ['id'])


def downgrade() -> None:
    # Drop assessment_rules table
    op.drop_table('assessment_rules')
    
    # Drop question_library table
    op.drop_table('question_library')
    
    # Remove columns from assessment_questions
    op.drop_column('assessment_questions', 'category')
    op.drop_column('assessment_questions', 'response_type')
    op.drop_column('assessment_questions', 'description')
    op.drop_column('assessment_questions', 'title')
    
    # Remove columns from assessments
    op.drop_constraint('fk_assessments_updated_by', 'assessments', type_='foreignkey')
    op.drop_index('ix_assessments_assessment_id', 'assessments')
    op.drop_column('assessments', 'updated_by')
    op.drop_column('assessments', 'business_purpose')
    op.drop_column('assessments', 'assessment_id')
