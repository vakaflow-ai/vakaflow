"""standardize_request_type_config_model

Revision ID: a17e76af767e
Revises: be803324806e
Create Date: 2026-01-18 23:20:19.160074

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a17e76af767e'
down_revision = 'be803324806e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add unique constraint to request_type_configs table
    op.create_unique_constraint(
        'uq_tenant_request_type', 
        'request_type_configs', 
        ['tenant_id', 'request_type']
    )
    
    # Rename config_options to extra_metadata (if exists)
    try:
        op.alter_column(
            'request_type_configs', 
            'config_options', 
            new_column_name='extra_metadata'
        )
    except Exception:
        # Column might not exist, which is fine
        pass
    
    # Add unique constraint to request_type_tenant_mappings table
    op.create_unique_constraint(
        'uq_request_type_tenant', 
        'request_type_tenant_mappings', 
        ['request_type_config_id', 'tenant_id']
    )


def downgrade() -> None:
    # Drop unique constraints
    op.drop_constraint('uq_request_type_tenant', 'request_type_tenant_mappings')
    op.drop_constraint('uq_tenant_request_type', 'request_type_configs')
    
    # Rename extra_metadata back to config_options (if exists)
    try:
        op.alter_column(
            'request_type_configs', 
            'extra_metadata', 
            new_column_name='config_options'
        )
    except Exception:
        # Column might not exist, which is fine
        pass

