"""Add workflow_ticket_id to assessment_assignments

Revision ID: add_workflow_ticket_id
Revises: edfd7ee9d01a
Create Date: 2025-01-02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_workflow_ticket_id'
down_revision = 'edfd7ee9d01a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add workflow_ticket_id column to assessment_assignments
    op.add_column('assessment_assignments', sa.Column('workflow_ticket_id', sa.String(50), nullable=True))
    op.create_index('ix_assessment_assignments_workflow_ticket_id', 'assessment_assignments', ['workflow_ticket_id'])


def downgrade() -> None:
    op.drop_index('ix_assessment_assignments_workflow_ticket_id', table_name='assessment_assignments')
    op.drop_column('assessment_assignments', 'workflow_ticket_id')

