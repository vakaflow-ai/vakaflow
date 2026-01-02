"""Add compliance frameworks, rules, and requirements

Revision ID: 017
Revises: 016
Create Date: 2025-12-06 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade():
    # Create compliance_frameworks table
    op.create_table(
        'compliance_frameworks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('code', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('region', sa.String(100), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('version', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
    )
    op.create_index('ix_compliance_frameworks_tenant_id', 'compliance_frameworks', ['tenant_id'])
    op.create_index('ix_compliance_frameworks_code', 'compliance_frameworks', ['code'])
    
    # Create framework_risks table
    op.create_table(
        'framework_risks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('framework_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(50), nullable=False),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('order', sa.Integer(), default=0),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['framework_id'], ['compliance_frameworks.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_framework_risks_framework_id', 'framework_risks', ['framework_id'])
    
    # Create framework_rules table
    op.create_table(
        'framework_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('framework_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('risk_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('conditions', postgresql.JSONB(), nullable=True),
        sa.Column('requirement_text', sa.Text(), nullable=False),
        sa.Column('requirement_code', sa.String(100), nullable=True),
        sa.Column('parent_rule_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('order', sa.Integer(), default=0),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['framework_id'], ['compliance_frameworks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['risk_id'], ['framework_risks.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['parent_rule_id'], ['framework_rules.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_framework_rules_framework_id', 'framework_rules', ['framework_id'])
    op.create_index('ix_framework_rules_risk_id', 'framework_rules', ['risk_id'])
    op.create_index('ix_framework_rules_parent_rule_id', 'framework_rules', ['parent_rule_id'])
    
    # Create agent_framework_links table
    op.create_table(
        'agent_framework_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('framework_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_required', sa.Boolean(), default=True),
        sa.Column('linked_at', sa.DateTime(), nullable=False),
        sa.Column('linked_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['framework_id'], ['compliance_frameworks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['linked_by'], ['users.id']),
    )
    op.create_unique_constraint('uq_agent_framework', 'agent_framework_links', ['agent_id', 'framework_id'])
    op.create_index('ix_agent_framework_links_agent_id', 'agent_framework_links', ['agent_id'])
    op.create_index('ix_agent_framework_links_framework_id', 'agent_framework_links', ['framework_id'])
    
    # Create requirement_responses table
    op.create_table(
        'requirement_responses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rule_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('response_text', sa.Text(), nullable=True),
        sa.Column('evidence', postgresql.JSONB(), nullable=True),
        sa.Column('compliance_status', sa.String(50), nullable=True),
        sa.Column('submitted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['rule_id'], ['framework_rules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id']),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id']),
    )
    op.create_unique_constraint('uq_agent_rule_response', 'requirement_responses', ['agent_id', 'rule_id'])
    op.create_index('ix_requirement_responses_agent_id', 'requirement_responses', ['agent_id'])
    op.create_index('ix_requirement_responses_rule_id', 'requirement_responses', ['rule_id'])


def downgrade():
    op.drop_table('requirement_responses')
    op.drop_table('agent_framework_links')
    op.drop_table('framework_rules')
    op.drop_table('framework_risks')
    op.drop_table('compliance_frameworks')

