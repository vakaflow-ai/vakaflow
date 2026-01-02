"""add_entity_field_registry_tables

Revision ID: add_entity_field_registry
Revises: remove_field_name
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_entity_field_registry'
down_revision = 'add_custom_field_catalog'  # After custom_field_catalog migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create entity_field_registry table
    op.create_table(
        'entity_field_registry',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('entity_name', sa.String(100), nullable=False),
        sa.Column('entity_label', sa.String(255), nullable=False),
        sa.Column('entity_category', sa.String(100), nullable=True),
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('field_label', sa.String(255), nullable=False),
        sa.Column('field_description', sa.Text(), nullable=True),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('field_type_display', sa.String(50), nullable=False),
        sa.Column('is_nullable', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_primary_key', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_foreign_key', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('foreign_key_table', sa.String(100), nullable=True),
        sa.Column('max_length', sa.Integer(), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_visible', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_editable', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_auto_discovered', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_custom', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('field_config', postgresql.JSON, nullable=True),
        sa.Column('default_view_roles', postgresql.JSON, nullable=True),
        sa.Column('default_edit_roles', postgresql.JSON, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_discovered_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('tenant_id', 'entity_name', 'field_name', name='uq_entity_field_registry'),
    )
    
    # Create entity_permissions table
    op.create_table(
        'entity_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('entity_name', sa.String(100), nullable=False),
        sa.Column('entity_label', sa.String(255), nullable=False),
        sa.Column('entity_category', sa.String(100), nullable=True),
        sa.Column('role_permissions', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('data_filter_rule_ids', postgresql.JSON, nullable=True),
        sa.Column('data_filter_rule_config', postgresql.JSON, nullable=True),
        sa.Column('enforce_tenant_isolation', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('tenant_id', 'entity_name', name='uq_entity_permissions'),
    )
    
    # Create entity_field_permissions table
    op.create_table(
        'entity_field_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('entity_name', sa.String(100), nullable=False),
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('entity_field_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('role_permissions', postgresql.JSON, nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['entity_field_id'], ['entity_field_registry.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('tenant_id', 'entity_name', 'field_name', name='uq_entity_field_permissions'),
    )
    
    # Create indexes
    op.create_index('ix_entity_field_registry_tenant_id', 'entity_field_registry', ['tenant_id'])
    op.create_index('ix_entity_field_registry_entity_name', 'entity_field_registry', ['entity_name'])
    op.create_index('ix_entity_field_registry_field_name', 'entity_field_registry', ['field_name'])
    op.create_index('ix_entity_field_registry_entity_category', 'entity_field_registry', ['entity_category'])
    op.create_index('ix_entity_field_registry_is_enabled', 'entity_field_registry', ['is_enabled'])
    
    op.create_index('ix_entity_permissions_tenant_id', 'entity_permissions', ['tenant_id'])
    op.create_index('ix_entity_permissions_entity_name', 'entity_permissions', ['entity_name'])
    op.create_index('ix_entity_permissions_entity_category', 'entity_permissions', ['entity_category'])
    op.create_index('ix_entity_permissions_is_active', 'entity_permissions', ['is_active'])
    
    op.create_index('ix_entity_field_permissions_tenant_id', 'entity_field_permissions', ['tenant_id'])
    op.create_index('ix_entity_field_permissions_entity_name', 'entity_field_permissions', ['entity_name'])
    op.create_index('ix_entity_field_permissions_field_name', 'entity_field_permissions', ['field_name'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_entity_field_permissions_field_name', table_name='entity_field_permissions')
    op.drop_index('ix_entity_field_permissions_entity_name', table_name='entity_field_permissions')
    op.drop_index('ix_entity_field_permissions_tenant_id', table_name='entity_field_permissions')
    
    op.drop_index('ix_entity_permissions_is_active', table_name='entity_permissions')
    op.drop_index('ix_entity_permissions_entity_category', table_name='entity_permissions')
    op.drop_index('ix_entity_permissions_entity_name', table_name='entity_permissions')
    op.drop_index('ix_entity_permissions_tenant_id', table_name='entity_permissions')
    
    op.drop_index('ix_entity_field_registry_is_enabled', table_name='entity_field_registry')
    op.drop_index('ix_entity_field_registry_entity_category', table_name='entity_field_registry')
    op.drop_index('ix_entity_field_registry_field_name', table_name='entity_field_registry')
    op.drop_index('ix_entity_field_registry_entity_name', table_name='entity_field_registry')
    op.drop_index('ix_entity_field_registry_tenant_id', table_name='entity_field_registry')
    
    # Drop tables
    op.drop_table('entity_field_permissions')
    op.drop_table('entity_permissions')
    op.drop_table('entity_field_registry')

