"""Add vendor logo and agent enhancements

Revision ID: 012
Revises: 011
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add vendor logo and details
    op.add_column('vendors', sa.Column('logo_url', sa.Text(), nullable=True))
    op.add_column('vendors', sa.Column('logo_path', sa.Text(), nullable=True))
    op.add_column('vendors', sa.Column('website', sa.String(255), nullable=True))
    op.add_column('vendors', sa.Column('description', sa.Text(), nullable=True))
    
    # Add agent metadata enhancements
    op.add_column('agent_metadata', sa.Column('use_cases', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('features', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('personas', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('version_info', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('agent_metadata', 'version_info')
    op.drop_column('agent_metadata', 'personas')
    op.drop_column('agent_metadata', 'features')
    op.drop_column('agent_metadata', 'use_cases')
    op.drop_column('vendors', 'description')
    op.drop_column('vendors', 'website')
    op.drop_column('vendors', 'logo_path')
    op.drop_column('vendors', 'logo_url')

