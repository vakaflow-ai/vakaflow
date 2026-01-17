import api from './api'

export interface Product {
  id: string
  vendor_id: string
  tenant_id?: string
  name: string
  product_type: string
  category?: string
  subcategory?: string
  description?: string
  version?: string
  sku?: string
  pricing_model?: string
  website?: string
  status: string
  approval_date?: string
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

export interface ProductCreate {
  vendor_id: string
  name: string
  product_type: string
  category?: string
  subcategory?: string
  description?: string
  version?: string
  sku?: string
  pricing_model?: string
  website?: string
  status?: string
  use_cases?: string
  integration_points?: Record<string, any>
  business_value?: Record<string, any>
  deployment_info?: Record<string, any>
  metadata?: Record<string, any>
}

export interface ProductUpdate {
  name?: string
  product_type?: string
  category?: string
  subcategory?: string
  description?: string
  version?: string
  sku?: string
  pricing_model?: string
  website?: string
  status?: string
  compliance_score?: number
  risk_score?: number
  use_cases?: string
  integration_points?: Record<string, any>
  business_value?: Record<string, any>
  deployment_info?: Record<string, any>
  metadata?: Record<string, any>
}

export interface ProductListResponse {
  products: Product[]
  total: number
  page: number
  limit: number
}

export const productsApi = {
  list: async (
    vendorId?: string,
    status?: string,
    category?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ProductListResponse> => {
    const params = new URLSearchParams()
    if (vendorId) params.append('vendor_id', vendorId)
    if (status) params.append('status', status)
    if (category) params.append('category', category)
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    const response = await api.get(`/products?${params.toString()}`)
    return response.data
  },

  get: async (id: string): Promise<Product> => {
    const response = await api.get(`/products/${id}`)
    return response.data
  },

  create: async (data: ProductCreate): Promise<Product> => {
    const response = await api.post('/products', data)
    return response.data
  },

  update: async (id: string, data: ProductUpdate): Promise<Product> => {
    const response = await api.patch(`/products/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`)
  },

  getAgents: async (productId: string): Promise<Array<{
    id: string
    name: string
    type: string
    category?: string
    status: string
    relationship_type?: string
  }>> => {
    const response = await api.get(`/products/${productId}/agents`)
    return response.data
  },

  tagAgent: async (productId: string, agentId: string, relationshipType?: string): Promise<void> => {
    const params = relationshipType ? `?relationship_type=${relationshipType}` : ''
    await api.post(`/products/${productId}/agents/${agentId}${params}`)
  },

  untagAgent: async (productId: string, agentId: string): Promise<void> => {
    await api.delete(`/products/${productId}/agents/${agentId}`)
  }
}
