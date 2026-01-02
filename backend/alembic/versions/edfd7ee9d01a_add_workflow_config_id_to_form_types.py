"""add_workflow_config_id_to_form_types

Revision ID: edfd7ee9d01a
Revises: add_forms_table
Create Date: 2025-12-29 10:52:13.501755

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'edfd7ee9d01a'
down_revision = 'add_forms_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add workflow_config_id column to form_types table
    op.add_column(
        'form_types',
        sa.Column('workflow_config_id', UUID(as_uuid=True), nullable=True, index=True)
    )
    
    # Add comment to the column
    op.execute("COMMENT ON COLUMN form_types.workflow_config_id IS 'Link to WorkflowConfiguration - Business Process to Workflow Mapping'")


def downgrade() -> None:
    # Remove workflow_config_id column from form_types table
    op.drop_column('form_types', 'workflow_config_id')

