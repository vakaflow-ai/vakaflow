# Assessment/Evaluation Management System - Design Document

## Overview
A comprehensive system for managing vendor and agent assessments/evaluations (TPRM, Vendor Qualification, Risk Assessment, AI-Vendor Qualification, etc.) with rule-based assignment, scheduling, and integrated response collection.

## Understanding Confirmed

### 1. Assessment Structure
- **Both**: Assessments can contain new questions AND reference existing submission requirements
- **Reusability**: Questions can be reused across multiple assessments
- **Question Types**:
  - `NEW_QUESTION`: Question defined within the assessment
  - `REQUIREMENT_REFERENCE`: References existing submission requirement

### 2. Rule-Based Assignment
- **Configurable in UI**: Rules are fully configurable through the user interface
- **Attributes Supported**:
  - Vendor attributes: category, type, risk level
  - Agent attributes: category, type, risk level
  - Master data tags: department, business unit (BU)
- **Assignment Context**: Can be applied to vendor onboarding, agent onboarding, or both

### 3. Scheduling
- **Per-Assessment**: Scheduling is configured per assessment
- **Vendor Selection**: Pick vendors based on matching to the last schedule
- **Auto-Trigger**: System automatically triggers assessments based on schedule
- **Dashboard Integration**: Upcoming assessments shown in dashboards
- **Frequencies**: Quarterly, Yearly, Monthly, Bi-Annual, One-Time, Custom

### 4. Response Management
- **Integrated Storage**: Responses stored in `submission_requirement_responses` table (integrated with existing system)
- **Completion Tracking**: Track completion status per vendor/agent
- **Status Management**: pending, in_progress, completed, overdue, cancelled

### 5. Permissions
- **Create/Edit**: Role-based (Admin, Compliance Reviewer, etc.)
- **View Responses**: Role-based (Admin, Compliance Reviewer, etc.)

## Database Schema

### Tables Created

1. **assessments**
   - Core assessment definition
   - Supports scheduling, rule-based assignment
   - Links to owner and teams

2. **assessment_questions**
   - Questions within assessments
   - Supports both new questions and requirement references
   - Reusability support

3. **assessment_schedules**
   - Schedule instances
   - Tracks scheduled dates, vendor selection, status

4. **assessment_assignments**
   - Individual assignments to vendors/agents
   - Links to schedules
   - Tracks completion status

## Implementation Plan

### Phase 1: Backend Foundation ✅ (In Progress)
- [x] Create database models
- [x] Create Alembic migration
- [ ] Create service layer (AssessmentService)
- [ ] Create API endpoints (CRUD operations)
- [ ] Implement audit logging

### Phase 2: Question Management
- [ ] API endpoints for question management
- [ ] Support for reusable questions
- [ ] Question-to-requirement mapping

### Phase 3: Rule-Based Assignment
- [ ] Rule configuration API
- [ ] Rule evaluation engine
- [ ] Auto-assignment logic

### Phase 4: Scheduling
- [ ] Schedule management API
- [ ] Auto-trigger scheduler (background job)
- [ ] Vendor selection based on last schedule

### Phase 5: Frontend
- [ ] Main Assessments Management screen
- [ ] Create/Edit modals
- [ ] Question management UI
- [ ] Scheduling UI
- [ ] Rule configuration UI
- [ ] Navigation menu integration

### Phase 6: Integration
- [ ] Assessment-to-form integration
- [ ] Response collection forms
- [ ] Completion tracking
- [ ] Dashboard widgets

## Next Steps

1. **Confirm Understanding**: Review this document and confirm all details
2. **Run Migration**: Execute the Alembic migration to create tables
3. **Implement Service Layer**: Create AssessmentService with business logic
4. **Create API Endpoints**: Build RESTful API for assessments
5. **Build Frontend**: Create the management interface

## Questions for Clarification

1. **Master Data Tags**: Should department and BU be stored as master data lists, or as separate fields on vendors/agents?
2. **Team Management**: How should "team_ids" work? Are there existing team/user group models?
3. **Assessment Templates**: Should there be pre-built assessment templates for common types (TPRM, etc.)?
4. **Response Workflow**: Should there be a review/approval workflow for assessment responses?
