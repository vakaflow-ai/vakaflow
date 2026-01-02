"""merge_heads

Revision ID: bd69e563d698
Revises: 023_add_presentation, d2c32098bd4e
Create Date: 2025-12-11 16:58:53.275311

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bd69e563d698'
down_revision = ('023_add_presentation', 'd2c32098bd4e')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

