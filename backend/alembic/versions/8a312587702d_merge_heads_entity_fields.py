"""merge_heads_entity_fields

Revision ID: 8a312587702d
Revises: add_entity_user_level, add_field_category
Create Date: 2025-12-26 12:53:09.229896

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a312587702d'
down_revision = ('add_entity_user_level', 'add_field_category')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

