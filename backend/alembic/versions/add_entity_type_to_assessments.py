"""add_entity_type_to_assessments

Revision ID: add_entity_type_assessments
Revises: add_products_services
Create Date: 2025-01-20 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_entity_type_assessments'
down_revision = 'add_products_services'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add entity_type and entity_id to assessment_assignments
    op.add_column('assessment_assignments', sa.Column('entity_type', sa.String(50), nullable=True))
    op.add_column('assessment_assignments', sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Create indexes
    op.create_index('ix_assessment_assignments_entity_type', 'assessment_assignments', ['entity_type'])
    op.create_index('ix_assessment_assignments_entity_id', 'assessment_assignments', ['entity_id'])
    
    # Migrate existing data: if agent_id is set, set entity_type='agent' and entity_id=agent_id
    # If vendor_id is set, set entity_type='vendor' and entity_id=vendor_id
    op.execute("""
        UPDATE assessment_assignments
        SET entity_type = 'agent', entity_id = agent_id
        WHERE agent_id IS NOT NULL
    """)
    
    op.execute("""
        UPDATE assessment_assignments
        SET entity_type = 'vendor', entity_id = vendor_id
        WHERE vendor_id IS NOT NULL AND entity_type IS NULL
    """)


def downgrade() -> None:
    op.drop_index('ix_assessment_assignments_entity_id', 'assessment_assignments')
    op.drop_index('ix_assessment_assignments_entity_type', 'assessment_assignments')
    op.drop_column('assessment_assignments', 'entity_id')
    op.drop_column('assessment_assignments', 'entity_type')
