import api from './api'

export interface RoleConfiguration {
  id: string
  tenant_id?: string
  role: string
  data_filter_rule_ids?: Array<{ id: string; type: string; name?: string }>
  data_filter_rule_config?: Record<string, any>
  settings?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface RoleConfigurationUpdate {
  data_filter_rule_ids?: Array<{ id: string; type: string }> | null
  data_filter_rule_config?: Record<string, any> | null
  settings?: Record<string, any> | null
}

export const roleConfigurationsApi = {
  list: async (params?: { role?: string; tenant_id?: string }): Promise<RoleConfiguration[]> => {
    // Remove tenant_id from params if it's undefined or empty
    const cleanParams: any = {}
    if (params?.role) cleanParams.role = params.role
    if (params?.tenant_id) cleanParams.tenant_id = params.tenant_id
    const response = await api.get('/role-configurations', { params: cleanParams })
    return response.data
  },

  get: async (role: string, tenant_id?: string): Promise<RoleConfiguration> => {
    const params: any = {}
    if (tenant_id) params.tenant_id = tenant_id
    const response = await api.get(`/role-configurations/${role}`, { params })
    return response.data
  },

  update: async (role: string, data: RoleConfigurationUpdate): Promise<RoleConfiguration> => {
    const response = await api.put(`/role-configurations/${role}`, data)
    return response.data
  },
}

