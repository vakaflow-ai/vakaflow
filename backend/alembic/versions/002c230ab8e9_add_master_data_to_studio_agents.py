"""add_master_data_to_studio_agents

Revision ID: 002c230ab8e9
Revises: bd69e563d698
Create Date: 2025-12-11 18:42:50.028356

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '002c230ab8e9'
down_revision = 'bd69e563d698'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add master data columns to studio_agents table
    op.add_column('studio_agents', sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('studio_agents', sa.Column('department', sa.String(100), nullable=True))
    op.add_column('studio_agents', sa.Column('organization', sa.String(255), nullable=True))
    op.add_column('studio_agents', sa.Column('master_data_attributes', postgresql.JSON, nullable=True))
    
    # Add foreign key constraint for owner_id
    op.create_foreign_key(
        'fk_studio_agents_owner_id',
        'studio_agents',
        'users',
        ['owner_id'],
        ['id']
    )
    
    # Add index on department for faster queries
    op.create_index('ix_studio_agents_department', 'studio_agents', ['department'])


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_studio_agents_department', table_name='studio_agents')
    
    # Remove foreign key constraint
    op.drop_constraint('fk_studio_agents_owner_id', 'studio_agents', type_='foreignkey')
    
    # Remove columns
    op.drop_column('studio_agents', 'master_data_attributes')
    op.drop_column('studio_agents', 'organization')
    op.drop_column('studio_agents', 'department')
    op.drop_column('studio_agents', 'owner_id')

