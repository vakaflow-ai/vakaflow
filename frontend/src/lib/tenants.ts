import api from './api'

export interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  license_tier: string
  max_agents?: number
  max_users?: number
  onboarding_status: string
  features: Record<string, boolean>
  custom_branding?: {
    logo_url?: string
    logo_path?: string
    primary_color?: string
    secondary_color?: string
    [key: string]: any
  }
  industry?: string
  timezone?: string
  locale?: string
  i18n_settings?: Record<string, any>
  contact_email?: string
  contact_name?: string
  contact_phone?: string
  website?: string
  created_at: string
}

export interface TenantCreate {
  name: string
  slug: string
  contact_email: string
  contact_name?: string
  license_tier: string
  max_agents?: number
  max_users?: number
  tenant_admin_email?: string
  tenant_admin_name?: string
  tenant_admin_password?: string
}

export interface TenantUpdate {
  name?: string
  status?: string
  license_tier?: string
  max_agents?: number
  max_users?: number
  custom_branding?: Record<string, any>
  industry?: string
  timezone?: string
  locale?: string
  i18n_settings?: Record<string, any>
  contact_email?: string
  contact_name?: string
  contact_phone?: string
  website?: string
}

export const tenantsApi = {
  list: async (page: number = 1, limit: number = 20, statusFilter?: string): Promise<Tenant[]> => {
    const params: any = { page, limit }
    if (statusFilter) params.status_filter = statusFilter
    const response = await api.get('/tenants', { params })
    return response.data
  },

  get: async (tenantId: string): Promise<Tenant> => {
    const response = await api.get(`/tenants/${tenantId}`)
    return response.data
  },

  create: async (data: TenantCreate): Promise<Tenant> => {
    const response = await api.post('/tenants', data)
    return response.data
  },

  update: async (tenantId: string, data: TenantUpdate): Promise<Tenant> => {
    const response = await api.patch(`/tenants/${tenantId}`, data)
    return response.data
  },

  completeOnboarding: async (tenantId: string): Promise<any> => {
    const response = await api.post(`/tenants/${tenantId}/complete-onboarding`)
    return response.data
  },

  getBranding: async (): Promise<{ tenant_id: string; tenant_name: string; custom_branding: Record<string, any> }> => {
    const response = await api.get('/tenants/me/branding')
    return response.data
  },

  getMyTenantFeatures: async (): Promise<Record<string, boolean>> => {
    const response = await api.get('/tenants/me/features')
    return response.data
  },

  getMyTenant: async (): Promise<Tenant> => {
    const response = await api.get('/tenants/me')
    return response.data
  },

  updateMyTenant: async (data: TenantUpdate): Promise<Tenant> => {
    const response = await api.patch('/tenants/me', data)
    return response.data
  },

  uploadLogo: async (tenantId: string, file: File): Promise<Tenant> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/tenants/${tenantId}/logo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  uploadMyLogo: async (file: File): Promise<Tenant> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/tenants/me/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  updateBranding: async (tenantId: string, branding: Record<string, any>): Promise<Tenant> => {
    const response = await api.patch(`/tenants/${tenantId}/branding`, branding)
    return response.data
  },

  updateMyBranding: async (branding: Record<string, any>): Promise<Tenant> => {
    const response = await api.patch('/tenants/me/branding', branding)
    return response.data
  },

  fetchLogoFromWebsite: async (website: string): Promise<Tenant> => {
    const response = await api.post('/tenants/me/fetch-logo', null, {
      params: { website }
    })
    return response.data
  },
}

