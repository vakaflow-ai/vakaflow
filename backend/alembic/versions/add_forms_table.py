"""add_forms_table

Revision ID: add_forms_table
Revises: add_form_types_table
Create Date: 2025-01-XX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'add_forms_table'
down_revision = '4815a1207763'  # Current head
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create forms table - stores user-designed forms in the forms library
    # Separate from form_layouts which may contain processes
    op.create_table(
        'forms',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('layout_type', sa.String(255), nullable=True),  # submission, approver, completed (comma-separated)
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sections', sa.JSON(), nullable=False),
        sa.Column('field_dependencies', sa.JSON(), nullable=True),
        sa.Column('custom_field_ids', sa.JSON(), nullable=True),  # Array of CustomFieldCatalog UUIDs
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False, index=True),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now(), nullable=False)
    )
    op.execute("COMMENT ON TABLE forms IS 'Forms library - user-designed forms separate from processes/layouts'")


def downgrade() -> None:
    # Drop forms table
    op.drop_table('forms')

