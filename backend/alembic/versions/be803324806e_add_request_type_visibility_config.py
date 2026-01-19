"""add_request_type_visibility_config

Revision ID: be803324806e
Revises: f77891981622
Create Date: 2026-01-18 14:34:19.483927

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'be803324806e'
down_revision = 'f77891981622'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create request_type_configs table
    op.create_table(
        'request_type_configs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('request_type', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=False),
        sa.Column('visibility_scope', sa.Enum('INTERNAL', 'EXTERNAL', 'BOTH', name='visibilityscope'), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('show_tenant_name', sa.Boolean(), nullable=False, default=False),
        sa.Column('tenant_display_format', sa.String(length=100), nullable=True),
        sa.Column('internal_portal_order', sa.Integer(), nullable=True),
        sa.Column('external_portal_order', sa.Integer(), nullable=True),
        sa.Column('allowed_roles', sa.JSON(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon_class', sa.String(length=100), nullable=True),
        sa.Column('config_options', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_request_type_configs_request_type'), 'request_type_configs', ['request_type'], unique=False)
    
    # Create request_type_tenant_mappings table
    op.create_table(
        'request_type_tenant_mappings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('request_type_config_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('tenant_name', sa.String(length=255), nullable=False),
        sa.Column('external_display_name', sa.String(length=255), nullable=False),
        sa.Column('external_description', sa.Text(), nullable=True),
        sa.Column('is_visible_externally', sa.Boolean(), nullable=False, default=True),
        sa.Column('external_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['request_type_config_id'], ['request_type_configs.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_request_type_tenant_mappings_request_type_config_id'), 'request_type_tenant_mappings', ['request_type_config_id'], unique=False)
    op.create_index(op.f('ix_request_type_tenant_mappings_tenant_id'), 'request_type_tenant_mappings', ['tenant_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f('ix_request_type_tenant_mappings_tenant_id'), table_name='request_type_tenant_mappings')
    op.drop_index(op.f('ix_request_type_tenant_mappings_request_type_config_id'), table_name='request_type_tenant_mappings')
    op.drop_table('request_type_tenant_mappings')
    
    op.drop_index(op.f('ix_request_type_configs_request_type'), table_name='request_type_configs')
    op.drop_table('request_type_configs')
    
    # Drop enum type
    op.execute("DROP TYPE IF EXISTS visibilityscope")

