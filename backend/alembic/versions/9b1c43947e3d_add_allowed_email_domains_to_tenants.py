"""add_allowed_email_domains_to_tenants

Revision ID: 9b1c43947e3d
Revises: a1b2c3d4e5f6
Create Date: 2025-12-06 22:40:43.291431

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '9b1c43947e3d'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add allowed_email_domains column to tenants table
    try:
        op.add_column('tenants', sa.Column('allowed_email_domains', postgresql.JSONB(), nullable=True))
    except Exception:
        # Column might already exist
        pass
    
    # Add sso_domain_mapping column to tenants table
    try:
        op.add_column('tenants', sa.Column('sso_domain_mapping', postgresql.JSONB(), nullable=True))
    except Exception:
        # Column might already exist
        pass


def downgrade() -> None:
    try:
        op.drop_column('tenants', 'sso_domain_mapping')
    except Exception:
        pass
    try:
        op.drop_column('tenants', 'allowed_email_domains')
    except Exception:
        pass

