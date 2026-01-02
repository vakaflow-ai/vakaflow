# Agent Models - Understanding the Difference

## Overview

The VAKA platform has **two different types of "agents"** that serve completely different purposes. This document clarifies the distinction to avoid confusion.

## 1. Agent Model (`app/models/agent.py`)

### Purpose
Represents **vendor-submitted agents** - the business entities/products that vendors submit for onboarding.

### Characteristics
- **Table**: `agents`
- **Owner**: Vendors
- **Lifecycle**: Draft → Submitted → In Review → Approved/Rejected → Offboarded
- **Examples**: 
  - Vendor's AI chatbot
  - Vendor's automation tool
  - Vendor's API service
  - Vendor's AI agent product

### Usage
- Vendor submits their agent for approval
- Platform reviews the agent (security, compliance, technical)
- Platform approves/rejects the agent
- Agent goes through onboarding workflow
- Agent can be offboarded later

### API Endpoints
- `GET /api/v1/agents` - List vendor-submitted agents
- `POST /api/v1/agents` - Create new agent submission
- `GET /api/v1/agents/{id}` - Get agent details
- `POST /api/v1/agents/{id}/submit` - Submit agent for review

## 2. AgenticAgent Model (`app/models/agentic_agent.py`)

### Purpose
Represents **AI agents that perform work** - the platform's intelligent agents that analyze, assess, and manage vendor agents.

### Characteristics
- **Table**: `agentic_agents`
- **Owner**: Platform/Tenant
- **Status**: Active, Inactive, Training, Error
- **Examples**:
  - AI GRC Agent (performs risk analysis)
  - Assessment Agent (conducts assessments)
  - Vendor Agent (manages vendor operations)
  - Compliance Reviewer Agent (reviews compliance)

### Usage
- Platform creates agentic agents for different purposes
- Agents execute skills (e.g., `realtime_risk_analysis`)
- Agents can call other agents (agent-to-agent communication)
- Agents learn from interactions
- Agents provide insights and recommendations

### API Endpoints
- `GET /api/v1/agentic-agents` - List AI agents
- `POST /api/v1/agentic-agents` - Create new AI agent
- `POST /api/v1/agentic-agents/{id}/execute-skill` - Execute agent skill
- `GET /api/v1/studio/agents` - Get all agents (VAKA + external)

## Relationship

```
┌─────────────────────────────────────┐
│  Vendor submits Agent                │
│  (app/models/agent.py)               │
│  - Their AI product                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  AgenticAgent analyzes it           │
│  (app/models/agentic_agent.py)     │
│  - AI GRC Agent: Risk analysis      │
│  - Assessment Agent: Assessment     │
│  - Compliance Agent: Compliance    │
└─────────────────────────────────────┘
```

## Example Flow

1. **Vendor submits Agent**:
   ```python
   # Vendor creates an Agent (their product)
   agent = Agent(
       name="Customer Support Bot",
       type="ai_agent",
       vendor_id=vendor.id
   )
   ```

2. **AgenticAgent analyzes it**:
   ```python
   # AI GRC Agent analyzes the submitted agent
   ai_grc_agent = await registry.get_agent(ai_grc_agent_id, tenant_id)
   risk_analysis = await ai_grc_agent.execute_skill(
       "realtime_risk_analysis",
       {"agent_id": str(agent.id)}
   )
   ```

3. **Result**: Risk analysis, compliance check, assessment, etc.

## Why Both Are Needed

- **Agent**: The **subject** of the platform (what's being managed)
- **AgenticAgent**: The **tool** that manages (the AI that does the work)

They are complementary, not redundant!

## Database Tables

### `agents` table
- Vendor-submitted agents
- Business entities
- Onboarding workflow subjects

### `agentic_agents` table
- Platform's AI agents
- Intelligent workers
- Analysis and assessment tools

## Summary

| Aspect | Agent | AgenticAgent |
|--------|-------|--------------|
| **Purpose** | Vendor submissions | AI workers |
| **Owner** | Vendors | Platform/Tenant |
| **What it is** | Business entity | Intelligent agent |
| **Lifecycle** | Onboarding workflow | Active/Inactive |
| **Skills** | N/A | Has skills (TPRM, assessment, etc.) |
| **Communication** | N/A | Agent-to-agent communication |
| **Learning** | N/A | Learns from interactions |

**Both models are essential and serve different purposes!**
