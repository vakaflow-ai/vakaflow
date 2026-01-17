"""add_entity_type_to_workflow_config

Revision ID: add_entity_type_workflow
Revises: add_entity_type_assessments
Create Date: 2025-01-20 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_entity_type_workflow'
down_revision = 'add_entity_type_assessments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No schema changes needed - entity_type support is in JSON fields (conditions and trigger_rules)
    # This migration is for documentation and future schema changes if needed
    pass


def downgrade() -> None:
    pass
