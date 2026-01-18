"""merge_heads

Revision ID: c56ba1106975
Revises: add_file_metadata_table, add_incident_configs, e4954ed96532
Create Date: 2026-01-18 04:58:07.051232

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c56ba1106975'
down_revision = ('add_file_metadata_table', 'add_incident_configs', 'e4954ed96532')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

