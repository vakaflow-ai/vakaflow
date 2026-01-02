# Codebase Cleanup Plan

## ✅ Cleanup Completed

### Removed

1. **`app/agents/` directory** - ✅ REMOVED
   - **Reason**: Contained broken imports to non-existent files
   - **Replacement**: Functionality now in `app/services/agentic/`
   - **Status**: Directory successfully removed

## 📋 Important: What to KEEP

### These are NOT redundant - They serve different purposes:

#### 1. `app/models/agent.py` (Agent model) - ✅ KEEP
- **Purpose**: Represents **vendor-submitted agents** (the business entities being onboarded)
- **Table**: `agents`
- **Usage**: 
  - Agent onboarding/offboarding workflows
  - Reviews and compliance checks
  - Vendor submissions
  - Core business entity management
- **Example**: A vendor submits their AI chatbot for approval

#### 2. `app/models/agentic_agent.py` (AgenticAgent model) - ✅ KEEP
- **Purpose**: Represents **AI agents that perform work** (our platform's intelligent agents)
- **Table**: `agentic_agents`
- **Usage**:
  - AI GRC agent (performs risk analysis)
  - Assessment agent (conducts assessments)
  - Vendor agent (manages vendors)
  - Compliance reviewer agent (reviews compliance)
- **Example**: The AI GRC agent analyzes a vendor's submitted agent

**Key Distinction**:
- `Agent` = **The thing being managed** (vendor's AI product/agent)
- `AgenticAgent` = **The AI that manages** (our platform's intelligent agents)

### Both models are needed and serve different purposes!

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Vendor submits Agent (app/models/agent.py)    │
│  - AI chatbot, automation tool, etc.           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  AgenticAgent (app/models/agentic_agent.py)     │
│  - AI GRC Agent analyzes the submitted Agent    │
│  - Assessment Agent evaluates the Agent         │
│  - Compliance Reviewer Agent checks compliance  │
└─────────────────────────────────────────────────┘
```

## Code Structure (After Cleanup)

### ✅ Active Agent System
```
app/services/agentic/
├── base_agent.py              # BaseAgenticAgent
├── agent_registry.py          # AgentRegistry
├── ai_grc_agent.py            # AiGrcAgent
├── assessment_agent.py        # AssessmentAgent
├── vendor_agent.py            # VendorAgent
├── compliance_reviewer_agent.py # ComplianceReviewerAgent
├── mcp_server.py              # MCP server/client
├── learning_system.py          # Learning system
└── external_agent_service.py   # External agent service
```

### ✅ Core Business Models
```
app/models/
├── agent.py                   # Agent (vendor submissions) - KEEP
├── agentic_agent.py           # AgenticAgent (AI agents) - KEEP
├── vendor.py                  # Vendor model
└── ... (other models)
```

### ✅ API Endpoints
```
app/api/v1/
├── agents.py                  # Agent CRUD (vendor agents) - KEEP
├── agentic_agents.py          # AgenticAgent management - KEEP
├── studio.py                  # Studio and flows - KEEP
├── external_agents.py         # External agent communication - KEEP
└── presentation.py            # Presentation layer - KEEP
```

## Verification

### ✅ No Broken Imports
- Removed `app/agents/__init__.py` with broken imports
- All agent functionality now in `app/services/agentic/`
- No references to `app.agents` found in codebase

### ✅ Clear Separation
- `Agent` model: Vendor-submitted business entities
- `AgenticAgent` model: Platform's AI agents
- Both models coexist and serve different purposes

## Summary

**Cleanup Status**: ✅ Complete

- ✅ Removed broken `app/agents/` directory
- ✅ No redundant code found
- ✅ Both Agent models are needed (different purposes)
- ✅ All agentic functionality in `app/services/agentic/`
- ✅ Clear architecture separation

**No further cleanup needed** - The codebase is clean and well-organized!
