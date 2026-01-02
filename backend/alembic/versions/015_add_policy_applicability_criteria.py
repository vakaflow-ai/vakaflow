"""Add applicability criteria to policies

Revision ID: 015
Revises: 014
Create Date: 2025-12-06 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('policies', sa.Column('applicability_criteria', postgresql.JSON(), nullable=True))


def downgrade():
    op.drop_column('policies', 'applicability_criteria')
