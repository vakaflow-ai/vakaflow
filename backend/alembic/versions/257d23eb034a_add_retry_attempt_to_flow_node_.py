"""add_retry_attempt_to_flow_node_executions

Revision ID: 257d23eb034a
Revises: 1df77d2e34a1
Create Date: 2025-12-11 22:06:30.889957

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '257d23eb034a'
down_revision = '1df77d2e34a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add retry_attempt column to flow_node_executions table
    op.add_column('flow_node_executions', sa.Column('retry_attempt', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Remove retry_attempt column (only if it exists)
    try:
        op.drop_column('flow_node_executions', 'retry_attempt')
    except Exception:
        # Column might not exist, ignore error
        pass

