"""add_incident_action_history

Revision ID: 5a8a617c146d
Revises: 024_add_security_incidents
Create Date: 2025-01-20 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '5a8a617c146d'
down_revision = '024_add_security_incidents'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add user action fields to security_incidents table
    op.add_column('security_incidents', sa.Column('acknowledged_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('security_incidents', sa.Column('acknowledged_at', sa.DateTime(), nullable=True))
    op.add_column('security_incidents', sa.Column('ignored_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('security_incidents', sa.Column('ignored_at', sa.DateTime(), nullable=True))
    op.add_column('security_incidents', sa.Column('cleared_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('security_incidents', sa.Column('cleared_at', sa.DateTime(), nullable=True))
    op.add_column('security_incidents', sa.Column('action_notes', sa.Text(), nullable=True))
    
    # Add foreign key constraints
    op.create_foreign_key(
        'fk_security_incidents_acknowledged_by',
        'security_incidents', 'users',
        ['acknowledged_by'], ['id']
    )
    op.create_foreign_key(
        'fk_security_incidents_ignored_by',
        'security_incidents', 'users',
        ['ignored_by'], ['id']
    )
    op.create_foreign_key(
        'fk_security_incidents_cleared_by',
        'security_incidents', 'users',
        ['cleared_by'], ['id']
    )
    
    # Add indexes for the new fields
    op.create_index('ix_security_incidents_acknowledged_by', 'security_incidents', ['acknowledged_by'])
    op.create_index('ix_security_incidents_ignored_by', 'security_incidents', ['ignored_by'])
    op.create_index('ix_security_incidents_cleared_by', 'security_incidents', ['cleared_by'])
    
    # Create security_incident_action_history table
    op.create_table(
        'security_incident_action_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('performed_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('performed_at', sa.DateTime(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('previous_status', sa.String(50), nullable=True),
        sa.Column('new_status', sa.String(50), nullable=True),
        sa.Column('action_metadata', postgresql.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['incident_id'], ['security_incidents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id']),
    )
    
    # Create indexes for action_history
    op.create_index('ix_security_incident_action_history_tenant_id', 'security_incident_action_history', ['tenant_id'])
    op.create_index('ix_security_incident_action_history_incident_id', 'security_incident_action_history', ['incident_id'])
    op.create_index('ix_security_incident_action_history_action', 'security_incident_action_history', ['action'])
    op.create_index('ix_security_incident_action_history_performed_by', 'security_incident_action_history', ['performed_by'])
    op.create_index('ix_security_incident_action_history_performed_at', 'security_incident_action_history', ['performed_at'])
    op.create_index('ix_security_incident_action_history_created_at', 'security_incident_action_history', ['created_at'])


def downgrade() -> None:
    # Drop action_history table
    op.drop_index('ix_security_incident_action_history_created_at', table_name='security_incident_action_history')
    op.drop_index('ix_security_incident_action_history_performed_at', table_name='security_incident_action_history')
    op.drop_index('ix_security_incident_action_history_performed_by', table_name='security_incident_action_history')
    op.drop_index('ix_security_incident_action_history_action', table_name='security_incident_action_history')
    op.drop_index('ix_security_incident_action_history_incident_id', table_name='security_incident_action_history')
    op.drop_index('ix_security_incident_action_history_tenant_id', table_name='security_incident_action_history')
    op.drop_table('security_incident_action_history')
    
    # Drop indexes and foreign keys from security_incidents
    op.drop_index('ix_security_incidents_cleared_by', table_name='security_incidents')
    op.drop_index('ix_security_incidents_ignored_by', table_name='security_incidents')
    op.drop_index('ix_security_incidents_acknowledged_by', table_name='security_incidents')
    op.drop_constraint('fk_security_incidents_cleared_by', 'security_incidents', type_='foreignkey')
    op.drop_constraint('fk_security_incidents_ignored_by', 'security_incidents', type_='foreignkey')
    op.drop_constraint('fk_security_incidents_acknowledged_by', 'security_incidents', type_='foreignkey')
    
    # Drop columns from security_incidents
    op.drop_column('security_incidents', 'action_notes')
    op.drop_column('security_incidents', 'cleared_at')
    op.drop_column('security_incidents', 'cleared_by')
    op.drop_column('security_incidents', 'ignored_at')
    op.drop_column('security_incidents', 'ignored_by')
    op.drop_column('security_incidents', 'acknowledged_at')
    op.drop_column('security_incidents', 'acknowledged_by')
