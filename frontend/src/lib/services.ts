import api from './api'

export interface Service {
  id: string
  vendor_id: string
  tenant_id?: string
  name: string
  service_type: string
  category?: string
  description?: string
  service_level?: string
  pricing_model?: string
  status: string
  compliance_score?: number
  risk_score?: number
  use_cases?: string
  integration_points?: Record<string, any>
  business_value?: Record<string, any>
  deployment_info?: Record<string, any>
  metadata?: Record<string, any>
  created_at: string
  updated_at?: string
  vendor_name?: string
}

export interface ServiceCreate {
  vendor_id: string
  name: string
  service_type: string
  category?: string
  description?: string
  service_level?: string
  pricing_model?: string
  status?: string
  use_cases?: string
  integration_points?: Record<string, any>
  business_value?: Record<string, any>
  deployment_info?: Record<string, any>
  metadata?: Record<string, any>
}

export interface ServiceUpdate {
  name?: string
  service_type?: string
  category?: string
  description?: string
  service_level?: string
  pricing_model?: string
  status?: string
  compliance_score?: number
  risk_score?: number
  use_cases?: string
  integration_points?: Record<string, any>
  business_value?: Record<string, any>
  deployment_info?: Record<string, any>
  metadata?: Record<string, any>
}

export interface ServiceListResponse {
  services: Service[]
  total: number
  page: number
  limit: number
}

export const servicesApi = {
  list: async (
    vendorId?: string,
    status?: string,
    category?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ServiceListResponse> => {
    const params = new URLSearchParams()
    if (vendorId) params.append('vendor_id', vendorId)
    if (status) params.append('status', status)
    if (category) params.append('category', category)
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    const response = await api.get(`/services?${params.toString()}`)
    return response.data
  },

  get: async (id: string): Promise<Service> => {
    const response = await api.get(`/services/${id}`)
    return response.data
  },

  create: async (data: ServiceCreate): Promise<Service> => {
    const response = await api.post('/services', data)
    return response.data
  },

  update: async (id: string, data: ServiceUpdate): Promise<Service> => {
    const response = await api.patch(`/services/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/services/${id}`)
  }
}
