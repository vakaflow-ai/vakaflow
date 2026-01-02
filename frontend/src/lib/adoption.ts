import api from './api'

export interface AdoptionMetric {
  id: string
  agent_id: string
  status: string
  user_count: number
  usage_count: number
  last_used_at?: string
  roi?: number
  cost_savings?: number
  efficiency_gain?: number
  user_satisfaction?: number
  feedback_count: number
  deployed_at?: string
  created_at: string
  updated_at: string
}

export interface AdoptionEvent {
  id: string
  event_type: string
  metadata?: any
  occurred_at: string
}

export interface AdoptionEventCreate {
  agent_id: string
  event_type: string
  metadata?: any
}

export const adoptionApi = {
  getMetrics: async (agentId: string): Promise<AdoptionMetric> => {
    const response = await api.get(`/adoption/agents/${agentId}/metrics`)
    return response.data
  },

  createEvent: async (data: AdoptionEventCreate): Promise<any> => {
    const response = await api.post('/adoption/events', data)
    return response.data
  },

  getEvents: async (agentId: string, page: number = 1, limit: number = 50): Promise<AdoptionEvent[]> => {
    const response = await api.get(`/adoption/agents/${agentId}/events`, {
      params: { page, limit }
    })
    return response.data
  },

  getDashboard: async (): Promise<any> => {
    const response = await api.get('/adoption/dashboard')
    return response.data
  }
}

