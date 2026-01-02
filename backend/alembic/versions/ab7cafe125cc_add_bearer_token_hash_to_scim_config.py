"""add_bearer_token_hash_to_scim_config

Revision ID: ab7cafe125cc
Revises: 9b1c43947e3d
Create Date: 2025-12-07 10:24:22.314608

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ab7cafe125cc'
down_revision = '9b1c43947e3d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add bearer_token_hash column to scim_configurations table
    try:
        op.add_column('scim_configurations', sa.Column('bearer_token_hash', sa.String(500), nullable=True))
    except Exception:
        # Column might already exist
        pass
    
    # Note: Migration of existing bearer_token values to hashed versions
    # will happen automatically when tokens are verified (see scim.py verify_scim_token)


def downgrade() -> None:
    try:
        op.drop_column('scim_configurations', 'bearer_token_hash')
    except Exception:
        pass
