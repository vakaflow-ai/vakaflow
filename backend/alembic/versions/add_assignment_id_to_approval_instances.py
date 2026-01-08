"""add_assignment_id_to_approval_instances

Revision ID: add_assignment_id_approval
Revises: add_supplier_master
Create Date: 2025-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_assignment_id_approval'
down_revision = 'add_supplier_master'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make agent_id nullable (it was NOT NULL but should be nullable for assessments)
    op.alter_column('approval_instances', 'agent_id',
                    existing_type=postgresql.UUID(as_uuid=True),
                    nullable=True)
    
    # Add assignment_id column for assessment assignments
    op.add_column(
        'approval_instances',
        sa.Column('assignment_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    
    # Add index on assignment_id
    op.create_index(
        'ix_approval_instances_assignment_id',
        'approval_instances',
        ['assignment_id']
    )
    
    # Add foreign key constraint to assessment_assignments table
    op.create_foreign_key(
        'fk_approval_instances_assignment_id',
        'approval_instances',
        'assessment_assignments',
        ['assignment_id'],
        ['id']
    )


def downgrade() -> None:
    # Remove foreign key constraint
    op.drop_constraint('fk_approval_instances_assignment_id', 'approval_instances', type_='foreignkey')
    
    # Remove index
    op.drop_index('ix_approval_instances_assignment_id', table_name='approval_instances')
    
    # Remove assignment_id column
    op.drop_column('approval_instances', 'assignment_id')
    
    # Make agent_id NOT NULL again (if needed, but this might fail if there are NULL values)
    # op.alter_column('approval_instances', 'agent_id',
    #                 existing_type=postgresql.UUID(as_uuid=True),
    #                 nullable=False)

