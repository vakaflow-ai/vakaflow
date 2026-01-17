"""add_incident_reports_table

Revision ID: add_incident_reports
Revises: add_entity_type_workflow
Create Date: 2025-01-20 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_incident_reports'
down_revision = 'add_entity_type_workflow'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create incident_reports table
    op.create_table(
        'incident_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Incident identification
        sa.Column('incident_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(50), nullable=True),
        
        # Linked entity
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Related entities
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('related_entity_type', sa.String(50), nullable=True),
        sa.Column('related_entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Incident details
        sa.Column('incident_data', postgresql.JSON, nullable=True),
        
        # External system integration
        sa.Column('external_system', sa.String(50), nullable=True),
        sa.Column('external_ticket_id', sa.String(255), nullable=True),
        sa.Column('external_ticket_url', sa.Text(), nullable=True),
        sa.Column('push_status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('push_attempts', sa.Integer(), default=0),
        sa.Column('last_push_attempt', sa.DateTime(), nullable=True),
        sa.Column('push_error', sa.Text(), nullable=True),
        
        # Status tracking
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Metadata
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    
    # Create indexes
    op.create_index('ix_incident_reports_tenant_id', 'incident_reports', ['tenant_id'])
    op.create_index('ix_incident_reports_entity_type', 'incident_reports', ['entity_type'])
    op.create_index('ix_incident_reports_entity_id', 'incident_reports', ['entity_id'])
    op.create_index('ix_incident_reports_vendor_id', 'incident_reports', ['vendor_id'])
    op.create_index('ix_incident_reports_external_ticket_id', 'incident_reports', ['external_ticket_id'])
    op.create_index('ix_incident_reports_incident_type', 'incident_reports', ['incident_type'])
    op.create_index('ix_incident_reports_push_status', 'incident_reports', ['push_status'])
    
    # Create foreign keys
    op.create_foreign_key('fk_incident_reports_vendor', 'incident_reports', 'vendors', ['vendor_id'], ['id'])
    op.create_foreign_key('fk_incident_reports_created_by', 'incident_reports', 'users', ['created_by'], ['id'])
    op.create_foreign_key('fk_incident_reports_resolved_by', 'incident_reports', 'users', ['resolved_by'], ['id'])


def downgrade() -> None:
    op.drop_table('incident_reports')
