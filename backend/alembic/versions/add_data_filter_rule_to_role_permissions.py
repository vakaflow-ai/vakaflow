"""add_data_filter_rule_to_role_permissions

Revision ID: add_data_filter_rule
Revises: 6ec6ef160647
Create Date: 2025-01-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_data_filter_rule'
down_revision = '6ec6ef160647'  # Update this to the latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Add data_filter_rule_id column
    op.add_column('role_permissions', 
        sa.Column('data_filter_rule_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    
    # Add data_filter_rule_config column
    op.add_column('role_permissions',
        sa.Column('data_filter_rule_config', postgresql.JSON(astext_type=sa.Text()), nullable=True)
    )
    
    # Add index on data_filter_rule_id for faster lookups
    op.create_index('ix_role_permissions_data_filter_rule_id', 'role_permissions', ['data_filter_rule_id'])


def downgrade():
    # Remove index
    op.drop_index('ix_role_permissions_data_filter_rule_id', table_name='role_permissions')
    
    # Remove columns
    op.drop_column('role_permissions', 'data_filter_rule_config')
    op.drop_column('role_permissions', 'data_filter_rule_id')

