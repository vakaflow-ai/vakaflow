"""add_vendor_branding

Revision ID: 557e560b9e55
Revises: 5a8a617c146d
Create Date: 2025-12-24 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '557e560b9e55'
down_revision = '5a8a617c146d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add branding column to vendors table
    op.add_column('vendors', sa.Column('branding', postgresql.JSON(), nullable=True))


def downgrade() -> None:
    # Remove branding column from vendors table
    op.drop_column('vendors', 'branding')
