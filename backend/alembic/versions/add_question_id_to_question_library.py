"""add question_id to question_library

Revision ID: add_qid_to_q_lib
Revises: add_role_configurations
Create Date: 2025-01-23 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_qid_to_q_lib'
down_revision = 'add_role_configurations'  # Update this to match your latest migration
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import text
    
    # Add question_id column to question_library table
    op.add_column('question_library', sa.Column('question_id', sa.String(length=50), nullable=True))
    op.create_index('ix_question_library_question_id', 'question_library', ['question_id'])
    
    # Backfill question_id for existing questions
    conn = op.get_bind()
    
    # Get all questions grouped by tenant and category
    questions = conn.execute(text("""
        SELECT id, tenant_id, category, 
               ROW_NUMBER() OVER (PARTITION BY tenant_id, COALESCE(category, '') ORDER BY created_at) as seq
        FROM question_library
        WHERE question_id IS NULL
        ORDER BY tenant_id, COALESCE(category, ''), created_at
    """))
    
    for row in questions:
        question_uuid = row[0]
        tenant_id = row[1]
        category = row[2] or ''
        seq = row[3]
        
        # Generate category prefix
        if category:
            category_prefix = category[:3].upper().replace(' ', '').replace('-', '').replace('_', '')
        else:
            category_prefix = 'GEN'
        
        # Generate question_id: Q-{CATEGORY}-{SEQ}
        question_id = f"Q-{category_prefix}-{seq:02d}"
        
        # Ensure uniqueness by checking if it exists
        max_attempts = 100
        attempt = 0
        while attempt < max_attempts:
            existing = conn.execute(text("""
                SELECT id FROM question_library 
                WHERE tenant_id = :tenant_id AND question_id = :question_id
            """), {"tenant_id": str(tenant_id), "question_id": question_id}).first()
            
            if not existing:
                break
            seq += 1
            question_id = f"Q-{category_prefix}-{seq:02d}"
            attempt += 1
        
        # Update the question with the generated question_id
        conn.execute(text("""
            UPDATE question_library 
            SET question_id = :question_id 
            WHERE id = :question_uuid
        """), {"question_id": question_id, "question_uuid": str(question_uuid)})


def downgrade():
    op.drop_index('ix_question_library_question_id', table_name='question_library')
    op.drop_column('question_library', 'question_id')

