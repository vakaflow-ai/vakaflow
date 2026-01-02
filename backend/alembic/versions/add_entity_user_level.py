"""add_entity_user_level

Revision ID: add_entity_user_level
Revises: add_selection_type
Create Date: 2025-12-26 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_entity_user_level'
down_revision = 'add_selection_type'
branch_labels = None
depends_on = None


def upgrade():
    # Add entity_user_level column to entity_field_registry
    op.add_column('entity_field_registry', 
        sa.Column('entity_user_level', sa.String(length=50), nullable=True, server_default='business')
    )
    
    # Create index on entity_user_level
    op.create_index('ix_entity_field_registry_entity_user_level', 'entity_field_registry', ['entity_user_level'])
    
    # Update existing records based on common business entities
    op.execute("""
        UPDATE entity_field_registry 
        SET entity_user_level = 'business' 
        WHERE entity_name IN ('agents', 'vendors', 'users', 'submission_requirements', 'assessments', 'security_incidents')
    """)
    
    op.execute("""
        UPDATE entity_field_registry 
        SET entity_user_level = 'advanced' 
        WHERE entity_name NOT IN ('agents', 'vendors', 'users', 'submission_requirements', 'assessments', 'security_incidents')
    """)


def downgrade():
    # Drop index
    op.drop_index('ix_entity_field_registry_entity_user_level', table_name='entity_field_registry')
    
    # Drop column
    op.drop_column('entity_field_registry', 'entity_user_level')
