import api from './api'

export enum VisibilityScope {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  BOTH = 'both'
}

export interface RequestTypeConfig {
  id: string
  tenant_id: string
  request_type: string
  display_name: string
  visibility_scope: VisibilityScope
  icon_name?: string
  sort_order: number
  workflow_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RequestTypeConfigCreate {
  request_type: string
  display_name: string
  visibility_scope: VisibilityScope
  description?: string
  icon_name?: string
  sort_order?: number
  workflow_id?: string
  is_active?: boolean
}

export interface RequestTypeConfigUpdate {
  display_name?: string
  visibility_scope?: VisibilityScope
  icon_name?: string
  sort_order?: number
  workflow_id?: string
  is_active?: boolean
}

export interface HubOption {
  request_type: string
  display_name: string
  icon_name?: string
  sort_order: number
}

// Form Association Interfaces
export interface FormAssociation {
  id: string
  request_type_config_id: string
  form_layout_id: string
  display_order: number
  is_primary: boolean
  form_variation_type?: string
  created_at: string
  updated_at: string
  // Form details from backend response
  form_name: string
  form_description?: string
  form_is_active: boolean
  // Related objects
  form_layout?: FormLayout
}

// Helper functions for frontend compatibility
export const getFormAssociationSortOrder = (form: FormAssociation): number => form.display_order;
export const getFormAssociationIsDefault = (form: FormAssociation): boolean => form.is_primary;

export interface FormAssociationCreate {
  form_layout_id: string
  display_order?: number
  is_primary?: boolean
  form_variation_type?: string
}

export interface FormAssociationUpdate {
  sort_order?: number
  is_default?: boolean
}

export interface FormLayout {
  id: string
  name: string
  description?: string
  json_schema: Record<string, any>
  ui_schema: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
}

export const requestTypeConfigApi = {
  getAll: async (): Promise<RequestTypeConfig[]> => {
    const response = await api.get('/request-type-config')
    return response.data
  },

  getById: async (id: string): Promise<RequestTypeConfig> => {
    const response = await api.get(`/request-type-config/${id}`)
    return response.data
  },

  create: async (data: RequestTypeConfigCreate): Promise<RequestTypeConfig> => {
    const response = await api.post('/request-type-config', data)
    return response.data
  },

  update: async (id: string, data: RequestTypeConfigUpdate): Promise<RequestTypeConfig> => {
    const response = await api.patch(`/request-type-config/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/request-type-config/${id}`)
  },

  getHubOptions: async (portalType: 'internal' | 'external'): Promise<HubOption[]> => {
    const response = await api.get(`/request-type-config/hub-options/${portalType}`)
    return response.data
  },

  // Bulk operations
  bulkCreate: async (configs: RequestTypeConfigCreate[]): Promise<RequestTypeConfig[]> => {
    const response = await api.post('/request-type-config/bulk', configs)
    return response.data
  },

  bulkUpdate: async (updates: { id: string; data: RequestTypeConfigUpdate }[]): Promise<RequestTypeConfig[]> => {
    const response = await api.patch('/request-type-config/bulk', updates)
    return response.data
  },

  // Form Association Methods
  getAssociatedForms: async (configId: string): Promise<FormAssociation[]> => {
    const response = await api.get(`/request-type-config/${configId}/forms`)
    return response.data
  },

  associateForm: async (configId: string, data: FormAssociationCreate): Promise<FormAssociation> => {
    const response = await api.post(`/request-type-config/${configId}/forms`, data)
    return response.data
  },

  dissociateForm: async (configId: string, formId: string): Promise<void> => {
    await api.delete(`/request-type-config/${configId}/forms/${formId}`)
  },

  updateFormAssociation: async (configId: string, formId: string, data: FormAssociationUpdate): Promise<FormAssociation> => {
    const response = await api.patch(`/request-type-config/${configId}/forms/${formId}`, data)
    return response.data
  }
}