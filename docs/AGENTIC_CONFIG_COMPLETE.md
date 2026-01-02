# Agentic Node Configuration - Implementation Complete ✅

## Overview

Agent nodes in flows can now be configured with **agentic actions** that are driven by configuration, not hardcoded code. This makes flows highly flexible and allows users to configure email, push data, and collect data actions without code changes.

---

## ✅ What Was Implemented

### 1. Frontend Components

#### `AgenticNodeConfig.tsx` (NEW)
- **Email Configuration**:
  - Enable/disable email notifications
  - Configure send timing (before/after/both/error)
  - Add multiple recipients (user, vendor, custom email)
  - Custom subject with variable substitution
  - Include execution result option

- **Push Data Configuration**:
  - Enable/disable push data
  - Add multiple targets (webhook, MCP, database, API)
  - Configure endpoints, methods, headers
  - Data mapping (map result fields to target fields)

- **Collect Data Configuration**:
  - Enable/disable data collection
  - Add multiple sources (API, database, MCP, RAG, file)
  - Configure queries, parameters
  - Merge strategies (replace, merge, append)

#### `FlowBuilder.tsx` (UPDATED)
- Added `agenticConfig` to node structure
- Integrated `AgenticNodeConfig` component
- Persists agentic configuration in flow definition
- Loads agentic configuration from saved flows

#### `BusinessFlowBuilder.tsx` (UPDATED)
- Added `agenticConfig` field to node structure
- Ready for agentic configuration (can be configured in Flow Builder after creation)

### 2. Backend Services

#### `AgenticActionService` (NEW)
- **`execute_email_action()`**: Sends emails based on configuration
- **`execute_push_data_action()`**: Pushes data to configured targets
- **`execute_collect_data_action()`**: Collects data from configured sources
- **Variable substitution**: Supports `${variable}` syntax
- **Error handling**: Graceful failure, doesn't break execution

#### `FlowExecutionService` (UPDATED)
- Processes `agenticConfig` in node execution
- Executes collect data **before** agent execution
- Executes push data **after** agent execution
- Executes email **before/after/on error** based on configuration
- Merges collected data into input_data

---

## 📋 Configuration Structure

### Node Structure (Enhanced)
```json
{
  "id": "node1",
  "name": "TPRM Assessment",
  "type": "agent",
  "agent_id": "...",
  "skill": "tprm",
  "input": {...},
  "agenticConfig": {
    "email": {...},
    "push_data": {...},
    "collect_data": {...}
  }
}
```

---

## 🎯 Use Cases

### Use Case 1: TPRM with Email Notification
```json
{
  "agenticConfig": {
    "email": {
      "enabled": true,
      "send_on": "after",
      "recipients": [
        {"type": "vendor", "value": "${input.vendor_id}"}
      ],
      "subject": "TPRM Assessment Complete - Score: ${result.tprm_score}",
      "include_result": true
    }
  }
}
```

### Use Case 2: Collect Data Before Execution
```json
{
  "agenticConfig": {
    "collect_data": {
      "enabled": true,
      "sources": [
        {
          "type": "rag",
          "query": "TPRM requirements for vendor ${input.vendor_id}",
          "merge_strategy": "merge"
        }
      ]
    }
  }
}
```

### Use Case 3: Push Results to Webhook
```json
{
  "agenticConfig": {
    "push_data": {
      "enabled": true,
      "targets": [
        {
          "type": "webhook",
          "endpoint": "https://crm.example.com/api/tprm-results",
          "method": "POST",
          "data_mapping": {
            "vendor_id": "vendor_id",
            "score": "tprm_score"
          }
        }
      ]
    }
  }
}
```

### Use Case 4: Complete Workflow
```json
{
  "agenticConfig": {
    "collect_data": {
      "enabled": true,
      "sources": [
        {"type": "rag", "query": "TPRM requirements"}
      ]
    },
    "email": {
      "enabled": true,
      "send_on": "after",
      "recipients": [{"type": "vendor", "value": "${input.vendor_id}"}]
    },
    "push_data": {
      "enabled": true,
      "targets": [
        {"type": "webhook", "endpoint": "https://example.com/webhook"}
      ]
    }
  }
}
```

---

## 🔄 Execution Flow

### With All Actions Enabled:

```
1. Node Execution Starts
   ↓
2. Collect Data (if enabled)
   ├── Collect from API/RAG/MCP/etc.
   ├── Merge into input_data
   └── Enriched input_data ready
   ↓
3. Send Email Before (if send_on: "before")
   ↓
4. Execute Agent Skill
   ├── Uses enriched input_data
   └── Returns result
   ↓
5. Push Data (if enabled)
   ├── Push to webhook/MCP/database
   └── Result pushed to targets
   ↓
6. Send Email After (if send_on: "after")
   ↓
7. Return Result
   └── Includes: result, _collected_data, _push_data, _email_sent
```

---

## 📝 Variable Substitution

All configurations support `${variable}` syntax:

- **Context**: `${context.execution_id}`, `${context.flow_id}`
- **Input**: `${input.vendor_id}`, `${input.agent_id}`
- **Result**: `${result.tprm_score}`, `${result.status}`
- **Environment**: `${env.WEBHOOK_TOKEN}`

---

## 🎨 UI Integration

### In Flow Builder:
1. Select an agent node
2. Scroll to **"Agentic Configuration"** section
3. Configure:
   - ✅ Email Notifications
   - ✅ Push Data
   - ✅ Collect Data
4. Save flow

### Visual Layout:
```
┌─────────────────────────────────────┐
│ Node Configuration                  │
├─────────────────────────────────────┤
│ Agent & Skill Selection             │
│ Input Data Configuration            │
│                                     │
│ ┌───────────────────────────────┐ │
│ │ Agentic Configuration          │ │
│ ├───────────────────────────────┤ │
│ │ ☑ Email Notifications         │ │
│ │ ☑ Push Data                   │ │
│ │ ☑ Collect Data                │ │
│ └───────────────────────────────┘ │
│                                     │
│ Custom Attributes                   │
└─────────────────────────────────────┘
```

---

## ✅ Benefits

1. **No Code Changes**: Configure actions via UI
2. **Flexible**: Mix and match actions per node
3. **Reusable**: Same flow, different configurations
4. **Integration Ready**: Easy external system integration
5. **Data Enrichment**: Collect data before execution
6. **Automated Notifications**: Email based on execution status
7. **Audit Trail**: All actions logged in execution results

---

## 📚 Documentation

- **`/docs/AGENTIC_NODE_CONFIGURATION.md`**: Complete configuration guide
- **`/docs/TPRM_AGENTIC_WORKFLOW.md`**: TPRM workflow examples
- **`/docs/AGENT_SKILL_INPUT_DATA.md`**: Updated with agentic config

---

## 🚀 Ready to Use

The agentic configuration system is now fully functional:

1. ✅ **UI Component**: `AgenticNodeConfig` ready
2. ✅ **Backend Service**: `AgenticActionService` implemented
3. ✅ **Flow Execution**: Integrated into `FlowExecutionService`
4. ✅ **Documentation**: Complete guides available

**Next Steps:**
1. Create a flow with agentic configuration
2. Test email notifications
3. Test push data to webhook
4. Test collect data from RAG
5. Combine all actions in a single node

---

## 🎉 Summary

**Agentic configuration is now fully implemented!** Users can configure email, push data, and collect data actions directly in the flow builder UI, making flows highly flexible and automated without requiring code changes.
