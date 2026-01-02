# Integration Guide: Using GenericWorkflowView in Existing Components

## Overview

This guide explains how to integrate the new `GenericWorkflowView` component and workflow orchestration service into existing components like `AgentSubmission` and `ApprovalInterface`.

## Approach

Rather than completely replacing existing components, we recommend a **hybrid approach**:
1. Use `GenericWorkflowView` for form rendering (automatic from layouts + permissions)
2. Keep existing business logic for agent-specific features
3. Use workflow orchestration service for transitions

## Integration Steps

### 1. For AgentSubmission Component

**Current State**: Complex component with custom form rendering, step navigation, and agent-specific logic.

**Integration Strategy**:
- Keep existing step navigation and agent-specific features
- Replace form rendering with `GenericWorkflowView` for the "new" stage
- Use workflow orchestration for stage transitions

**Example Integration**:

```tsx
import GenericWorkflowView from '../components/GenericWorkflowView'
import { workflowOrchestrationApi } from '../lib/workflowOrchestration'

// In AgentSubmission component:
const [useGenericView, setUseGenericView] = useState(true) // Feature flag

// Replace form rendering section with:
{useGenericView ? (
  <GenericWorkflowView
    entityName="agents"
    requestType="agent_onboarding_workflow"
    workflowStage="new"
    entityData={formData}
    agentType={formData.type}
    agentCategory={formData.category}
    onFieldChange={handleFieldChange}
    onSubmit={handleSubmit}
    readOnly={false}
  />
) : (
  // Existing form rendering logic
)}
```

### 2. For ApprovalInterface Component

**Current State**: Complex component with tabs, approval actions, and custom form rendering.

**Integration Strategy**:
- Keep existing tabs and approval actions
- Replace form rendering with `GenericWorkflowView` for approver view
- Use workflow orchestration for approval/rejection transitions

**Example Integration**:

```tsx
import GenericWorkflowView from '../components/GenericWorkflowView'
import { workflowOrchestrationApi } from '../lib/workflowOrchestration'

// In ApprovalInterface component:
const handleApprove = async () => {
  const result = await workflowOrchestrationApi.transitionStage({
    entity_type: "agent",
    entity_id: agent.id,
    entity_data: agent,
    request_type: "agent_onboarding_workflow",
    current_stage: workflowStage,
    target_stage: "approved",
    transition_data: { approval_notes: approvalNotes }
  })
  
  if (result.success) {
    showToast.success("Agent approved successfully")
    // Refresh data
    queryClient.invalidateQueries(['agent', id])
  }
}

// Replace form rendering in details tab with:
<GenericWorkflowView
  entityName="agents"
  requestType="agent_onboarding_workflow"
  workflowStage={workflowStage}
  entityId={id}
  entityData={agent}
  agentType={agent?.type}
  agentCategory={agent?.category}
  readOnly={false} // Approver can edit
  onFieldChange={handleFieldChange}
/>
```

## Benefits of Hybrid Approach

1. **Gradual Migration**: Can migrate one component at a time
2. **Feature Flags**: Can toggle between old and new views
3. **Preserve Business Logic**: Keep agent-specific features intact
4. **Automatic Benefits**: Get automatic view generation, permissions, etc.

## Complete Migration Path

### Phase 1: Add GenericWorkflowView (Current)
- ✅ Create `GenericWorkflowView` component
- ✅ Create workflow orchestration service
- ✅ Add feature flags to existing components

### Phase 2: Test and Validate
- Test with existing workflows
- Validate permissions and layouts
- Ensure business rules work correctly

### Phase 3: Full Migration
- Remove old form rendering code
- Remove feature flags
- Use `GenericWorkflowView` exclusively

## Migration Checklist

- [ ] Add `GenericWorkflowView` import to component
- [ ] Add feature flag for gradual rollout
- [ ] Replace form rendering section with `GenericWorkflowView`
- [ ] Update field change handlers to work with generic view
- [ ] Update submit handlers to use workflow orchestration
- [ ] Test with existing workflows
- [ ] Validate permissions and layouts
- [ ] Remove old form rendering code
- [ ] Remove feature flag

## Notes

- The `GenericWorkflowView` automatically handles:
  - Tab/section generation from layouts
  - Field filtering by permissions
  - Input component rendering
  - Validation

- Existing components can keep:
  - Step navigation
  - Approval actions
  - Business-specific features
  - Custom UI elements

