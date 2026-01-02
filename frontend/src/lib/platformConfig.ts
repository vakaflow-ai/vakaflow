import { api } from './api'

export interface PlatformConfig {
  id: string
  config_key: string
  category: string
  value_type: string
  value: any
  display_value?: string
  description?: string
  is_secret: boolean
  is_required: boolean
  created_at: string
  updated_at: string
}

export interface PlatformConfigCreate {
  config_key: string
  value: any
  category: string
  value_type: string
  description?: string
  is_secret: boolean
}

export interface PlatformConfigUpdate {
  value: any
  description?: string
}

export const platformConfigApi = {
  list: async (category?: string): Promise<PlatformConfig[]> => {
    const params: any = {}
    if (category) params.category = category
    console.log('Fetching platform configs with params:', params)
    const response = await api.get('/platform-config', { params })
    console.log('Platform configs API response:', response.data)
    console.log('Response length:', response.data?.length ?? 0)
    return response.data
  },

  get: async (configKey: string): Promise<PlatformConfig> => {
    const response = await api.get(`/platform-config/${configKey}`)
    return response.data
  },

  create: async (config: PlatformConfigCreate): Promise<PlatformConfig> => {
    const response = await api.post('/platform-config', config)
    return response.data
  },

  update: async (configKey: string, config: PlatformConfigUpdate): Promise<PlatformConfig> => {
    const response = await api.put(`/platform-config/${configKey}`, config)
    return response.data
  },

  delete: async (configKey: string): Promise<void> => {
    await api.delete(`/platform-config/${configKey}`)
  },

  getCategories: async (): Promise<string[]> => {
    const response = await api.get('/platform-config/categories/list')
    return response.data
  },

  getValueTypes: async (): Promise<string[]> => {
    const response = await api.get('/platform-config/value-types/list')
    return response.data
  },
}

