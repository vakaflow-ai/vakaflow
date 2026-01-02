"""add_master_data_lists_table

Revision ID: 1736428800
Revises: df1caed9234b
Create Date: 2025-01-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '1736428800'
down_revision = 'df1caed9234b'  # Update this to match your latest revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'master_data_lists',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('list_type', sa.String(100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('values', postgresql.JSON(), nullable=False, server_default='[]'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    )
    op.create_index('ix_master_data_lists_tenant_id', 'master_data_lists', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_master_data_lists_tenant_id', table_name='master_data_lists')
    op.drop_table('master_data_lists')
