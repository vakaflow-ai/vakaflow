"""add_presentation_tables

Revision ID: 023_add_presentation
Revises: 022_add_communication_type
Create Date: 2025-01-15 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '023_add_presentation'
down_revision = '022_add_communication_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create business_pages table
    op.create_table(
        'business_pages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('page_type', sa.String(50), nullable=False, server_default='dashboard'),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('layout_config', postgresql.JSON, nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('allowed_roles', postgresql.JSON, nullable=True),
        sa.Column('allowed_users', postgresql.JSON, nullable=True),
        sa.Column('tags', postgresql.JSON, nullable=True),
        sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_business_pages_tenant_id', 'business_pages', ['tenant_id'])
    
    # Create widgets table
    op.create_table(
        'widgets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('widget_type', sa.String(50), nullable=False),
        sa.Column('widget_config', postgresql.JSON, nullable=False),
        sa.Column('data_sources', postgresql.JSON, nullable=False),
        sa.Column('display_config', postgresql.JSON, nullable=True),
        sa.Column('refresh_interval', sa.Integer(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('tags', postgresql.JSON, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_widgets_tenant_id', 'widgets', ['tenant_id'])
    
    # Create page_widgets table
    op.create_table(
        'page_widgets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('page_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('widget_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('position_x', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('position_y', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('width', sa.Integer(), nullable=False, server_default='6'),
        sa.Column('height', sa.Integer(), nullable=False, server_default='4'),
        sa.Column('config_override', postgresql.JSON, nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_visible', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['page_id'], ['business_pages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['widget_id'], ['widgets.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_page_widgets_page_id', 'page_widgets', ['page_id'])
    op.create_index('ix_page_widgets_widget_id', 'page_widgets', ['widget_id'])
    
    # Create widget_data_cache table
    op.create_table(
        'widget_data_cache',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('widget_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('data', postgresql.JSON, nullable=False),
        sa.Column('cache_key', sa.String(500), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['widget_id'], ['widgets.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_widget_data_cache_widget_id', 'widget_data_cache', ['widget_id'])
    op.create_index('ix_widget_data_cache_tenant_id', 'widget_data_cache', ['tenant_id'])
    op.create_index('ix_widget_data_cache_cache_key', 'widget_data_cache', ['cache_key'])
    op.create_index('ix_widget_data_cache_expires_at', 'widget_data_cache', ['expires_at'])


def downgrade() -> None:
    op.drop_table('widget_data_cache')
    op.drop_table('page_widgets')
    op.drop_table('widgets')
    op.drop_table('business_pages')
