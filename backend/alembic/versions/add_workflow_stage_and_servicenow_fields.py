"""add_workflow_stage_and_servicenow_fields

Revision ID: add_workflow_stage_servicenow
Revises: add_form_types_table
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = 'add_workflow_stage_servicenow'
down_revision = '0fa08898e235'  # Merge migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add workflow_stage column to form_layouts table
    op.add_column('form_layouts', sa.Column('workflow_stage', sa.String(50), nullable=False, server_default='new'))
    
    # Add ServiceNow integration fields to form_layouts
    op.add_column('form_layouts', sa.Column('servicenow_table', sa.String(100), nullable=True))
    op.add_column('form_layouts', sa.Column('servicenow_state_mapping', JSON, nullable=True))
    
    # Add workflow_stage column to form_field_access table
    op.add_column('form_field_access', sa.Column('workflow_stage', sa.String(50), nullable=False, server_default='new'))
    
    # Add ServiceNow integration fields to form_types table
    op.add_column('form_types', sa.Column('servicenow_table', sa.String(100), nullable=True))
    op.add_column('form_types', sa.Column('servicenow_state_mapping', JSON, nullable=True))
    
    # Update existing records to have default workflow_stage
    # For form_layouts, set workflow_stage based on request_type (legacy mapping)
    op.execute("""
        UPDATE form_layouts 
        SET workflow_stage = CASE 
            WHEN request_type = 'vendor' THEN 'new'
            WHEN request_type = 'approver' THEN 'pending_approval'
            WHEN request_type = 'admin' THEN 'in_progress'
            WHEN request_type = 'end_user' THEN 'new'
            ELSE 'new'
        END
        WHERE workflow_stage = 'new'
    """)
    
    # For form_field_access, set workflow_stage based on request_type (legacy mapping)
    op.execute("""
        UPDATE form_field_access 
        SET workflow_stage = CASE 
            WHEN request_type = 'vendor' THEN 'new'
            WHEN request_type = 'approver' THEN 'pending_approval'
            WHEN request_type = 'admin' THEN 'in_progress'
            WHEN request_type = 'end_user' THEN 'new'
            ELSE 'new'
        END
        WHERE workflow_stage = 'new'
    """)


def downgrade() -> None:
    # Remove ServiceNow fields from form_types
    op.drop_column('form_types', 'servicenow_state_mapping')
    op.drop_column('form_types', 'servicenow_table')
    
    # Remove workflow_stage and ServiceNow fields from form_field_access
    op.drop_column('form_field_access', 'workflow_stage')
    
    # Remove workflow_stage and ServiceNow fields from form_layouts
    op.drop_column('form_layouts', 'servicenow_state_mapping')
    op.drop_column('form_layouts', 'servicenow_table')
    op.drop_column('form_layouts', 'workflow_stage')
