import apiClient from './api'

export interface TableColumn {
  id: string
  label: string
  field: string | null
  order: number
  width?: string | null
  visible: boolean
  sortable: boolean
  type: string
}

export interface AssessmentTableLayout {
  id: string
  tenant_id: string | null
  name: string
  view_type: 'vendor_submission' | 'approver'
  description: string | null
  columns: TableColumn[]
  is_active: boolean
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AssessmentTableLayoutCreate {
  name: string
  view_type: 'vendor_submission' | 'approver'
  description?: string | null
  columns: TableColumn[]
  is_active?: boolean
  is_default?: boolean
}

export interface AssessmentTableLayoutUpdate {
  name?: string
  description?: string | null
  columns?: TableColumn[]
  is_active?: boolean
  is_default?: boolean
}

export interface AvailableColumn {
  id: string
  label: string
  field: string | null
  type: string
  default_visible: boolean
}

class AssessmentTableLayoutsApi {
  private baseUrl = '/api/v1/assessment-table-layouts'

  async list(params?: {
    view_type?: 'vendor_submission' | 'approver'
    is_active?: boolean
  }): Promise<AssessmentTableLayout[]> {
    const queryParams = new URLSearchParams()
    if (params?.view_type) queryParams.append('view_type', params.view_type)
    if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active))
    
    const url = queryParams.toString() ? `${this.baseUrl}?${queryParams}` : this.baseUrl
    const response = await apiClient.get(url)
    return response.data
  }

  async get(id: string): Promise<AssessmentTableLayout> {
    const response = await apiClient.get(`${this.baseUrl}/${id}`)
    return response.data
  }

  async getDefault(viewType: 'vendor_submission' | 'approver'): Promise<AssessmentTableLayout> {
    const response = await apiClient.get(`${this.baseUrl}/default/${viewType}`)
    return response.data
  }

  async create(data: AssessmentTableLayoutCreate): Promise<AssessmentTableLayout> {
    const response = await apiClient.post(this.baseUrl, data)
    return response.data
  }

  async update(id: string, data: AssessmentTableLayoutUpdate): Promise<AssessmentTableLayout> {
    const response = await apiClient.put(`${this.baseUrl}/${id}`, data)
    return response.data
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${id}`)
  }

  async getAvailableColumns(viewType: 'vendor_submission' | 'approver'): Promise<AvailableColumn[]> {
    const response = await apiClient.get(`${this.baseUrl}/available-columns/${viewType}`)
    return response.data
  }
}

export const assessmentTableLayoutsApi = new AssessmentTableLayoutsApi()
