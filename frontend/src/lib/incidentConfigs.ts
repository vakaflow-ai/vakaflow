import api from './api'

export interface IncidentConfig {
  id: string
  name: string
  description?: string
  trigger_type: string
  trigger_conditions?: Record<string, any>
  entity_types?: string[]
  entity_categories?: string[]
  external_system: string
  auto_push: boolean
  field_mapping?: Record<string, any>
  severity_mapping?: Record<string, any>
  is_active: boolean
  priority: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface IncidentConfigCreate {
  name: string
  description?: string
  trigger_type: string
  trigger_conditions?: Record<string, any>
  entity_types?: string[]
  entity_categories?: string[]
  external_system: string
  auto_push?: boolean
  field_mapping?: Record<string, any>
  severity_mapping?: Record<string, any>
  is_active?: boolean
  priority?: number
}

export const incidentConfigsApi = {
  list: async (
    triggerType?: string,
    externalSystem?: string,
    isActive?: boolean
  ): Promise<IncidentConfig[]> => {
    const params = new URLSearchParams()
    if (triggerType) params.append('trigger_type', triggerType)
    if (externalSystem) params.append('external_system', externalSystem)
    if (isActive !== undefined) params.append('is_active', isActive.toString())
    const response = await api.get(`/incident-configs?${params.toString()}`)
    return response.data
  },

  get: async (id: string): Promise<IncidentConfig> => {
    const response = await api.get(`/incident-configs/${id}`)
    return response.data
  },

  create: async (data: IncidentConfigCreate): Promise<IncidentConfig> => {
    const response = await api.post('/incident-configs', data)
    return response.data
  },

  update: async (id: string, data: IncidentConfigCreate): Promise<IncidentConfig> => {
    const response = await api.put(`/incident-configs/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/incident-configs/${id}`)
  }
}
