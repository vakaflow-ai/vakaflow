"""add_missing_tenant_columns

Revision ID: 08f99d683b64
Revises: c56ba1106975
Create Date: 2026-01-18 04:58:45.596687

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '08f99d683b64'
down_revision = 'c56ba1106975'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing tenant columns
    op.add_column('tenants', sa.Column('industry', sa.String(100), nullable=True))
    op.add_column('tenants', sa.Column('timezone', sa.String(50), nullable=True, server_default='UTC'))
    op.add_column('tenants', sa.Column('locale', sa.String(10), nullable=True, server_default='en'))
    op.add_column('tenants', sa.Column('i18n_settings', sa.JSON(), nullable=True))
    op.add_column('tenants', sa.Column('website', sa.String(500), nullable=True))
    
    # Create indexes for new columns
    op.create_index('ix_tenants_industry', 'tenants', ['industry'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_tenants_industry', table_name='tenants')
    
    # Drop columns
    op.drop_column('tenants', 'website')
    op.drop_column('tenants', 'i18n_settings')
    op.drop_column('tenants', 'locale')
    op.drop_column('tenants', 'timezone')
    op.drop_column('tenants', 'industry')

