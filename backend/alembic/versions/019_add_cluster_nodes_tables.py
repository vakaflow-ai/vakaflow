"""add_cluster_nodes_tables

Revision ID: 019_add_cluster_nodes
Revises: ec79cec05667
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '019_add_cluster_nodes'
down_revision = '6e9bd13ec1d1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create cluster_nodes table
    op.create_table(
        'cluster_nodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('hostname', sa.String(255), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=False),
        sa.Column('node_type', sa.String(50), nullable=False),
        sa.Column('ssh_username', sa.String(100), nullable=False),
        sa.Column('ssh_password', sa.Text(), nullable=True),
        sa.Column('ssh_port', sa.Integer(), nullable=False, server_default='22'),
        sa.Column('ssh_key_path', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('tags', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='unknown'),
        sa.Column('last_health_check', sa.DateTime(), nullable=True),
        sa.Column('last_health_check_result', sa.Text(), nullable=True),
        sa.Column('cpu_usage', sa.String(20), nullable=True),
        sa.Column('memory_usage', sa.String(20), nullable=True),
        sa.Column('disk_usage', sa.String(20), nullable=True),
        sa.Column('uptime', sa.String(100), nullable=True),
        sa.Column('services_status', sa.Text(), nullable=True),
        sa.Column('error_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('last_error_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_monitored', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
    )
    
    # Create cluster_health_checks table
    op.create_table(
        'cluster_health_checks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('check_type', sa.String(50), nullable=False),
        sa.Column('check_result', sa.Text(), nullable=False),
        sa.Column('cpu_usage', sa.String(20), nullable=True),
        sa.Column('memory_usage', sa.String(20), nullable=True),
        sa.Column('disk_usage', sa.String(20), nullable=True),
        sa.Column('uptime', sa.String(100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('checked_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['node_id'], ['cluster_nodes.id'], ondelete='CASCADE'),
    )
    
    # Create indexes
    op.create_index('ix_cluster_nodes_hostname', 'cluster_nodes', ['hostname'], unique=True)
    op.create_index('ix_cluster_nodes_ip_address', 'cluster_nodes', ['ip_address'])
    op.create_index('ix_cluster_nodes_node_type', 'cluster_nodes', ['node_type'])
    op.create_index('ix_cluster_nodes_status', 'cluster_nodes', ['status'])
    op.create_index('ix_cluster_nodes_is_active', 'cluster_nodes', ['is_active'])
    op.create_index('ix_cluster_health_checks_node_id', 'cluster_health_checks', ['node_id'])
    op.create_index('ix_cluster_health_checks_checked_at', 'cluster_health_checks', ['checked_at'])


def downgrade() -> None:
    op.drop_index('ix_cluster_health_checks_checked_at', table_name='cluster_health_checks')
    op.drop_index('ix_cluster_health_checks_node_id', table_name='cluster_health_checks')
    op.drop_index('ix_cluster_nodes_is_active', table_name='cluster_nodes')
    op.drop_index('ix_cluster_nodes_status', table_name='cluster_nodes')
    op.drop_index('ix_cluster_nodes_node_type', table_name='cluster_nodes')
    op.drop_index('ix_cluster_nodes_ip_address', table_name='cluster_nodes')
    op.drop_index('ix_cluster_nodes_hostname', table_name='cluster_nodes')
    op.drop_table('cluster_health_checks')
    op.drop_table('cluster_nodes')
