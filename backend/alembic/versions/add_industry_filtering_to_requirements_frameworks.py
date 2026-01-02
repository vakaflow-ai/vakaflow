"""add_industry_filtering_to_requirements_frameworks

Revision ID: add_industry_filtering
Revises: add_tenant_profile_fields
Create Date: 2025-01-15 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_industry_filtering'
down_revision = 'add_tenant_profile_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add applicable_industries to submission_requirements
    op.add_column('submission_requirements', sa.Column('applicable_industries', postgresql.JSON, nullable=True))
    
    # Add applicable_industries to compliance_frameworks
    op.add_column('compliance_frameworks', sa.Column('applicable_industries', postgresql.JSON, nullable=True))


def downgrade() -> None:
    op.drop_column('compliance_frameworks', 'applicable_industries')
    op.drop_column('submission_requirements', 'applicable_industries')
