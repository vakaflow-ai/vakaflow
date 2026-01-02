"""add_approver_groups_table

Revision ID: cc1afa0798de
Revises: ec79cec05667
Create Date: 2025-12-06 11:14:12.402084

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'cc1afa0798de'
down_revision = 'ec79cec05667'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create approver_groups table
    op.create_table(
        'approver_groups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('member_ids', postgresql.JSON(), nullable=False),  # Array of user IDs
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_approver_groups_tenant_id', 'approver_groups', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_approver_groups_tenant_id', table_name='approver_groups')
    op.drop_table('approver_groups')

