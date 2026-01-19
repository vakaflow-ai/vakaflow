"""merge_heads_for_request_type_forms

Revision ID: fc3cca1e21a6
Revises: a17e76af767e, request_type_form_associations
Create Date: 2026-01-18 23:47:48.657757

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fc3cca1e21a6'
down_revision = ('a17e76af767e', 'request_type_form_associations')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

