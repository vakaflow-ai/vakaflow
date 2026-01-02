"""merge_form_types_and_other_heads

Revision ID: 0fa08898e235
Revises: add_form_types_table, add_node_role_current, ddd518aa6e30
Create Date: 2025-12-10 13:40:18.934859

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0fa08898e235'
down_revision = ('add_form_types_table', 'add_node_role_current', 'ddd518aa6e30')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

