/**
 * Generic Workflow Orchestration API Client
 * Provides automatic view generation, workflow transitions, and rule evaluation
 */
import api from './api'

export interface ViewStructure {
  layout_id: string
  layout_name: string
  tabs: Array<{
    id: string
    label: string
    order: number
    icon?: string
  }>
  sections: Array<{
    id: string
    title: string
    order: number
    description?: string
    fields: Array<{
      field_name: string
      label: string
      can_view: boolean
      can_edit: boolean
      is_required: boolean
      field_type: string
    }>
    connection_diagram?: string
  }>
  fields: string[]
  workflow_stage: string
  request_type: string
  connection_diagram?: string
}

export interface ViewStructureRequest {
  entity_name: string
  request_type: string
  workflow_stage: string
  entity_id?: string
  agent_type?: string
  agent_category?: string
}

export interface TransitionRequest {
  entity_type: string
  entity_id: string
  entity_data: Record<string, any>
  request_type: string
  current_stage: string
  target_stage: string
  transition_data?: Record<string, any>
}

export interface TransitionResponse {
  success: boolean
  current_stage: string
  target_stage: string
  rule_results: {
    matched_rules: number
    rule_results: any[]
    action_results: any
  }
  notifications: {
    sent: boolean
    results: Array<{
      recipient: string
      sent: boolean
      role?: string
      error?: string
    }>
  }
  reminders: Array<{
    entity_type: string
    entity_id: string
    workflow_stage: string
    reminder_days: number
    reminder_date: string
    recipients: string[]
    scheduled_by: string
  }>
  view_structure: ViewStructure
  error?: string
}

export interface RuleEvaluationRequest {
  entity_type: string
  entity_id: string
  entity_data: Record<string, any>
  request_type: string
  workflow_stage: string
  auto_execute?: boolean
}

export interface RuleEvaluationResponse {
  matched_rules: number
  rule_results: any[]
  action_results: any
}

export const workflowOrchestrationApi = {
  /**
   * Generate view structure (tabs/sections) automatically from layout + permissions
   * 
   * This automatically generates the view structure based on:
   * - Layout configuration for the workflow stage
   * - Hierarchical permissions (Entity → Field → Layout)
   * - User's role
   * 
   * No hardcoding required - everything is configuration-driven!
   */
  async generateViewStructure(request: ViewStructureRequest): Promise<ViewStructure> {
    const response = await api.post('/workflow/view-structure', request)
    return response.data
  },

  /**
   * Transition entity to a new workflow stage
   * 
   * This orchestrates the entire transition:
   * 1. Evaluate business rules
   * 2. Validate transition
   * 3. Update entity state
   * 4. Send email notifications
   * 5. Schedule reminders
   * 6. Return new view structure
   */
  async transitionStage(request: TransitionRequest): Promise<TransitionResponse> {
    const response = await api.post('/workflow/transition', request)
    return response.data
  },

  /**
   * Evaluate business rules for a workflow stage
   * 
   * Rules are evaluated based on:
   * - Entity type and data
   * - Workflow stage
   * - User context
   * 
   * Actions are executed automatically if auto_execute=true
   */
  async evaluateRules(request: RuleEvaluationRequest): Promise<RuleEvaluationResponse> {
    const response = await api.post('/workflow/evaluate-rules', request)
    return response.data
  },
}

