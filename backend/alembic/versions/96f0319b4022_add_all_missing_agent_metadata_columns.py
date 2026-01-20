"""add_all_missing_agent_metadata_columns

Revision ID: 96f0319b4022
Revises: d0837431830a
Create Date: 2026-01-19 14:31:45.604889

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '96f0319b4022'
down_revision = 'd0837431830a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add all missing columns to agent_metadata table (check if they exist first)
    from sqlalchemy import text
    
    # Check and add monitoring_tools
    try:
        op.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='monitoring_tools'"))
        result = op.get_bind().execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='monitoring_tools'"))
        if result.fetchone() is None:
            op.add_column('agent_metadata', sa.Column('monitoring_tools', sa.JSON(), nullable=True))
    except Exception:
        # Column doesn't exist, add it
        op.add_column('agent_metadata', sa.Column('monitoring_tools', sa.JSON(), nullable=True))
    
    # Check and add version_info
    try:
        op.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='version_info'"))
        result = op.get_bind().execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='version_info'"))
        if result.fetchone() is None:
            op.add_column('agent_metadata', sa.Column('version_info', sa.JSON(), nullable=True))
    except Exception:
        # Column doesn't exist, add it
        op.add_column('agent_metadata', sa.Column('version_info', sa.JSON(), nullable=True))
    
    # Check and add use_cases
    try:
        op.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='use_cases'"))
        result = op.get_bind().execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='use_cases'"))
        if result.fetchone() is None:
            op.add_column('agent_metadata', sa.Column('use_cases', sa.JSON(), nullable=True))
    except Exception:
        # Column doesn't exist, add it
        op.add_column('agent_metadata', sa.Column('use_cases', sa.JSON(), nullable=True))
    
    # Check and add personas
    try:
        op.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='personas'"))
        result = op.get_bind().execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='personas'"))
        if result.fetchone() is None:
            op.add_column('agent_metadata', sa.Column('personas', sa.JSON(), nullable=True))
    except Exception:
        # Column doesn't exist, add it
        op.add_column('agent_metadata', sa.Column('personas', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove added columns from agent_metadata table (if they exist)
    from sqlalchemy import text
    
    # Check and drop monitoring_tools
    try:
        op.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='monitoring_tools'"))
        result = op.get_bind().execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='monitoring_tools'"))
        if result.fetchone() is not None:
            op.drop_column('agent_metadata', 'monitoring_tools')
    except Exception:
        pass
    
    # Check and drop version_info
    try:
        op.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='version_info'"))
        result = op.get_bind().execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='version_info'"))
        if result.fetchone() is not None:
            op.drop_column('agent_metadata', 'version_info')
    except Exception:
        pass
    
    # Check and drop use_cases
    try:
        op.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='use_cases'"))
        result = op.get_bind().execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='use_cases'"))
        if result.fetchone() is not None:
            op.drop_column('agent_metadata', 'use_cases')
    except Exception:
        pass
    
    # Check and drop personas
    try:
        op.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='personas'"))
        result = op.get_bind().execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agent_metadata' AND column_name='personas'"))
        if result.fetchone() is not None:
            op.drop_column('agent_metadata', 'personas')
    except Exception:
        pass

