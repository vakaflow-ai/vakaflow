# Agentic Node Configuration Guide

## Overview

Agent nodes in flows can now be configured with **agentic actions**:
- **Email Notifications**: Send emails before/after/on error
- **Push Data**: Push execution results to external systems (webhooks, MCP, databases)
- **Collect Data**: Collect data from external sources (APIs, databases, MCP, RAG, files) before execution

These configurations are **driven by agentic config** in each node, making flows highly flexible and automated.

---

## Node Structure (Enhanced)

```typescript
interface FlowNode {
  id: string
  name?: string
  type: 'agent' | 'condition' | 'delay'
  agent_id?: string
  skill?: string
  input?: Record<string, any>
  customAttributes?: Record<string, any>
  agenticConfig?: {  // NEW: Agentic configuration
    email?: EmailConfig
    push_data?: PushDataConfig
    collect_data?: CollectDataConfig
  }
  position?: { x: number; y: number }
}
```

---

## 1. Email Configuration

### Structure
```typescript
{
  email: {
    enabled: boolean
    send_on: 'before' | 'after' | 'both' | 'error'
    recipients: Array<{
      type: 'user' | 'vendor' | 'custom'
      value: string  // user_id, vendor_id, or email address
    }>
    subject?: string  // Supports ${variable} syntax
    include_result?: boolean
  }
}
```

### Examples

**Send email after execution to vendor:**
```json
{
  "email": {
    "enabled": true,
    "send_on": "after",
    "recipients": [
      {
        "type": "vendor",
        "value": "${input.vendor_id}"
      }
    ],
    "subject": "TPRM Assessment Complete - ${result.tprm_score}",
    "include_result": true
  }
}
```

**Send email on error:**
```json
{
  "email": {
    "enabled": true,
    "send_on": "error",
    "recipients": [
      {
        "type": "user",
        "value": "${context.triggered_by}"
      },
      {
        "type": "custom",
        "value": "admin@company.com"
      }
    ],
    "subject": "Flow Execution Error: ${result.error}"
  }
}
```

---

## 2. Push Data Configuration

### Structure
```typescript
{
  push_data: {
    enabled: boolean
    targets: Array<{
      type: 'webhook' | 'mcp' | 'database' | 'api'
      endpoint?: string  // For webhook/api
      mcp_connection_id?: string  // For MCP
      method?: 'POST' | 'PUT' | 'PATCH'
      headers?: Record<string, string>
      data_mapping?: Record<string, string>  // Map result fields
    }>
  }
}
```

### Examples

**Push to webhook:**
```json
{
  "push_data": {
    "enabled": true,
    "targets": [
      {
        "type": "webhook",
        "endpoint": "https://api.example.com/webhook",
        "method": "POST",
        "headers": {
          "Authorization": "Bearer ${env.WEBHOOK_TOKEN}"
        },
        "data_mapping": {
          "vendor_id": "vendor_id",
          "score": "tprm_score",
          "status": "status"
        }
      }
    ]
  }
}
```

**Push via MCP:**
```json
{
  "push_data": {
    "enabled": true,
    "targets": [
      {
        "type": "mcp",
        "mcp_connection_id": "abc-123-def-456"
      }
    ]
  }
}
```

---

## 3. Collect Data Configuration

### Structure
```typescript
{
  collect_data: {
    enabled: boolean
    sources: Array<{
      type: 'api' | 'database' | 'mcp' | 'rag' | 'file'
      endpoint?: string  // For api
      mcp_connection_id?: string  // For mcp
      query?: string  // For rag/file
      params?: Record<string, any>
      merge_strategy?: 'replace' | 'merge' | 'append'
    }>
  }
}
```

### Examples

**Collect from API:**
```json
{
  "collect_data": {
    "enabled": true,
    "sources": [
      {
        "type": "api",
        "endpoint": "https://api.example.com/vendor/${input.vendor_id}",
        "params": {
          "include_risk": true
        },
        "merge_strategy": "merge"
      }
    ]
  }
}
```

**Collect from RAG:**
```json
{
  "collect_data": {
    "enabled": true,
    "sources": [
      {
        "type": "rag",
        "query": "TPRM requirements for vendor ${input.vendor_id}",
        "params": {
          "limit": 10
        },
        "merge_strategy": "append"
      }
    ]
  }
}
```

**Collect from MCP:**
```json
{
  "collect_data": {
    "enabled": true,
    "sources": [
      {
        "type": "mcp",
        "mcp_connection_id": "abc-123-def-456",
        "query": "get_vendor_data",
        "params": {
          "vendor_id": "${input.vendor_id}"
        },
        "merge_strategy": "merge"
      }
    ]
  }
}
```

---

## Complete Example: TPRM Flow with Agentic Config

```json
{
  "name": "TPRM Assessment with Notifications",
  "flow_definition": {
    "nodes": [
      {
        "id": "node1",
        "name": "Collect Vendor Data",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "assessment",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}",
          "assessment_type": "tprm"
        },
        "agenticConfig": {
          "collect_data": {
            "enabled": true,
            "sources": [
              {
                "type": "rag",
                "query": "TPRM requirements vendor ${input.vendor_id}",
                "merge_strategy": "merge"
              }
            ]
          }
        }
      },
      {
        "id": "node2",
        "name": "TPRM Analysis",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "tprm",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}",
          "send_questionnaire": true
        },
        "agenticConfig": {
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
                "method": "POST",
                "data_mapping": {
                  "vendor_id": "vendor_id",
                  "score": "tprm_score",
                  "status": "status"
                }
              }
            ]
          }
        }
      }
    ],
    "edges": [
      {"from": "node1", "to": "node2"}
    ]
  }
}
```

---

## Execution Flow

### With Collect Data:
1. **Before Execution**: Collect data from configured sources
2. **Merge Data**: Merge collected data into input_data
3. **Execute Agent**: Run agent with enriched input data
4. **Return Result**: Include collected data in result

### With Push Data:
1. **Execute Agent**: Run agent skill
2. **After Execution**: Push result to configured targets
3. **Return Result**: Include push status in result

### With Email:
1. **Before Execution** (if `send_on: "before"`): Send notification
2. **Execute Agent**: Run agent skill
3. **After Execution** (if `send_on: "after"`): Send result notification
4. **On Error** (if `send_on: "error"`): Send error notification

---

## Variable Substitution

All configurations support variable substitution using `${variable}` syntax:

- **Context Variables**: `${context.execution_id}`, `${context.flow_id}`, `${context.node_id}`
- **Input Variables**: `${input.vendor_id}`, `${input.agent_id}`
- **Result Variables**: `${result.tprm_score}`, `${result.status}`
- **Environment Variables**: `${env.WEBHOOK_TOKEN}` (for push headers)

---

## UI Configuration

In the Flow Builder:
1. Select a node
2. Scroll to **"Agentic Configuration"** section
3. Configure:
   - ✅ **Email Notifications**: Enable, set recipients, timing
   - ✅ **Push Data**: Enable, add targets (webhook, MCP, etc.)
   - ✅ **Collect Data**: Enable, add sources (API, RAG, MCP, etc.)

---

## Benefits

1. **Flexible Automation**: Configure actions per node without code changes
2. **Integration Ready**: Easy integration with external systems
3. **Data Enrichment**: Collect data before execution for better results
4. **Notification System**: Automated email notifications
5. **Audit Trail**: All actions logged in execution results

---

## Next Steps

1. **Test Email Configuration**: Create a flow with email notification
2. **Test Push Data**: Configure webhook push
3. **Test Collect Data**: Collect from RAG before execution
4. **Combine Actions**: Use all three in a single node

---

## Notes

- Email service must be configured (SMTP settings)
- Webhook endpoints must be accessible
- MCP connections must be active
- Collected data is merged into input_data before execution
- Push data happens after execution completes
- Email can be sent before, after, or on error
