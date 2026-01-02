"""Add invitation_id and business_contact_id to onboarding_requests

Revision ID: 20251207130803
Revises: 
Create Date: 2025-12-07 13:08:03.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251207130803'
down_revision = 'add_workflow_features'  # After workflow trigger rules and stage actions
branch_labels = None
depends_on = None


def upgrade():
    # Add invitation_id column
    op.add_column('onboarding_requests', 
        sa.Column('invitation_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_index('ix_onboarding_requests_invitation_id', 'onboarding_requests', ['invitation_id'])
    
    # Add foreign key constraint for invitation_id
    op.create_foreign_key(
        'fk_onboarding_requests_invitation_id',
        'onboarding_requests', 'vendor_invitations',
        ['invitation_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Add business_contact_id column
    op.add_column('onboarding_requests',
        sa.Column('business_contact_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_index('ix_onboarding_requests_business_contact_id', 'onboarding_requests', ['business_contact_id'])
    
    # Add foreign key constraint for business_contact_id
    op.create_foreign_key(
        'fk_onboarding_requests_business_contact_id',
        'onboarding_requests', 'users',
        ['business_contact_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade():
    # Remove foreign key constraints
    op.drop_constraint('fk_onboarding_requests_business_contact_id', 'onboarding_requests', type_='foreignkey')
    op.drop_constraint('fk_onboarding_requests_invitation_id', 'onboarding_requests', type_='foreignkey')
    
    # Remove indexes
    op.drop_index('ix_onboarding_requests_business_contact_id', table_name='onboarding_requests')
    op.drop_index('ix_onboarding_requests_invitation_id', table_name='onboarding_requests')
    
    # Remove columns
    op.drop_column('onboarding_requests', 'business_contact_id')
    op.drop_column('onboarding_requests', 'invitation_id')

