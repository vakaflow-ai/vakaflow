import api from './api'

export interface WorkflowAction {
  id: string
  action_type: 'approve' | 'reject' | 'forward' | 'comment' | 'request_revision' | 'escalate'
  performed_by: string
  performed_at: string
  comments?: string
  forwarded_to?: string
  step_number: number
}

export interface ForwardRequest {
  forwarded_to: string
  comments?: string
}

export interface CommentRequest {
  comments: string
  step_number?: number
}

export interface AuditTrailEntry {
  id: string
  user_id: string
  action: string
  step_number?: number
  step_name?: string
  comments?: string
  action_details?: Record<string, any>
  previous_status?: string
  new_status?: string
  created_at: string
  ip_address?: string
  user_agent?: string
}

export const workflowActionsApi = {
  forward: async (requestId: string, data: ForwardRequest): Promise<WorkflowAction> => {
    const response = await api.post(`/workflow-actions/onboarding-requests/${requestId}/forward`, {
      forwarded_to: data.forwarded_to,
      comments: data.comments
    })
    return response.data
  },

  addComment: async (requestId: string, data: CommentRequest): Promise<WorkflowAction> => {
    const response = await api.post(`/workflow-actions/onboarding-requests/${requestId}/comment`, {
      comments: data.comments
    })
    return response.data
  },

  getActions: async (requestId: string): Promise<WorkflowAction[]> => {
    const response = await api.get(`/workflow-actions/onboarding-requests/${requestId}/actions`)
    return response.data
  },

  getAuditTrail: async (requestId: string): Promise<AuditTrailEntry[]> => {
    const response = await api.get(`/workflow-actions/onboarding-requests/${requestId}/audit-trail`)
    return response.data
  },
}

