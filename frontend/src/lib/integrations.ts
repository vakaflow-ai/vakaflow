import api from './api'

export interface Integration {
  id: string
  name: string
  integration_type: string
  status: string
  health_status?: string
  last_sync_at?: string
  last_error?: string
  error_count: number
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface IntegrationCreate {
  name: string
  integration_type: string
  config: Record<string, any>
  description?: string
}

export const integrationsApi = {
  create: async (data: IntegrationCreate): Promise<Integration> => {
    const response = await api.post('/integrations', data)
    return response.data
  },

  list: async (integrationType?: string): Promise<Integration[]> => {
    const params: any = {}
    if (integrationType) params.integration_type = integrationType
    const response = await api.get('/integrations', { params })
    return response.data
  },

  get: async (integrationId: string): Promise<Integration> => {
    const response = await api.get(`/integrations/${integrationId}`)
    return response.data
  },

  test: async (integrationId: string): Promise<any> => {
    const response = await api.post(`/integrations/${integrationId}/test`)
    return response.data
  },

  activate: async (integrationId: string): Promise<any> => {
    const response = await api.post(`/integrations/${integrationId}/activate`)
    return response.data
  },

  deactivate: async (integrationId: string): Promise<any> => {
    const response = await api.post(`/integrations/${integrationId}/deactivate`)
    return response.data
  },

  getEvents: async (integrationId: string, page: number = 1, limit: number = 50): Promise<any[]> => {
    const response = await api.get(`/integrations/${integrationId}/events`, {
      params: { page, limit }
    })
    return response.data
  },

  update: async (integrationId: string, data: IntegrationCreate): Promise<Integration> => {
    const response = await api.put(`/integrations/${integrationId}`, data)
    return response.data
  },

  getConfig: async (integrationId: string): Promise<any> => {
    const response = await api.get(`/integrations/${integrationId}/config`)
    return response.data
  }
}

