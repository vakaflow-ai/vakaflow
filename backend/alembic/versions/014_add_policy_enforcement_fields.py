"""Add enforcement controls, required attributes, and qualification criteria to policies

Revision ID: 014_add_policy_enforcement_fields
Revises: 013_add_submission_requirements
Create Date: 2025-12-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '014'
down_revision = '013_add_submission_requirements'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('policies', sa.Column('enforcement_controls', postgresql.JSON(), nullable=True))
    op.add_column('policies', sa.Column('required_attributes', postgresql.JSON(), nullable=True))
    op.add_column('policies', sa.Column('qualification_criteria', postgresql.JSON(), nullable=True))


def downgrade():
    op.drop_column('policies', 'qualification_criteria')
    op.drop_column('policies', 'required_attributes')
    op.drop_column('policies', 'enforcement_controls')
