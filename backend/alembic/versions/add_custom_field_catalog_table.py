"""add_custom_field_catalog_table

Revision ID: add_custom_field_catalog
Revises: 557e560b9e55
Create Date: 2025-01-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_custom_field_catalog'
down_revision = '557e560b9e55'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create custom_field_catalog table
    op.create_table(
        'custom_field_catalog',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('label', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('placeholder', sa.String(255), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_standard', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('field_source', sa.String(50), nullable=True),
        sa.Column('field_source_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('accepted_file_types', sa.String(255), nullable=True),
        sa.Column('link_text', sa.String(255), nullable=True),
        sa.Column('master_data_list_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('options', postgresql.JSON, nullable=True),
        sa.Column('role_permissions', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['master_data_list_id'], ['master_data_lists.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('tenant_id', 'field_name', name='uq_custom_field_catalog_tenant_field_name'),
    )
    
    # Create indexes
    op.create_index('ix_custom_field_catalog_tenant_id', 'custom_field_catalog', ['tenant_id'])
    op.create_index('ix_custom_field_catalog_field_name', 'custom_field_catalog', ['field_name'])
    op.create_index('ix_custom_field_catalog_is_enabled', 'custom_field_catalog', ['is_enabled'])
    op.create_index('ix_custom_field_catalog_is_standard', 'custom_field_catalog', ['is_standard'])


def downgrade() -> None:
    op.drop_index('ix_custom_field_catalog_is_standard', table_name='custom_field_catalog')
    op.drop_index('ix_custom_field_catalog_is_enabled', table_name='custom_field_catalog')
    op.drop_index('ix_custom_field_catalog_field_name', table_name='custom_field_catalog')
    op.drop_index('ix_custom_field_catalog_tenant_id', table_name='custom_field_catalog')
    op.drop_table('custom_field_catalog')

