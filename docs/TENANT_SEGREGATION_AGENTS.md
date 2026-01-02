# Tenant Segregation for Agentic AI Agents

## Overview

All agentic AI agents in the VAKA platform are **tenant-segregated**, ensuring complete data isolation between tenants. This document describes how tenant segregation is enforced throughout the agentic AI system.

## ✅ Tenant Segregation Implementation

### 1. Database Models

All agentic agent models include `tenant_id` as a required, indexed field:

- **AgenticAgent**: `tenant_id` (required, indexed)
- **AgenticAgentSession**: `tenant_id` (required, indexed)
- **AgenticAgentInteraction**: `tenant_id` (required, indexed)
- **AgenticAgentLearning**: `tenant_id` (required, indexed)
- **MCPConnection**: `tenant_id` (required, indexed)

### 2. Agent Registry

The `AgentRegistry` class enforces tenant isolation:

#### `get_agent(agent_id, tenant_id)`
- **tenant_id is now REQUIRED** (not optional)
- Queries filter by both `agent_id` AND `tenant_id`
- Cache validation ensures tenant_id matches
- Returns `None` if agent doesn't belong to tenant

#### `get_agents_by_type(agent_type, tenant_id, ...)`
- **tenant_id is now REQUIRED** (not optional)
- All queries filter by `tenant_id`
- Only returns agents belonging to the specified tenant

#### `get_agents_by_skill(skill, tenant_id, ...)`
- **tenant_id is now REQUIRED** (not optional)
- All queries filter by `tenant_id`
- Only returns agents belonging to the specified tenant

### 3. Base Agent Class

The `BaseAgenticAgent` class enforces tenant boundaries:

#### `call_other_agent()`
- **Validates tenant isolation** before calling another agent
- Verifies target agent belongs to the same tenant
- Raises `ValueError` if tenant mismatch detected
- Prevents cross-tenant agent communication

#### `_get_tenant_id()`
- Retrieves tenant_id from the agent model
- Used for all tenant-scoped operations

### 4. API Endpoints

All API endpoints enforce tenant isolation:

#### `POST /api/v1/agentic-agents`
- Creates agent with `current_user.tenant_id`
- Validates user has tenant assignment

#### `GET /api/v1/agentic-agents`
- Filters by `current_user.tenant_id`
- Only returns agents for user's tenant

#### `GET /api/v1/agentic-agents/{agent_id}`
- Filters by both `agent_id` AND `tenant_id`
- Returns 404 if agent doesn't belong to tenant

#### `POST /api/v1/agentic-agents/{agent_id}/execute-skill`
- Uses `registry.get_agent(agent_id, tenant_id)` for tenant isolation
- Automatically enforces tenant boundaries

#### `POST /api/v1/agentic-agents/{agent_id}/sessions`
- Uses `registry.get_agent(agent_id, tenant_id)` for tenant isolation
- Sessions inherit tenant from agent

### 5. MCP Server

The MCP server enforces tenant isolation:

#### `handle_mcp_request()`
- Requires `tenant_id` parameter
- Validates MCP connection belongs to tenant
- All agent queries filter by `tenant_id`

#### `_handle_skill_execution()`
- Uses `get_agents_by_type(agent_type, tenant_id)`
- Only executes skills on tenant's agents

#### `_handle_agent_query()`
- All agent queries filter by `tenant_id`
- Returns only tenant's agents

### 6. Learning System

The learning system respects tenant boundaries:

#### `learn_from_compliance_check()`
- Learning records inherit `tenant_id` from agent
- Patterns are tenant-scoped

#### `learn_from_questionnaire()`
- Learning records inherit `tenant_id` from agent
- Patterns are tenant-scoped

#### `learn_from_interaction()`
- Learning records inherit `tenant_id` from agent
- Patterns are tenant-scoped

#### `apply_learned_patterns()`
- Only applies patterns from same tenant
- Queries filter by `tenant_id`

## 🔒 Security Guarantees

### Tenant Isolation
- ✅ Agents can only access agents from the same tenant
- ✅ Agent-to-agent communication is tenant-scoped
- ✅ Learning patterns are tenant-isolated
- ✅ MCP connections are tenant-scoped
- ✅ All database queries filter by `tenant_id`

### Access Control
- ✅ API endpoints validate tenant membership
- ✅ Users can only see agents from their tenant
- ✅ Cross-tenant access attempts are rejected
- ✅ Agent registry enforces tenant boundaries

### Data Isolation
- ✅ Sessions are tenant-scoped
- ✅ Interactions are tenant-scoped
- ✅ Learning data is tenant-scoped
- ✅ MCP connections are tenant-scoped

## 📋 Code Examples

### Creating an Agent (Tenant-Scoped)
```python
# Automatically uses current_user.tenant_id
agent = AgenticAgent(
    tenant_id=current_user.tenant_id,  # Required
    name="My Agent",
    agent_type="ai_grc",
    ...
)
```

### Getting an Agent (Tenant-Scoped)
```python
# tenant_id is REQUIRED
registry = AgentRegistry(db)
agent = await registry.get_agent(agent_id, tenant_id)

# Returns None if agent doesn't belong to tenant
if not agent:
    raise HTTPException(404, "Agent not found")
```

### Agent-to-Agent Communication (Tenant-Scoped)
```python
# Automatically validates tenant isolation
result = await agent.call_other_agent(
    target_agent_id=other_agent_id,
    skill="realtime_risk_analysis",
    input_data={...}
)

# Raises ValueError if tenant mismatch
```

### Querying Agents (Tenant-Scoped)
```python
# tenant_id is REQUIRED
agents = await registry.get_agents_by_type(
    agent_type="ai_grc",
    tenant_id=current_user.tenant_id  # Required
)

# Only returns agents from specified tenant
```

## 🧪 Testing Tenant Segregation

### Test Cases
1. **Cross-Tenant Access**: Attempt to access agent from different tenant → Should fail
2. **Agent-to-Agent**: Attempt to call agent from different tenant → Should fail
3. **Query Isolation**: Query agents without tenant filter → Should fail
4. **Learning Isolation**: Learning patterns from different tenant → Should not apply

### Validation
- All database queries include `tenant_id` filter
- All API endpoints validate tenant membership
- Agent registry requires `tenant_id` parameter
- Base agent validates tenant in `call_other_agent()`

## 📊 Database Schema

All agentic agent tables have `tenant_id` as:
- **Required field** (NOT NULL)
- **Indexed** for performance
- **Foreign key constraint** (where applicable)

```sql
CREATE TABLE agentic_agents (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,  -- Required, indexed
    ...
    INDEX idx_agentic_agents_tenant_id (tenant_id)
);
```

## ✅ Summary

**All agentic AI agents are fully tenant-segregated:**

1. ✅ Database models require `tenant_id`
2. ✅ Agent registry enforces tenant isolation
3. ✅ Base agent validates tenant boundaries
4. ✅ API endpoints filter by tenant
5. ✅ MCP server enforces tenant isolation
6. ✅ Learning system respects tenant boundaries
7. ✅ Agent-to-agent communication is tenant-scoped

**Security**: Cross-tenant access is impossible - all queries and operations are tenant-scoped.
