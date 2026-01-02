"""add_catalog_id_to_submission_requirements

Revision ID: add_catalog_id
Revises: add_requirement_type
Create Date: 2025-12-12 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_catalog_id'
down_revision = 'add_requirement_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add catalog_id column to submission_requirements (nullable first, we'll make it unique after populating)
    op.add_column('submission_requirements', sa.Column('catalog_id', sa.String(50), nullable=True))
    
    # Generate catalog IDs for existing requirements using a simpler approach
    # Format: REQ-{CATEGORY}-{SEQ}
    # Example: REQ-SEC-01, REQ-SEC-02 (Security), REQ-COM-01 (Compliance), REQ-TPRM-01 (TPRM Questionnaire)
    op.execute("""
        WITH numbered_requirements AS (
            SELECT 
                id,
                tenant_id,
                category,
                questionnaire_type,
                ROW_NUMBER() OVER (
                    PARTITION BY tenant_id, 
                        COALESCE(
                            CASE 
                                WHEN questionnaire_type IS NOT NULL THEN
                                    CASE 
                                        WHEN UPPER(questionnaire_type) LIKE '%%TPRM%%' THEN 'TPRM'
                                        WHEN UPPER(questionnaire_type) LIKE '%%SECURITY%%' OR UPPER(questionnaire_type) LIKE '%%SEC%%' THEN 'VSEC'
                                        WHEN UPPER(questionnaire_type) LIKE '%%SUB%%' OR UPPER(questionnaire_type) LIKE '%%CONTRACTOR%%' THEN 'SCON'
                                        WHEN UPPER(questionnaire_type) LIKE '%%QUALIFICATION%%' OR UPPER(questionnaire_type) LIKE '%%QUAL%%' THEN 'VQUA'
                                        ELSE COALESCE(UPPER(REGEXP_REPLACE(SUBSTRING(questionnaire_type FROM 1 FOR 4), '[^A-Z0-9]', '', 'g')), 'GEN')
                                    END
                                WHEN category IS NOT NULL 
                                THEN UPPER(SUBSTRING(category FROM 1 FOR 3))
                                ELSE 'GEN'
                            END,
                            'GEN'
                        )
                    ORDER BY created_at, "order"
                ) as seq_num
            FROM submission_requirements
            WHERE catalog_id IS NULL
        )
        UPDATE submission_requirements sr
        SET catalog_id = CONCAT(
            'REQ-',
            CASE 
                WHEN nr.questionnaire_type IS NOT NULL THEN
                    CASE 
                        WHEN UPPER(nr.questionnaire_type) LIKE '%%TPRM%%' THEN 'TPRM'
                        WHEN UPPER(nr.questionnaire_type) LIKE '%%SECURITY%%' OR UPPER(nr.questionnaire_type) LIKE '%%SEC%%' THEN 'VSEC'
                        WHEN UPPER(nr.questionnaire_type) LIKE '%%SUB%%' OR UPPER(nr.questionnaire_type) LIKE '%%CONTRACTOR%%' THEN 'SCON'
                        WHEN UPPER(nr.questionnaire_type) LIKE '%%QUALIFICATION%%' OR UPPER(nr.questionnaire_type) LIKE '%%QUAL%%' THEN 'VQUA'
                        ELSE COALESCE(UPPER(REGEXP_REPLACE(SUBSTRING(nr.questionnaire_type FROM 1 FOR 4), '[^A-Z0-9]', '', 'g')), 'GEN')
                    END
                WHEN nr.category IS NOT NULL 
                THEN UPPER(SUBSTRING(nr.category FROM 1 FOR 3))
                ELSE 'GEN'
            END,
            '-',
            LPAD(nr.seq_num::text, 2, '0')
        )
        FROM numbered_requirements nr
        WHERE sr.id = nr.id
    """)
    
    # Now create unique index after all catalog_ids are populated
    # Make it unique per tenant (catalog_id should be unique within a tenant, not globally)
    op.create_index('ix_submission_requirements_catalog_id', 'submission_requirements', ['tenant_id', 'catalog_id'], unique=True)


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_submission_requirements_catalog_id', table_name='submission_requirements')
    
    # Drop column
    op.drop_column('submission_requirements', 'catalog_id')
