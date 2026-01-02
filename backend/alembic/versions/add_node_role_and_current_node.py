"""Add node_role and is_current_node to cluster_nodes

Revision ID: add_node_role_current
Revises: 
Create Date: 2025-12-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_node_role_current'
down_revision = None  # Update this with the latest revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_current_node column
    op.add_column('cluster_nodes', sa.Column('is_current_node', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add node_role column (nullable enum)
    op.execute("""
        CREATE TYPE noderole AS ENUM ('primary', 'secondary');
    """)
    op.add_column('cluster_nodes', sa.Column('node_role', postgresql.ENUM('primary', 'secondary', name='noderole'), nullable=True))
    
    # Create indexes
    op.create_index('ix_cluster_nodes_is_current_node', 'cluster_nodes', ['is_current_node'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_cluster_nodes_is_current_node', table_name='cluster_nodes')
    
    # Drop columns
    op.drop_column('cluster_nodes', 'node_role')
    op.drop_column('cluster_nodes', 'is_current_node')
    
    # Drop enum type
    op.execute("DROP TYPE IF EXISTS noderole;")

