"""Add file_metadata table for evidence storage with retention policies

Revision ID: add_file_metadata_table
Revises: 
Create Date: 2024-01-17 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_file_metadata_table'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create file_metadata table
    op.create_table('file_metadata',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_id', sa.String(length=36), nullable=False),
        sa.Column('original_name', sa.String(length=255), nullable=False),
        sa.Column('stored_name', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('context_type', sa.String(length=50), nullable=False),
        sa.Column('context_id', sa.String(length=36), nullable=False),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('last_accessed', sa.DateTime(), nullable=True),
        sa.Column('retention_days', sa.Integer(), nullable=False, default=90),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_reason', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index('ix_file_metadata_context', 'file_metadata', ['context_type', 'context_id'])
    op.create_index('ix_file_metadata_expires', 'file_metadata', ['expires_at'])
    op.create_index('ix_file_metadata_file_id', 'file_metadata', ['file_id'], unique=True)
    op.create_index('ix_file_metadata_tenant_context', 'file_metadata', ['tenant_id', 'context_type', 'context_id'])
    op.create_index('ix_file_metadata_tenant_id', 'file_metadata', ['tenant_id'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_file_metadata_tenant_id', table_name='file_metadata')
    op.drop_index('ix_file_metadata_tenant_context', table_name='file_metadata')
    op.drop_index('ix_file_metadata_file_id', table_name='file_metadata')
    op.drop_index('ix_file_metadata_expires', table_name='file_metadata')
    op.drop_index('ix_file_metadata_context', table_name='file_metadata')
    
    # Drop table
    op.drop_table('file_metadata')