"""merge_ecosystem_and_other_heads

Revision ID: b1e8903c0094
Revises: 026_add_ecosystem_entity_tables, 08f99d683b64
Create Date: 2026-01-18 13:03:57.145007

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1e8903c0094'
down_revision = ('026_add_ecosystem_entity_tables', '08f99d683b64')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

