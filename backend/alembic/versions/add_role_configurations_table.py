"""add_role_configurations_table

Revision ID: add_role_configurations
Revises: add_rule_ids_array
Create Date: 2025-01-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_role_configurations'
down_revision = 'add_rule_ids_array'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'role_configurations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('data_filter_rule_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('data_filter_rule_config', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('settings', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.UniqueConstraint('tenant_id', 'role', name='uq_role_configuration'),
        comment='Role-level configuration including data filter rules'
    )
    op.create_index('ix_role_configurations_tenant_id', 'role_configurations', ['tenant_id'])


def downgrade():
    op.drop_index('ix_role_configurations_tenant_id', table_name='role_configurations')
    op.drop_table('role_configurations')

