import api from './api'

export interface Prediction {
  agent_id: string
  success_probability?: number
  approval_likelihood?: string
  risk_score?: number
  risk_level?: string
  confidence?: string
  factors?: any[]
  prediction?: string
}

export const predictiveApi = {
  predictSuccess: async (agentId: string): Promise<Prediction> => {
    const response = await api.get(`/predictive/agents/${agentId}/success`)
    return response.data
  },
  
  predictApproval: async (agentId: string): Promise<Prediction> => {
    const response = await api.get(`/predictive/agents/${agentId}/approval`)
    return response.data
  },
  
  predictRisk: async (agentId: string): Promise<Prediction> => {
    const response = await api.get(`/predictive/agents/${agentId}/risk`)
    return response.data
  },
}

