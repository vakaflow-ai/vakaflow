# Agent Skill Input Data Guide

This document describes the required input data format for each agent skill in the VAKA platform.

## Assessment Agent

### Skill: `assessment`

Conducts a general assessment using RAG and LLM.

**Input Data Structure:**
```json
{
  "assessment_type": "tprm",  // Optional, defaults to "general"
  "agent_id": "uuid-string"    // Optional, UUID of agent to assess
}
```

**Valid `assessment_type` values:**
- `"tprm"` - Third-Party Risk Management
- `"vendor_qualification"` - Vendor Qualification
- `"risk_assessment"` - Risk Assessment
- `"ai_vendor_qualification"` - AI Vendor Qualification
- `"security_assessment"` - Security Assessment
- `"compliance_assessment"` - Compliance Assessment
- `"custom"` - Custom Assessment
- `"general"` - General Assessment (default if not specified)

**Examples:**

1. **TPRM Assessment:**
```json
{
  "assessment_type": "tprm",
  "agent_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

2. **Security Assessment (no specific agent):**
```json
{
  "assessment_type": "security_assessment"
}
```

3. **Using dynamic values in flows:**
```json
{
  "assessment_type": "tprm",
  "agent_id": "${trigger_data.agent_id}"
}
```

**What the skill does:**
- Queries RAG for assessment criteria based on `assessment_type`
- Uses LLM to generate assessment with score, findings, recommendations, and risk areas
- Returns assessment results with RAG context

---

### Skill: `vendor_qualification`

Conducts vendor qualification assessment.

**Input Data Structure:**
```json
{
  "vendor_id": "uuid-string"  // Required, UUID of vendor
}
```

**Example:**
```json
{
  "vendor_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Using dynamic values:**
```json
{
  "vendor_id": "${trigger_data.vendor_id}"
}
```

**What the skill does:**
- Retrieves vendor information from database
- Queries RAG for vendor qualification criteria
- Assesses vendor against qualification criteria (security, compliance, financial stability, etc.)
- Returns qualification status, score, and recommendations

---

### Skill: `marketplace_reviews`

Analyzes marketplace reviews for a vendor.

**Input Data Structure:**
```json
{
  "vendor_id": "uuid-string",  // Required, UUID of vendor
  "agent_id": "uuid-string"     // Optional, UUID of agent
}
```

**Example:**
```json
{
  "vendor_id": "123e4567-e89b-12d3-a456-426614174000",
  "agent_id": "987e6543-e21b-43d2-b654-321987654321"
}
```

**What the skill does:**
- Retrieves vendor reviews and ratings from database
- Analyzes reviews using RAG
- Calculates review metrics (total reviews, average rating, sentiment)
- Returns review summary with recommendations

---

## AI GRC Agent

### Skill: `tprm`

Third-Party Risk Management analysis.

**Input Data Structure:**
```json
{
  "vendor_id": "uuid-string",  // Optional, UUID of vendor
  "agent_id": "uuid-string",   // Optional, UUID of agent (at least one required)
  "send_questionnaire": false  // Optional, if true, creates and sends TPRM questionnaire to vendor
}
```

**Example:**
```json
{
  "vendor_id": "123e4567-e89b-12d3-a456-426614174000",
  "agent_id": "987e6543-e21b-43d2-b654-321987654321",
  "send_questionnaire": true
}
```

**What the skill does:**
- Fetches TPRM requirements from RAG and database
- Performs TPRM analysis on vendor or agent
- Uses RAG to retrieve compliance and risk data
- **Optionally creates and sends TPRM questionnaire to vendor** (if `send_questionnaire=true`)
- Generates risk assessment with LLM
- Returns risk score, findings, recommendations, and questionnaire status

---

### Skill: `realtime_risk_analysis`

Real-time risk analysis for an agent.

**Input Data Structure:**
```json
{
  "agent_id": "uuid-string"  // Required, UUID of agent to analyze
}
```

**Example:**
```json
{
  "agent_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**What the skill does:**
- Performs real-time risk analysis on specified agent
- Queries RAG for current risk indicators
- Uses LLM to assess current risk level
- Returns real-time risk score and alerts

---

## Compliance Reviewer Agent

### Skill: `compliance_review`

Reviews agent compliance.

**Input Data Structure:**
```json
{
  "agent_id": "uuid-string",     // Required, UUID of agent to review
  "review_type": "security"       // Optional, type of review
}
```

**Example:**
```json
{
  "agent_id": "123e4567-e89b-12d3-a456-426614174000",
  "review_type": "security"
}
```

**What the skill does:**
- Reviews agent compliance status
- Checks compliance against frameworks
- Returns compliance status and recommendations

---

## Using Dynamic Values in Flows

When creating flows, you can use dynamic values from flow execution context:

```json
{
  "assessment_type": "tprm",
  "agent_id": "${trigger_data.agent_id}",
  "vendor_id": "${trigger_data.vendor_id}"
}
```

**Available context variables:**
- `${trigger_data.agent_id}` - Agent ID from flow trigger
- `${trigger_data.vendor_id}` - Vendor ID from flow trigger
- `${trigger_data.context_id}` - Context ID from flow execution
- `${trigger_data.context_type}` - Context type from flow execution
- `${node1.result.field}` - Result from previous node (e.g., `node1.result.risk_score`)

---

## Common Patterns

### Pattern 1: Agent Assessment
```json
{
  "assessment_type": "ai_vendor_qualification",
  "agent_id": "${trigger_data.agent_id}"
}
```

### Pattern 2: Vendor TPRM
```json
{
  "vendor_id": "${trigger_data.vendor_id}"
}
```

### Pattern 3: Combined Analysis
```json
{
  "vendor_id": "${trigger_data.vendor_id}",
  "agent_id": "${trigger_data.agent_id}",
  "assessment_type": "tprm"
}
```

---

## Error Handling

If required fields are missing:
- `vendor_qualification` without `vendor_id`: Returns error "vendor_id is required"
- `marketplace_reviews` without `vendor_id`: Returns error "vendor_id is required"

If optional fields are missing:
- `assessment` without `assessment_type`: Defaults to "general"
- `assessment` without `agent_id`: Assessment runs without specific agent context

---

## Best Practices

1. **Always provide required fields** - Check skill documentation for required vs optional fields
2. **Use specific assessment types** - More specific types provide better RAG context
3. **Include agent_id when available** - Provides better context for agent-specific assessments
4. **Use dynamic values in flows** - Makes flows reusable across different contexts
5. **Validate JSON format** - Ensure proper JSON syntax before execution

---

## Quick Reference

| Skill | Required Fields | Optional Fields |
|-------|---------------|----------------|
| `assessment` | - | `assessment_type`, `agent_id` |
| `vendor_qualification` | `vendor_id` | - |
| `marketplace_reviews` | `vendor_id` | `agent_id` |
| `tprm` | `vendor_id` OR `agent_id` | Both can be provided |
| `realtime_risk_analysis` | `agent_id` | - |
| `compliance_review` | `agent_id` | `review_type` |
