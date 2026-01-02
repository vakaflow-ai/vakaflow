"""merge_entity_field_registry

Revision ID: ad6800c388bc
Revises: add_entity_field_registry, remove_field_name
Create Date: 2025-12-25 10:14:32.057495

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ad6800c388bc'
down_revision = ('add_entity_field_registry', 'remove_field_name')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

