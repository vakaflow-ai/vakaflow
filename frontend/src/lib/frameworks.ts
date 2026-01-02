import api from './api'

export interface ComplianceFramework {
  id: string
  name: string
  code: string
  description?: string
  region?: string
  category?: string
  version?: string
  status: string
  is_active: boolean
}

export interface Requirement {
  id: string
  name: string
  code: string
  description?: string
  requirement_text: string
  requirement_code?: string
  order: number
  children: Requirement[]
}

export interface RequirementTree {
  framework_id: string
  framework_name: string
  requirements: Requirement[]
}

export interface RequirementResponse {
  id?: string
  rule_id: string
  response_text?: string
  evidence?: Record<string, any>
  compliance_status?: string
}

export const frameworksApi = {
  list: async (): Promise<ComplianceFramework[]> => {
    const response = await api.get('/frameworks')
    return response.data
  },

  getAgentRequirements: async (agentId: string): Promise<RequirementTree[]> => {
    const response = await api.get(`/frameworks/agents/${agentId}/requirements`)
    return response.data
  },

  submitResponses: async (agentId: string, responses: RequirementResponse[]): Promise<{ message: string; created: number; updated: number }> => {
    const response = await api.post(`/frameworks/agents/${agentId}/responses`, responses)
    return response.data
  },

  getResponses: async (agentId: string): Promise<RequirementResponse[]> => {
    const response = await api.get(`/frameworks/agents/${agentId}/responses`)
    return response.data
  },
}

