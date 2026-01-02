import api from './api'

export interface Review {
  id: string
  agent_id: string
  reviewer_id: string
  reviewer_name?: string
  reviewer_email?: string
  reviewer_role?: string
  stage: string
  status: string
  comment?: string
  findings?: string[]
  created_at: string
  completed_at?: string
}

export interface ReviewCreate {
  agent_id: string
  stage: string
  status: string
  comment?: string
  findings?: string[]
}

export const reviewsApi = {
  create: async (data: ReviewCreate): Promise<Review> => {
    const response = await api.post('/reviews', data)
    return response.data
  },

  list: async (agentId: string, page = 1, limit = 20) => {
    const response = await api.get(`/reviews/agents/${agentId}`, {
      params: { page, limit }
    })
    return response.data
  },

  queryRAG: async (agentId: string, query: string, limit = 5) => {
    const response = await api.post(`/reviews/agents/${agentId}/rag-query`, null, {
      params: { query, limit }
    })
    return response.data
  }
}

