"""add_form_types_table

Revision ID: add_form_types_table
Revises: rename_screen_type_to_request_type
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'add_form_types_table'
down_revision = 'rename_screen_to_request'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create form_types table
    op.create_table(
        'form_types',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('request_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('view_mappings', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_default', sa.Boolean(), default=False),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now())
    )
    op.execute("COMMENT ON TABLE form_types IS 'Form type configuration mapping request types to form layouts with different views'")


def downgrade() -> None:
    # Drop form_types table
    op.drop_table('form_types')
