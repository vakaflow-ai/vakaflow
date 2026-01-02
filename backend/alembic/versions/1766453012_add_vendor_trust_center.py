"""Add vendor trust center fields

Revision ID: 1766453012
Revises: 9a3b48d1722d
Create Date: 2024-12-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '1766453012'
down_revision = '9a3b48d1722d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add trust center fields to vendors table
    op.add_column('vendors', sa.Column('trust_center_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('vendors', sa.Column('compliance_score', sa.Integer(), nullable=True))
    op.add_column('vendors', sa.Column('compliance_url', sa.Text(), nullable=True))
    op.add_column('vendors', sa.Column('security_policy_url', sa.Text(), nullable=True))
    op.add_column('vendors', sa.Column('privacy_policy_url', sa.Text(), nullable=True))
    op.add_column('vendors', sa.Column('customer_logos', postgresql.JSONB(), nullable=True))
    op.add_column('vendors', sa.Column('published_artifacts', postgresql.JSONB(), nullable=True))
    op.add_column('vendors', sa.Column('published_documents', postgresql.JSONB(), nullable=True))
    op.add_column('vendors', sa.Column('compliance_certifications', postgresql.JSONB(), nullable=True))
    op.add_column('vendors', sa.Column('trust_center_slug', sa.String(100), nullable=True, unique=True))


def downgrade() -> None:
    op.drop_column('vendors', 'trust_center_slug')
    op.drop_column('vendors', 'compliance_certifications')
    op.drop_column('vendors', 'published_documents')
    op.drop_column('vendors', 'published_artifacts')
    op.drop_column('vendors', 'customer_logos')
    op.drop_column('vendors', 'privacy_policy_url')
    op.drop_column('vendors', 'security_policy_url')
    op.drop_column('vendors', 'compliance_url')
    op.drop_column('vendors', 'compliance_score')
    op.drop_column('vendors', 'trust_center_enabled')
