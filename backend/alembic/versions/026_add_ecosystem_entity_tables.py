"""add_ecosystem_entity_tables

Revision ID: 026_add_ecosystem_entity_tables
Revises: 025_add_agent_governance_fields
Create Date: 2025-01-18 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '026_add_ecosystem_entity_tables'
down_revision = '025_add_agent_governance_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ecosystem_entities table
    op.create_table(
        'ecosystem_entities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Entity identification
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('entity_type', sa.Enum('agent', 'product', 'service', name='entitytype'), nullable=False),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('subcategory', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        
        # Version and lifecycle
        sa.Column('version', sa.String(50), nullable=True),
        sa.Column('status', sa.Enum('draft', 'submitted', 'in_review', 'approved', 'rejected', 'active', 'paused', 'offboarded', 'archived', name='entitystatus'), nullable=False, server_default='draft'),
        
        # Governance fields
        sa.Column('service_account', sa.String(255), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('organization', sa.String(255), nullable=True),
        sa.Column('kill_switch_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_governance_review', sa.DateTime(), nullable=True),
        sa.Column('governance_owner_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Skills-based approach
        sa.Column('skills', postgresql.JSONB(), nullable=True),
        
        # Compliance and risk
        sa.Column('compliance_score', sa.Integer(), nullable=True),
        sa.Column('risk_score', sa.Integer(), nullable=True),
        sa.Column('security_controls', postgresql.JSONB(), nullable=True),
        sa.Column('compliance_standards', postgresql.JSONB(), nullable=True),
        
        # Documentation and artifacts
        sa.Column('documentation_urls', postgresql.JSONB(), nullable=True),
        sa.Column('architecture_diagrams', postgresql.JSONB(), nullable=True),
        sa.Column('landscape_diagrams', postgresql.JSONB(), nullable=True),
        
        # Ecosystem relationships
        sa.Column('related_entity_ids', postgresql.JSONB(), nullable=True),
        sa.Column('integration_points', postgresql.JSONB(), nullable=True),
        
        # Lifecycle timestamps
        sa.Column('submission_date', sa.DateTime(), nullable=True),
        sa.Column('approval_date', sa.DateTime(), nullable=True),
        sa.Column('activation_date', sa.DateTime(), nullable=True),
        sa.Column('deactivation_date', sa.DateTime(), nullable=True),
        
        # Metadata
        sa.Column('extra_metadata', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        
        # Foreign key constraints
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id']),
        sa.ForeignKeyConstraint(['governance_owner_id'], ['users.id']),
    )
    
    # Create indexes for ecosystem_entities
    op.create_index('ix_ecosystem_entities_tenant_id', 'ecosystem_entities', ['tenant_id'])
    op.create_index('ix_ecosystem_entities_vendor_id', 'ecosystem_entities', ['vendor_id'])
    op.create_index('ix_ecosystem_entities_entity_type', 'ecosystem_entities', ['entity_type'])
    op.create_index('ix_ecosystem_entities_status', 'ecosystem_entities', ['status'])
    op.create_index('ix_ecosystem_entities_department', 'ecosystem_entities', ['department'])
    op.create_index('ix_ecosystem_entities_organization', 'ecosystem_entities', ['organization'])
    op.create_index('ix_ecosystem_entities_governance_owner_id', 'ecosystem_entities', ['governance_owner_id'])
    
    # Create entity_lifecycle_events table
    op.create_table(
        'entity_lifecycle_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Event details
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('from_status', sa.Enum('draft', 'submitted', 'in_review', 'approved', 'rejected', 'active', 'paused', 'offboarded', 'archived', name='entitystatus'), nullable=True),
        sa.Column('to_status', sa.Enum('draft', 'submitted', 'in_review', 'approved', 'rejected', 'active', 'paused', 'offboarded', 'archived', name='entitystatus'), nullable=False),
        sa.Column('triggered_by', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Event context
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('automated', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('workflow_step', sa.String(100), nullable=True),
        
        # Metadata
        sa.Column('event_data', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        
        # Foreign key constraints
        sa.ForeignKeyConstraint(['entity_id'], ['ecosystem_entities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['triggered_by'], ['users.id']),
    )
    
    # Create indexes for entity_lifecycle_events
    op.create_index('ix_entity_lifecycle_events_entity_id', 'entity_lifecycle_events', ['entity_id'])
    op.create_index('ix_entity_lifecycle_events_tenant_id', 'entity_lifecycle_events', ['tenant_id'])
    op.create_index('ix_entity_lifecycle_events_event_type', 'entity_lifecycle_events', ['event_type'])
    op.create_index('ix_entity_lifecycle_events_trigger_by', 'entity_lifecycle_events', ['triggered_by'])
    
    # Create shared_governance_profiles table
    op.create_table(
        'shared_governance_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Profile identification
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('profile_type', sa.String(50), nullable=False),
        
        # Shared governance fields
        sa.Column('security_controls', postgresql.JSONB(), nullable=True),
        sa.Column('compliance_standards', postgresql.JSONB(), nullable=True),
        sa.Column('monitoring_requirements', postgresql.JSONB(), nullable=True),
        sa.Column('documentation_templates', postgresql.JSONB(), nullable=True),
        
        # Usage tracking
        sa.Column('entity_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_applied', sa.DateTime(), nullable=True),
        
        # Metadata
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        
        # Foreign key constraints
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    
    # Create indexes for shared_governance_profiles
    op.create_index('ix_shared_governance_profiles_tenant_id', 'shared_governance_profiles', ['tenant_id'])
    op.create_index('ix_shared_governance_profiles_profile_type', 'shared_governance_profiles', ['profile_type'])
    op.create_index('ix_shared_governance_profiles_created_by', 'shared_governance_profiles', ['created_by'])


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('ix_shared_governance_profiles_created_by', table_name='shared_governance_profiles')
    op.drop_index('ix_shared_governance_profiles_profile_type', table_name='shared_governance_profiles')
    op.drop_index('ix_shared_governance_profiles_tenant_id', table_name='shared_governance_profiles')
    op.drop_index('ix_entity_lifecycle_events_trigger_by', table_name='entity_lifecycle_events')
    op.drop_index('ix_entity_lifecycle_events_event_type', table_name='entity_lifecycle_events')
    op.drop_index('ix_entity_lifecycle_events_tenant_id', table_name='entity_lifecycle_events')
    op.drop_index('ix_entity_lifecycle_events_entity_id', table_name='entity_lifecycle_events')
    op.drop_index('ix_ecosystem_entities_governance_owner_id', table_name='ecosystem_entities')
    op.drop_index('ix_ecosystem_entities_organization', table_name='ecosystem_entities')
    op.drop_index('ix_ecosystem_entities_department', table_name='ecosystem_entities')
    op.drop_index('ix_ecosystem_entities_status', table_name='ecosystem_entities')
    op.drop_index('ix_ecosystem_entities_entity_type', table_name='ecosystem_entities')
    op.drop_index('ix_ecosystem_entities_vendor_id', table_name='ecosystem_entities')
    op.drop_index('ix_ecosystem_entities_tenant_id', table_name='ecosystem_entities')
    
    # Drop tables
    op.drop_table('shared_governance_profiles')
    op.drop_table('entity_lifecycle_events')
    op.drop_table('ecosystem_entities')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS entitytype')
    op.execute('DROP TYPE IF EXISTS entitystatus')