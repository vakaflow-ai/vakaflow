"""add_request_number_to_onboarding_requests

Revision ID: ddd518aa6e30
Revises: 20251207130803
Create Date: 2025-12-07 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ddd518aa6e30'
down_revision = '20251207130803'
branch_labels = None
depends_on = None


def upgrade():
    # Add request_number column for human-readable request IDs (AI-1, AI-2, etc.)
    op.add_column('onboarding_requests', 
        sa.Column('request_number', sa.String(50), nullable=True)
    )
    op.create_index('ix_onboarding_requests_request_number', 'onboarding_requests', ['request_number'], unique=True)


def downgrade():
    # Remove index and column
    op.drop_index('ix_onboarding_requests_request_number', table_name='onboarding_requests')
    op.drop_column('onboarding_requests', 'request_number')
