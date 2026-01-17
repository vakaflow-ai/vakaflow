"""add_incident_configs_table

Revision ID: add_incident_configs
Revises: add_form_designer_visibility
Create Date: 2025-01-20 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_incident_configs'
down_revision = 'add_form_designer_visibility'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create incident_configs table
    op.create_table(
        'incident_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Configuration name
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        
        # Trigger configuration
        sa.Column('trigger_type', sa.String(50), nullable=False),
        sa.Column('trigger_conditions', postgresql.JSON, nullable=True),
        
        # Entity filters
        sa.Column('entity_types', postgresql.JSON, nullable=True),
        sa.Column('entity_categories', postgresql.JSON, nullable=True),
        
        # External system configuration
        sa.Column('external_system', sa.String(50), nullable=False),
        sa.Column('auto_push', sa.Boolean(), default=True),
        
        # Field mapping
        sa.Column('field_mapping', postgresql.JSON, nullable=True),
        sa.Column('severity_mapping', postgresql.JSON, nullable=True),
        
        # Status
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('priority', sa.Integer(), default=100),
        
        # Metadata
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    
    # Create indexes
    op.create_index('ix_incident_configs_tenant_id', 'incident_configs', ['tenant_id'])
    op.create_index('ix_incident_configs_is_active', 'incident_configs', ['is_active'])
    op.create_index('ix_incident_configs_trigger_type', 'incident_configs', ['trigger_type'])
    op.create_index('ix_incident_configs_external_system', 'incident_configs', ['external_system'])
    
    # Create foreign key
    op.create_foreign_key('fk_incident_configs_created_by', 'incident_configs', 'users', ['created_by'], ['id'])


def downgrade() -> None:
    op.drop_table('incident_configs')
