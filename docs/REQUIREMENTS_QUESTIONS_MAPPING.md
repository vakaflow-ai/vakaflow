# Requirements and Questions Mapping Guide

## Overview

This document explains how requirements and questions are structured and mapped in the VAKA platform.

## Data Structure

### Requirements (`submission_requirements` table)
- **Type**: High-level compliance or risk requirements
- **Examples**: R-SEC-1 (Information Security Management Oversight), R-SEC-2 (Personnel Security)
- **Fields**:
  - `catalog_id`: Human-readable ID (e.g., "R-SEC-1", "R-COM-01", "R-RISK-02")
  - `requirement_type`: "compliance" or "risk" (NEVER "questionnaires")
  - `label`: Requirement name
  - `description`: Requirement description
  - `category`: security, compliance, technical, business
  - `section`: Grouping (e.g., "Security Requirements")

### Questions (`question_library` table)
- **Type**: Specific questions that belong to requirements
- **Examples**: 1.1, 1.2, 2.4, 2.4.1 (nested questions)
- **Fields**:
  - `title`: Question title
  - `question_text`: The actual question
  - `assessment_type`: tprm, vendor_qualification, risk_assessment, etc.
  - `category`: security, compliance, risk_management, etc.
  - `field_type`: radio, textarea, select, etc.
  - `response_type`: Text, File, Number, Date, etc.
  - `requirement_ids`: Array of requirement UUIDs this question satisfies
  - `options`: For radio/select fields (e.g., Yes/No options)

## Mapping Structure

```
Requirement (R-SEC-1)
  ├── Question 1.1
  ├── Question 1.2
  ├── Question 1.3
  └── Question 1.4

Requirement (R-SEC-2)
  ├── Question 2.1
  ├── Question 2.2
  ├── Question 2.3
  ├── Question 2.4
  │   └── Question 2.4.1 (nested/conditional)
  ├── Question 2.5
  └── Question 2.6
```

## Key Principles

1. **Requirements are NOT questions**: Requirements are high-level objectives (compliance/risk). Questions are specific items that assess those requirements.

2. **Questions link to Requirements**: Each question in `question_library` has a `requirement_ids` array that contains the UUID(s) of the requirement(s) it satisfies.

3. **No Questionnaire-Type Requirements**: Requirements with `requirement_type='questionnaires'` should be migrated to `question_library` and linked to their parent requirements.

4. **Catalog IDs**: Requirements use human-readable catalog IDs (R-SEC-1, R-COM-01) for easy reference.

5. **Question References**: Questions use hierarchical numbering (1.1, 2.4.1) stored in the `title` or as metadata.

## Seed Scripts

### `seed_all_requirements_and_questions.py` (Master Script)
This is the main script that seeds everything in the correct order:
1. Seeds compliance and risk requirements
2. Seeds structured requirements with questions (R-SEC-1, R-SEC-2, etc.)
3. Seeds additional question library items

### `seed_submission_requirements.py`
Seeds general compliance and risk requirements (NOT questionnaires).

### `seed_requirements_and_questions.py`
Seeds structured requirements with their associated questions, ensuring proper `requirement_ids` mapping.

### `seed_question_library.py`
Seeds additional standalone questions for various assessment types.

## Migration

The `move_questions_to_library.py` migration:
- Moves all `requirement_type='questionnaires'` items from `submission_requirements` to `question_library`
- Updates `assessment_questions` to reference the question library instead of requirements
- Preserves the relationship via `requirement_ids` (to be populated by seed scripts)

## Usage

To seed all requirements and questions:

```bash
cd backend
python scripts/seed_all_requirements_and_questions.py
```

This ensures:
- All requirements have proper `catalog_id` and `requirement_type`
- All questions are in `question_library` with proper `requirement_ids` links
- No questionnaire-type requirements exist in `submission_requirements`
