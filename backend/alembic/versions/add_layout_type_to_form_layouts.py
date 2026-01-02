"""Add layout_type to form_layouts

Revision ID: add_layout_type
Revises: 
Create Date: 2024-01-XX

This migration adds the layout_type column to form_layouts table to support
the simplified layout system (submission, approver, completed).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_layout_type'
down_revision = 'add_workflow_stage_servicenow'  # Corrected from add_entity_user_level
branch_labels = None
depends_on = None


def upgrade():
    # Add layout_type column
    op.add_column('form_layouts', sa.Column('layout_type', sa.String(50), nullable=True))
    
    # Create index for faster lookups
    op.create_index('ix_form_layouts_layout_type', 'form_layouts', ['layout_type'])
    
    # Populate layout_type based on workflow_stage (using mapping logic)
    # This maps stages to layout types:
    # - submission: new, needs_revision
    # - approver: pending_approval, pending_review, in_progress
    # - completed: approved, rejected, closed, cancelled
    op.execute("""
        UPDATE form_layouts
        SET layout_type = CASE
            WHEN workflow_stage IN ('new', 'needs_revision') THEN 'submission'
            WHEN workflow_stage IN ('pending_approval', 'pending_review', 'in_progress') THEN 'approver'
            WHEN workflow_stage IN ('approved', 'rejected', 'closed', 'cancelled') THEN 'completed'
            ELSE 'submission'  -- Default fallback
        END
        WHERE layout_type IS NULL
    """)


def downgrade():
    # Drop index
    op.drop_index('ix_form_layouts_layout_type', table_name='form_layouts')
    
    # Drop column
    op.drop_column('form_layouts', 'layout_type')

