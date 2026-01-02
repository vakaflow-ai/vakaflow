"""add_data_filter_rule_ids_array

Revision ID: add_rule_ids_array
Revises: add_data_filter_rule
Create Date: 2025-01-20 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_rule_ids_array'
down_revision = 'add_data_filter_rule'  # Update this to match your latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Add data_filter_rule_ids column (JSON array)
    op.add_column('role_permissions', 
        sa.Column('data_filter_rule_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True)
    )
    
    # Migrate existing data_filter_rule_id to data_filter_rule_ids array
    op.execute("""
        UPDATE role_permissions 
        SET data_filter_rule_ids = jsonb_build_array(jsonb_build_object('id', data_filter_rule_id::text, 'type', 'business_rule'))
        WHERE data_filter_rule_id IS NOT NULL AND data_filter_rule_ids IS NULL
    """)


def downgrade():
    # Remove column
    op.drop_column('role_permissions', 'data_filter_rule_ids')

