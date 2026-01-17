"""add_architecture_landscape_tables

Revision ID: add_architecture_landscape
Revises: add_incident_reports
Create Date: 2025-01-20 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_architecture_landscape'
down_revision = 'add_incident_reports'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create architecture_documents table
    op.create_table(
        'architecture_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Linked entity
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Architecture details
        sa.Column('diagram_type', sa.String(50), nullable=True),
        sa.Column('diagram_url', sa.Text(), nullable=True),
        sa.Column('diagram_data', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('components', postgresql.JSON, nullable=True),
        sa.Column('data_flows', postgresql.JSON, nullable=True),
        sa.Column('integration_points', postgresql.JSON, nullable=True),
        sa.Column('version', sa.String(50), nullable=True),
        sa.Column('last_reviewed', sa.DateTime(), nullable=True),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    
    op.create_index('ix_architecture_documents_tenant_id', 'architecture_documents', ['tenant_id'])
    op.create_index('ix_architecture_documents_entity_type', 'architecture_documents', ['entity_type'])
    op.create_index('ix_architecture_documents_entity_id', 'architecture_documents', ['entity_id'])
    op.create_foreign_key('fk_architecture_documents_reviewed_by', 'architecture_documents', 'users', ['reviewed_by'], ['id'])
    
    # Create landscape_positions table
    op.create_table(
        'landscape_positions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Linked entity
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Landscape positioning
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('subcategory', sa.String(100), nullable=True),
        sa.Column('quadrant', sa.String(50), nullable=True),
        sa.Column('position_x', sa.Float(), nullable=True),
        sa.Column('position_y', sa.Float(), nullable=True),
        
        # Positioning criteria
        sa.Column('capability_score', sa.Integer(), nullable=True),
        sa.Column('business_value_score', sa.Integer(), nullable=True),
        sa.Column('maturity_score', sa.Integer(), nullable=True),
        sa.Column('risk_score', sa.Integer(), nullable=True),
        
        # Metadata
        sa.Column('framework', sa.String(100), nullable=True),
        sa.Column('last_updated', sa.DateTime(), nullable=True),
        
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    
    op.create_index('ix_landscape_positions_tenant_id', 'landscape_positions', ['tenant_id'])
    op.create_index('ix_landscape_positions_entity_type', 'landscape_positions', ['entity_type'])
    op.create_index('ix_landscape_positions_entity_id', 'landscape_positions', ['entity_id'])


def downgrade() -> None:
    op.drop_table('landscape_positions')
    op.drop_table('architecture_documents')
