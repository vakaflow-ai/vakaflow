"""add_flow_sharing_and_versioning

Revision ID: 9a3b48d1722d
Revises: 1a411e4e855e
Create Date: 2025-12-16 17:07:10.378083

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '9a3b48d1722d'
down_revision = '1a411e4e855e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add sharing configuration columns
    op.add_column('agentic_flows', sa.Column('is_shared', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('agentic_flows', sa.Column('shared_with_tenants', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Add versioning columns
    op.add_column('agentic_flows', sa.Column('version', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('agentic_flows', sa.Column('parent_flow_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('agentic_flows', sa.Column('is_current_version', sa.Boolean(), nullable=True, server_default='true'))
    
    # Add foreign key for parent_flow_id
    op.create_foreign_key(
        'fk_agentic_flows_parent_flow_id',
        'agentic_flows', 'agentic_flows',
        ['parent_flow_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Update existing flows to have default values
    op.execute("UPDATE agentic_flows SET is_shared = false WHERE is_shared IS NULL")
    op.execute("UPDATE agentic_flows SET version = 1 WHERE version IS NULL")
    op.execute("UPDATE agentic_flows SET is_current_version = true WHERE is_current_version IS NULL")
    
    # Make columns NOT NULL after setting defaults
    op.alter_column('agentic_flows', 'is_shared', nullable=False, server_default='false')
    op.alter_column('agentic_flows', 'version', nullable=False, server_default='1')
    op.alter_column('agentic_flows', 'is_current_version', nullable=False, server_default='true')


def downgrade() -> None:
    # Remove foreign key
    op.drop_constraint('fk_agentic_flows_parent_flow_id', 'agentic_flows', type_='foreignkey')
    
    # Remove columns
    op.drop_column('agentic_flows', 'is_current_version')
    op.drop_column('agentic_flows', 'parent_flow_id')
    op.drop_column('agentic_flows', 'version')
    op.drop_column('agentic_flows', 'shared_with_tenants')
    op.drop_column('agentic_flows', 'is_shared')

