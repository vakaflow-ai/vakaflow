"""add_business_rules_table

Revision ID: 1a411e4e855e
Revises: 
Create Date: 2025-12-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '1a411e4e855e'
down_revision = 'dc17987cba32'  # Update to latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Create business_rules table
    op.create_table(
        'business_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rule_id', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('condition_expression', sa.Text(), nullable=False),
        sa.Column('action_expression', sa.Text(), nullable=False),
        sa.Column('rule_type', sa.String(50), nullable=False, server_default='conditional'),
        sa.Column('applicable_entities', postgresql.JSON, nullable=True),
        sa.Column('applicable_screens', postgresql.JSON, nullable=True),
        sa.Column('action_type', sa.String(50), nullable=True),
        sa.Column('action_config', postgresql.JSON, nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_automatic', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], name='fk_business_rules_tenant'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_business_rules_created_by'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name='fk_business_rules_updated_by'),
    )
    
    # Create indexes
    op.create_index('idx_business_rule_tenant_active', 'business_rules', ['tenant_id', 'is_active'])
    op.create_index('idx_business_rule_rule_id', 'business_rules', ['rule_id'])
    op.create_index('idx_business_rules_tenant_id', 'business_rules', ['tenant_id'])
    
    # Create unique constraint on rule_id per tenant (composite unique)
    # Note: rule_id should be unique per tenant, not globally
    op.create_unique_constraint('uq_business_rules_tenant_rule_id', 'business_rules', ['tenant_id', 'rule_id'])


def downgrade():
    op.drop_index('idx_business_rules_tenant_id', table_name='business_rules')
    op.drop_index('idx_business_rule_rule_id', table_name='business_rules')
    op.drop_index('idx_business_rule_tenant_active', table_name='business_rules')
    op.drop_constraint('uq_business_rules_tenant_rule_id', 'business_rules', type_='unique')
    op.drop_table('business_rules')
