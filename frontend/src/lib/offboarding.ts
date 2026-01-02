import api from './api'

export interface OffboardingRequest {
  id: string
  agent_id: string
  requested_by: string
  reason: string
  reason_details?: string
  target_date?: string
  replacement_agent_id?: string
  status: string
  impact_analysis?: any
  dependency_mapping?: any
  knowledge_extracted?: any
  created_at: string
  updated_at: string
  completed_at?: string
  knowledge_extractions: KnowledgeExtraction[]
}

export interface KnowledgeExtraction {
  id: string
  extraction_type: string
  content: string
  metadata?: any
  source_type?: string
  extracted_at: string
}

export interface OffboardingRequestCreate {
  agent_id: string
  reason: string
  reason_details?: string
  target_date?: string
  replacement_agent_id?: string
}

export const offboardingApi = {
  create: async (data: OffboardingRequestCreate): Promise<OffboardingRequest> => {
    const response = await api.post('/offboarding/requests', data)
    return response.data
  },

  list: async (page: number = 1, limit: number = 20, status?: string): Promise<{ requests: OffboardingRequest[], total: number, page: number, limit: number }> => {
    const params: any = { page, limit }
    if (status) params.status_filter = status
    const response = await api.get('/offboarding/requests', { params })
    return response.data
  },

  get: async (requestId: string): Promise<OffboardingRequest> => {
    const response = await api.get(`/offboarding/requests/${requestId}`)
    return response.data
  },

  analyze: async (requestId: string): Promise<any> => {
    const response = await api.post(`/offboarding/requests/${requestId}/analyze`)
    return response.data
  },

  extractKnowledge: async (requestId: string): Promise<any> => {
    const response = await api.post(`/offboarding/requests/${requestId}/extract-knowledge`)
    return response.data
  },

  complete: async (requestId: string): Promise<any> => {
    const response = await api.post(`/offboarding/requests/${requestId}/complete`)
    return response.data
  }
}

