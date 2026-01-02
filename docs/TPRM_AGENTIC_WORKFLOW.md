# TPRM Agentic Workflow - Complete Use Case

## Overview

Yes, **this is a correct and powerful use case for agentic AI!** The TPRM agent should:
1. **Fetch requirements** from RAG and database
2. **Send questionnaires** to vendors
3. **Process responses** when received
4. **Update TPRM scores** based on responses

---

## Current Implementation

### What the TPRM Agent Currently Does:
✅ Queries RAG for TPRM requirements and criteria  
✅ Fetches TPRM requirements from database  
✅ Performs risk analysis  
✅ **Optionally creates and sends questionnaires** (NEW - just added)

### What It Should Do (Complete Workflow):

```
1. Fetch TPRM Requirements
   ├── Query RAG for compliance frameworks (SOC2, ISO27001, etc.)
   ├── Fetch questionnaire requirements from database
   └── Identify vendor-specific requirements

2. Create & Send Questionnaire
   ├── Create Assessment Assignment
   ├── Link to TPRM questionnaire
   ├── Send notification to vendor (via email/webhook)
   └── Optionally use i18N platform for translation/distribution

3. Wait for Vendor Response
   ├── Monitor assignment status
   ├── Track completion progress
   └── Collect responses

4. Process Responses
   ├── Analyze questionnaire responses
   ├── Update TPRM score based on responses
   ├── Identify compliance gaps
   └── Generate recommendations

5. Generate Report
   ├── TPRM score with justification
   ├── Risk categories assessment
   ├── Compliance gaps
   └── Action items
```

---

## Enhanced TPRM Agent Implementation

### Skill: `tprm` (Enhanced)

**Input Data:**
```json
{
  "vendor_id": "uuid-string",
  "agent_id": "uuid-string",
  "send_questionnaire": true,  // NEW: Create and send questionnaire
  "use_i18n": false            // NEW: Use i18N platform for distribution
}
```

**What It Does Now:**
1. ✅ Fetches TPRM requirements from RAG
2. ✅ Fetches TPRM questionnaire requirements from database
3. ✅ **Creates Assessment Assignment** (if `send_questionnaire=true`)
4. ✅ **Sends questionnaire to vendor** via Assessment system
5. ✅ Returns TPRM analysis with questionnaire status

**Response:**
```json
{
  "vendor_id": "...",
  "vendor_name": "...",
  "tprm_score": 75,
  "risk_categories": {...},
  "rag_context": [...],
  "requirements_fetched": 15,           // NEW
  "questionnaire_sent": true,            // NEW
  "assessment_assignment_id": "...",     // NEW
  "recommendations": [...],
  "next_steps": [                        // NEW
    "Questionnaire sent to vendor",
    "Wait for vendor responses",
    "Review responses and update TPRM score"
  ]
}
```

---

## Complete Agentic Flow Example

### TPRM Review with Questionnaire Flow

```json
{
  "name": "TPRM Review with Questionnaire",
  "flow_definition": {
    "nodes": [
      {
        "id": "node1",
        "name": "Fetch TPRM Requirements",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "tprm",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}",
          "send_questionnaire": true
        }
      },
      {
        "id": "node2",
        "name": "Send via i18N (Optional)",
        "type": "agent",
        "agent_id": "<external_i18n_agent_id>",
        "source": "external",
        "mcp_connection_id": "<i18n_connection_id>",
        "skill": "send_questionnaire",
        "input": {
          "assessment_assignment_id": "${node1.assessment_assignment_id}",
          "translate": true
        }
      },
      {
        "id": "node3",
        "name": "Wait for Response",
        "type": "delay",
        "input": {
          "duration_days": 7
        }
      },
      {
        "id": "node4",
        "name": "Process Responses",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "assessment",
        "input": {
          "assessment_type": "tprm",
          "assessment_assignment_id": "${node1.assessment_assignment_id}"
        }
      },
      {
        "id": "node5",
        "name": "Update TPRM Score",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "tprm",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}",
          "assessment_assignment_id": "${node1.assessment_assignment_id}",
          "update_score": true
        }
      }
    ],
    "edges": [
      {"from": "node1", "to": "node2"},
      {"from": "node2", "to": "node3"},
      {"from": "node3", "to": "node4"},
      {"from": "node4", "to": "node5"}
    ]
  }
}
```

---

## Integration Points

### 1. Assessment System
- **AssessmentAssignment**: Tracks questionnaire assignment to vendor
- **AssessmentQuestion**: Questions from TPRM requirements
- **AssessmentResponse**: Vendor responses

### 2. RAG Knowledge Base
- Compliance frameworks (SOC2, ISO27001, GDPR, etc.)
- TPRM best practices
- Risk assessment criteria
- Vendor evaluation templates

### 3. External Platforms (via MCP)
- **i18N Platform**: For questionnaire translation and distribution
- **Email/Notification Systems**: For sending questionnaires
- **TPRM Tools**: For integration with existing TPRM systems

---

## Benefits of Agentic Approach

### ✅ Why This is a Good Use Case:

1. **Intelligent Orchestration**: Agents coordinate multiple systems (RAG, DB, Assessments, External platforms)
2. **Automated Workflow**: End-to-end automation from requirement fetching to score calculation
3. **Learning**: Agents learn from questionnaire responses to improve future assessments
4. **Flexibility**: Can adapt workflow based on vendor type, risk level, etc.
5. **Integration**: Seamlessly integrates with existing Assessment and Workflow systems

### ✅ Current Capabilities:

- ✅ Fetches requirements from RAG
- ✅ Fetches requirements from database
- ✅ Creates assessment assignments
- ✅ Sends questionnaires to vendors
- ✅ Returns questionnaire status

### ⚠️ Future Enhancements:

- [ ] Process questionnaire responses automatically
- [ ] Update TPRM scores based on responses
- [ ] Integrate with i18N platform for translation
- [ ] Schedule follow-up questionnaires
- [ ] Generate automated reports
- [ ] Learn from responses to improve future assessments

---

## Usage Example

### Execute TPRM with Questionnaire:

```python
# Via Studio API
POST /api/v1/studio/agents/{ai_grc_agent_id}/execute
{
  "source": "vaka",
  "skill": "tprm",
  "input_data": {
    "vendor_id": "1c3e207f-21ed-487a-8949-478bfbdc57d0",
    "send_questionnaire": true
  }
}
```

### Response:
```json
{
  "success": true,
  "result": {
    "vendor_id": "1c3e207f-21ed-487a-8949-478bfbdc57d0",
    "vendor_name": "Default Vendor's Company",
    "tprm_score": 75,
    "risk_categories": {...},
    "requirements_fetched": 15,
    "questionnaire_sent": true,
    "assessment_assignment_id": "abc-123-def-456",
    "recommendations": [...],
    "next_steps": [
      "Questionnaire sent to vendor",
      "Wait for vendor responses",
      "Review responses and update TPRM score"
    ]
  }
}
```

---

## Summary

**Yes, this is absolutely a correct use case for agentic AI!**

The TPRM agent now:
- ✅ Fetches requirements (RAG + Database)
- ✅ Sends questionnaires (via Assessment system)
- ✅ Tracks questionnaire status
- ✅ Provides next steps

**Next Steps:**
1. Vendor receives questionnaire notification
2. Vendor completes questionnaire
3. Agent processes responses (future enhancement)
4. Agent updates TPRM score (future enhancement)

This demonstrates the power of agentic AI: **intelligent orchestration of multiple systems to automate complex business processes.**
