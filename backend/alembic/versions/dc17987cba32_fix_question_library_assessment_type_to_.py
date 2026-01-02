"""fix_question_library_assessment_type_to_json

Revision ID: dc17987cba32
Revises: req_questions_junction
Create Date: 2025-12-14 09:10:14.887397

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import json


# revision identifiers, used by Alembic.
revision = 'dc17987cba32'
down_revision = 'req_questions_junction'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change assessment_type from VARCHAR(50) to JSON
    # First, migrate existing data from string to JSON format
    connection = op.get_bind()
    
    # Get all existing records
    result = connection.execute(sa.text("SELECT id, assessment_type FROM question_library"))
    rows = result.fetchall()
    
    # Update each row to convert string to JSON array
    for row in rows:
        question_id = row[0]
        assessment_type_str = row[1]
        
        # Convert string to JSON array
        if assessment_type_str:
            # If it's already a JSON string, parse it
            if isinstance(assessment_type_str, str) and assessment_type_str.startswith('[') and assessment_type_str.endswith(']'):
                try:
                    # Try to parse as JSON
                    parsed = json.loads(assessment_type_str)
                    if isinstance(parsed, list):
                        json_value = json.dumps(parsed)
                    else:
                        # Single value, wrap in array
                        json_value = json.dumps([parsed])
                except (json.JSONDecodeError, ValueError):
                    # Not valid JSON, treat as single value
                    json_value = json.dumps([assessment_type_str])
            else:
                # Plain string, wrap in array
                json_value = json.dumps([assessment_type_str])
        else:
            # Empty/null, default to empty array
            json_value = json.dumps([])
        
        # Update the row with JSON value - use CAST in the SQL
        connection.execute(
            sa.text("UPDATE question_library SET assessment_type = CAST(:json_value AS jsonb) WHERE id = :question_id"),
            {"json_value": json_value, "question_id": question_id}
        )
    
    # Now alter the column type from VARCHAR to JSON
    op.alter_column('question_library', 'assessment_type',
                    type_=postgresql.JSON,
                    existing_type=sa.String(50),
                    postgresql_using='assessment_type::json')


def downgrade() -> None:
    # Convert JSON back to VARCHAR(50) - take first value or empty string
    connection = op.get_bind()
    
    # Get all existing records
    result = connection.execute(sa.text("SELECT id, assessment_type FROM question_library"))
    rows = result.fetchall()
    
    # Update each row to convert JSON array to string (first value)
    for row in rows:
        question_id = row[0]
        assessment_type_json = row[1]
        
        # Convert JSON array to string (take first value)
        if assessment_type_json:
            if isinstance(assessment_type_json, list) and len(assessment_type_json) > 0:
                string_value = str(assessment_type_json[0])[:50]  # Limit to 50 chars
            elif isinstance(assessment_type_json, str):
                try:
                    parsed = json.loads(assessment_type_json)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        string_value = str(parsed[0])[:50]
                    else:
                        string_value = str(assessment_type_json)[:50]
                except (json.JSONDecodeError, ValueError):
                    string_value = str(assessment_type_json)[:50]
            else:
                string_value = str(assessment_type_json)[:50]
        else:
            string_value = ''
        
        # Update the row with string value
        connection.execute(
            sa.text("UPDATE question_library SET assessment_type = :string_value WHERE id = :question_id"),
            {"string_value": string_value, "question_id": question_id}
        )
    
    # Alter the column type back to VARCHAR(50)
    op.alter_column('question_library', 'assessment_type',
                    type_=sa.String(50),
                    existing_type=postgresql.JSON)

