# Requirements and Questions Cleanup

## Overview

This document describes the cleanup of the requirements table to separate high-level requirements from questions, and the implementation of a many-to-many relationship between requirements and questions.

## Changes Made

### 1. Database Schema Changes

#### New Junction Table: `requirement_questions`
- **Purpose**: Many-to-many relationship between requirements and questions
- **Columns**:
  - `id`: UUID primary key
  - `requirement_id`: Foreign key to `submission_requirements.id`
  - `question_id`: Foreign key to `question_library.id`
  - `tenant_id`: Foreign key to `tenants.id`
  - `order`: Integer for ordering questions within a requirement
  - `created_at`, `updated_at`: Timestamps

#### Migration: `create_requirement_questions_junction`
- Creates the junction table
- Migrates existing `requirement_ids` JSON data from `question_library` to the junction table
- Cleans up requirements table by deleting questionnaire-type requirements that were moved to question_library

### 2. API Changes

#### Requirements API (`/api/v1/submission-requirements`)
- **Filtered out questionnaires**: The `list_requirements` endpoint now only returns high-level requirements (compliance/risk types)
- **Excluded questionnaires**: Requirements with `requirement_type='questionnaires'` are filtered out
- **Updated documentation**: Endpoint documentation clarifies that questions are managed in Question Library

### 3. Data Model Changes

#### Question Library
- **Deprecated**: `requirement_ids` JSON array field (still exists for backward compatibility)
- **New approach**: Use `requirement_questions` junction table for many-to-many relationships

#### Submission Requirements
- **Only high-level requirements**: Table now only contains compliance and risk requirements
- **No questions**: Questions are managed separately in `question_library`

### 4. Seed Script Updates

#### `seed_requirements_and_questions.py`
- Updated to use junction table instead of JSON arrays
- Creates `RequirementQuestion` entries when linking questions to requirements
- Maintains proper ordering via the `order` field

## Usage

### Creating Assessments

Users can now set up assessments in two ways:

1. **Via Requirements**: Select high-level requirements (e.g., "R-SEC-1: Information Security Management Oversight")
   - System automatically includes all questions linked to those requirements via the junction table

2. **Via Questions**: Select individual questions from the Question Library
   - Questions can be added directly without going through requirements

### Analytics

Requirements are now optimized for analytics:
- **Grouping**: Requirements can be grouped by `requirement_type`, `category`, `section`
- **High-level view**: Only shows compliance/risk objectives, not individual questions
- **Question mapping**: Questions are linked via junction table for flexible querying

## Migration Steps

1. **Run the migration**:
   ```bash
   cd backend
   alembic upgrade head
   ```

2. **Re-seed data** (if needed):
   ```bash
   python scripts/seed_all_requirements_and_questions.py
   ```

## Benefits

1. **Separation of Concerns**: Requirements (high-level) vs Questions (specific)
2. **Many-to-Many Flexibility**: Questions can belong to multiple requirements
3. **Better Analytics**: Requirements table is cleaner for grouping and analysis
4. **Automatic Question Handling**: System automatically determines which questions to send based on selected requirements

## File Changes

- `backend/alembic/versions/create_requirement_questions_junction.py` - Migration
- `backend/app/models/requirement_question.py` - Junction table model
- `backend/app/api/v1/submission_requirements.py` - Updated to filter questionnaires
- `backend/scripts/seed_requirements_and_questions.py` - Updated to use junction table
- `backend/app/models/__init__.py` - Added RequirementQuestion import


