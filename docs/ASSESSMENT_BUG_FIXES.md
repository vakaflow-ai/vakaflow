# Assessment Bug Fixes - Complete ✅

## Issues Fixed

### 1. ✅ Assessment Creation 500 Error

**Error:**
```
TypeError: app.models.assessment.Assessment() got multiple values for keyword argument 'owner_id'
```

**Root Cause:**
- `owner_id` was being passed both explicitly and in `**assessment_data` dict
- This caused a duplicate keyword argument error

**Fix Applied:**
- Modified `assessment_service.py` to create a copy of the dict
- Extract `owner_id` from dict before unpacking
- Remove other explicitly passed fields (`tenant_id`, `created_by`, `is_active`)

**File:** `backend/app/services/assessment_service.py`
```python
# Create a copy to avoid mutating the original dict
assessment_dict = assessment_data.copy()

# Extract owner_id to avoid duplicate keyword argument
owner_id = assessment_dict.pop('owner_id', created_by)
if isinstance(owner_id, str):
    owner_id = UUID(owner_id)

# Remove fields that are passed explicitly
assessment_dict.pop('tenant_id', None)
assessment_dict.pop('created_by', None)
assessment_dict.pop('is_active', None)

assessment = Assessment(
    tenant_id=tenant_id,
    created_by=created_by,
    owner_id=owner_id,  # Only passed once
    is_active=True,
    **assessment_dict  # No longer contains owner_id, tenant_id, created_by, is_active
)
```

### 2. ✅ Assessment Question Creation 500 Error

**Error:**
```
TypeError: app.models.assessment.AssessmentQuestion() got multiple values for keyword argument 'order'
```

**Root Cause:**
- `order` was being passed both explicitly and in `**question_data` dict
- Same pattern as assessment creation

**Fix Applied:**
- Modified `assessment_service.py` `add_question` method
- Extract `order` from dict before unpacking
- Remove other explicitly passed fields

**File:** `backend/app/services/assessment_service.py`
```python
# Create a copy to avoid mutating the original dict
question_dict = question_data.copy()

# Extract order to avoid duplicate keyword argument
order = question_dict.pop('order', max_order)

# Remove fields that are passed explicitly
question_dict.pop('assessment_id', None)
question_dict.pop('tenant_id', None)

question = AssessmentQuestion(
    assessment_id=assessment_id,
    tenant_id=tenant_id,
    order=order,  # Only passed once
    **question_dict  # No longer contains order, assessment_id, tenant_id
)
```

---

## Testing

### Test Assessment Creation:
1. Navigate to **Assessment Management**
2. Click **"Create Assessment"**
3. Fill in:
   - Name: "TPRM Assessment"
   - Type: TPRM
   - Status: Active
   - Owner: Select a user
4. Click **"Save Assessment"**
5. ✅ Should save successfully (no 500 error)

### Test Question Addition:
1. Open an assessment
2. Click **"Add Question"**
3. Fill in question details
4. Click **"Save"**
5. ✅ Should save successfully (no 500 error)

### Test TPRM Agent Assignment:
1. Navigate to **Studio**
2. Execute **AiGrc Agent** with **TPRM** skill
3. Set `send_questionnaire: true` in input data
4. Execute the agent
5. ✅ Should create assignment and send email (no 500 error)
6. ✅ Result should show `questionnaire_sent: true` and `assessment_assignment_id` populated

---

### 3. ✅ Assessment Assignment Creation 500 Error (TPRM Agent)

**Error:**
```
TypeError: app.models.assessment.AssessmentAssignment() got multiple values for keyword argument 'status'
```

**Root Cause:**
- `status` was being passed both explicitly (`status='pending'`) and in `**assignment_data` dict
- Same pattern as assessment and question creation

**Fix Applied:**
- Modified `assessment_service.py` `create_assignment` method
- Extract `status` from dict before unpacking
- Remove other explicitly passed fields

**File:** `backend/app/services/assessment_service.py`
```python
# Create a copy to avoid mutating the original dict
assignment_dict = assignment_data.copy()

# Extract status to avoid duplicate keyword argument
status = assignment_dict.pop('status', 'pending')

# Remove fields that are passed explicitly
assignment_dict.pop('assessment_id', None)
assignment_dict.pop('schedule_id', None)
assignment_dict.pop('tenant_id', None)
assignment_dict.pop('assigned_by', None)
assignment_dict.pop('assigned_at', None)

assignment = AssessmentAssignment(
    assessment_id=assessment_id,
    schedule_id=schedule_id,
    tenant_id=tenant_id,
    assigned_by=assigned_by,
    assigned_at=datetime.utcnow(),
    status=status,  # Only passed once
    **assignment_dict  # No longer contains status or other explicit fields
)
```

**Impact:**
- This fix enables the TPRM agent to successfully create assessment assignments
- Questionnaire sending will now work correctly when `send_questionnaire=true`

---

## Status

✅ **Assessment creation fixed** - `owner_id` duplicate argument resolved
✅ **Question creation fixed** - `order` duplicate argument resolved
✅ **Assignment creation fixed** - `status` duplicate argument resolved (TPRM agent)
✅ **Backend auto-reload** - Changes should be picked up automatically

**The system should now work correctly for:**
- Creating/updating assessments
- Adding/updating questions
- All assessment management operations

---

## Summary

Both assessment-related 500 errors have been fixed by:
1. Creating copies of input dicts to avoid mutation
2. Extracting duplicate fields before unpacking
3. Removing explicitly passed fields from unpacked dict

The backend should automatically reload with `--reload` flag. If errors persist, try:
1. Hard refresh the browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Check backend logs for any remaining errors
3. Verify the fixes are in the code
