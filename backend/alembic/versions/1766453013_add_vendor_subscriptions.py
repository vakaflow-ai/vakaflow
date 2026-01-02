"""Add vendor subscriptions, follows, and interest lists

Revision ID: 1766453013
Revises: 1766453012
Create Date: 2024-12-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '1766453013'
down_revision = '1766453012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create vendor_subscriptions table
    op.create_table(
        'vendor_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subscribed_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('notification_preferences', postgresql.JSONB(), nullable=True),
        sa.UniqueConstraint('vendor_id', 'tenant_id', name='uq_vendor_subscription'),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_vendor_subscriptions_vendor_id', 'vendor_subscriptions', ['vendor_id'])
    op.create_index('ix_vendor_subscriptions_tenant_id', 'vendor_subscriptions', ['tenant_id'])
    
    # Create vendor_follows table
    op.create_table(
        'vendor_follows',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('followed_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.UniqueConstraint('vendor_id', 'user_id', name='uq_vendor_follow'),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_vendor_follows_vendor_id', 'vendor_follows', ['vendor_id'])
    op.create_index('ix_vendor_follows_user_id', 'vendor_follows', ['user_id'])
    
    # Create vendor_interest_lists table
    op.create_table(
        'vendor_interest_lists',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('added_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.UniqueConstraint('vendor_id', 'user_id', name='uq_vendor_interest'),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_vendor_interest_lists_vendor_id', 'vendor_interest_lists', ['vendor_id'])
    op.create_index('ix_vendor_interest_lists_user_id', 'vendor_interest_lists', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_vendor_interest_lists_user_id', table_name='vendor_interest_lists')
    op.drop_index('ix_vendor_interest_lists_vendor_id', table_name='vendor_interest_lists')
    op.drop_table('vendor_interest_lists')
    
    op.drop_index('ix_vendor_follows_user_id', table_name='vendor_follows')
    op.drop_index('ix_vendor_follows_vendor_id', table_name='vendor_follows')
    op.drop_table('vendor_follows')
    
    op.drop_index('ix_vendor_subscriptions_tenant_id', table_name='vendor_subscriptions')
    op.drop_index('ix_vendor_subscriptions_vendor_id', table_name='vendor_subscriptions')
    op.drop_table('vendor_subscriptions')

