"""add_questionnaire_type_to_submission_requirements

Revision ID: 85282629912d
Revises: 8661ef4cb80d
Create Date: 2025-12-11 10:20:46.388309

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '85282629912d'
down_revision = '8661ef4cb80d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add questionnaire_type column to submission_requirements
    op.add_column('submission_requirements', sa.Column('questionnaire_type', sa.String(100), nullable=True))
    
    # Add comment to explain the new column
    op.execute("COMMENT ON COLUMN submission_requirements.questionnaire_type IS 'Questionnaire type: TPRM- Questionnaire, Vendor Security Questionnaire, Sub Contractor Questionnaire, Vendor Qualification'")
    
    # Create index for better query performance
    op.create_index('ix_submission_requirements_questionnaire_type', 'submission_requirements', ['questionnaire_type'])


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_submission_requirements_questionnaire_type', table_name='submission_requirements')
    
    # Drop column
    op.drop_column('submission_requirements', 'questionnaire_type')

