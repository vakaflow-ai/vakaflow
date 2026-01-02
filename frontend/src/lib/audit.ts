import api from './api'

export interface AuditLog {
  id: string
  user_id: string
  action: string
  resource_type: string
  resource_id?: string
  details?: any
  ip_address?: string
  created_at: string
}

export interface AuditLogListResponse {
  logs: AuditLog[]
  total: number
  limit: number
  offset: number
}

export interface PurgeAuditRequest {
  tenant_id?: string
  older_than_days?: number  // 180 or 365
  older_than_years?: number  // 1, 2, or 3
}

export interface PurgeAuditResponse {
  message: string
  deleted_count: number
  tenant_id?: string
  cutoff_date: string
}

export const auditApi = {
  getLogs: async (
    tenantId?: string,
    userId?: string,
    resourceType?: string,
    resourceId?: string,
    action?: string,
    startDate?: string,
    endDate?: string,
    limit = 100,
    offset = 0
  ): Promise<AuditLogListResponse> => {
    const response = await api.get('/audit', {
      params: {
        tenant_id: tenantId,
        user_id: userId,
        resource_type: resourceType,
        resource_id: resourceId,
        action,
        start_date: startDate,
        end_date: endDate,
        limit,
        offset
      }
    })
    return response.data
  },

  getResourceHistory: async (resourceType: string, resourceId: string, limit = 50) => {
    const response = await api.get(`/audit/resources/${resourceType}/${resourceId}`, {
      params: { limit }
    })
    return response.data
  },

  purge: async (request: PurgeAuditRequest): Promise<PurgeAuditResponse> => {
    const response = await api.delete('/audit/purge', { data: request })
    return response.data
  }
}

