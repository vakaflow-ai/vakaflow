"""Add marketplace models

Revision ID: 009
Revises: 008
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create vendor_ratings table
    op.create_table(
        'vendor_ratings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('ease_of_use', sa.Integer(), nullable=True),
        sa.Column('reliability', sa.Integer(), nullable=True),
        sa.Column('performance', sa.Integer(), nullable=True),
        sa.Column('support', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id']),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'])
    )
    op.create_index('ix_vendor_ratings_vendor_id', 'vendor_ratings', ['vendor_id'])
    op.create_index('ix_vendor_ratings_agent_id', 'vendor_ratings', ['agent_id'])
    op.create_index('ix_vendor_ratings_user_id', 'vendor_ratings', ['user_id'])
    op.create_index('ix_vendor_ratings_tenant_id', 'vendor_ratings', ['tenant_id'])
    
    # Create vendor_reviews table
    op.create_table(
        'vendor_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), default=False),
        sa.Column('is_helpful', sa.Integer(), default=0),
        sa.Column('is_approved', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id']),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'])
    )
    op.create_index('ix_vendor_reviews_vendor_id', 'vendor_reviews', ['vendor_id'])
    op.create_index('ix_vendor_reviews_agent_id', 'vendor_reviews', ['agent_id'])
    op.create_index('ix_vendor_reviews_user_id', 'vendor_reviews', ['user_id'])
    op.create_index('ix_vendor_reviews_tenant_id', 'vendor_reviews', ['tenant_id'])
    op.create_index('ix_vendor_reviews_created_at', 'vendor_reviews', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_vendor_reviews_created_at', table_name='vendor_reviews')
    op.drop_index('ix_vendor_reviews_tenant_id', table_name='vendor_reviews')
    op.drop_index('ix_vendor_reviews_user_id', table_name='vendor_reviews')
    op.drop_index('ix_vendor_reviews_agent_id', table_name='vendor_reviews')
    op.drop_index('ix_vendor_reviews_vendor_id', table_name='vendor_reviews')
    op.drop_table('vendor_reviews')
    op.drop_index('ix_vendor_ratings_tenant_id', table_name='vendor_ratings')
    op.drop_index('ix_vendor_ratings_user_id', table_name='vendor_ratings')
    op.drop_index('ix_vendor_ratings_agent_id', table_name='vendor_ratings')
    op.drop_index('ix_vendor_ratings_vendor_id', table_name='vendor_ratings')
    op.drop_table('vendor_ratings')

