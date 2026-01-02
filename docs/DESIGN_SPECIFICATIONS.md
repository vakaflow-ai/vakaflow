# VAKA Platform - Design Specifications

## Overview
This document provides detailed design specifications for the VAKA Agentic AI & RAG-powered platform.

**Last Updated**: 2025-12-12
**Status**: Active Design

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - VAKA Studio                                           │
│  - Flow Builder (Business + Advanced)                   │
│  - Agent Execution                                       │
│  - Presentation Layer                                    │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP/REST
┌─────────────────────────────────────────────────────────┐
│                 API Layer (FastAPI)                      │
│  - Studio API                                            │
│  - Agentic Agents API                                    │
│  - External Agents API                                   │
│  - Presentation API                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Service Layer (Business Logic)             │
│  - Studio Service                                        │
│  - Flow Execution Service                                │
│  - Agent Registry                                        │
│  - RAG Service                                           │
│  - MCP Service                                           │
│  - Learning System                                       │
│  - Agent Selection Expander                             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Agent Layer (Agentic AI)                    │
│  - Base Agent (Abstract)                                 │
│  - AI GRC Agent                                          │
│  - Assessment Agent                                      │
│  - Vendor Agent                                          │
│  - Compliance Reviewer Agent                             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Data Layer                              │
│  - PostgreSQL (Agents, Flows, Users, etc.)               │
│  - Qdrant (Vector Database for RAG)                      │
│  - Redis (Cache, Rate Limiting)                          │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Component Design

#### Frontend Components
```
Studio.tsx
├── AgentDiscovery (Agents Tab)
│   ├── AgentCard
│   └── AgentExecutionModal
│       └── SkillInputForm
│           └── AgentSelector
└── FlowManagement (Flows Tab)
    ├── FlowCard
    ├── BusinessFlowBuilder
    │   └── Form-based configuration
    └── FlowBuilder (Advanced)
        ├── NodeList
        ├── FlowCanvas
        └── NodeConfiguration
            ├── SkillInputForm
            └── CustomAttributesEditor
```

#### Backend Services
```
StudioService
├── get_studio_agents() → Aggregates VAKA + External agents
├── execute_agent_in_studio() → Executes agent skills
└── list_flows() → Lists flows for tenant

FlowExecutionService
├── execute_flow() → Main execution entry point
├── _execute_flow_nodes() → Orchestrates node execution
├── _execute_agent_node() → Executes agent nodes
│   └── Uses AgentSelectionExpander
└── _execute_condition_node() → Handles conditional logic

AgentSelectionExpander
├── expand_selection() → Main expansion method
├── _expand_all_agents() → Expands "all" selection
├── _expand_by_categories() → Expands category selection
├── _expand_by_vendors() → Expands vendor selection
└── _expand_by_agents() → Expands individual agent selection
```

---

## 2. Data Models

### 2.1 AgenticFlow Model

```python
class AgenticFlow:
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    category: Optional[str]
    flow_definition: JSON  # {
        #   "nodes": [
        #     {
        #       "id": "node1",
        #       "name": "Friendly Name",  # NEW
        #       "type": "agent",
        #       "agent_id": "...",
        #       "skill": "...",
        #       "input": {...},
        #       "customAttributes": {...}  # NEW
        #     }
        #   ],
        #   "edges": [...]
        # }
    status: str  # draft, active, paused
    tags: List[str]
    created_at: datetime
    updated_at: datetime
```

### 2.2 Node Structure

```typescript
interface FlowNode {
  id: string                    // Technical ID (UUID-based)
  name?: string                 // Business-friendly name
  type: 'agent' | 'condition' | 'delay'
  agent_id?: string
  skill?: string
  input?: Record<string, any>  // Skill input data
  customAttributes?: Record<string, any>  // User-defined attributes
  position?: { x: number; y: number }
}
```

### 2.3 Agent Selection Structure

```typescript
interface AgentSelection {
  mode: 'agent' | 'category' | 'vendor' | 'all'
  agent_ids?: string[]          // For mode='agent'
  categories?: string[]          // For mode='category'
  vendors?: string[]            // For mode='vendor'
  condition?: 'select_one' | 'all'  // Selection condition
  rule?: 'all_agents'          // For mode='all'
}
```

---

## 3. API Design

### 3.1 Studio API Endpoints

```
GET  /api/v1/studio/agents
     - List all agents (VAKA + External)
     - Query params: agent_type, skill, source, category

POST /api/v1/studio/agents/{id}/execute
     - Execute agent skill
     - Body: { skill, input_data, mcp_connection_id? }

GET  /api/v1/studio/flows
     - List flows for tenant
     - Query params: category, status, is_template

POST /api/v1/studio/flows
     - Create new flow
     - Body: AgenticFlowCreate

GET  /api/v1/studio/flows/{id}
     - Get flow details

POST /api/v1/studio/flows/{id}/execute
     - Execute flow
     - Body: { context_id?, context_type?, trigger_data? }
```

### 3.2 Request/Response Models

```python
# Flow Creation
class AgenticFlowCreate:
    name: str
    description: Optional[str]
    category: Optional[str]
    flow_definition: dict  # Contains nodes with friendly names
    tags: Optional[List[str]]
    is_template: bool

# Flow Execution
class FlowExecutionRequest:
    context_id: Optional[str]
    context_type: Optional[str]
    trigger_data: Optional[dict]

# Agent Execution
class AgentExecutionRequest:
    skill: str
    input_data: dict  # Form-based, no raw JSON
    mcp_connection_id: Optional[str]
```

---

## 4. User Interface Design

### 4.1 Studio Page Layout

```
┌─────────────────────────────────────────────────┐
│  Header: VAKA Studio                            │
│  Tabs: [Agents] [Flows]                         │
└─────────────────────────────────────────────────┘
│                                                  │
│  Agents Tab:                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Agent 1  │ │ Agent 2  │ │ Agent 3  │         │
│  │ [Execute]│ │ [Execute]│ │ [Execute]│         │
│  └──────────┘ └──────────┘ └──────────┘         │
│                                                  │
│  Flows Tab:                                      │
│  [+ Business Flow] [+ Advanced Flow]             │
│  ┌──────────┐ ┌──────────┐                      │
│  │ Flow 1   │ │ Flow 2   │                      │
│  │ [View]   │ │ [View]   │                      │
│  │ [Edit]   │ │ [Edit]   │                      │
│  │ [Execute]│ │ [Execute]│                      │
│  └──────────┘ └──────────┘                      │
└─────────────────────────────────────────────────┘
```

### 4.2 Flow Builder Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Flow Details] │ [Flow Canvas] │ [Node Config]        │
│                                                          │
│  Flow Name: [________]                                   │
│  Description: [________]                                 │
│  Category: [________]                                    │
│                                                          │
│  Nodes:                                                  │
│  • Node 1: "TPRM Assessment"                             │
│  • Node 2: "Risk Analysis"                              │
│  [+ Add Node]                                            │
│                                                          │
│  ┌────────────┐                                          │
│  │ Node 1     │                                          │
│  │ Assessment │                                          │
│  └─────┬──────┘                                          │
│        │                                                  │
│  ┌─────▼──────┐                                          │
│  │ Node 2     │                                          │
│  │ Risk       │                                          │
│  └────────────┘                                          │
│                                                          │
│  Configure Node: Node 1                                 │
│  Node Name: [TPRM Assessment]                           │
│  Agent: [Assessment Agent ▼]                            │
│  Skill: [assessment ▼]                                   │
│  Input: [Form fields...]                                  │
│  Custom Attributes: [Editor...]                         │
│                                                          │
│  [Cancel] [Create Flow]                                  │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Agent Execution Modal

```
┌─────────────────────────────────────┐
│  Execute Agent: AI GRC Agent    [X] │
├─────────────────────────────────────┤
│  Select Skill *                      │
│  [realtime_risk_analysis ▼]         │
│                                      │
│  Configure Input Data *              │
│  ┌─────────────────────────────────┐ │
│  │ Agent Selection                 │ │
│  │ [Agent] [Category] [Vendor] [All]│ │
│  │                                  │ │
│  │ Condition: [Select 1 ▼]         │ │
│  │                                  │ │
│  │ ☑ Agent 1 (AI_AGENT)            │ │
│  │ ☐ Agent 2 (AUTOMATION)          │ │
│  │                                  │ │
│  │ 1 agent(s) selected              │ │
│  └─────────────────────────────────┘ │
│                                      │
│  Generated Input Data:               │
│  {                                  │
│    "agent_id": "..."                │
│  }                                  │
│                                      │
│  [Cancel] [Execute]                  │
└─────────────────────────────────────┘
```

---

## 5. Data Flow Design

### 5.1 Flow Execution Flow

```
User Executes Flow
    ↓
FlowExecutionService.execute_flow()
    ↓
Get Flow from DB (validate tenant, status)
    ↓
Create FlowExecution record
    ↓
For each node in flow:
    ↓
    If node.type == 'agent':
        ↓
        Expand agent selection (if needed)
            ↓
            AgentSelectionExpander.expand_selection()
                ↓
                Query DB for agents
                ↓
                Return agent IDs
        ↓
        Execute agent node
            ↓
            StudioService.execute_agent_in_studio()
                ↓
                AgentRegistry.get_agent()
                ↓
                Agent.execute_skill()
                    ↓
                    Query RAG
                    ↓
                    Call LLM
                    ↓
                    Return results
        ↓
        Store node execution results
    ↓
    If node.type == 'condition':
        Evaluate condition
        Route to next node
    ↓
    If node.type == 'delay':
        Wait for specified time
    ↓
Update FlowExecution status
    ↓
Return results to user
```

### 5.2 Agent Selection Expansion Flow

```
User selects: Category mode, ["Security & Compliance"], "All Matching"
    ↓
Flow saved with selection object:
{
  "mode": "category",
  "categories": ["Security & Compliance"],
  "condition": "all"
}
    ↓
Flow execution starts
    ↓
AgentSelectionExpander.expand_selection()
    ↓
Query DB: SELECT agents WHERE category IN ('Security & Compliance')
    ↓
Filter by tenant_id
    ↓
Filter by status = 'approved'
    ↓
Return agent IDs: ["id1", "id2", "id3"]
    ↓
Replace selection in input_data with agent_ids
    ↓
Execute agent skill with expanded agent IDs
```

---

## 6. Security Design

### 6.1 Tenant Isolation

```
All queries filtered by tenant_id:
- AgenticFlow.tenant_id == current_user.tenant_id
- AgenticAgent.tenant_id == current_user.tenant_id
- Agent.vendor_id IN (vendors WHERE tenant_id == current_user.tenant_id)

Agent-to-agent calls:
- Validate source_agent.tenant_id == target_agent.tenant_id
- Raise error if mismatch (for internal calls)
- Allow cross-tenant for external MCP calls
```

### 6.2 Input Validation

```
All inputs validated using Pydantic:
- AgenticFlowCreate: Validates flow structure
- FlowExecutionRequest: Validates execution params
- AgentExecutionRequest: Validates skill and input_data

Agent Selection Expansion:
- Validates selection object structure
- Validates mode, condition values
- Sanitizes agent IDs (UUID format)
```

---

## 7. Performance Design

### 7.1 Caching Strategy

```
Agent Registry:
- Cache agent instances (TTL: 5 minutes)
- Invalidate on agent update

RAG Queries:
- Cache common queries (TTL: 1 hour)
- Cache by query hash

Flow Definitions:
- Cache flow definitions (TTL: 10 minutes)
- Invalidate on flow update
```

### 7.2 Database Optimization

```
Indexes:
- agentic_flows.tenant_id (for tenant filtering)
- agentic_flows.status (for status filtering)
- agents.vendor_id (for vendor filtering)
- agents.category (for category filtering)
- agents.status (for approved agents)

Query Optimization:
- Use eager loading for relationships
- Batch queries for multiple agents
- Pagination for large result sets
```

---

## 8. Error Handling Design

### 8.1 Error Types

```
Validation Errors:
- Invalid flow definition
- Missing required fields
- Invalid agent selection

Execution Errors:
- Agent not found
- Skill not available
- RAG query failure
- LLM call failure

System Errors:
- Database connection failure
- External service timeout
- Rate limit exceeded
```

### 8.2 Error Handling Strategy

```
Flow Execution:
- Try-catch around each node
- Log errors with context
- Continue execution if possible
- Mark node as failed
- Update flow execution status

Agent Execution:
- Validate inputs before execution
- Handle RAG/LLM failures gracefully
- Return error in result (don't crash)
- Log for debugging
```

---

## 9. Testing Design

### 9.1 Unit Tests

```
AgentSelectionExpander:
- Test expand_all_agents()
- Test expand_by_categories()
- Test expand_by_vendors()
- Test expand_by_agents()
- Test tenant isolation

FlowExecutionService:
- Test execute_flow()
- Test node execution
- Test error handling
- Test agent selection expansion
```

### 9.2 Integration Tests

```
Flow Execution:
- Execute simple flow
- Execute flow with agent selection expansion
- Execute flow with multiple nodes
- Test error scenarios

Agent Execution:
- Execute agent skill
- Test with different input configurations
- Test tenant isolation
```

### 9.3 E2E Tests

```
User Flows:
- Create business flow
- Execute flow
- View results
- Create advanced flow
- Execute agent directly
```

---

## 10. Deployment Design

### 10.1 Environment Setup

```
Development:
- Local PostgreSQL
- Local Qdrant
- Local Redis
- Debug mode enabled

Production:
- Managed PostgreSQL (RDS)
- Managed Qdrant (cloud)
- Managed Redis (ElastiCache)
- Debug mode disabled
- Monitoring enabled
```

### 10.2 Scaling Strategy

```
Horizontal Scaling:
- Multiple API instances (load balanced)
- Multiple agent workers
- Database read replicas
- Vector database clustering

Vertical Scaling:
- Increase database resources
- Increase cache memory
- Increase worker resources
```

---

## Design Principles

1. **Separation of Concerns**: Clear boundaries between layers
2. **Single Responsibility**: Each component has one job
3. **DRY (Don't Repeat Yourself)**: Reusable components
4. **Security First**: Tenant isolation, input validation
5. **User Experience**: Business-friendly, no technical knowledge required
6. **Scalability**: Design for growth
7. **Maintainability**: Clean code, good documentation

---

## Notes

- Design specifications are living documents
- Updated based on implementation and feedback
- Aligned with coding standards and best practices
