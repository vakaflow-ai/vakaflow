"""add_assessment_table_layouts_table

Revision ID: 51f0b0e64f3c
Revises: add_ai_eval_responses
Create Date: 2026-01-10 11:21:27.706422

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '51f0b0e64f3c'
down_revision = 'add_ai_eval_responses'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if table already exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    if 'assessment_table_layouts' not in tables:
        # Create assessment_table_layouts table
        op.create_table(
            'assessment_table_layouts',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
            sa.Column('tenant_id', sa.UUID(as_uuid=True), nullable=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('view_type', sa.String(50), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('columns', sa.JSON(), nullable=False),
            sa.Column('is_active', sa.Boolean(), default=True),
            sa.Column('is_default', sa.Boolean(), default=False),
            sa.Column('created_by', sa.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], name='fk_assessment_table_layouts_tenant_id'),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_assessment_table_layouts_created_by'),
        )
        
        # Create indexes separately to avoid conflicts
        try:
            op.create_index('ix_assessment_table_layouts_tenant_id', 'assessment_table_layouts', ['tenant_id'])
        except:
            pass  # Index may already exist
        
        try:
            op.create_index('ix_assessment_table_layouts_view_type', 'assessment_table_layouts', ['view_type'])
        except:
            pass  # Index may already exist


def downgrade() -> None:
    op.drop_table('assessment_table_layouts')

