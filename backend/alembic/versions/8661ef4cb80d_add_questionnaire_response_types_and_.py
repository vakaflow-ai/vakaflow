"""add_questionnaire_response_types_and_filtering

Revision ID: 8661ef4cb80d
Revises: 
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '8661ef4cb80d'
down_revision = 'add_workflow_stage_servicenow'
branch_labels = None
depends_on = None


def upgrade():
    # Add allowed_response_types column to submission_requirements
    op.add_column('submission_requirements', sa.Column('allowed_response_types', postgresql.JSON, nullable=True))

    # Add filter_conditions column to submission_requirements
    op.add_column('submission_requirements', sa.Column('filter_conditions', postgresql.JSON, nullable=True))

    # Add comment to explain the new columns
    op.execute("COMMENT ON COLUMN submission_requirements.allowed_response_types IS 'Questionnaire-style: Multiple response types allowed per question. JSON array: [\"text\", \"file\", \"url\"]'")
    op.execute("COMMENT ON COLUMN submission_requirements.filter_conditions IS 'Filter conditions for showing requirement based on agent metadata. JSON: {\"agent_category\": [\"Security\"], \"agent_type\": [\"AI_AGENT\"]}'")


def downgrade():
    op.drop_column('submission_requirements', 'filter_conditions')
    op.drop_column('submission_requirements', 'allowed_response_types')
