# TPRM & Assessment via AgenticFlows

## Overview

TPRM (Third Party Risk Management) reviews and Assessments are performed via **AgenticFlows** that orchestrate AI agents. These flows can be:
1. **Standalone**: Executed directly via Studio
2. **Integrated**: Called from WorkflowConfigurations as workflow steps
3. **Automated**: Triggered by schedules or events

---

## Agent Skills Available

### AI GRC Agent Skills
- `realtime_risk_analysis`: Real-time risk analysis for AI agents
- `tprm`: Third Party Risk Management analysis
- `ai_agent_onboarding`: AI agent onboarding workflow

### Assessment Agent Skills
- `assessment`: General assessment
- `vendor_qualification`: Vendor qualification assessment
- `marketplace_reviews`: Marketplace review assessment

---

## Example AgenticFlows

### 1. TPRM Review Flow

**Purpose**: Comprehensive Third Party Risk Management review

**Flow Definition**:
```json
{
  "name": "TPRM Review Flow",
  "description": "Complete TPRM analysis for vendor/agent",
  "category": "tprm",
  "flow_definition": {
    "nodes": [
      {
        "id": "node1",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "tprm",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}",
          "agent_id": "${trigger_data.agent_id}"
        },
        "position": {"x": 100, "y": 100}
      },
      {
        "id": "node2",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "realtime_risk_analysis",
        "input": {
          "agent_id": "${trigger_data.agent_id}"
        },
        "position": {"x": 300, "y": 100}
      },
      {
        "id": "node3",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "vendor_qualification",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}"
        },
        "position": {"x": 500, "y": 100}
      },
      {
        "id": "node4",
        "type": "condition",
        "condition": {
          "type": "greater_than",
          "field": "node1.tprm_score",
          "value": 70
        },
        "position": {"x": 700, "y": 100}
      },
      {
        "id": "node5",
        "type": "agent",
        "agent_id": "<compliance_reviewer_agent_id>",
        "skill": "compliance_review",
        "input": {
          "agent_id": "${trigger_data.agent_id}",
          "review_type": "tprm"
        },
        "position": {"x": 900, "y": 50}
      }
    ],
    "edges": [
      {"from": "node1", "to": "node2"},
      {"from": "node2", "to": "node3"},
      {"from": "node3", "to": "node4"},
      {
        "from": "node4",
        "to": "node5",
        "condition": {
          "type": "equals",
          "field": "node4.condition_result",
          "value": true
        }
      }
    ]
  }
}
```

**Flow Execution**:
1. **Node 1**: AI GRC Agent performs TPRM analysis
2. **Node 2**: AI GRC Agent performs real-time risk analysis
3. **Node 3**: Assessment Agent performs vendor qualification
4. **Node 4**: Condition check - if TPRM score > 70, proceed
5. **Node 5**: Compliance Reviewer Agent performs compliance review (if condition met)

**Output**:
```json
{
  "tprm_analysis": {
    "vendor_id": "...",
    "tprm_score": 75,
    "risk_categories": {...},
    "recommendations": [...]
  },
  "risk_analysis": {
    "risk_level": "MEDIUM",
    "risk_score": 65,
    "risk_factors": [...]
  },
  "vendor_qualification": {
    "qualified": true,
    "qualification_score": 88
  },
  "compliance_review": {
    "compliance_score": 82,
    "gaps": [...]
  }
}
```

---

### 2. Assessment Flow

**Purpose**: Comprehensive assessment workflow

**Flow Definition**:
```json
{
  "name": "Comprehensive Assessment Flow",
  "description": "Multi-stage assessment for agent/vendor",
  "category": "assessment",
  "flow_definition": {
    "nodes": [
      {
        "id": "node1",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "assessment",
        "input": {
          "assessment_type": "${trigger_data.assessment_type}",
          "agent_id": "${trigger_data.agent_id}"
        },
        "position": {"x": 100, "y": 100}
      },
      {
        "id": "node2",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "vendor_qualification",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}"
        },
        "position": {"x": 300, "y": 100}
      },
      {
        "id": "node3",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "marketplace_reviews",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}",
          "agent_id": "${trigger_data.agent_id}"
        },
        "position": {"x": 500, "y": 100}
      },
      {
        "id": "node4",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "realtime_risk_analysis",
        "input": {
          "agent_id": "${trigger_data.agent_id}"
        },
        "position": {"x": 700, "y": 100}
      }
    ],
    "edges": [
      {"from": "node1", "to": "node2"},
      {"from": "node2", "to": "node3"},
      {"from": "node3", "to": "node4"}
    ]
  }
}
```

**Flow Execution**:
1. **Node 1**: Assessment Agent conducts general assessment
2. **Node 2**: Assessment Agent performs vendor qualification
3. **Node 3**: Assessment Agent analyzes marketplace reviews
4. **Node 4**: AI GRC Agent performs risk analysis

**Output**:
```json
{
  "assessment": {
    "assessment_type": "security_assessment",
    "score": 85,
    "findings": [...],
    "recommendations": [...]
  },
  "vendor_qualification": {
    "qualified": true,
    "qualification_score": 88
  },
  "marketplace_reviews": {
    "total_reviews": 150,
    "average_rating": 4.5,
    "review_summary": {...}
  },
  "risk_analysis": {
    "risk_level": "MEDIUM",
    "risk_score": 65
  }
}
```

---

## Integration with WorkflowConfigurations

### Option 1: AgenticFlow as Workflow Step

**Enhanced WorkflowConfiguration** with AI agent steps:

```python
workflow_steps = [
    {
        "step_number": 1,
        "step_type": "ai_agent_flow",  # NEW: AI agent flow step
        "agentic_flow_id": "<tprm_flow_id>",
        "step_name": "TPRM Review",
        "auto_approve_if": {
            "condition": "tprm_score > 80 AND risk_level == 'LOW'"
        },
        "escalate_if": {
            "condition": "tprm_score < 50 OR risk_level == 'CRITICAL'"
        },
        "required": True,
        "can_skip": False
    },
    {
        "step_number": 2,
        "step_type": "review",
        "step_name": "Security Review",
        "assigned_role": "security_reviewer",
        "form_layout_id": "...",
        "required": True
    },
    {
        "step_number": 3,
        "step_type": "ai_agent_flow",
        "agentic_flow_id": "<assessment_flow_id>",
        "step_name": "Comprehensive Assessment",
        "required": True
    },
    {
        "step_number": 4,
        "step_type": "approval",
        "step_name": "Final Approval",
        "assigned_role": "tenant_admin",
        "required": True
    }
]
```

**Workflow Execution Flow**:
```
1. Agent submitted → OnboardingRequest created
2. Workflow Step 1: TPRM Review Flow (AgenticFlow)
   ├─ AI GRC Agent: TPRM analysis
   ├─ AI GRC Agent: Risk analysis
   └─ Assessment Agent: Vendor qualification
   → Results stored in workflow state
3. Conditional routing:
   - If auto_approve_if condition met → Skip to Step 4
   - If escalate_if condition met → Create urgent review task
   - Otherwise → Continue to Step 2
4. Workflow Step 2: Security Review (Human)
   ├─ Form Designer renders review form
   ├─ AI results displayed in form
   └─ Human reviewer makes decision
5. Workflow Step 3: Assessment Flow (AgenticFlow)
   └─ Comprehensive assessment executed
6. Workflow Step 4: Final Approval (Human)
   └─ Final decision based on all results
```

---

## API Usage Examples

### 1. Execute TPRM Flow Directly

```python
# POST /api/v1/studio/flows/{flow_id}/execute
{
  "context_id": "<agent_id>",
  "context_type": "agent",
  "trigger_data": {
    "vendor_id": "<vendor_id>",
    "agent_id": "<agent_id>"
  }
}
```

### 2. Execute Assessment Flow

```python
# POST /api/v1/studio/flows/{flow_id}/execute
{
  "context_id": "<agent_id>",
  "context_type": "agent",
  "trigger_data": {
    "agent_id": "<agent_id>",
    "vendor_id": "<vendor_id>",
    "assessment_type": "security_assessment"
  }
}
```

### 3. Trigger from WorkflowConfiguration

When a workflow step of type `"ai_agent_flow"` is reached:

```python
# Workflow service calls:
flow_execution = await flow_execution_service.execute_flow(
    flow_id=step["agentic_flow_id"],
    tenant_id=onboarding_request.tenant_id,
    context_id=str(onboarding_request.agent_id),
    context_type="agent",
    trigger_data={
        "agent_id": str(onboarding_request.agent_id),
        "vendor_id": str(agent.vendor_id),
        "onboarding_request_id": str(onboarding_request.id)
    }
)

# Results stored in workflow state
workflow_state["tprm_results"] = flow_execution.execution_data
```

---

## Implementation Details

### Flow Execution Service

The `FlowExecutionService` handles:
1. **Flow Resolution**: Loads flow definition from database
2. **Node Execution**: Executes each node sequentially/parallel
3. **Agent Execution**: Calls agents via `StudioService`
4. **Data Flow**: Passes data between nodes via `execution_data`
5. **Condition Evaluation**: Evaluates conditions for routing
6. **Error Handling**: Handles failures and retries

### Agent Execution

Each agent node:
1. Resolves input data from previous nodes
2. Calls agent via `StudioService.execute_agent_in_studio()`
3. Stores output in `execution_data`
4. Makes output available to next nodes

### Data Flow Between Nodes

```python
# Node 1 output
execution_data["node1"] = {
    "tprm_score": 75,
    "risk_categories": {...}
}

# Node 2 can reference Node 1 output
node2_input = {
    "tprm_score": "${node1.tprm_score}",  # Resolved to 75
    "risk_categories": "${node1.risk_categories}"
}
```

---

## Studio UI Integration

### Creating TPRM/Assessment Flows

1. **Open Studio**: Navigate to VAKA Studio
2. **Create Flow**: Click "Create Flow"
3. **Add Agents**: Drag AI GRC Agent, Assessment Agent, etc.
4. **Configure Skills**: Set skill for each agent node
5. **Connect Nodes**: Draw edges between nodes
6. **Add Conditions**: Configure conditional routing
7. **Save Flow**: Save as template or active flow

### Executing Flows

1. **Select Flow**: Choose TPRM or Assessment flow
2. **Set Context**: Provide agent_id, vendor_id, etc.
3. **Execute**: Click "Execute Flow"
4. **Monitor**: View execution progress in real-time
5. **View Results**: See aggregated results from all agents

---

## Best Practices

### 1. Flow Design
- **Start Simple**: Begin with single-agent flows
- **Add Complexity**: Gradually add more agents and conditions
- **Test Incrementally**: Test each node before connecting

### 2. Error Handling
- **Retry Logic**: Configure retry for critical nodes
- **Fallback Paths**: Add alternative paths for failures
- **Logging**: Log all node executions for debugging

### 3. Performance
- **Parallel Execution**: Use parallel nodes for independent operations
- **Caching**: Cache RAG results when possible
- **Timeout**: Set appropriate timeouts for long-running flows

### 4. Integration
- **Workflow Steps**: Use AgenticFlows as workflow steps
- **Form Display**: Show flow results in Form Designer forms
- **Notifications**: Notify users when flows complete

---

## Summary

**TPRM and Assessment are performed via AgenticFlows that:**

1. **Orchestrate AI Agents**: Coordinate multiple agents (AI GRC, Assessment, Compliance Reviewer)
2. **Execute Skills**: Call agent skills (tprm, assessment, vendor_qualification, etc.)
3. **Flow Data**: Pass data between agents via execution context
4. **Conditional Logic**: Route based on results
5. **Integrate with Workflows**: Can be called from WorkflowConfigurations
6. **Store Results**: Results available for human review and decision-making

**Key Benefits**:
- ✅ Automated intelligence gathering
- ✅ Consistent execution
- ✅ Reusable flows
- ✅ Integration with human workflows
- ✅ Real-time results
- ✅ Audit trail
