"""Add auto-generation fields to submission requirements

Revision ID: 018
Revises: 017
Create Date: 2025-12-06 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    # Add auto-generation fields to submission_requirements table
    op.add_column('submission_requirements', sa.Column('source_type', sa.String(50), nullable=True))
    op.add_column('submission_requirements', sa.Column('source_id', sa.String(255), nullable=True))
    op.add_column('submission_requirements', sa.Column('source_name', sa.String(255), nullable=True))
    op.add_column('submission_requirements', sa.Column('is_auto_generated', sa.Boolean(), default=False))
    op.add_column('submission_requirements', sa.Column('is_enabled', sa.Boolean(), default=True))
    
    # Create indexes for filtering
    op.create_index('ix_submission_requirements_source_type', 'submission_requirements', ['source_type'])
    op.create_index('ix_submission_requirements_source_id', 'submission_requirements', ['source_id'])
    op.create_index('ix_submission_requirements_is_enabled', 'submission_requirements', ['is_enabled'])


def downgrade():
    op.drop_index('ix_submission_requirements_is_enabled', table_name='submission_requirements')
    op.drop_index('ix_submission_requirements_source_id', table_name='submission_requirements')
    op.drop_index('ix_submission_requirements_source_type', table_name='submission_requirements')
    op.drop_column('submission_requirements', 'is_enabled')
    op.drop_column('submission_requirements', 'is_auto_generated')
    op.drop_column('submission_requirements', 'source_name')
    op.drop_column('submission_requirements', 'source_id')
    op.drop_column('submission_requirements', 'source_type')

