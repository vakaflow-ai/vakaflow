"""Add request_type_form_associations table for form-request type relationships

Revision ID: request_type_form_associations
Revises: 
Create Date: 2024-01-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'request_type_form_associations'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create request_type_form_associations table
    op.create_table('request_type_form_associations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('request_type_config_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('form_layout_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, default=0),
        sa.Column('is_primary', sa.Boolean(), nullable=False, default=False),
        sa.Column('form_variation_type', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['request_type_config_id'], ['request_type_configs.id'], ),
        sa.ForeignKeyConstraint(['form_layout_id'], ['form_layouts.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('request_type_config_id', 'form_layout_id', name='uq_request_type_form')
    )
    
    # Add indexes for better query performance
    op.create_index('ix_request_type_form_associations_request_type_config_id', 
                   'request_type_form_associations', ['request_type_config_id'])
    op.create_index('ix_request_type_form_associations_form_layout_id', 
                   'request_type_form_associations', ['form_layout_id'])
    
    # Add comment to table
    op.execute("COMMENT ON TABLE request_type_form_associations IS 'Junction table linking request types to their associated form layouts'")


def downgrade():
    # Drop indexes
    op.drop_index('ix_request_type_form_associations_form_layout_id', 
                 table_name='request_type_form_associations')
    op.drop_index('ix_request_type_form_associations_request_type_config_id', 
                 table_name='request_type_form_associations')
    
    # Drop table
    op.drop_table('request_type_form_associations')