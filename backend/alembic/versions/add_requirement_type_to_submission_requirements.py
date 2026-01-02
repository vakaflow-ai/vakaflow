"""add_requirement_type_to_submission_requirements

Revision ID: add_requirement_type
Revises: 85282629912d
Create Date: 2025-12-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_requirement_type'
down_revision = '85282629912d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add requirement_type column to submission_requirements (MANDATORY)
    # First add as nullable to allow existing data
    op.add_column('submission_requirements', sa.Column('requirement_type', sa.String(50), nullable=True))
    
    # Set default values based on existing data
    # If section is 'Risks', set to 'risk'
    op.execute("""
        UPDATE submission_requirements 
        SET requirement_type = 'risk' 
        WHERE section = 'Risks' OR source_type = 'risk'
    """)
    
    # If section is 'Compliance Frameworks' or source_type is 'framework', set to 'compliance'
    op.execute("""
        UPDATE submission_requirements 
        SET requirement_type = 'compliance' 
        WHERE section = 'Compliance Frameworks' OR source_type = 'framework'
    """)
    
    # If questionnaire_type is set, set to 'questionnaires'
    op.execute("""
        UPDATE submission_requirements 
        SET requirement_type = 'questionnaires' 
        WHERE questionnaire_type IS NOT NULL
    """)
    
    # For any remaining null values, default to 'compliance' (most common)
    op.execute("""
        UPDATE submission_requirements 
        SET requirement_type = 'compliance' 
        WHERE requirement_type IS NULL
    """)
    
    # Now make it non-nullable
    op.alter_column('submission_requirements', 'requirement_type', nullable=False)
    
    # Add comment to explain the new column
    op.execute("COMMENT ON COLUMN submission_requirements.requirement_type IS 'Requirement type: compliance, risk, or questionnaires (MANDATORY)'")
    
    # Create index for better query performance
    op.create_index('ix_submission_requirements_requirement_type', 'submission_requirements', ['requirement_type'])


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_submission_requirements_requirement_type', table_name='submission_requirements')
    
    # Drop column
    op.drop_column('submission_requirements', 'requirement_type')
