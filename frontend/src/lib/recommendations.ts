import api from './api'

export interface Recommendation {
  type: string
  title: string
  description: string
  confidence: number
  agent_id?: string
  reason?: string
}

export const recommendationsApi = {
  getSimilar: async (agentId: string): Promise<Recommendation[]> => {
    const response = await api.get(`/recommendations/agents/${agentId}/similar`)
    return response.data
  },
  
  getHistorical: async (agentId: string): Promise<Recommendation[]> => {
    const response = await api.get(`/recommendations/agents/${agentId}/historical`)
    return response.data
  },
  
  getReview: async (agentId: string): Promise<Recommendation[]> => {
    const response = await api.get(`/recommendations/agents/${agentId}/review`)
    return response.data
  },
  
  getCompliance: async (agentId: string): Promise<Recommendation[]> => {
    const response = await api.get(`/recommendations/agents/${agentId}/compliance`)
    return response.data
  },
}

