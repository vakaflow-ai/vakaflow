"""Create requirement_questions junction table for many-to-many relationship

Revision ID: create_requirement_questions_junction
Revises: move_questions_to_library
Create Date: 2025-12-13

This migration creates a many-to-many relationship between requirements and questions,
replacing the JSON array approach in question_library.requirement_ids.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'req_questions_junction'
down_revision = 'move_questions_to_library'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create requirement_questions junction table and migrate existing data.
    """
    conn = op.get_bind()
    
    # Create junction table for many-to-many relationship
    op.create_table(
        'requirement_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('requirement_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order', sa.Integer(), server_default='0'),  # Order of question within requirement
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['requirement_id'], ['submission_requirements.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['question_id'], ['question_library.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    )
    
    # Create indexes
    op.create_index('ix_requirement_questions_requirement_id', 'requirement_questions', ['requirement_id'])
    op.create_index('ix_requirement_questions_question_id', 'requirement_questions', ['question_id'])
    op.create_index('ix_requirement_questions_tenant_id', 'requirement_questions', ['tenant_id'])
    op.create_unique_constraint('uq_requirement_question', 'requirement_questions', ['requirement_id', 'question_id'])
    
    # Migrate existing requirement_ids JSON data to junction table
    # For each question in question_library that has requirement_ids, create junction records
    conn.execute(text("""
        INSERT INTO requirement_questions (requirement_id, question_id, tenant_id, "order", created_at, updated_at)
        SELECT 
            (requirement_id::uuid) as requirement_id,
            ql.id as question_id,
            ql.tenant_id,
            ROW_NUMBER() OVER (PARTITION BY ql.id ORDER BY requirement_id) - 1 as "order",
            ql.created_at,
            ql.updated_at
        FROM question_library ql
        CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE 
                WHEN ql.requirement_ids IS NULL THEN '[]'::jsonb
                WHEN jsonb_typeof(ql.requirement_ids::jsonb) = 'array' THEN ql.requirement_ids::jsonb
                ELSE '[]'::jsonb
            END
        ) AS requirement_id
        WHERE ql.requirement_ids IS NOT NULL 
        AND jsonb_typeof(COALESCE(ql.requirement_ids::jsonb, '[]'::jsonb)) = 'array'
        AND jsonb_array_length(
            CASE 
                WHEN ql.requirement_ids IS NULL THEN '[]'::jsonb
                WHEN jsonb_typeof(ql.requirement_ids::jsonb) = 'array' THEN ql.requirement_ids::jsonb
                ELSE '[]'::jsonb
            END
        ) > 0
        AND EXISTS (
            SELECT 1 FROM submission_requirements sr 
            WHERE sr.id = requirement_id::uuid
        )
        ON CONFLICT (requirement_id, question_id) DO NOTHING
    """))
    
    # Clean up requirements table: Delete any requirements with requirement_type='questionnaires'
    # These should have been moved to question_library already
    conn.execute(text("""
        DELETE FROM submission_requirements 
        WHERE requirement_type = 'questionnaires'
        AND id IN (
            SELECT id FROM question_library
        )
    """))


def downgrade() -> None:
    """
    Reverse the migration: populate requirement_ids JSON from junction table, then drop table.
    """
    conn = op.get_bind()
    
    # Populate requirement_ids JSON array from junction table
    conn.execute(text("""
        UPDATE question_library ql
        SET requirement_ids = (
            SELECT jsonb_agg(rq.requirement_id::text ORDER BY rq."order")
            FROM requirement_questions rq
            WHERE rq.question_id = ql.id
        )
        WHERE EXISTS (
            SELECT 1 FROM requirement_questions rq WHERE rq.question_id = ql.id
        )
    """))
    
    # Drop the junction table
    op.drop_table('requirement_questions')


