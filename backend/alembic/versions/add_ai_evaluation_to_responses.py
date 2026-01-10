"""add_ai_evaluation_to_responses

Revision ID: add_ai_eval_to_responses
Revises: add_platform_questions_compliance
Create Date: 2025-01-24 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_ai_eval_responses'
down_revision = 'add_platform_q_compliance'  # Previous migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add AI evaluation column to assessment_question_responses
    op.add_column('assessment_question_responses', sa.Column('ai_evaluation', postgresql.JSON, nullable=True))


def downgrade() -> None:
    # Remove AI evaluation column
    op.drop_column('assessment_question_responses', 'ai_evaluation')
