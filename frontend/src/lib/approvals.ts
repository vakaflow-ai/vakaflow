import api from './api'

export interface UserInfo {
  id: string
  name: string
  email: string
  role: string
}

export interface ApprovalResponse {
  id: string
  agent_id: string
  status: string
  current_step: number
  approved_by?: string
  approved_by_user?: UserInfo
  approval_notes?: string
  started_at: string
  completed_at?: string
  current_assignee?: UserInfo
  steps: ApprovalStepResponse[]
}

export interface ApprovalStepResponse {
  id: string
  step_number: number
  step_type: string
  step_name?: string
  assigned_to?: string
  assigned_to_user?: UserInfo
  assigned_role?: string
  status: string
  completed_by?: string
  completed_by_user?: UserInfo
  completed_at?: string
  notes?: string
}

export interface ApprovalRequest {
  notes?: string
}

export const approvalsApi = {
  approve: async (agentId: string, notes?: string): Promise<ApprovalResponse> => {
    const response = await api.post(`/approvals/agents/${agentId}/approve`, { notes: notes || null })
    return response.data
  },

  reject: async (agentId: string, notes: string): Promise<ApprovalResponse> => {
    const response = await api.post(`/approvals/agents/${agentId}/reject`, { notes })
    return response.data
  },

  getAgentApproval: async (agentId: string): Promise<ApprovalResponse> => {
    const response = await api.get(`/approvals/agents/${agentId}`)
    return response.data
  },

  getPendingApprovals: async (page: number = 1, limit: number = 20): Promise<ApprovalResponse[]> => {
    const response = await api.get('/approvals/pending', {
      params: { page, limit }
    })
    return response.data
  }
}

