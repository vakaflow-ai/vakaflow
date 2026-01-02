# VAKA Studio - Agent Collection & Agentic AI Flows

## Overview

VAKA Studio provides a unified interface for:
1. **Agent Collection**: View and use agents from VAKA and external platforms
2. **Flow Builder**: Create agentic AI workflows using drag-and-drop interface
3. **Flow Execution**: Execute flows for use cases like i18N questionnaires, assessments, etc.

## Architecture

### Studio Components

1. **Studio Service** (`app/services/studio_service.py`)
   - Aggregates agents from multiple sources
   - Executes agents from Studio interface
   - Manages agent discovery

2. **Flow Execution Service** (`app/services/flow_execution_service.py`)
   - Executes agentic AI flows
   - Manages flow state and node execution
   - Handles flow orchestration

3. **Studio API** (`app/api/v1/studio.py`)
   - REST API for Studio operations
   - Flow management endpoints
   - Agent execution endpoints

### Database Models

- **AgenticFlow**: Flow definition with nodes and edges
- **FlowExecution**: Flow execution instance
- **FlowNodeExecution**: Individual node execution
- **StudioAgent**: Aggregated view of agents (VAKA + external)

## Agent Sources

### 1. VAKA Agents
- Built-in agentic AI agents
- Tenant-segregated
- Direct execution via AgentRegistry

### 2. External Agents (via MCP)
- Agents from external platforms
- Connected via MCP (Model Context Protocol)
- Discovered through MCP connections

### 3. Marketplace Agents (Future)
- Agents from marketplace
- Community-contributed agents
- Third-party agents

## Flow Definition Structure

```json
{
  "nodes": [
    {
      "id": "node1",
      "type": "agent",
      "agent_id": "123e4567-e89b-12d3-a456-426614174000",
      "source": "vaka",
      "skill": "realtime_risk_analysis",
      "input": {
        "agent_id": "${context.agent_id}"
      },
      "position": {"x": 100, "y": 100}
    },
    {
      "id": "node2",
      "type": "agent",
      "agent_id": "ext_agent_123",
      "source": "external",
      "mcp_connection_id": "456e7890-e89b-12d3-a456-426614174001",
      "skill": "send_questionnaire",
      "input": {
        "questionnaire_id": "${node1.output.questionnaire_id}"
      },
      "position": {"x": 300, "y": 100}
    }
  ],
  "edges": [
    {
      "from": "node1",
      "to": "node2",
      "condition": {
        "type": "equals",
        "field": "node1.output.status",
        "value": "success"
      }
    }
  ]
}
```

## Node Types

1. **Agent Node**: Execute an agent skill
2. **Condition Node**: Conditional branching
3. **Delay Node**: Wait/delay execution
4. **Trigger Node**: External trigger
5. **Action Node**: Custom action
6. **Parallel Node**: Parallel execution
7. **Merge Node**: Merge parallel branches

## Use Cases

### i18N Questionnaire Flow

```json
{
  "name": "i18N Questionnaire Flow",
  "category": "i18n",
  "flow_definition": {
    "nodes": [
      {
        "id": "detect_language",
        "type": "agent",
        "agent_id": "lang_detection_agent",
        "source": "vaka",
        "skill": "detect_language",
        "input": {"text": "${context.text}"}
      },
      {
        "id": "translate_questionnaire",
        "type": "agent",
        "agent_id": "translation_agent",
        "source": "external",
        "mcp_connection_id": "i18n_platform",
        "skill": "translate",
        "input": {
          "text": "${context.questionnaire}",
          "target_language": "${detect_language.output.language}"
        }
      },
      {
        "id": "send_questionnaire",
        "type": "agent",
        "agent_id": "notification_agent",
        "source": "vaka",
        "skill": "send_questionnaire",
        "input": {
          "questionnaire": "${translate_questionnaire.output.translated_text}",
          "recipient": "${context.recipient}"
        }
      }
    ],
    "edges": [
      {"from": "detect_language", "to": "translate_questionnaire"},
      {"from": "translate_questionnaire", "to": "send_questionnaire"}
    ]
  }
}
```

### Assessment Flow

```json
{
  "name": "Automated Assessment Flow",
  "category": "assessment",
  "flow_definition": {
    "nodes": [
      {
        "id": "risk_analysis",
        "type": "agent",
        "agent_id": "ai_grc_agent",
        "source": "vaka",
        "skill": "realtime_risk_analysis",
        "input": {"agent_id": "${context.agent_id}"}
      },
      {
        "id": "create_assessment",
        "type": "agent",
        "agent_id": "assessment_agent",
        "source": "vaka",
        "skill": "assessment",
        "input": {
          "assessment_type": "compliance",
          "risk_data": "${risk_analysis.output}"
        }
      },
      {
        "id": "send_assessment",
        "type": "agent",
        "agent_id": "notification_agent",
        "source": "vaka",
        "skill": "send_assessment",
        "input": {
          "assessment": "${create_assessment.output}",
          "recipient": "${context.reviewer_id}"
        }
      }
    ],
    "edges": [
      {"from": "risk_analysis", "to": "create_assessment"},
      {"from": "create_assessment", "to": "send_assessment"}
    ]
  }
}
```

## API Endpoints

### Studio Agents

- `GET /api/v1/studio/agents` - Get all agents (VAKA + external)
- `POST /api/v1/studio/agents/{agent_id}/execute` - Execute agent skill

### Flows

- `POST /api/v1/studio/flows` - Create new flow
- `GET /api/v1/studio/flows` - List flows
- `GET /api/v1/studio/flows/{flow_id}` - Get flow details
- `POST /api/v1/studio/flows/{flow_id}/execute` - Execute flow
- `PATCH /api/v1/studio/flows/{flow_id}/activate` - Activate flow

## Flow Execution

### Execution Process

1. **Create Execution**: Flow execution instance created
2. **Node Execution**: Nodes executed in order (or parallel)
3. **Data Flow**: Output from one node becomes input to next
4. **Condition Evaluation**: Conditions evaluated for branching
5. **Completion**: Flow completes with final result

### Execution State

- **PENDING**: Execution created, not started
- **RUNNING**: Execution in progress
- **COMPLETED**: Execution completed successfully
- **FAILED**: Execution failed with error
- **CANCELLED**: Execution cancelled
- **PAUSED**: Execution paused

## Tenant Segregation

All Studio operations are tenant-segregated:
- Agents filtered by tenant
- Flows scoped to tenant
- Executions isolated by tenant
- External agents accessible only via tenant's MCP connections

## Security

- ✅ Tenant isolation enforced
- ✅ Agent execution validated
- ✅ Flow definitions validated
- ✅ MCP connections authenticated
- ✅ User permissions checked

## Future Enhancements

1. **Visual Flow Builder**: Drag-and-drop interface
2. **Flow Templates**: Pre-built flow templates
3. **Flow Marketplace**: Share flows across tenants
4. **Flow Versioning**: Version control for flows
5. **Flow Scheduling**: Scheduled flow execution
6. **Flow Monitoring**: Real-time flow execution monitoring
7. **Flow Debugging**: Debug mode for flow development
