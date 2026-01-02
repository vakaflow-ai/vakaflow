import api from './api'

export interface MasterDataValue {
  value: string
  label: string
  order: number
  is_active: boolean
  metadata?: Record<string, any>
}

export interface MasterDataList {
  id: string
  tenant_id: string
  name: string
  description?: string
  list_type: string
  selection_type: 'single' | 'multi'  // Controls whether single-select or multi-select UI is used
  is_active: boolean
  is_system: boolean
  values: MasterDataValue[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface MasterDataListCreate {
  name: string
  description?: string
  list_type: string
  selection_type?: 'single' | 'multi'  // Defaults to 'single'
  values: MasterDataValue[]
  is_active?: boolean
}

export interface MasterDataListUpdate {
  name?: string
  description?: string
  list_type?: string
  selection_type?: 'single' | 'multi'
  values?: MasterDataValue[]
  is_active?: boolean
}

export const masterDataListsApi = {
  list: async (listType?: string, isActive?: boolean): Promise<MasterDataList[]> => {
    const params: any = {}
    if (listType) params.list_type = listType
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get('/master-data-lists', { params })
    return response.data
  },

  get: async (id: string): Promise<MasterDataList> => {
    const response = await api.get(`/master-data-lists/${id}`)
    return response.data
  },

  create: async (list: MasterDataListCreate): Promise<MasterDataList> => {
    const response = await api.post('/master-data-lists', list)
    return response.data
  },

  update: async (id: string, list: MasterDataListUpdate): Promise<MasterDataList> => {
    const response = await api.patch(`/master-data-lists/${id}`, list)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/master-data-lists/${id}`)
  },

  getValuesByType: async (listType: string): Promise<MasterDataValue[]> => {
    const response = await api.get(`/master-data-lists/by-type/${listType}/values`)
    return response.data
  },
}
