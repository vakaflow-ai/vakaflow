"""add_role_permissions_table

Revision ID: 6ec6ef160647
Revises: c723883c0e24
Create Date: 2025-12-23 09:10:08.206532

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '6ec6ef160647'
down_revision = 'c723883c0e24'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create role_permissions table
    op.create_table(
        'role_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('permission_key', sa.String(100), nullable=False),
        sa.Column('permission_label', sa.String(255), nullable=False),
        sa.Column('permission_description', sa.String(500), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.UniqueConstraint('tenant_id', 'role', 'category', 'permission_key', name='uq_role_permission'),
    )
    op.create_index('ix_role_permissions_tenant_id', 'role_permissions', ['tenant_id'])
    op.create_index('ix_role_permissions_role', 'role_permissions', ['role'])
    op.create_index('ix_role_permissions_category', 'role_permissions', ['category'])
    op.create_index('ix_role_permissions_permission_key', 'role_permissions', ['permission_key'])


def downgrade() -> None:
    op.drop_index('ix_role_permissions_permission_key', table_name='role_permissions')
    op.drop_index('ix_role_permissions_category', table_name='role_permissions')
    op.drop_index('ix_role_permissions_role', table_name='role_permissions')
    op.drop_index('ix_role_permissions_tenant_id', table_name='role_permissions')
    op.drop_table('role_permissions')

