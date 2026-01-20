"""add_workflow_id_column_to_request_type_configs

Revision ID: 822686d386b4
Revises: 727ada3fc788
Create Date: 2026-01-19 19:01:19.444869

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '822686d386b4'
down_revision = '96f0319b4022'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add workflow_id column to request_type_configs table
    op.add_column('request_type_configs', sa.Column('workflow_id', sa.UUID(), nullable=True))
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_request_type_configs_workflow_id', 
        'request_type_configs', 
        'workflow_configurations', 
        ['workflow_id'], 
        ['id']
    )


def downgrade() -> None:
    # Remove foreign key constraint
    op.drop_constraint('fk_request_type_configs_workflow_id', 'request_type_configs', type_='foreignkey')
    # Remove workflow_id column
    op.drop_column('request_type_configs', 'workflow_id')

