"""Add tenant and licensing tables

Revision ID: 002
Revises: 001
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tenants table
    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False, unique=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('contact_email', sa.String(255), nullable=False),
        sa.Column('contact_name', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('license_tier', sa.String(50), nullable=False, server_default='trial'),
        sa.Column('license_features', postgresql.JSONB(), nullable=True),
        sa.Column('max_agents', sa.String(50), nullable=True),
        sa.Column('max_users', sa.String(50), nullable=True),
        sa.Column('onboarding_status', sa.String(50), nullable=False, server_default='not_started'),
        sa.Column('onboarding_completed_at', sa.DateTime(), nullable=True),
        sa.Column('settings', postgresql.JSONB(), nullable=True),
        sa.Column('custom_branding', postgresql.JSONB(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_tenants_slug', 'tenants', ['slug'])
    
    # Create license_features table
    op.create_table(
        'license_features',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('feature_key', sa.String(100), nullable=False, unique=True),
        sa.Column('feature_name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('default_enabled', sa.Boolean(), default=False),
        sa.Column('tier_availability', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_license_features_feature_key', 'license_features', ['feature_key'])
    
    # Create tenant_features table
    op.create_table(
        'tenant_features',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('feature_key', sa.String(100), nullable=False),
        sa.Column('enabled', sa.Boolean(), default=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_tenant_features_tenant_id', 'tenant_features', ['tenant_id'])
    op.create_index('ix_tenant_features_feature_key', 'tenant_features', ['feature_key'])
    
    # Add tenant_id to vendors table
    try:
        op.add_column('vendors', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_index('ix_vendors_tenant_id', 'vendors', ['tenant_id'])
    except Exception:
        # Column might already exist, try to create index only
        try:
            op.create_index('ix_vendors_tenant_id', 'vendors', ['tenant_id'])
        except Exception:
            pass  # Index might already exist


def downgrade() -> None:
    op.drop_index('ix_vendors_tenant_id', table_name='vendors')
    op.drop_column('vendors', 'tenant_id')
    op.drop_index('ix_tenant_features_feature_key', table_name='tenant_features')
    op.drop_index('ix_tenant_features_tenant_id', table_name='tenant_features')
    op.drop_table('tenant_features')
    op.drop_index('ix_license_features_feature_key', table_name='license_features')
    op.drop_table('license_features')
    op.drop_index('ix_tenants_slug', table_name='tenants')
    op.drop_table('tenants')

