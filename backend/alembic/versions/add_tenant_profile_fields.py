"""add_tenant_profile_fields

Revision ID: add_tenant_profile_fields
Revises: 257d23eb034a
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_tenant_profile_fields'
down_revision = '257d23eb034a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tenant profile fields
    op.add_column('tenants', sa.Column('industry', sa.String(100), nullable=True))
    op.add_column('tenants', sa.Column('timezone', sa.String(50), nullable=True, server_default='UTC'))
    op.add_column('tenants', sa.Column('locale', sa.String(10), nullable=True, server_default='en'))
    op.add_column('tenants', sa.Column('i18n_settings', postgresql.JSON, nullable=True))
    
    # Create index on industry for faster filtering
    op.create_index('ix_tenants_industry', 'tenants', ['industry'])


def downgrade() -> None:
    op.drop_index('ix_tenants_industry', table_name='tenants')
    op.drop_column('tenants', 'i18n_settings')
    op.drop_column('tenants', 'locale')
    op.drop_column('tenants', 'timezone')
    op.drop_column('tenants', 'industry')
