# TPRM Workflow Architecture - Best Practices

## Question: Flow Designer vs. Single Skill?

**Should TPRM workflow (fetch vendor → fetch questionnaire → send email) be:**
- **Option A**: Single skill that does everything
- **Option B**: Multi-node flow in Flow Designer

---

## 🎯 Recommended Approach: **Flow-Based (Option B)**

### Why Flow-Based is Better for TPRM

#### ✅ **1. Separation of Concerns**
Each step is a separate node with clear responsibility:
- **Node 1**: Fetch vendor data
- **Node 2**: Fetch questionnaire/requirements  
- **Node 3**: Create assessment assignment
- **Node 4**: Send email notification

**Benefit**: Easier to understand, debug, and maintain.

#### ✅ **2. Reusability**
Nodes can be reused in other flows:
- "Fetch Vendor" node → Use in vendor qualification flows
- "Send Email" node → Use in any notification flow
- "Fetch Questionnaire" node → Use in assessment flows

**Benefit**: Don't repeat code, build once, use everywhere.

#### ✅ **3. Better Error Handling**
Each node can have its own error handling:
- If vendor fetch fails → Stop flow, show specific error
- If questionnaire fetch fails → Continue with defaults or stop
- If email fails → Log error but don't fail entire flow

**Benefit**: Granular error handling, better user experience.

#### ✅ **4. Visibility & Monitoring**
See exactly where the flow is:
- "Currently fetching vendor..."
- "Fetching questionnaire requirements..."
- "Creating assessment assignment..."
- "Sending email notification..."

**Benefit**: Better debugging, better user feedback.

#### ✅ **5. Flexibility & Extensibility**
Easy to add steps:
- Add approval step before sending email
- Add risk analysis step after fetching vendor
- Add notification to internal team
- Add data push to external system

**Benefit**: Evolve workflow without changing agent code.

#### ✅ **6. Conditional Logic**
Add conditions between steps:
- Only send email if vendor has contact_email
- Only create assignment if requirements found
- Skip steps based on vendor status

**Benefit**: Smart, context-aware workflows.

---

## 📊 Comparison

| Aspect | Single Skill | Flow-Based |
|--------|-------------|------------|
| **Simplicity** | ✅ Simple to use | ⚠️ More setup |
| **Flexibility** | ❌ Hard to modify | ✅ Easy to extend |
| **Reusability** | ❌ Monolithic | ✅ Modular |
| **Error Handling** | ⚠️ All-or-nothing | ✅ Granular |
| **Visibility** | ❌ Black box | ✅ Step-by-step |
| **Testing** | ⚠️ Test entire skill | ✅ Test each node |
| **Maintenance** | ⚠️ Change entire skill | ✅ Change one node |

---

## 🏗️ Recommended TPRM Flow Architecture

### Flow Structure

```
┌─────────────────────────────────────────────────────────┐
│ TPRM Assessment Flow                                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Node 1: Fetch Vendor Data                               │
│  ┌─────────────────────────────────────┐                │
│  │ Agent: Vendor Agent                  │                │
│  │ Skill: get_vendor_details            │                │
│  │ Input: { vendor_id }                │                │
│  │ Output: vendor_data                 │                │
│  └─────────────────────────────────────┘                │
│                    ↓                                      │
│  Node 2: Fetch TPRM Requirements                         │
│  ┌─────────────────────────────────────┐                │
│  │ Agent: AI GRC Agent                 │                │
│  │ Skill: fetch_tprm_requirements      │                │
│  │ Input: { vendor_id, tenant_id }     │                │
│  │ Output: requirements_data           │                │
│  └─────────────────────────────────────┘                │
│                    ↓                                      │
│  Node 3: Create Assessment Assignment                    │
│  ┌─────────────────────────────────────┐                │
│  │ Agent: Assessment Agent             │                │
│  │ Skill: create_assignment            │                │
│  │ Input: {                            │                │
│  │   vendor_id,                        │                │
│  │   assessment_type: "tprm",          │                │
│  │   requirements_data                 │                │
│  │ }                                   │                │
│  │ Output: assignment_id               │                │
│  └─────────────────────────────────────┘                │
│                    ↓                                      │
│  Node 4: Send Email Notification                         │
│  ┌─────────────────────────────────────┐                │
│  │ Agent: AI GRC Agent                 │                │
│  │ Skill: send_notification            │                │
│  │ Input: {                            │                │
│  │   assignment_id,                    │                │
│  │   vendor_email,                     │                │
│  │   email_template: "tprm"            │                │
│  │ }                                   │                │
│  │ Output: email_sent                  │                │
│  └─────────────────────────────────────┘                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Alternative: Simplified Flow (Current Approach)

If you want to keep it simpler, you can use **agentic configuration** on a single node:

```
┌─────────────────────────────────────────────────────────┐
│ TPRM Assessment Flow (Simplified)                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Node 1: TPRM Analysis & Questionnaire                  │
│  ┌─────────────────────────────────────┐                │
│  │ Agent: AI GRC Agent                 │                │
│  │ Skill: tprm                         │                │
│  │ Input: {                            │                │
│  │   vendor_id,                        │                │
│  │   send_questionnaire: true          │                │
│  │ }                                   │                │
│  │                                     │                │
│  │ Agentic Config:                     │                │
│  │ ┌───────────────────────────────┐  │                │
│  │ │ Collect Data:                 │  │                │
│  │ │ - RAG: TPRM requirements      │  │                │
│  │ │ - Database: Vendor details    │  │                │
│  │ └───────────────────────────────┘  │                │
│  │ ┌───────────────────────────────┐  │                │
│  │ │ Email:                        │  │                │
│  │ │ - Send after execution        │  │                │
│  │ │ - Recipient: vendor email     │  │                │
│  │ │ - Include result              │  │                │
│  │ └───────────────────────────────┘  │                │
│  └─────────────────────────────────────┘                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Implementation Options

### Option 1: Full Flow-Based (Recommended for Complex Workflows)

**Pros:**
- Maximum flexibility
- Best visibility
- Easy to extend
- Reusable components

**Cons:**
- More setup
- More nodes to manage

**Use When:**
- Complex multi-step workflows
- Need conditional logic
- Want to reuse components
- Need detailed monitoring

### Option 2: Single Skill + Agentic Config (Recommended for Simple Workflows)

**Pros:**
- Simple to use
- Less setup
- Atomic operation
- Good for straightforward workflows

**Cons:**
- Less flexible
- Harder to extend
- Less visibility into steps

**Use When:**
- Simple, atomic operations
- Don't need step-by-step visibility
- Workflow is unlikely to change

### Option 3: Hybrid Approach (Best of Both Worlds)

**Structure:**
- Use **single skill** for core logic (TPRM analysis)
- Use **agentic config** for:
  - Collect data before (vendor, requirements)
  - Send email after
  - Push data to external systems

**Pros:**
- Simple to use (single node)
- Flexible (agentic config)
- Good visibility (config shows what will happen)

**Cons:**
- Still monolithic skill
- Less granular error handling

---

## 💡 Recommendation for TPRM

### **Recommended: Hybrid Approach (Option 3)**

**Why:**
1. **TPRM is a well-defined workflow** - doesn't need complex branching
2. **Agentic config provides flexibility** - can configure email, data collection
3. **Single node is simpler** - easier for users to understand
4. **Can evolve to flow-based later** - if needs become more complex

### Implementation

**Current State (Good!):**
- Single `tprm` skill that handles:
  - Fetching vendor
  - Fetching requirements
  - Creating assignment (if `send_questionnaire: true`)
  - Sending email (if `send_questionnaire: true`)

**Enhancement (Recommended):**
- Keep single skill for core TPRM logic
- Use **agentic config** for:
  - **Collect Data**: Fetch vendor and requirements before execution
  - **Email**: Configure email notifications
  - **Push Data**: Push results to external systems

**Future Evolution:**
- If workflow becomes more complex (e.g., add approval steps, risk analysis), break into flow-based approach

---

## 📝 Example: Hybrid TPRM Flow

### Flow Definition

```json
{
  "name": "TPRM Assessment with Questionnaire",
  "flow_definition": {
    "nodes": [
      {
        "id": "node1",
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
                "query": "get_vendor",
                "params": {
                  "vendor_id": "${input.vendor_id}"
                },
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
              {
                "type": "vendor",
                "value": "${input.vendor_id}"
              }
            ],
            "subject": "TPRM Assessment Complete - Score: ${result.tprm_score}",
            "include_result": true
          },
          "push_data": {
            "enabled": true,
            "targets": [
              {
                "type": "webhook",
                "endpoint": "https://crm.example.com/api/tprm-results",
                "method": "POST"
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

---

## 🚀 Migration Path

### Phase 1: Current (Single Skill)
- ✅ Single `tprm` skill does everything
- ✅ Simple to use
- ✅ Works well for basic use cases

### Phase 2: Enhanced (Single Skill + Agentic Config)
- ✅ Add agentic config for data collection
- ✅ Add agentic config for email
- ✅ Add agentic config for data push
- ✅ More flexible, still simple

### Phase 3: Advanced (Flow-Based)
- ✅ Break into multiple nodes if needed
- ✅ Add conditional logic
- ✅ Add approval steps
- ✅ Add risk analysis nodes

---

## ✅ Best Practice Summary

### For TPRM Specifically:

1. **Start with Single Skill + Agentic Config** (Current + Enhancement)
   - Simple to use
   - Flexible via config
   - Good visibility

2. **Evolve to Flow-Based if Needed**
   - When workflow becomes complex
   - When you need conditional logic
   - When you need to reuse components

3. **Use Flow-Based for Complex Workflows**
   - Multi-step processes
   - Need approval workflows
   - Need conditional branching
   - Need detailed monitoring

### General Rule:

- **Simple, atomic operations** → Single skill
- **Complex, multi-step workflows** → Flow-based
- **Simple but need flexibility** → Single skill + agentic config

---

## 🎯 Action Items

1. ✅ **Current**: Single `tprm` skill (good for now)
2. ⏳ **Enhance**: Add agentic config support for data collection and email
3. ⏳ **Future**: Consider flow-based if workflow becomes more complex

**The current approach is good!** Just enhance it with agentic configuration for more flexibility.
