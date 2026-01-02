# TPRM Workflow Best Practice Recommendation

## Question

**Should TPRM workflow (fetch vendor → fetch questionnaire → send email) be:**
- **A) Single skill** that does everything
- **B) Multi-node flow** in Flow Designer

---

## 🎯 **Recommended: Hybrid Approach (Single Skill + Agentic Config)**

### Why This is Best for TPRM

#### ✅ **1. TPRM is a Well-Defined Workflow**
- The steps are always the same: fetch vendor → fetch requirements → analyze → send questionnaire
- No complex branching needed
- Atomic operation makes sense

#### ✅ **2. Agentic Config Provides Flexibility**
- **Collect Data**: Configure what to fetch before execution
- **Email**: Configure when and how to send notifications
- **Push Data**: Configure where to send results
- **No code changes needed** - just configuration

#### ✅ **3. Simpler for Users**
- One node to configure instead of multiple
- Clear input/output
- Easier to understand and use

#### ✅ **4. Can Evolve Later**
- If workflow becomes complex (e.g., add approval steps), break into flow-based
- Current approach doesn't lock you in

---

## 📊 Comparison

| Aspect | Single Skill | Flow-Based | **Hybrid (Recommended)** |
|--------|-------------|------------|--------------------------|
| **Simplicity** | ✅ Simple | ❌ Complex | ✅ Simple |
| **Flexibility** | ❌ Limited | ✅ Very Flexible | ✅ Flexible via config |
| **Reusability** | ❌ Monolithic | ✅ Modular | ⚠️ Moderate |
| **Visibility** | ⚠️ Black box | ✅ Step-by-step | ✅ Config shows steps |
| **Error Handling** | ⚠️ All-or-nothing | ✅ Granular | ⚠️ Skill-level |
| **Maintenance** | ✅ Easy | ⚠️ Multiple nodes | ✅ Easy |
| **Best For** | Simple workflows | Complex workflows | **Well-defined workflows** |

---

## 🏗️ Recommended Architecture

### Current Implementation (Good!)

```python
# Single tprm skill that:
1. Fetches vendor (from input or database)
2. Fetches requirements (RAG + database)
3. Performs TPRM analysis
4. Optionally creates assessment assignment
5. Optionally sends email
```

### Enhanced with Agentic Config

```json
{
  "nodes": [
    {
      "id": "tprm_node",
      "type": "agent",
      "agent_id": "<ai_grc_agent_id>",
      "skill": "tprm",
      "input": {
        "vendor_id": "${trigger_data.vendor_id}",
        "send_questionnaire": true
      },
      "agenticConfig": {
        "collect_data": {
          "enabled": true,
          "sources": [
            {
              "type": "database",
              "query": "get_vendor",
              "params": {"vendor_id": "${input.vendor_id}"},
              "merge_strategy": "merge"
            },
            {
              "type": "rag",
              "query": "TPRM requirements for vendor ${input.vendor_id}",
              "merge_strategy": "merge"
            }
          ]
        },
        "email": {
          "enabled": true,
          "send_on": "after",
          "recipients": [
            {"type": "vendor", "value": "${input.vendor_id}"}
          ],
          "subject": "TPRM Assessment - ${result.tprm_score}",
          "include_result": true
        }
      }
    }
  ]
}
```

**Benefits:**
- ✅ Single node (simple)
- ✅ Configurable data collection (flexible)
- ✅ Configurable email (flexible)
- ✅ Clear what will happen (visible)

---

## 🔄 When to Use Each Approach

### Use Single Skill + Agentic Config When:
- ✅ Workflow is well-defined and consistent
- ✅ Steps are always the same
- ✅ No complex branching needed
- ✅ Want simplicity for users
- ✅ **TPRM fits this perfectly!**

### Use Flow-Based When:
- ✅ Workflow has conditional logic
- ✅ Need approval steps
- ✅ Need to reuse components in other flows
- ✅ Need step-by-step visibility
- ✅ Workflow varies based on context

### Example: When to Break TPRM into Flow

**Current (Good):**
```
TPRM Skill → Does everything
```

**Future (If Needed):**
```
Node 1: Fetch Vendor
  ↓
Node 2: Risk Check
  ↓ (if high risk)
Node 3: Get Approval
  ↓
Node 4: Fetch Requirements
  ↓
Node 5: Create Assignment
  ↓
Node 6: Send Email
```

**Only break into flow if:**
- You need approval steps
- You need conditional logic (e.g., different process for high-risk vendors)
- You want to reuse "Fetch Vendor" in other flows

---

## 💡 Recommendation for TPRM

### **Keep Current Approach + Enhance with Agentic Config**

**Why:**
1. **TPRM is atomic** - fetch, analyze, send is one logical operation
2. **Agentic config adds flexibility** - can configure data collection and email
3. **Simple for users** - one node, clear purpose
4. **Can evolve** - break into flow later if needed

**Implementation:**
- ✅ Keep single `tprm` skill (current)
- ✅ Use agentic config for:
  - Data collection (vendor, requirements)
  - Email notifications
  - Data push to external systems
- ✅ Document that it can be flow-based if needed

---

## 📝 Example: Enhanced TPRM Flow

### Flow Definition

```json
{
  "name": "TPRM Assessment with Questionnaire",
  "description": "Automated TPRM analysis and questionnaire distribution",
  "flow_definition": {
    "nodes": [
      {
        "id": "tprm_analysis",
        "name": "TPRM Analysis & Questionnaire",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "tprm",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}",
          "send_questionnaire": true
        },
        "agenticConfig": {
          "collect_data": {
            "enabled": true,
            "sources": [
              {
                "type": "database",
                "query": "get_vendor_details",
                "params": {
                  "vendor_id": "${input.vendor_id}"
                },
                "merge_strategy": "merge"
              },
              {
                "type": "rag",
                "query": "TPRM requirements compliance frameworks SOC2 ISO27001",
                "params": {
                  "limit": 10
                },
                "merge_strategy": "append"
              }
            ]
          },
          "email": {
            "enabled": true,
            "send_on": "after",
            "recipients": [
              {
                "type": "vendor",
                "value": "${input.vendor_id}"
              }
            ],
            "subject": "TPRM Assessment Assignment - ${result.vendor_name}",
            "include_result": false
          },
          "push_data": {
            "enabled": true,
            "targets": [
              {
                "type": "webhook",
                "endpoint": "https://crm.example.com/api/tprm-results",
                "method": "POST",
                "data_mapping": {
                  "vendor_id": "vendor_id",
                  "tprm_score": "tprm_score",
                  "assignment_id": "assessment_assignment_id"
                }
              }
            ]
          }
        }
      }
    ],
    "edges": []
  }
}
```

### What This Does

1. **Before Execution** (Collect Data):
   - Fetches vendor details from database
   - Fetches TPRM requirements from RAG
   - Merges into input_data

2. **During Execution** (TPRM Skill):
   - Uses enriched input_data
   - Performs TPRM analysis
   - Creates assessment assignment (if `send_questionnaire: true`)
   - Returns results

3. **After Execution**:
   - Sends email to vendor (via agentic config)
   - Pushes results to webhook (via agentic config)

---

## ✅ Best Practice Summary

### For TPRM Specifically:

**✅ Recommended: Single Skill + Agentic Config**

**Reasons:**
1. TPRM is a well-defined, atomic workflow
2. Agentic config provides needed flexibility
3. Simpler for users (one node)
4. Can evolve to flow-based if needed

**Implementation:**
- Keep current `tprm` skill
- Enhance with agentic config (already done!)
- Document flow-based option for future

### General Rule:

| Workflow Type | Approach | Example |
|--------------|----------|---------|
| **Simple, Atomic** | Single Skill | TPRM analysis |
| **Simple but Flexible** | Single Skill + Config | TPRM with configurable email |
| **Complex, Multi-Step** | Flow-Based | Multi-stage approval workflow |
| **Conditional Logic** | Flow-Based | Different paths based on risk level |

---

## 🚀 Action Plan

### Phase 1: Current (✅ Done)
- Single `tprm` skill
- Handles: fetch vendor, fetch requirements, create assignment, send email

### Phase 2: Enhanced (✅ Done)
- Agentic config for data collection
- Agentic config for email
- Agentic config for data push

### Phase 3: Future (If Needed)
- Break into flow-based if workflow becomes complex
- Add approval steps
- Add conditional logic

---

## 🎯 Conclusion

**For TPRM: Use Single Skill + Agentic Config**

This approach:
- ✅ Keeps it simple for users
- ✅ Provides flexibility via configuration
- ✅ Doesn't lock you into one approach
- ✅ Can evolve to flow-based if needed

**The current implementation is good!** Just enhance it with agentic configuration (which we've already done) for maximum flexibility while maintaining simplicity.
