# Agent Communication - Internal vs External

## Overview

Agent-to-agent communication in VAKA supports two modes:

1. **Internal Communication**: Tenant-scoped, agents can only communicate within the same tenant
2. **External Communication**: Cross-tenant, agents can communicate across tenants with no restriction

## Communication Types

### Internal Communication

**Scope**: Within tenant only
**Restriction**: Agents can only call other agents from the same tenant
**Use Case**: Secure, tenant-isolated workflows

```python
# Internal call - same tenant
result = await agent.call_other_agent(
    target_agent_id=other_agent_id,
    skill="realtime_risk_analysis",
    input_data={...},
    communication_type="internal"  # Default
)
```

**Security**:
- ✅ Tenant isolation enforced
- ✅ Cannot access agents from other tenants
- ✅ Data stays within tenant boundary

### External Communication

**Scope**: Cross-tenant, no restriction
**Restriction**: None - can call agents from any tenant
**Use Case**: Cross-tenant data sharing, federated learning, shared services

```python
# External call - cross-tenant
result = await agent.call_other_agent(
    target_agent_id=external_agent_id,
    skill="get_data",
    input_data={...},
    communication_type="external",
    target_tenant_id=other_tenant_id  # Required for external
)
```

**Security**:
- ⚠️ Cross-tenant access allowed
- ⚠️ Can pick data from any tenant
- ✅ Logged for audit purposes
- ✅ Requires explicit target_tenant_id

## Implementation

### Base Agent Method

```python
async def call_other_agent(
    self,
    target_agent_id: UUID,
    skill: str,
    input_data: Dict[str, Any],
    communication_type: str = "internal",  # "internal" or "external"
    target_tenant_id: Optional[UUID] = None,  # Required for external
    use_mcp: bool = True
) -> Dict[str, Any]
```

### Internal Communication Flow

1. **Validation**: Verify target agent belongs to same tenant
2. **Execution**: Execute skill on target agent
3. **Logging**: Log interaction with tenant context

### External Communication Flow

1. **Validation**: Verify target agent exists in target tenant
2. **Execution**: Execute skill on target agent (cross-tenant)
3. **Logging**: Log interaction with cross-tenant context
4. **Audit**: Track cross-tenant access for security

## API Endpoints

### Discover External Agents

```http
GET /api/v1/external-agents/discover?agent_type=ai_grc&skill=tprm
```

Returns agents from all tenants (excluding current tenant by default).

### Get Tenant Agents

```http
GET /api/v1/external-agents/tenants/{tenant_id}/agents?skill=assessment
```

Returns agents from a specific tenant (for external discovery).

### Call External Agent

```http
POST /api/v1/external-agents/call
{
  "target_agent_id": "...",
  "target_tenant_id": "...",
  "skill": "get_data",
  "input_data": {...},
  "communication_type": "external"
}
```

Calls an external agent from any tenant.

### Call External from Agent

```http
POST /api/v1/external-agents/agents/{agent_id}/call-external
{
  "target_agent_id": "...",
  "target_tenant_id": "...",
  "skill": "get_data",
  "input_data": {...}
}
```

Calls an external agent from a specific source agent.

## Agent Registry Updates

The `AgentRegistry.get_agent()` method now supports:

```python
async def get_agent(
    self,
    agent_id: UUID,
    tenant_id: UUID,
    allow_cross_tenant: bool = False  # For external calls
) -> Optional[BaseAgenticAgent]
```

- **Internal**: `allow_cross_tenant=False` (default) - enforces tenant filter
- **External**: `allow_cross_tenant=True` - bypasses tenant filter

## Use Cases

### Internal Communication

1. **Workflow Orchestration**: Agents in same tenant coordinate workflows
2. **Data Processing**: Agents process data within tenant boundary
3. **Compliance**: All operations stay within tenant for compliance

### External Communication

1. **Federated Learning**: Agents share patterns across tenants
2. **Shared Services**: Common agents serve multiple tenants
3. **Data Aggregation**: Aggregate data from multiple tenants
4. **Cross-Tenant Analytics**: Analyze patterns across tenants

## Security Considerations

### Internal Communication
- ✅ Fully tenant-isolated
- ✅ No cross-tenant data leakage
- ✅ Compliant with data residency requirements

### External Communication
- ⚠️ **Use with caution** - bypasses tenant isolation
- ✅ All external calls are logged
- ✅ Requires explicit target_tenant_id
- ✅ Audit trail for compliance
- ⚠️ Consider data privacy regulations (GDPR, etc.)

## Logging

All agent communications are logged:

```python
AgenticAgentInteraction(
    interaction_type="agent_call",
    communication_type="internal" | "external",
    target_tenant_id=...,  # For external calls
    ...
)
```

## Best Practices

1. **Default to Internal**: Use internal communication by default
2. **Explicit External**: Only use external when explicitly needed
3. **Audit External Calls**: Monitor all external communications
4. **Data Privacy**: Ensure external calls comply with data privacy regulations
5. **Documentation**: Document why external communication is needed

## Example: i18N Flow with External Communication

```python
# Internal: Detect language (within tenant)
language = await agent.call_other_agent(
    target_agent_id=lang_agent_id,
    skill="detect_language",
    input_data={"text": text},
    communication_type="internal"
)

# External: Get translation from shared service (cross-tenant)
translation = await agent.call_other_agent(
    target_agent_id=translation_agent_id,
    skill="translate",
    input_data={"text": text, "target_lang": language},
    communication_type="external",
    target_tenant_id=shared_services_tenant_id
)
```

## Summary

- **Internal**: Tenant-scoped, secure, isolated
- **External**: Cross-tenant, flexible, requires explicit configuration
- **Security**: Internal is default, external is logged and audited
- **Use Cases**: Internal for workflows, External for shared services and federated operations
