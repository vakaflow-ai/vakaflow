"""add_platform_configuration_table

Revision ID: 6e9bd13ec1d1
Revises: ab7cafe125cc
Create Date: 2025-12-07 10:32:09.738213

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '6e9bd13ec1d1'
down_revision = 'ab7cafe125cc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create platform_configurations table
    op.create_table(
        'platform_configurations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('config_key', sa.String(100), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('value_type', sa.String(50), nullable=False),
        sa.Column('config_value', sa.Text(), nullable=True),
        sa.Column('display_value', sa.String(500), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_secret', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_encrypted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
    )
    
    # Create unique constraint on config_key
    op.create_unique_constraint('uq_platform_configurations_config_key', 'platform_configurations', ['config_key'])
    
    # Create indexes
    op.create_index('ix_platform_configurations_config_key', 'platform_configurations', ['config_key'])
    op.create_index('ix_platform_configurations_category', 'platform_configurations', ['category'])


def downgrade() -> None:
    op.drop_index('ix_platform_configurations_category', table_name='platform_configurations')
    op.drop_index('ix_platform_configurations_config_key', table_name='platform_configurations')
    op.drop_table('platform_configurations')
