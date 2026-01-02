"""add_department_organization_to_users

Revision ID: b1c1c867e791
Revises: cc1afa0798de
Create Date: 2025-12-06 11:51:20.538017

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1c1c867e791'
down_revision = 'cc1afa0798de'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add department and organization columns to users table
    op.add_column('users', sa.Column('department', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('organization', sa.String(255), nullable=True))
    
    # Create indexes for the new columns
    op.create_index('ix_users_department', 'users', ['department'])
    op.create_index('ix_users_organization', 'users', ['organization'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_users_organization', table_name='users')
    op.drop_index('ix_users_department', table_name='users')
    
    # Drop columns
    op.drop_column('users', 'organization')
    op.drop_column('users', 'department')

