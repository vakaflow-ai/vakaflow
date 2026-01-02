"""add_workflow_reminders_table

Revision ID: add_workflow_reminders
Revises: migrate_custom_fields_to_ids
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_workflow_reminders'
down_revision = 'migrate_custom_fields_to_ids'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create workflow_reminders table
    op.create_table(
        'workflow_reminders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('request_type', sa.String(100), nullable=False),
        sa.Column('workflow_stage', sa.String(100), nullable=False),
        sa.Column('reminder_days', sa.Integer(), nullable=False),
        sa.Column('reminder_date', sa.DateTime(), nullable=False),
        sa.Column('recipients', sa.JSON(), nullable=False),
        sa.Column('is_sent', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('send_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('scheduled_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['scheduled_by'], ['users.id'], ),
    )
    
    # Create indexes
    op.create_index('idx_workflow_reminder_date_sent', 'workflow_reminders', ['reminder_date', 'is_sent'])
    op.create_index('idx_workflow_reminder_entity', 'workflow_reminders', ['entity_type', 'entity_id', 'workflow_stage'])
    op.create_index(op.f('ix_workflow_reminders_tenant_id'), 'workflow_reminders', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_workflow_reminders_entity_type'), 'workflow_reminders', ['entity_type'], unique=False)
    op.create_index(op.f('ix_workflow_reminders_entity_id'), 'workflow_reminders', ['entity_id'], unique=False)
    op.create_index(op.f('ix_workflow_reminders_workflow_stage'), 'workflow_reminders', ['workflow_stage'], unique=False)
    op.create_index(op.f('ix_workflow_reminders_reminder_date'), 'workflow_reminders', ['reminder_date'], unique=False)
    op.create_index(op.f('ix_workflow_reminders_is_sent'), 'workflow_reminders', ['is_sent'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_workflow_reminders_is_sent'), table_name='workflow_reminders')
    op.drop_index(op.f('ix_workflow_reminders_reminder_date'), table_name='workflow_reminders')
    op.drop_index(op.f('ix_workflow_reminders_workflow_stage'), table_name='workflow_reminders')
    op.drop_index(op.f('ix_workflow_reminders_entity_id'), table_name='workflow_reminders')
    op.drop_index(op.f('ix_workflow_reminders_entity_type'), table_name='workflow_reminders')
    op.drop_index(op.f('ix_workflow_reminders_tenant_id'), table_name='workflow_reminders')
    op.drop_index('idx_workflow_reminder_entity', table_name='workflow_reminders')
    op.drop_index('idx_workflow_reminder_date_sent', table_name='workflow_reminders')
    
    # Drop table
    op.drop_table('workflow_reminders')

