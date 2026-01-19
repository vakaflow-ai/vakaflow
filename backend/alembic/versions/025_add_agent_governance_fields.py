"""add_agent_governance_fields

Revision ID: 025_add_agent_governance_fields
Revises: 024_add_form_builder_tables
Create Date: 2025-01-18 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '025_add_agent_governance_fields'
down_revision = '024_add_security_incidents'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add governance fields to agents table
    op.add_column('agents', sa.Column('service_account', sa.String(255), nullable=True))
    op.add_column('agents', sa.Column('department', sa.String(100), nullable=True))
    op.add_column('agents', sa.Column('organization', sa.String(255), nullable=True))
    op.add_column('agents', sa.Column('kill_switch_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('agents', sa.Column('last_governance_review', sa.DateTime(), nullable=True))
    op.add_column('agents', sa.Column('governance_owner_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('agents', sa.Column('skills', postgresql.JSONB(), nullable=True))
    op.add_column('agents', sa.Column('related_product_ids', postgresql.JSONB(), nullable=True))
    op.add_column('agents', sa.Column('related_service_ids', postgresql.JSONB(), nullable=True))
    
    # Create foreign key constraint for governance_owner_id
    op.create_foreign_key('fk_agents_governance_owner', 'agents', 'users', ['governance_owner_id'], ['id'])
    
    # Create indexes for better query performance
    op.create_index('ix_agents_service_account', 'agents', ['service_account'])
    op.create_index('ix_agents_department', 'agents', ['department'])
    op.create_index('ix_agents_organization', 'agents', ['organization'])
    op.create_index('ix_agents_kill_switch_enabled', 'agents', ['kill_switch_enabled'])
    op.create_index('ix_agents_governance_owner_id', 'agents', ['governance_owner_id'])
    
    # Add new fields to agent_metadata table
    # === DATA HANDLING ===
    op.add_column('agent_metadata', sa.Column('data_classification_levels', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('jurisdictions', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('related_product_ids', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('related_service_ids', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('hosting_provider', sa.String(100), nullable=True))
    op.add_column('agent_metadata', sa.Column('ai_ml_info', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('training_data_source', sa.Text(), nullable=True))
    op.add_column('agent_metadata', sa.Column('certification_status', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('audit_trail_enabled', sa.Boolean(), nullable=True))
    op.add_column('agent_metadata', sa.Column('privacy_policy_url', sa.String(500), nullable=True))
    op.add_column('agent_metadata', sa.Column('data_protection_officer', sa.String(255), nullable=True))
    op.add_column('agent_metadata', sa.Column('change_log', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('rollback_procedures', sa.Text(), nullable=True))
    op.add_column('agent_metadata', sa.Column('business_purpose', sa.Text(), nullable=True))
    op.add_column('agent_metadata', sa.Column('target_audience', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('competitive_advantage', sa.Text(), nullable=True))
    op.add_column('agent_metadata', sa.Column('governance_framework', sa.String(100), nullable=True))
    op.add_column('agent_metadata', sa.Column('service_level_agreements', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('documentation_urls', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('architecture_diagrams', postgresql.JSONB(), nullable=True))
    op.add_column('agent_metadata', sa.Column('landscape_diagrams', postgresql.JSONB(), nullable=True))
    
    # Create indexes for new metadata fields
    op.create_index('ix_agent_metadata_data_classification', 'agent_metadata', ['data_classification_levels'])
    op.create_index('ix_agent_metadata_jurisdictions', 'agent_metadata', ['jurisdictions'])
    op.create_index('ix_agent_metadata_hosting_provider', 'agent_metadata', ['hosting_provider'])


def downgrade() -> None:
    # Remove indexes first
    op.drop_index('ix_agent_metadata_hosting_provider', table_name='agent_metadata')
    op.drop_index('ix_agent_metadata_jurisdictions', table_name='agent_metadata')
    op.drop_index('ix_agent_metadata_data_classification', table_name='agent_metadata')
    op.drop_index('ix_agents_governance_owner_id', table_name='agents')
    op.drop_index('ix_agents_kill_switch_enabled', table_name='agents')
    op.drop_index('ix_agents_organization', table_name='agents')
    op.drop_index('ix_agents_department', table_name='agents')
    op.drop_index('ix_agents_service_account', table_name='agents')
    
    # Remove foreign key constraint
    op.drop_constraint('fk_agents_governance_owner', 'agents', type_='foreignkey')
    
    # Remove agent table columns
    op.drop_column('agents', 'related_service_ids')
    op.drop_column('agents', 'related_product_ids')
    op.drop_column('agents', 'skills')
    op.drop_column('agents', 'governance_owner_id')
    op.drop_column('agents', 'last_governance_review')
    op.drop_column('agents', 'kill_switch_enabled')
    op.drop_column('agents', 'organization')
    op.drop_column('agents', 'department')
    op.drop_column('agents', 'service_account')
    
    # Remove agent_metadata table columns
    op.drop_column('agent_metadata', 'landscape_diagrams')
    op.drop_column('agent_metadata', 'architecture_diagrams')
    op.drop_column('agent_metadata', 'documentation_urls')
    op.drop_column('agent_metadata', 'service_level_agreements')
    op.drop_column('agent_metadata', 'governance_framework')
    op.drop_column('agent_metadata', 'competitive_advantage')
    op.drop_column('agent_metadata', 'target_audience')
    op.drop_column('agent_metadata', 'business_purpose')
    op.drop_column('agent_metadata', 'rollback_procedures')
    op.drop_column('agent_metadata', 'change_log')
    op.drop_column('agent_metadata', 'data_protection_officer')
    op.drop_column('agent_metadata', 'privacy_policy_url')
    op.drop_column('agent_metadata', 'audit_trail_enabled')
    op.drop_column('agent_metadata', 'certification_status')
    op.drop_column('agent_metadata', 'training_data_source')
    op.drop_column('agent_metadata', 'ai_ml_info')
    op.drop_column('agent_metadata', 'hosting_provider')
    op.drop_column('agent_metadata', 'related_service_ids')
    op.drop_column('agent_metadata', 'related_product_ids')
    op.drop_column('agent_metadata', 'jurisdictions')
    op.drop_column('agent_metadata', 'data_classification_levels')