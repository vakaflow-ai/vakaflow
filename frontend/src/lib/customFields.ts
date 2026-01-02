import api from './api'
import { CustomField } from './formLayouts'

export interface CustomFieldCatalog extends CustomField {
  id: string
  tenant_id: string
  is_enabled: boolean
  is_standard: boolean
  field_source?: string
  field_source_id?: string
  role_permissions: Record<string, { view: boolean; edit: boolean }>
  created_at: string
  updated_at: string
}

export interface CustomFieldCreate {
  field_name: string
  field_type: string
  label: string
  description?: string
  placeholder?: string
  is_required?: boolean
  is_enabled?: boolean
  accepted_file_types?: string
  link_text?: string
  master_data_list_id?: string
  options?: Array<{ value: string; label: string }>
  role_permissions?: Record<string, { view: boolean; edit: boolean }>
}

export interface CustomFieldUpdate {
  label?: string
  description?: string
  placeholder?: string
  is_required?: boolean
  is_enabled?: boolean
  accepted_file_types?: string
  link_text?: string
  master_data_list_id?: string
  options?: Array<{ value: string; label: string }>
  role_permissions?: Record<string, { view: boolean; edit: boolean }>
}

export interface CustomFieldListResponse {
  fields: CustomFieldCatalog[]
  total: number
  page: number
  limit: number
}

export const customFieldsApi = {
  list: async (
    page: number = 1,
    limit: number = 20,
    is_enabled?: boolean,
    is_standard?: boolean
  ): Promise<CustomFieldListResponse> => {
    const params: any = { page, limit }
    if (is_enabled !== undefined) params.is_enabled = is_enabled
    if (is_standard !== undefined) params.is_standard = is_standard
    const response = await api.get('/custom-fields', { params })
    return response.data
  },

  create: async (field: CustomFieldCreate): Promise<CustomFieldCatalog> => {
    const response = await api.post('/custom-fields', field)
    return response.data
  },

  update: async (fieldId: string, field: CustomFieldUpdate): Promise<CustomFieldCatalog> => {
    const response = await api.patch(`/custom-fields/${fieldId}`, field)
    return response.data
  },

  delete: async (fieldId: string): Promise<void> => {
    await api.delete(`/custom-fields/${fieldId}`)
  },
}

