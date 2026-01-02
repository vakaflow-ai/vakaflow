"""add_api_gateway_and_scim_tables

Revision ID: a1b2c3d4e5f6
Revises: 89e9c82038ed, b1c1c867e791
Create Date: 2025-12-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = ('89e9c82038ed', 'b1c1c867e791')  # Merge both heads
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create api_tokens table
    op.create_table(
        'api_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('token_hash', sa.String(255), unique=True, nullable=False),
        sa.Column('token_prefix', sa.String(20), nullable=False),
        sa.Column('scopes', postgresql.JSON, nullable=False),
        sa.Column('permissions', postgresql.JSON, nullable=True),
        sa.Column('rate_limit_per_minute', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('rate_limit_per_hour', sa.Integer(), nullable=False, server_default='1000'),
        sa.Column('rate_limit_per_day', sa.Integer(), nullable=False, server_default='10000'),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_ip', sa.String(45), nullable=True),
        sa.Column('request_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_request_at', sa.DateTime(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_by', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index('ix_api_tokens_tenant_id', 'api_tokens', ['tenant_id'])
    op.create_index('ix_api_tokens_token_hash', 'api_tokens', ['token_hash'])
    op.create_index('ix_api_tokens_status', 'api_tokens', ['status'])
    op.create_index('ix_api_tokens_expires_at', 'api_tokens', ['expires_at'])
    op.create_foreign_key('fk_api_tokens_created_by', 'api_tokens', 'users', ['created_by'], ['id'])
    op.create_foreign_key('fk_api_tokens_revoked_by', 'api_tokens', 'users', ['revoked_by'], ['id'])
    
    # Create scim_configurations table
    op.create_table(
        'scim_configurations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('base_url', sa.String(500), nullable=False),
        sa.Column('bearer_token', sa.String(500), nullable=False),
        sa.Column('auto_provision_users', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('auto_update_users', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('auto_deactivate_users', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('field_mappings', postgresql.JSON, nullable=True),
        sa.Column('webhook_url', sa.String(500), nullable=True),
        sa.Column('webhook_secret', sa.String(500), nullable=True),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('sync_status', sa.String(50), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_scim_configurations_tenant_id', 'scim_configurations', ['tenant_id'])
    op.create_foreign_key('fk_scim_configurations_created_by', 'scim_configurations', 'users', ['created_by'], ['id'])
    
    # Create api_gateway_sessions table
    op.create_table(
        'api_gateway_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('api_token_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_token', sa.String(500), unique=True, nullable=False),
        sa.Column('client_ip', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('last_activity_at', sa.DateTime(), nullable=False),
        sa.Column('request_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_api_gateway_sessions_tenant_id', 'api_gateway_sessions', ['tenant_id'])
    op.create_index('ix_api_gateway_sessions_api_token_id', 'api_gateway_sessions', ['api_token_id'])
    op.create_index('ix_api_gateway_sessions_session_token', 'api_gateway_sessions', ['session_token'])
    op.create_index('ix_api_gateway_sessions_expires_at', 'api_gateway_sessions', ['expires_at'])
    op.create_index('ix_api_gateway_sessions_is_active', 'api_gateway_sessions', ['is_active'])
    op.create_index('idx_session_token_active', 'api_gateway_sessions', ['session_token', 'is_active'])
    op.create_foreign_key('fk_api_gateway_sessions_api_token_id', 'api_gateway_sessions', 'api_tokens', ['api_token_id'], ['id'])
    
    # Create api_gateway_request_logs table
    op.create_table(
        'api_gateway_request_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('api_token_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('method', sa.String(10), nullable=False),
        sa.Column('path', sa.String(500), nullable=False),
        sa.Column('query_params', postgresql.JSON, nullable=True),
        sa.Column('client_ip', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('rate_limit_hit', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('requested_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_api_gateway_request_logs_tenant_id', 'api_gateway_request_logs', ['tenant_id'])
    op.create_index('ix_api_gateway_request_logs_api_token_id', 'api_gateway_request_logs', ['api_token_id'])
    op.create_index('ix_api_gateway_request_logs_session_id', 'api_gateway_request_logs', ['session_id'])
    op.create_index('ix_api_gateway_request_logs_requested_at', 'api_gateway_request_logs', ['requested_at'])
    op.create_index('idx_request_log_token_time', 'api_gateway_request_logs', ['api_token_id', 'requested_at'])
    op.create_index('idx_request_log_tenant_time', 'api_gateway_request_logs', ['tenant_id', 'requested_at'])
    op.create_foreign_key('fk_api_gateway_request_logs_api_token_id', 'api_gateway_request_logs', 'api_tokens', ['api_token_id'], ['id'])
    op.create_foreign_key('fk_api_gateway_request_logs_session_id', 'api_gateway_request_logs', 'api_gateway_sessions', ['session_id'], ['id'])


def downgrade() -> None:
    op.drop_table('api_gateway_request_logs')
    op.drop_table('api_gateway_sessions')
    op.drop_table('scim_configurations')
    op.drop_table('api_tokens')

