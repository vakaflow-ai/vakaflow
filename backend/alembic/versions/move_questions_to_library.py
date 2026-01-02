"""Move questionnaire requirements to question library

Revision ID: move_questions_to_library
Revises: add_assessment_fields
Create Date: 2025-12-12

This migration moves all submission_requirements with requirement_type='questionnaires' 
to the question_library table, properly separating questions from requirements.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'move_questions_to_library'
down_revision = 'add_assessment_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Move questionnaire-type requirements to question_library.
    Requirements with requirement_type='questionnaires' are questions and should be in the library.
    """
    conn = op.get_bind()
    
    # Insert questionnaire requirements into question_library
    # Map submission_requirements fields to question_library fields
    conn.execute(text("""
        INSERT INTO question_library (
            id,
            tenant_id,
            title,
            question_text,
            description,
            assessment_type,
            category,
            field_type,
            response_type,
            is_required,
            options,
            validation_rules,
            requirement_ids,
            applicable_industries,
            created_by,
            updated_by,
            is_active,
            usage_count,
            created_at,
            updated_at
        )
        SELECT 
            sr.id,
            sr.tenant_id,
            sr.label as title,
            COALESCE(sr.description, sr.label) as question_text,
            sr.description,
            COALESCE(sr.questionnaire_type, 'tprm') as assessment_type,
            sr.category,
            sr.field_type,
            CASE 
                WHEN sr.allowed_response_types IS NOT NULL AND jsonb_array_length(sr.allowed_response_types::jsonb) > 0
                THEN (sr.allowed_response_types::jsonb->>0)
                ELSE sr.field_type
            END as response_type,
            sr.is_required,
            sr.options,
            jsonb_build_object(
                'min_length', sr.min_length,
                'max_length', sr.max_length,
                'min_value', sr.min_value,
                'max_value', sr.max_value,
                'pattern', sr.pattern
            ) as validation_rules,
            -- For questionnaire requirements, we need to find the parent requirement
            -- If this was a questionnaire, it might have been linked to a requirement
            -- For now, set to empty array - will be populated by seed scripts
            '[]'::jsonb as requirement_ids,
            NULL as applicable_industries,  -- Can be populated later based on tenant industry
            sr.created_by,
            NULL as updated_by,
            sr.is_active,
            0 as usage_count,
            sr.created_at,
            sr.updated_at
        FROM submission_requirements sr
        WHERE sr.requirement_type = 'questionnaires'
        AND NOT EXISTS (
            SELECT 1 FROM question_library ql WHERE ql.id = sr.id
        )
    """))
    
    # Update assessment_questions that reference these requirements
    # to reference the question_library instead
    conn.execute(text("""
        UPDATE assessment_questions aq
        SET 
            question_type = 'new_question',
            title = ql.title,
            question_text = ql.question_text,
            description = ql.description,
            field_type = ql.field_type,
            response_type = ql.response_type,
            category = ql.category,
            requirement_id = NULL  -- Clear requirement reference
        FROM question_library ql
        WHERE aq.requirement_id = ql.id
        AND ql.id IN (
            SELECT id FROM submission_requirements WHERE requirement_type = 'questionnaires'
        )
    """))


def downgrade() -> None:
    """
    Reverse the migration - this is complex as we'd need to recreate requirements.
    For now, we'll just note that this is a one-way migration.
    """
    # Note: This is a data migration that's difficult to reverse.
    # If needed, we could restore from backup or recreate requirements from question_library.
    pass
