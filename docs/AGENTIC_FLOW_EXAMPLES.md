# AgenticFlow Examples - TPRM & Assessment

## Quick Reference Examples

### Example 1: Simple TPRM Flow

```json
{
  "name": "Simple TPRM Review",
  "category": "tprm",
  "flow_definition": {
    "nodes": [
      {
        "id": "tprm_analysis",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "tprm",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}"
        }
      }
    ],
    "edges": []
  }
}
```

**Usage**:
```python
# Execute via API
POST /api/v1/studio/flows/{flow_id}/execute
{
  "trigger_data": {
    "vendor_id": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

---

### Example 2: Comprehensive TPRM Flow

```json
{
  "name": "Comprehensive TPRM Review",
  "category": "tprm",
  "flow_definition": {
    "nodes": [
      {
        "id": "tprm",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "tprm",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}",
          "agent_id": "${trigger_data.agent_id}"
        }
      },
      {
        "id": "risk_analysis",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "realtime_risk_analysis",
        "input": {
          "agent_id": "${trigger_data.agent_id}"
        }
      },
      {
        "id": "vendor_qual",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "vendor_qualification",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}"
        }
      },
      {
        "id": "check_score",
        "type": "condition",
        "condition": {
          "type": "greater_than",
          "field": "tprm.tprm_score",
          "value": 70
        }
      },
      {
        "id": "compliance_review",
        "type": "agent",
        "agent_id": "<compliance_reviewer_agent_id>",
        "skill": "compliance_review",
        "input": {
          "agent_id": "${trigger_data.agent_id}",
          "review_type": "tprm"
        }
      }
    ],
    "edges": [
      {"from": "tprm", "to": "risk_analysis"},
      {"from": "risk_analysis", "to": "vendor_qual"},
      {"from": "vendor_qual", "to": "check_score"},
      {
        "from": "check_score",
        "to": "compliance_review",
        "condition": {
          "type": "equals",
          "field": "check_score.condition_result",
          "value": true
        }
      }
    ]
  }
}
```

---

### Example 3: Assessment Flow

```json
{
  "name": "Comprehensive Assessment",
  "category": "assessment",
  "flow_definition": {
    "nodes": [
      {
        "id": "general_assessment",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "assessment",
        "input": {
          "assessment_type": "${trigger_data.assessment_type}",
          "agent_id": "${trigger_data.agent_id}"
        }
      },
      {
        "id": "vendor_qualification",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "vendor_qualification",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}"
        }
      },
      {
        "id": "marketplace_reviews",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "marketplace_reviews",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}",
          "agent_id": "${trigger_data.agent_id}"
        }
      },
      {
        "id": "risk_analysis",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "realtime_risk_analysis",
        "input": {
          "agent_id": "${trigger_data.agent_id}"
        }
      }
    ],
    "edges": [
      {"from": "general_assessment", "to": "vendor_qualification"},
      {"from": "vendor_qualification", "to": "marketplace_reviews"},
      {"from": "marketplace_reviews", "to": "risk_analysis"}
    ]
  }
}
```

---

### Example 4: Parallel Execution Flow

```json
{
  "name": "Parallel TPRM & Assessment",
  "category": "tprm",
  "flow_definition": {
    "nodes": [
      {
        "id": "tprm",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "tprm",
        "input": {
          "vendor_id": "${trigger_data.vendor_id}"
        }
      },
      {
        "id": "assessment",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "assessment",
        "input": {
          "agent_id": "${trigger_data.agent_id}",
          "assessment_type": "security_assessment"
        }
      },
      {
        "id": "aggregate",
        "type": "action",
        "action": "aggregate_results",
        "input": {
          "tprm_results": "${tprm}",
          "assessment_results": "${assessment}"
        }
      }
    ],
    "edges": [
      {"from": "tprm", "to": "aggregate"},
      {"from": "assessment", "to": "aggregate"}
    ]
  }
}
```

---

## Python Code Examples

### Creating a TPRM Flow

```python
from app.models.agentic_flow import AgenticFlow, FlowStatus
from uuid import uuid4

tprm_flow = AgenticFlow(
    id=uuid4(),
    tenant_id=tenant_id,
    name="TPRM Review Flow",
    description="Comprehensive TPRM analysis",
    category="tprm",
    flow_definition={
        "nodes": [
            {
                "id": "tprm_analysis",
                "type": "agent",
                "agent_id": str(ai_grc_agent_id),
                "skill": "tprm",
                "input": {
                    "vendor_id": "${trigger_data.vendor_id}"
                }
            }
        ],
        "edges": []
    },
    status=FlowStatus.ACTIVE.value
)

db.add(tprm_flow)
db.commit()
```

### Executing a Flow

```python
from app.services.flow_execution_service import FlowExecutionService

flow_service = FlowExecutionService(db)

execution = await flow_service.execute_flow(
    flow_id=tprm_flow.id,
    tenant_id=tenant_id,
    context_id=str(agent_id),
    context_type="agent",
    trigger_data={
        "vendor_id": str(vendor_id),
        "agent_id": str(agent_id)
    }
)

# Access results
results = execution.execution_data
tprm_score = results["tprm_analysis"]["tprm_score"]
```

---

## Integration with WorkflowConfigurations

### Workflow Step Configuration

```python
workflow_steps = [
    {
        "step_number": 1,
        "step_type": "ai_agent_flow",
        "agentic_flow_id": str(tprm_flow.id),
        "step_name": "TPRM Review",
        "auto_approve_if": {
            "condition": "tprm_score > 80 AND risk_level == 'LOW'"
        },
        "required": True
    }
]
```

### Workflow Execution Logic

```python
# When workflow reaches AI agent flow step
if step["step_type"] == "ai_agent_flow":
    # Execute the flow
    flow_execution = await flow_execution_service.execute_flow(
        flow_id=step["agentic_flow_id"],
        tenant_id=onboarding_request.tenant_id,
        context_id=str(onboarding_request.agent_id),
        context_type="agent",
        trigger_data={
            "agent_id": str(onboarding_request.agent_id),
            "vendor_id": str(agent.vendor_id)
        }
    )
    
    # Store results in workflow state
    workflow_state["tprm_results"] = flow_execution.execution_data
    
    # Evaluate auto-approve condition
    if step.get("auto_approve_if"):
        condition_met = evaluate_condition(
            step["auto_approve_if"]["condition"],
            flow_execution.execution_data
        )
        if condition_met:
            # Auto-approve and skip to next step
            proceed_to_next_step()
```

---

## Summary

**TPRM and Assessment via AgenticFlows:**

1. ✅ **Create Flows**: Define flows in Studio or via API
2. ✅ **Execute Flows**: Run flows directly or from workflows
3. ✅ **Orchestrate Agents**: Coordinate multiple AI agents
4. ✅ **Flow Data**: Pass data between agents
5. ✅ **Conditional Logic**: Route based on results
6. ✅ **Integration**: Use in WorkflowConfigurations
7. ✅ **Results**: Access results for human review

**The agentic system handles TPRM and Assessment automatically via flows!**
