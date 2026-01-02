"""add_vendor_invitations_and_otp_tables

Revision ID: 89e9c82038ed
Revises: 
Create Date: 2024-12-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '89e9c82038ed'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create vendor_invitations table
    op.create_table(
        'vendor_invitations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('invited_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token', sa.String(255), unique=True, nullable=False),
        sa.Column('status', sa.String(50), nullable=False, default='pending'),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('message', sa.String(1000), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_vendor_invitations_tenant_id', 'vendor_invitations', ['tenant_id'])
    op.create_index('ix_vendor_invitations_invited_by', 'vendor_invitations', ['invited_by'])
    op.create_index('ix_vendor_invitations_email', 'vendor_invitations', ['email'])
    op.create_index('ix_vendor_invitations_token', 'vendor_invitations', ['token'])
    op.create_foreign_key('fk_vendor_invitations_invited_by', 'vendor_invitations', 'users', ['invited_by'], ['id'])
    op.create_foreign_key('fk_vendor_invitations_vendor_id', 'vendor_invitations', 'vendors', ['vendor_id'], ['id'])
    
    # Create otp_codes table
    op.create_table(
        'otp_codes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('purpose', sa.String(50), nullable=False),
        sa.Column('otp_hash', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, default='pending'),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_otp_codes_email', 'otp_codes', ['email'])
    op.create_index('ix_otp_codes_purpose', 'otp_codes', ['purpose'])


def downgrade() -> None:
    op.drop_table('otp_codes')
    op.drop_table('vendor_invitations')
