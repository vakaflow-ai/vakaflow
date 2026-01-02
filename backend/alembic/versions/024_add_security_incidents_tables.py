"""add_security_incidents_tables

Revision ID: 024_add_security_incidents
Revises: 023_add_presentation
Create Date: 2025-01-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '024_add_security_incidents'
down_revision = 'add_qid_to_q_lib'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create security_incidents table
    op.create_table(
        'security_incidents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('incident_type', sa.String(50), nullable=False),
        sa.Column('external_id', sa.String(100), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(50), nullable=True),
        sa.Column('cvss_score', sa.Float(), nullable=True),
        sa.Column('cvss_vector', sa.String(200), nullable=True),
        sa.Column('affected_products', postgresql.JSON, nullable=True),
        sa.Column('affected_vendors', postgresql.JSON, nullable=True),
        sa.Column('source', sa.String(100), nullable=False),
        sa.Column('source_url', sa.Text(), nullable=True),
        sa.Column('published_date', sa.DateTime(), nullable=True),
        sa.Column('incident_metadata', postgresql.JSON, nullable=True),
        sa.Column('status', sa.String(50), server_default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_security_incidents_tenant_id', 'security_incidents', ['tenant_id'])
    op.create_index('ix_security_incidents_incident_type', 'security_incidents', ['incident_type'])
    op.create_index('ix_security_incidents_external_id', 'security_incidents', ['external_id'])
    op.create_index('ix_security_incidents_severity', 'security_incidents', ['severity'])
    op.create_index('ix_security_incidents_status', 'security_incidents', ['status'])
    op.create_index('ix_security_incidents_published_date', 'security_incidents', ['published_date'])
    op.create_index('ix_security_incidents_created_at', 'security_incidents', ['created_at'])
    
    # Create vendor_security_tracking table
    op.create_table(
        'vendor_security_tracking',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('match_confidence', sa.Float(), nullable=False),
        sa.Column('match_method', sa.String(50), nullable=False),
        sa.Column('match_details', postgresql.JSON, nullable=True),
        sa.Column('risk_qualification_status', sa.String(50), server_default='pending'),
        sa.Column('risk_assessment', postgresql.JSON, nullable=True),
        sa.Column('risk_level', sa.String(50), nullable=True),
        sa.Column('qualified_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('qualified_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(50), server_default='active'),
        sa.Column('resolution_type', sa.String(50), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['incident_id'], ['security_incidents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['qualified_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_vendor_security_tracking_tenant_id', 'vendor_security_tracking', ['tenant_id'])
    op.create_index('ix_vendor_security_tracking_vendor_id', 'vendor_security_tracking', ['vendor_id'])
    op.create_index('ix_vendor_security_tracking_incident_id', 'vendor_security_tracking', ['incident_id'])
    op.create_index('ix_vendor_security_tracking_risk_qualification_status', 'vendor_security_tracking', ['risk_qualification_status'])
    op.create_index('ix_vendor_security_tracking_status', 'vendor_security_tracking', ['status'])
    op.create_index('ix_vendor_security_tracking_created_at', 'vendor_security_tracking', ['created_at'])
    
    # Create security_monitoring_configs table
    op.create_table(
        'security_monitoring_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('cve_monitoring_enabled', sa.Boolean(), server_default='true'),
        sa.Column('cve_scan_frequency', sa.String(50), server_default='daily'),
        sa.Column('cve_severity_threshold', sa.String(50), server_default='medium'),
        sa.Column('cve_cvss_threshold', sa.Float(), server_default='5.0'),
        sa.Column('breach_monitoring_enabled', sa.Boolean(), server_default='true'),
        sa.Column('breach_scan_frequency', sa.String(50), server_default='daily'),
        sa.Column('auto_create_tasks', sa.Boolean(), server_default='true'),
        sa.Column('auto_send_alerts', sa.Boolean(), server_default='true'),
        sa.Column('auto_trigger_assessments', sa.Boolean(), server_default='false'),
        sa.Column('auto_start_workflows', sa.Boolean(), server_default='false'),
        sa.Column('alert_recipients', postgresql.JSON, nullable=True),
        sa.Column('alert_channels', postgresql.JSON, nullable=True),
        sa.Column('alert_severity_mapping', postgresql.JSON, nullable=True),
        sa.Column('default_assessment_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('default_workflow_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assessment_due_days', sa.Integer(), server_default='30'),
        sa.Column('min_match_confidence', sa.Float(), server_default='0.5'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_security_monitoring_configs_tenant_id', 'security_monitoring_configs', ['tenant_id'])
    
    # Create security_alerts table
    op.create_table(
        'security_alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('priority', sa.String(50), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('tracking_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('recipient_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('recipient_role', sa.String(50), nullable=True),
        sa.Column('channels', postgresql.JSON, nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['incident_id'], ['security_incidents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tracking_id'], ['vendor_security_tracking.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_security_alerts_tenant_id', 'security_alerts', ['tenant_id'])
    op.create_index('ix_security_alerts_priority', 'security_alerts', ['priority'])
    op.create_index('ix_security_alerts_status', 'security_alerts', ['status'])
    op.create_index('ix_security_alerts_created_at', 'security_alerts', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_security_alerts_created_at', table_name='security_alerts')
    op.drop_index('ix_security_alerts_status', table_name='security_alerts')
    op.drop_index('ix_security_alerts_priority', table_name='security_alerts')
    op.drop_index('ix_security_alerts_tenant_id', table_name='security_alerts')
    op.drop_table('security_alerts')
    
    op.drop_index('ix_security_monitoring_configs_tenant_id', table_name='security_monitoring_configs')
    op.drop_table('security_monitoring_configs')
    
    op.drop_index('ix_vendor_security_tracking_created_at', table_name='vendor_security_tracking')
    op.drop_index('ix_vendor_security_tracking_status', table_name='vendor_security_tracking')
    op.drop_index('ix_vendor_security_tracking_risk_qualification_status', table_name='vendor_security_tracking')
    op.drop_index('ix_vendor_security_tracking_incident_id', table_name='vendor_security_tracking')
    op.drop_index('ix_vendor_security_tracking_vendor_id', table_name='vendor_security_tracking')
    op.drop_index('ix_vendor_security_tracking_tenant_id', table_name='vendor_security_tracking')
    op.drop_table('vendor_security_tracking')
    
    op.drop_index('ix_security_incidents_created_at', table_name='security_incidents')
    op.drop_index('ix_security_incidents_published_date', table_name='security_incidents')
    op.drop_index('ix_security_incidents_status', table_name='security_incidents')
    op.drop_index('ix_security_incidents_severity', table_name='security_incidents')
    op.drop_index('ix_security_incidents_external_id', table_name='security_incidents')
    op.drop_index('ix_security_incidents_incident_type', table_name='security_incidents')
    op.drop_index('ix_security_incidents_tenant_id', table_name='security_incidents')
    op.drop_table('security_incidents')

