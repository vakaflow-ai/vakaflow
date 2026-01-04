"""add_supplier_master_tables

Revision ID: add_supplier_master
Revises: add_assessment_workflow_history
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_supplier_master'
down_revision = 'add_assessment_workflow_history'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create supplier_agreements table
    op.create_table(
        'supplier_agreements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agreement_type', sa.Enum('nda', 'msa', 'sow', 'sla', 'contract', 'license', 'other', name='agreementtype'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('draft', 'pending_signature', 'active', 'expired', 'terminated', 'renewal_pending', name='agreementstatus'), nullable=False, server_default='draft'),
        sa.Column('effective_date', sa.DateTime(), nullable=True),
        sa.Column('expiry_date', sa.DateTime(), nullable=True),
        sa.Column('signed_date', sa.DateTime(), nullable=True),
        sa.Column('renewal_date', sa.DateTime(), nullable=True),
        sa.Column('signed_by_vendor', sa.String(255), nullable=True),
        sa.Column('signed_by_tenant', sa.String(255), nullable=True),
        sa.Column('vendor_contact_email', sa.String(255), nullable=True),
        sa.Column('tenant_contact_email', sa.String(255), nullable=True),
        sa.Column('pdf_file_path', sa.Text(), nullable=True),
        sa.Column('pdf_file_name', sa.String(255), nullable=True),
        sa.Column('pdf_file_size', sa.Integer(), nullable=True),
        sa.Column('pdf_uploaded_at', sa.DateTime(), nullable=True),
        sa.Column('additional_metadata', postgresql.JSON, nullable=True),
        sa.Column('tags', postgresql.JSON, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_supplier_agreements_vendor_id', 'supplier_agreements', ['vendor_id'])
    op.create_index('ix_supplier_agreements_tenant_id', 'supplier_agreements', ['tenant_id'])
    op.create_index('idx_supplier_agreement_vendor_tenant', 'supplier_agreements', ['vendor_id', 'tenant_id'])
    op.create_index('idx_supplier_agreement_status', 'supplier_agreements', ['status'])
    op.create_index('idx_supplier_agreement_expiry', 'supplier_agreements', ['expiry_date'])
    op.create_foreign_key('fk_supplier_agreements_vendor', 'supplier_agreements', 'vendors', ['vendor_id'], ['id'])
    op.create_foreign_key('fk_supplier_agreements_tenant', 'supplier_agreements', 'tenants', ['tenant_id'], ['id'])
    op.create_foreign_key('fk_supplier_agreements_created_by', 'supplier_agreements', 'users', ['created_by'], ['id'])

    # Create supplier_cves table
    op.create_table(
        'supplier_cves',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cve_id', sa.String(50), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(20), nullable=True),
        sa.Column('cvss_score', sa.String(10), nullable=True),
        sa.Column('status', sa.Enum('open', 'confirmed', 'resolved', 'false_positive', 'mitigated', name='cvestatus'), nullable=False, server_default='open'),
        sa.Column('confirmed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('confirmed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('affected_products', postgresql.JSON, nullable=True),
        sa.Column('affected_agents', postgresql.JSON, nullable=True),
        sa.Column('remediation_notes', sa.Text(), nullable=True),
        sa.Column('remediation_date', sa.DateTime(), nullable=True),
        sa.Column('mitigation_applied', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('mitigation_notes', sa.Text(), nullable=True),
        sa.Column('external_references', postgresql.JSON, nullable=True),
        sa.Column('discovered_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_supplier_cves_vendor_id', 'supplier_cves', ['vendor_id'])
    op.create_index('ix_supplier_cves_tenant_id', 'supplier_cves', ['tenant_id'])
    op.create_index('ix_supplier_cves_cve_id', 'supplier_cves', ['cve_id'])
    op.create_index('idx_supplier_cve_vendor_tenant', 'supplier_cves', ['vendor_id', 'tenant_id'])
    op.create_index('idx_supplier_cve_status', 'supplier_cves', ['status'])
    op.create_index('idx_supplier_cve_confirmed', 'supplier_cves', ['confirmed'])
    op.create_foreign_key('fk_supplier_cves_vendor', 'supplier_cves', 'vendors', ['vendor_id'], ['id'])
    op.create_foreign_key('fk_supplier_cves_tenant', 'supplier_cves', 'tenants', ['tenant_id'], ['id'])
    op.create_foreign_key('fk_supplier_cves_created_by', 'supplier_cves', 'users', ['created_by'], ['id'])
    op.create_foreign_key('fk_supplier_cves_confirmed_by', 'supplier_cves', 'users', ['confirmed_by'], ['id'])

    # Create supplier_investigations table
    op.create_table(
        'supplier_investigations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('investigation_type', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('open', 'in_progress', 'resolved', 'closed', 'escalated', name='investigationstatus'), nullable=False, server_default='open'),
        sa.Column('priority', sa.String(20), nullable=True),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=True),
        sa.Column('assigned_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('opened_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('findings', sa.Text(), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('resolution_action', sa.Text(), nullable=True),
        sa.Column('related_agents', postgresql.JSON, nullable=True),
        sa.Column('related_assessments', postgresql.JSON, nullable=True),
        sa.Column('related_cves', postgresql.JSON, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_supplier_investigations_vendor_id', 'supplier_investigations', ['vendor_id'])
    op.create_index('ix_supplier_investigations_tenant_id', 'supplier_investigations', ['tenant_id'])
    op.create_index('ix_supplier_investigations_assigned_to', 'supplier_investigations', ['assigned_to'])
    op.create_index('idx_supplier_investigation_vendor_tenant', 'supplier_investigations', ['vendor_id', 'tenant_id'])
    op.create_index('idx_supplier_investigation_status', 'supplier_investigations', ['status'])
    op.create_index('idx_supplier_investigation_assigned', 'supplier_investigations', ['assigned_to'])
    op.create_foreign_key('fk_supplier_investigations_vendor', 'supplier_investigations', 'vendors', ['vendor_id'], ['id'])
    op.create_foreign_key('fk_supplier_investigations_tenant', 'supplier_investigations', 'tenants', ['tenant_id'], ['id'])
    op.create_foreign_key('fk_supplier_investigations_assigned_to', 'supplier_investigations', 'users', ['assigned_to'], ['id'])
    op.create_foreign_key('fk_supplier_investigations_assigned_by', 'supplier_investigations', 'users', ['assigned_by'], ['id'])
    op.create_foreign_key('fk_supplier_investigations_created_by', 'supplier_investigations', 'users', ['created_by'], ['id'])

    # Create supplier_compliance_issues table
    op.create_table(
        'supplier_compliance_issues',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('compliance_framework', sa.String(100), nullable=True),
        sa.Column('requirement', sa.String(255), nullable=True),
        sa.Column('severity', sa.String(20), nullable=True),
        sa.Column('status', sa.Enum('open', 'in_remediation', 'resolved', 'closed', 'waived', name='complianceissuestatus'), nullable=False, server_default='open'),
        sa.Column('identified_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('target_resolution_date', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('remediation_plan', sa.Text(), nullable=True),
        sa.Column('remediation_notes', sa.Text(), nullable=True),
        sa.Column('remediation_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=True),
        sa.Column('related_agents', postgresql.JSON, nullable=True),
        sa.Column('related_assessments', postgresql.JSON, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_supplier_compliance_issues_vendor_id', 'supplier_compliance_issues', ['vendor_id'])
    op.create_index('ix_supplier_compliance_issues_tenant_id', 'supplier_compliance_issues', ['tenant_id'])
    op.create_index('ix_supplier_compliance_issues_assigned_to', 'supplier_compliance_issues', ['assigned_to'])
    op.create_index('idx_supplier_compliance_vendor_tenant', 'supplier_compliance_issues', ['vendor_id', 'tenant_id'])
    op.create_index('idx_supplier_compliance_status', 'supplier_compliance_issues', ['status'])
    op.create_index('idx_supplier_compliance_framework', 'supplier_compliance_issues', ['compliance_framework'])
    op.create_foreign_key('fk_supplier_compliance_issues_vendor', 'supplier_compliance_issues', 'vendors', ['vendor_id'], ['id'])
    op.create_foreign_key('fk_supplier_compliance_issues_tenant', 'supplier_compliance_issues', 'tenants', ['tenant_id'], ['id'])
    op.create_foreign_key('fk_supplier_compliance_issues_assigned_to', 'supplier_compliance_issues', 'users', ['assigned_to'], ['id'])
    op.create_foreign_key('fk_supplier_compliance_issues_created_by', 'supplier_compliance_issues', 'users', ['created_by'], ['id'])

    # Create supplier_department_relationships table
    op.create_table(
        'supplier_department_relationships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('department', sa.String(255), nullable=False),
        sa.Column('relationship_type', sa.String(50), nullable=False),
        sa.Column('contact_person', sa.String(255), nullable=True),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('engagement_start_date', sa.DateTime(), nullable=True),
        sa.Column('engagement_end_date', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('annual_spend', sa.Integer(), nullable=True),
        sa.Column('usage_notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_supplier_department_relationships_vendor_id', 'supplier_department_relationships', ['vendor_id'])
    op.create_index('ix_supplier_department_relationships_tenant_id', 'supplier_department_relationships', ['tenant_id'])
    op.create_index('idx_supplier_dept_vendor_tenant', 'supplier_department_relationships', ['vendor_id', 'tenant_id'])
    op.create_index('idx_supplier_dept_active', 'supplier_department_relationships', ['is_active'])
    op.create_foreign_key('fk_supplier_department_relationships_vendor', 'supplier_department_relationships', 'vendors', ['vendor_id'], ['id'])
    op.create_foreign_key('fk_supplier_department_relationships_tenant', 'supplier_department_relationships', 'tenants', ['tenant_id'], ['id'])
    op.create_foreign_key('fk_supplier_department_relationships_created_by', 'supplier_department_relationships', 'users', ['created_by'], ['id'])

    # Create supplier_offerings table
    op.create_table(
        'supplier_offerings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('offering_type', sa.String(50), nullable=True),
        sa.Column('pricing_model', sa.String(50), nullable=True),
        sa.Column('price', sa.Integer(), nullable=True),
        sa.Column('currency', sa.String(10), nullable=True, server_default='USD'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_approved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('related_agent_ids', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_supplier_offerings_vendor_id', 'supplier_offerings', ['vendor_id'])
    op.create_index('ix_supplier_offerings_tenant_id', 'supplier_offerings', ['tenant_id'])
    op.create_index('idx_supplier_offering_vendor_tenant', 'supplier_offerings', ['vendor_id', 'tenant_id'])
    op.create_index('idx_supplier_offering_active', 'supplier_offerings', ['is_active'])
    op.create_foreign_key('fk_supplier_offerings_vendor', 'supplier_offerings', 'vendors', ['vendor_id'], ['id'])
    op.create_foreign_key('fk_supplier_offerings_tenant', 'supplier_offerings', 'tenants', ['tenant_id'], ['id'])


def downgrade() -> None:
    op.drop_table('supplier_offerings')
    op.drop_table('supplier_department_relationships')
    op.drop_table('supplier_compliance_issues')
    op.drop_table('supplier_investigations')
    op.drop_table('supplier_cves')
    op.drop_table('supplier_agreements')
    op.execute('DROP TYPE IF EXISTS agreementtype')
    op.execute('DROP TYPE IF EXISTS agreementstatus')
    op.execute('DROP TYPE IF EXISTS cvestatus')
    op.execute('DROP TYPE IF EXISTS investigationstatus')
    op.execute('DROP TYPE IF EXISTS complianceissuestatus')

