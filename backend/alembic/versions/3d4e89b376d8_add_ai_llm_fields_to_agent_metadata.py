"""add_ai_llm_fields_to_agent_metadata

Revision ID: 3d4e89b376d8
Revises: 153bc01d0366
Create Date: 2025-12-06 07:00:34.487716

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '3d4e89b376d8'
down_revision = '153bc01d0366'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add AI/LLM fields to agent_metadata table
    op.add_column('agent_metadata', sa.Column('llm_vendor', sa.String(length=100), nullable=True))
    op.add_column('agent_metadata', sa.Column('llm_model', sa.String(length=100), nullable=True))
    op.add_column('agent_metadata', sa.Column('deployment_type', sa.String(length=50), nullable=True))
    op.add_column('agent_metadata', sa.Column('data_sharing_scope', sa.JSON(), nullable=True))
    op.add_column('agent_metadata', sa.Column('data_usage_purpose', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove AI/LLM fields from agent_metadata table
    op.drop_column('agent_metadata', 'data_usage_purpose')
    op.drop_column('agent_metadata', 'data_sharing_scope')
    op.drop_column('agent_metadata', 'deployment_type')
    op.drop_column('agent_metadata', 'llm_model')
    op.drop_column('agent_metadata', 'llm_vendor')
