"""add_context_config_to_flows

Revision ID: 1df77d2e34a1
Revises: 002c230ab8e9
Create Date: 2025-12-11 21:36:59.227436

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1df77d2e34a1'
down_revision = '002c230ab8e9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add context configuration fields to agentic_flows table
    op.add_column('agentic_flows', sa.Column('context_id_template', sa.String(255), nullable=True))
    op.add_column('agentic_flows', sa.Column('context_type_default', sa.String(50), nullable=True))


def downgrade() -> None:
    # Remove context configuration fields
    op.drop_column('agentic_flows', 'context_type_default')
    op.drop_column('agentic_flows', 'context_id_template')

