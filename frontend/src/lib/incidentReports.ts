import api from './api'

export interface IncidentReport {
  id: string
  incident_type: string
  title: string
  description?: string
  severity?: string
  entity_type: string
  entity_id: string
  vendor_id?: string
  related_entity_type?: string
  related_entity_id?: string
  incident_data?: Record<string, any>
  external_system?: string
  external_ticket_id?: string
  external_ticket_url?: string
  push_status: string
  push_attempts: number
  last_push_attempt?: string
  push_error?: string
  status?: string
  resolved_at?: string
  resolved_by?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface IncidentReportListResponse {
  incidents: IncidentReport[]
  total: number
  page: number
  limit: number
}

export const incidentReportsApi = {
  list: async (
    entityType?: string,
    entityId?: string,
    incidentType?: string,
    severity?: string,
    pushStatus?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IncidentReportListResponse> => {
    const params = new URLSearchParams()
    if (entityType) params.append('entity_type', entityType)
    if (entityId) params.append('entity_id', entityId)
    if (incidentType) params.append('incident_type', incidentType)
    if (severity) params.append('severity', severity)
    if (pushStatus) params.append('push_status', pushStatus)
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    const response = await api.get(`/incident-reports?${params.toString()}`)
    return response.data
  },

  get: async (id: string): Promise<IncidentReport> => {
    const response = await api.get(`/incident-reports/${id}`)
    return response.data
  },

  create: async (data: {
    incident_type: string
    title: string
    description?: string
    severity?: string
    entity_type: string
    entity_id: string
    vendor_id?: string
    related_entity_type?: string
    related_entity_id?: string
    incident_data?: Record<string, any>
    external_system?: string
  }): Promise<IncidentReport> => {
    const response = await api.post('/incident-reports', data)
    return response.data
  },

  push: async (id: string, externalSystem: string): Promise<{ success: boolean; ticket_id?: string; ticket_url?: string; error?: string }> => {
    const response = await api.post(`/incident-reports/${id}/push?external_system=${externalSystem}`)
    return response.data
  }
}
