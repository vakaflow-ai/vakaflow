"""add_products_and_services_tables

Revision ID: add_products_services
Revises: add_supplier_master
Create Date: 2025-01-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_products_services'
down_revision = 'add_supplier_master'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create products table
    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Product identification
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('product_type', sa.String(100), nullable=False),  # software, hardware, saas, etc.
        sa.Column('category', sa.String(100), nullable=True),  # security, compliance, automation, etc.
        sa.Column('subcategory', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('version', sa.String(50), nullable=True),
        
        # Product details
        sa.Column('sku', sa.String(100), nullable=True),
        sa.Column('pricing_model', sa.String(50), nullable=True),  # subscription, one-time, usage-based
        sa.Column('website', sa.String(255), nullable=True),
        
        # Status and lifecycle
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('approval_date', sa.DateTime(), nullable=True),
        
        # Compliance and risk
        sa.Column('compliance_score', sa.Integer(), nullable=True),
        sa.Column('risk_score', sa.Integer(), nullable=True),
        
        # Ecosystem mapping fields (MVP - simple fields)
        sa.Column('use_cases', sa.Text(), nullable=True),  # Rich text area - list of use cases
        sa.Column('integration_points', postgresql.JSON, nullable=True),  # Integration with other products/services
        sa.Column('business_value', postgresql.JSON, nullable=True),  # Business value metrics
        sa.Column('deployment_info', postgresql.JSON, nullable=True),  # Deployment details
        
        # Extra metadata (using extra_metadata to avoid SQLAlchemy reserved name conflict)
        sa.Column('extra_metadata', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_products_vendor_id', 'products', ['vendor_id'])
    op.create_index('ix_products_tenant_id', 'products', ['tenant_id'])
    op.create_index('ix_products_sku', 'products', ['sku'], unique=True, postgresql_where=sa.text('sku IS NOT NULL'))
    op.create_foreign_key('fk_products_vendor', 'products', 'vendors', ['vendor_id'], ['id'])

    # Create services table
    op.create_table(
        'services',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Service identification
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('service_type', sa.String(100), nullable=False),  # consulting, support, managed_service, etc.
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        
        # Service details
        sa.Column('service_level', sa.String(50), nullable=True),  # basic, standard, premium
        sa.Column('pricing_model', sa.String(50), nullable=True),
        
        # Status
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        
        # Compliance and risk
        sa.Column('compliance_score', sa.Integer(), nullable=True),
        sa.Column('risk_score', sa.Integer(), nullable=True),
        
        # Ecosystem mapping fields (MVP - simple fields)
        sa.Column('use_cases', sa.Text(), nullable=True),  # Rich text area - list of use cases
        sa.Column('integration_points', postgresql.JSON, nullable=True),  # Integration with other products/services
        sa.Column('business_value', postgresql.JSON, nullable=True),  # Business value metrics
        sa.Column('deployment_info', postgresql.JSON, nullable=True),  # Deployment details
        
        # Extra metadata (using extra_metadata to avoid SQLAlchemy reserved name conflict)
        sa.Column('extra_metadata', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_services_vendor_id', 'services', ['vendor_id'])
    op.create_index('ix_services_tenant_id', 'services', ['tenant_id'])
    op.create_foreign_key('fk_services_vendor', 'services', 'vendors', ['vendor_id'], ['id'])

    # Create agent_products junction table
    op.create_table(
        'agent_products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relationship_type', sa.String(50), nullable=True),  # component, integration, dependency
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_agent_products_agent_id', 'agent_products', ['agent_id'])
    op.create_index('ix_agent_products_product_id', 'agent_products', ['product_id'])
    op.create_unique_constraint('uq_agent_product', 'agent_products', ['agent_id', 'product_id'])
    op.create_foreign_key('fk_agent_products_agent', 'agent_products', 'agents', ['agent_id'], ['id'])
    op.create_foreign_key('fk_agent_products_product', 'agent_products', 'products', ['product_id'], ['id'])

    # Add tenant_id and use_cases to agents table
    op.add_column('agents', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('agents', sa.Column('use_cases', sa.Text(), nullable=True))
    op.create_index('ix_agents_tenant_id', 'agents', ['tenant_id'])


def downgrade() -> None:
    # Remove agent additions
    op.drop_index('ix_agents_tenant_id', 'agents')
    op.drop_column('agents', 'use_cases')
    op.drop_column('agents', 'tenant_id')
    
    # Drop junction table
    op.drop_table('agent_products')
    
    # Drop services table
    op.drop_table('services')
    
    # Drop products table
    op.drop_table('products')
