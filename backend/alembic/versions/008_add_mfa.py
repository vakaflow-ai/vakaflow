"""Add MFA support

Revision ID: 008
Revises: 007
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create mfa_configs table
    op.create_table(
        'mfa_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), default=False),
        sa.Column('method', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('totp_secret', sa.String(255), nullable=True),
        sa.Column('totp_backup_codes', sa.String(), nullable=True),
        sa.Column('phone_number', sa.String(20), nullable=True),
        sa.Column('email_verified', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.UniqueConstraint('user_id')
    )
    op.create_index('ix_mfa_configs_user_id', 'mfa_configs', ['user_id'])
    
    # Create mfa_attempts table
    op.create_table(
        'mfa_attempts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('mfa_config_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('method', sa.String(50), nullable=False),
        sa.Column('code_used', sa.String(10), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('attempted_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['mfa_config_id'], ['mfa_configs.id'])
    )
    op.create_index('ix_mfa_attempts_user_id', 'mfa_attempts', ['user_id'])
    op.create_index('ix_mfa_attempts_attempted_at', 'mfa_attempts', ['attempted_at'])


def downgrade() -> None:
    op.drop_index('ix_mfa_attempts_attempted_at', table_name='mfa_attempts')
    op.drop_index('ix_mfa_attempts_user_id', table_name='mfa_attempts')
    op.drop_table('mfa_attempts')
    op.drop_index('ix_mfa_configs_user_id', table_name='mfa_configs')
    op.drop_table('mfa_configs')

