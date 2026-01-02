import api from './api'

export interface BusinessRule {
  id: string
  tenant_id: string
  rule_id: string
  name: string
  description?: string
  condition_expression: string
  action_expression: string
  rule_type: string
  applicable_entities?: string[]
  applicable_screens?: string[]
  action_type?: string
  action_config?: Record<string, any>
  priority: number
  is_active: boolean
  is_automatic: boolean
  created_by: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface BusinessRuleCreate {
  rule_id: string
  name: string
  description?: string
  condition_expression: string
  action_expression: string
  rule_type?: string
  applicable_entities?: string[]
  applicable_screens?: string[]
  action_type?: string
  action_config?: Record<string, any>
  priority?: number
  is_active?: boolean
  is_automatic?: boolean
}

export interface BusinessRuleUpdate {
  name?: string
  description?: string
  condition_expression?: string
  action_expression?: string
  rule_type?: string
  applicable_entities?: string[]
  applicable_screens?: string[]
  action_type?: string
  action_config?: Record<string, any>
  priority?: number
  is_active?: boolean
  is_automatic?: boolean
}

export const businessRulesApi = {
  list: async (params?: {
    skip?: number
    limit?: number
    is_active?: boolean
    rule_type?: string
    applicable_entity?: string
  }): Promise<BusinessRule[]> => {
    const response = await api.get('/business-rules', { params })
    return response.data
  },

  get: async (id: string): Promise<BusinessRule> => {
    const response = await api.get(`/business-rules/${id}`)
    return response.data
  },

  create: async (rule: BusinessRuleCreate): Promise<BusinessRule> => {
    const response = await api.post('/business-rules', rule)
    return response.data
  },

  update: async (id: string, rule: BusinessRuleUpdate): Promise<BusinessRule> => {
    const response = await api.patch(`/business-rules/${id}`, rule)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/business-rules/${id}`)
  },
}

