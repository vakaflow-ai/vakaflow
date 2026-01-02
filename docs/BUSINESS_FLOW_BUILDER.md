# Business Flow Builder - User Guide

## Overview

The Business Flow Builder provides a user-friendly, form-based interface for creating assessment flows without requiring JSON knowledge. It's designed for business users who want to quickly configure assessment workflows for vendors and their agents.

## Features

### ✅ Form-Based Configuration
- **No JSON Required**: All configuration done through intuitive forms and dropdowns
- **Vendor Selection**: Select from available vendors with agent counts
- **Agent Selection**: Multi-select agents from the chosen vendor
- **Assessment Type**: Choose from predefined assessment types
- **Risk Analysis**: Optional real-time risk analysis integration

### ✅ Automatic Flow Generation
- Automatically creates flow nodes and connections
- Configures Assessment Agent for each selected agent
- Optionally adds Risk Analysis Agent (AI GRC) for comprehensive analysis
- Generates proper flow structure with edges and dependencies

### ✅ Business-Friendly Interface
- Clear labels and descriptions
- Visual feedback for selections
- Flow preview before saving
- Validation and error messages

## How to Use

### Step 1: Access Business Flow Builder

1. Navigate to **VAKA Studio** (Operations → VAKA Studio)
2. Click on the **Flows** tab
3. Click **"+ Business Flow"** button (green button)

### Step 2: Configure Flow Information

1. **Flow Name** (Required)
   - Enter a descriptive name, e.g., "TPRM Assessment for Vendor ABC"
   
2. **Description** (Optional)
   - Add details about what this flow does

### Step 3: Select Vendor

1. Choose a vendor from the dropdown
   - Vendors show agent count: "Vendor Name (5 agents)"
   - Selected vendor details are displayed

### Step 4: Select Agents

1. **Multi-Select Agents**
   - Checkboxes for each agent from the selected vendor
   - Shows agent name, type, status, and risk score
   - "Select All" / "Deselect All" option available

2. **Agent Information Displayed**
   - Agent name and type
   - Status (approved, in_review, etc.)
   - Risk score (if available)
   - Description

### Step 5: Configure Assessment

1. **Assessment Type** (Required)
   - Select from dropdown:
     - TPRM - Third-Party Risk Management
     - Vendor Qualification
     - Risk Assessment
     - AI Vendor Qualification
     - Security Assessment
     - Compliance Assessment
     - Custom Assessment
     - General Assessment

### Step 6: Additional Analysis (Optional)

1. **Include Real-Time Risk Analysis**
   - Checkbox to enable risk analysis
   - Automatically uses AI GRC Agent
   - Performs risk analysis after assessment completes

### Step 7: Review and Save

1. **Flow Preview**
   - Shows flow steps
   - Displays number of agents
   - Shows assessment type and risk analysis status

2. **Save Flow**
   - Click "Save Flow" button
   - Flow is created and saved
   - Can be executed immediately or later

## Generated Flow Structure

### Example: TPRM Assessment with Risk Analysis

**For 3 selected agents, the flow generates:**

```
Node 1: Assessment Agent → Agent 1 (TPRM)
Node 2: Assessment Agent → Agent 2 (TPRM)
Node 3: Assessment Agent → Agent 3 (TPRM)
Node 4: Risk Analysis Agent → Agent 1
Node 5: Risk Analysis Agent → Agent 2
Node 6: Risk Analysis Agent → Agent 3

Edges:
- Assessment 1 → Risk Analysis 1
- Assessment 2 → Risk Analysis 2
- Assessment 3 → Risk Analysis 3
```

### Flow Definition Structure

```json
{
  "name": "TPRM Assessment for Vendor ABC",
  "description": "Assessment flow for vendor with 3 agent(s)",
  "category": "assessment",
  "flow_definition": {
    "nodes": [
      {
        "id": "assessment_agent1",
        "type": "agent",
        "agent_id": "<assessment_agent_id>",
        "skill": "assessment",
        "input": {
          "assessment_type": "tprm",
          "agent_id": "agent1_id",
          "vendor_id": "vendor_id"
        }
      },
      {
        "id": "risk_analysis_agent1",
        "type": "agent",
        "agent_id": "<ai_grc_agent_id>",
        "skill": "realtime_risk_analysis",
        "input": {
          "agent_id": "agent1_id"
        }
      }
    ],
    "edges": [
      {
        "from": "assessment_agent1",
        "to": "risk_analysis_agent1"
      }
    ]
  },
  "tags": ["business-friendly", "assessment", "tprm"]
}
```

## Use Cases

### Use Case 1: Vendor Onboarding Assessment
1. Select new vendor
2. Select all agents from vendor
3. Choose "Vendor Qualification" assessment type
4. Enable risk analysis
5. Save and execute

### Use Case 2: Quarterly TPRM Review
1. Select existing vendor
2. Select specific agents to review
3. Choose "TPRM" assessment type
4. Enable risk analysis
5. Save as template for future use

### Use Case 3: Security Assessment
1. Select vendor
2. Select agents with security concerns
3. Choose "Security Assessment" type
4. Save flow

## Comparison: Business Flow vs Advanced Flow

| Feature | Business Flow | Advanced Flow |
|---------|--------------|----------------|
| **Target Users** | Business users, non-technical | Developers, technical users |
| **Configuration** | Form-based, dropdowns | JSON, code-like |
| **Complexity** | Simple, guided | Full control |
| **Use Case** | Standard assessments | Custom workflows |
| **Learning Curve** | Low | High |
| **Flexibility** | Limited to common patterns | Unlimited |

## Best Practices

1. **Use Descriptive Names**
   - Include vendor name and assessment type
   - Example: "TPRM Assessment - Vendor ABC - Q1 2024"

2. **Select Relevant Agents**
   - Don't select all agents if only some need assessment
   - Consider agent status and risk levels

3. **Enable Risk Analysis**
   - Recommended for comprehensive assessment
   - Provides additional insights

4. **Save as Templates**
   - For recurring assessments
   - Modify and reuse for similar scenarios

5. **Review Flow Preview**
   - Verify flow structure before saving
   - Ensure all steps are correct

## Troubleshooting

### Issue: "No agents found for this vendor"
**Solution**: Ensure the vendor has agents in the system. Check agent status and vendor association.

### Issue: "Assessment Agent not found"
**Solution**: Ensure Assessment Agent is configured in Studio. Contact administrator.

### Issue: "Risk Analysis Agent not available"
**Solution**: Ensure AI GRC Agent with `realtime_risk_analysis` skill is available in Studio.

### Issue: Flow saves but doesn't execute
**Solution**: Check that all required agents (Assessment, AI GRC) are active and have required skills.

## Technical Details

### Required Agents
- **Assessment Agent**: Must have `assessment` skill
- **AI GRC Agent**: Must have `realtime_risk_analysis` skill (if risk analysis enabled)

### Flow Execution
- Flows execute sequentially by default
- Each assessment node runs independently
- Risk analysis nodes wait for corresponding assessment to complete
- Results are aggregated and returned

### Data Flow
1. User selects vendor and agents
2. Flow builder creates flow definition
3. Flow saved to database
4. Flow can be executed with context
5. Assessment Agent processes each agent
6. Risk Analysis Agent processes results (if enabled)
7. Results returned to user

## Future Enhancements

- [ ] Schedule recurring assessments
- [ ] Email notifications on completion
- [ ] Custom assessment criteria selection
- [ ] Integration with existing assessments
- [ ] Batch processing for large agent sets
- [ ] Flow templates library
- [ ] Export flow definitions
- [ ] Flow versioning
