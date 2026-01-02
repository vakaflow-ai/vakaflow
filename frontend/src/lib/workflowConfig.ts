import api from './api'

export interface StageSettings {
  visible_fields?: string[] // Fields from submission that are visible
  email_notifications?: {
    enabled: boolean
    recipients?: ('user' | 'vendor' | 'next_approver')[]
    reminders?: number[] // Days before reminder (e.g., [1, 2])
  }
  layout_id?: string // Form layout ID for approver screen tabs
}

export interface WorkflowStep {
  step_number: number
  step_type: 'approval' | 'notification'  // Removed 'review' - everything is approval now
  step_name: string
  assigned_role?: string
  assigned_user_id?: string
  approver_group_id?: string
  required: boolean
  can_skip: boolean
  auto_assign: boolean
  conditions?: Record<string, any>
  is_first_step?: boolean
  assignment_rule?: {
    type: 'role' | 'user' | 'group' | 'round_robin'
    value?: string // user_id, role, or group_id
  }
  stage_settings?: StageSettings
}

export interface ApproverGroup {
  id: string
  name: string
  description?: string
  tenant_id: string
  member_ids: string[]
  created_at: string
  updated_at: string
}

export interface AssignmentRules {
  approver_selection: 'round_robin' | 'specific_user' | 'role_based' | 'group_based'
  specific_approver_id?: string
  approver_group_id?: string
  reviewer_auto_assign: boolean
  escalation_rules?: {
    timeout_hours?: number
    escalate_to?: string
  }
}

export interface WorkflowConditions {
  agent_types?: string[]
  risk_levels?: string[]
  categories?: string[]
  priority: number
}

export interface TriggerRules {
  sso_groups?: string[]
  departments?: string[]
  application_categories?: string[]
  agent_types?: string[]
  risk_levels?: string[]
  match_all?: boolean // true = all conditions must match, false = any condition matches
}

export interface WorkflowConfig {
  id: string
  tenant_id: string
  name: string
  description?: string
  workflow_engine: 'internal' | 'servicenow' | 'jira' | 'custom'
  integration_id?: string
  integration_name?: string
  workflow_steps?: WorkflowStep[]
  assignment_rules?: AssignmentRules
  conditions?: WorkflowConditions
  trigger_rules?: TriggerRules
  status: 'active' | 'inactive' | 'draft'
  is_default: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface WorkflowConfigCreate {
  name: string
  description?: string
  workflow_engine?: 'internal' | 'servicenow' | 'jira' | 'custom'
  integration_id?: string
  integration_config?: Record<string, any>
  workflow_steps?: WorkflowStep[]
  assignment_rules?: AssignmentRules
  conditions?: WorkflowConditions
  trigger_rules?: TriggerRules
  is_default?: boolean
  status?: 'active' | 'inactive' | 'draft'
}

export interface OnboardingRequest {
  id: string
  agent_id: string
  tenant_id: string
  requested_by: string
  request_type: 'onboarding' | 'renewal' | 'update'
  workflow_config_id?: string
  workflow_engine: string
  external_workflow_id?: string
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'cancelled'
  assigned_to?: string
  assigned_to_email?: string  // Email of assigned user
  assigned_to_name?: string  // Name of assigned user
  current_step: number
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  approved_by?: string
  approved_by_name?: string  // Name of approver
  approved_by_email?: string  // Email of approver
  approved_at?: string
  approval_notes?: string
  rejected_by?: string
  rejected_by_name?: string  // Name of rejector
  rejected_by_email?: string  // Email of rejector
  rejected_at?: string
  rejection_reason?: string
  request_number?: string  // Human-readable request number (AI-1, AI-2, etc.)
  created_at: string
  updated_at: string
}

export const workflowConfigApi = {
  list: async (): Promise<WorkflowConfig[]> => {
    const response = await api.get('/workflow-config')
    return response.data
  },

  get: async (id: string): Promise<WorkflowConfig> => {
    const response = await api.get(`/workflow-config/${id}`)
    return response.data
  },

  create: async (data: WorkflowConfigCreate): Promise<WorkflowConfig> => {
    const response = await api.post('/workflow-config', data)
    return response.data
  },

  update: async (id: string, data: Partial<WorkflowConfigCreate>): Promise<WorkflowConfig> => {
    const response = await api.patch(`/workflow-config/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/workflow-config/${id}`)
  },

  setFirstStep: async (id: string, stepNumber: number): Promise<WorkflowConfig> => {
    const response = await api.post(`/workflow-config/${id}/set-first-step?step_number=${stepNumber}`)
    return response.data
  },

  reorderSteps: async (id: string, stepOrder: number[]): Promise<WorkflowConfig> => {
    const response = await api.post(`/workflow-config/${id}/reorder-steps`, stepOrder)
    return response.data
  },

  listOnboardingRequests: async (status?: string): Promise<OnboardingRequest[]> => {
    const response = await api.get('/workflow-config/onboarding-requests', {
      params: status ? { status } : {}
    })
    return response.data
  },

  approveOnboardingRequest: async (requestId: string, notes?: string): Promise<OnboardingRequest> => {
    const response = await api.post(`/workflow-config/onboarding-requests/${requestId}/approve`, notes ? { notes } : null)
    return response.data
  },

  rejectOnboardingRequest: async (requestId: string, reason: string): Promise<OnboardingRequest> => {
    const response = await api.post(`/workflow-config/onboarding-requests/${requestId}/reject`, { reason })
    return response.data
  },

  getOnboardingRequestByAgent: async (agentId: string): Promise<OnboardingRequest | null> => {
    try {
      const response = await api.get(`/workflow-config/onboarding-requests/agent/${agentId}`)
      return response.data
    } catch (error: any) {
      // Handle 204 No Content or 404 - agent exists but no workflow request yet
      if (error?.response?.status === 204 || error?.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  // Approver Groups
  listApproverGroups: async (): Promise<ApproverGroup[]> => {
    const response = await api.get('/workflow-config/approver-groups')
    return response.data
  },

  getApproverGroup: async (id: string): Promise<ApproverGroup> => {
    const response = await api.get(`/workflow-config/approver-groups/${id}`)
    return response.data
  },

  createApproverGroup: async (data: Omit<ApproverGroup, 'id' | 'created_at' | 'updated_at'>): Promise<ApproverGroup> => {
    const response = await api.post('/workflow-config/approver-groups', data)
    return response.data
  },

  updateApproverGroup: async (id: string, data: Partial<Omit<ApproverGroup, 'id' | 'created_at' | 'updated_at'>>): Promise<ApproverGroup> => {
    const response = await api.patch(`/workflow-config/approver-groups/${id}`, data)
    return response.data
  },

  deleteApproverGroup: async (id: string): Promise<void> => {
    await api.delete(`/workflow-config/approver-groups/${id}`)
  },

  healthCheck: async (): Promise<{
    tables_exist: Record<string, boolean>
    tenants: Array<{
      id: string
      name: string
      slug: string
      has_default_workflow: boolean
      has_any_workflow: boolean
      has_active_workflow: boolean
      workflow_count: number
      default_workflow?: {
        id: string
        name: string
        status: string
        steps_count: number
        engine: string
      }
    }>
    summary: {
      all_tables_exist: boolean
      total_tenants: number
      tenants_with_workflows: number
      tenants_without_workflows: number
      total_workflows: number
      total_onboarding_requests: number
    }
  }> => {
    const response = await api.get('/workflow-config/health-check')
    return response.data
  },
}

