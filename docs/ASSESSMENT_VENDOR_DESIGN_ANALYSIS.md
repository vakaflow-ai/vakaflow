# Assessment-Vendor Design Analysis

## Current State

### Database Relationships (All Exist ✓)

1. **VENDOR → ASSESSMENT_ASSIGNMENT** (via `vendor_id` FK)
2. **ASSESSMENT_ASSIGNMENT → ASSESSMENT** (via `assessment_id` FK)
3. **ASSESSMENT_ASSIGNMENT → ASSESSMENT_QUESTION_RESPONSE** (via `assignment_id` FK)
4. **ASSESSMENT_ASSIGNMENT → ASSESSMENT_SCHEDULE** (via `schedule_id` FK)
5. **ASSESSMENT_REVIEW → VENDOR** (via `vendor_id` FK)
6. **ASSESSMENT_REVIEW → ASSESSMENT_ASSIGNMENT** (via `assignment_id` FK)

### Current Implementation

**File**: `backend/app/api/v1/suppliers_master.py` (lines 290-314)

```python
# Get assessment history
assessment_assignments = db.query(AssessmentAssignment).join(
    Assessment, AssessmentAssignment.assessment_id == Assessment.id
).filter(
    Assessment.tenant_id == effective_tenant_id,
    AssessmentAssignment.vendor_id == vendor.id
).all()

assessment_history = []
for assignment in assessment_assignments:
    assessment = db.query(Assessment).filter(Assessment.id == assignment.assessment_id).first()
    if assessment:
        assessment_history.append({
            "id": str(assessment.id),
            "name": assessment.name,
            "type": get_enum_value(assessment.assessment_type),
            "status": assignment.status if assignment.status else None,
            "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
            "completed_at": assignment.completed_at.isoformat() if assignment.completed_at else None,
        })
```

### What's Currently Returned

✅ Assessment ID, name, type, status, assigned_at, completed_at

### What's Missing

❌ **Assessment Schedules** - When assessments are scheduled for vendors
❌ **Assessment Responses** - Actual submitted answers and data
❌ **Assessment Artifacts** - Documents/files uploaded by vendors (stored in `AssessmentQuestionResponse.documents`)
❌ **Assessment Reviews** - AI/human reviews of vendor responses
❌ **Assessment Workflow History** - Status changes and workflow progression

## Design Issues

### Issue 1: Incomplete Data in Vendor Master View

**Current**: Only basic assignment info is returned
**Needed**: Full assessment context including:
- Schedules (when assessments are due/recurring)
- Responses (what vendors submitted)
- Artifacts (documents uploaded)
- Reviews (evaluation results)
- History (workflow progression)

### Issue 2: No Direct Query Path for Schedules

**Current**: `AssessmentSchedule.selected_vendor_ids` is stored as JSON array
**Impact**: To get schedules for a vendor, you must:
1. Query `AssessmentAssignment` where `vendor_id = X` → get `schedule_id`
2. OR query `AssessmentSchedule` and filter JSON array (inefficient)

**Better Design**: Could add a junction table `vendor_assessment_schedules` for many-to-many relationship, but current design works via assignments.

### Issue 3: Artifacts Not Easily Accessible

**Current**: Artifacts are stored in `AssessmentQuestionResponse.documents` (JSON field)
**Impact**: To get all artifacts for a vendor:
1. Query `AssessmentAssignment` where `vendor_id = X`
2. For each assignment, query `AssessmentQuestionResponse` where `assignment_id = Y`
3. Extract `documents` from each response

**This works but requires multiple queries.**

## Recommended Enhancements

### Option 1: Enhance Current API (Recommended)

Enhance `/suppliers-master/list` endpoint to include:

```python
assessment_history = []
for assignment in assessment_assignments:
    assessment = db.query(Assessment).filter(Assessment.id == assignment.assessment_id).first()
    
    # Get schedule if exists
    schedule = None
    if assignment.schedule_id:
        schedule = db.query(AssessmentSchedule).filter(
            AssessmentSchedule.id == assignment.schedule_id
        ).first()
    
    # Get responses/artifacts
    question_responses = db.query(AssessmentQuestionResponse).filter(
        AssessmentQuestionResponse.assignment_id == assignment.id
    ).all()
    
    # Extract artifacts from responses
    artifacts = []
    for qr in question_responses:
        if qr.documents:
            artifacts.extend(qr.documents)
    
    # Get reviews
    reviews = db.query(AssessmentReview).filter(
        AssessmentReview.assignment_id == assignment.id,
        AssessmentReview.vendor_id == vendor.id
    ).all()
    
    assessment_history.append({
        "id": str(assessment.id),
        "name": assessment.name,
        "type": get_enum_value(assessment.assessment_type),
        "status": assignment.status,
        "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
        "completed_at": assignment.completed_at.isoformat() if assignment.completed_at else None,
        "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
        "schedule": {
            "id": str(schedule.id) if schedule else None,
            "scheduled_date": schedule.scheduled_date.isoformat() if schedule else None,
            "frequency": schedule.frequency if schedule else None,
        } if schedule else None,
        "responses_count": len(question_responses),
        "artifacts_count": len(artifacts),
        "artifacts": artifacts,  # Or just count for performance
        "reviews": [{
            "id": str(r.id),
            "review_type": r.review_type,
            "status": r.status,
            "risk_score": r.risk_score,
            "risk_level": r.risk_level,
        } for r in reviews],
    })
```

### Option 2: Add Database Indexes (Performance)

Add indexes for common queries:
- `CREATE INDEX idx_assessment_assignments_vendor_status ON assessment_assignments(vendor_id, status)`
- `CREATE INDEX idx_assessment_question_responses_assignment ON assessment_question_responses(assignment_id)`
- `CREATE INDEX idx_assessment_reviews_vendor_assignment ON assessment_reviews(vendor_id, assignment_id)`

### Option 3: Create Dedicated Endpoint (Scalability)

Create `/vendors/{vendor_id}/assessments` endpoint that returns:
- Assessment assignments
- Schedules
- Responses
- Artifacts
- Reviews
- Workflow history

This keeps the suppliers master endpoint lightweight.

## Conclusion

**Database Design**: ✅ Correct - All relationships exist
**API Implementation**: ⚠️ Incomplete - Missing schedules, responses, artifacts, reviews
**Recommendation**: Enhance the API to include full assessment context for vendors

The relationships are correct, but the API needs to be enhanced to query and return the complete assessment data for vendors.
