import api from './api'

export interface RolePermission {
  id: string
  tenant_id?: string
  role: string
  category: string
  permission_key: string
  permission_label: string
  permission_description?: string
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface PermissionCreate {
  role: string
  category: string
  permission_key: string
  permission_label: string
  permission_description?: string
  is_enabled?: boolean
}

export interface PermissionUpdate {
  permission_label?: string
  permission_description?: string
  is_enabled?: boolean
  data_filter_rule_ids?: Array<{ id: string; type: string }> | null
  data_filter_rule_id?: string | null  // Legacy field
  data_filter_rule_config?: Record<string, any> | null
}

export interface BulkPermissionUpdate {
  permission_ids: string[]
  is_enabled: boolean
}

export interface PermissionsByCategory {
  [category: string]: {
    [role: string]: RolePermission[]
  }
}

export const rolePermissionsApi = {
  list: async (params?: { role?: string; category?: string; tenant_id?: string }): Promise<RolePermission[]> => {
    const response = await api.get('/role-permissions', { params })
    return response.data
  },

  getMyPermissions: async (category?: string): Promise<RolePermission[]> => {
    const response = await api.get('/role-permissions/my-permissions', { params: category ? { category } : undefined })
    return response.data
  },

  getByCategory: async (params?: { role?: string; tenant_id?: string }): Promise<PermissionsByCategory> => {
    const response = await api.get('/role-permissions/by-category', { params })
    return response.data
  },

  create: async (data: PermissionCreate): Promise<RolePermission> => {
    const response = await api.post('/role-permissions', data)
    return response.data
  },

  update: async (permissionId: string, data: PermissionUpdate): Promise<RolePermission> => {
    const response = await api.patch(`/role-permissions/${permissionId}`, data)
    return response.data
  },

  bulkToggle: async (data: BulkPermissionUpdate): Promise<{ updated: number; enabled: boolean }> => {
    const response = await api.patch('/role-permissions/bulk-toggle', data)
    return response.data
  },

  delete: async (permissionId: string): Promise<void> => {
    await api.delete(`/role-permissions/${permissionId}`)
  },

  seedDefaults: async (): Promise<{ created: number; updated: number; total: number }> => {
    const response = await api.post('/role-permissions/seed-defaults')
    return response.data
  },
}

