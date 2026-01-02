import api from './api'

export interface ComplianceCheck {
  agent_id: string
  compliance_score: number
  checks: any[]
  gaps: any[]
  recommendations: any[]
  timestamp: string
}

export interface Policy {
  id: string
  name: string
  category: string
  type: string
  region?: string
  description?: string
  version?: string
  is_active: boolean
  created_at: string
  requirements?: string[]
  rules?: Record<string, any>
  enforcement_controls?: Array<{
    control: string
    type: 'required' | 'recommended' | 'optional'
    description: string
    validation_rule?: string
  }>
  required_attributes?: Array<{
    attribute: string
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    required: boolean
    description: string
    validation?: string
  }>
  qualification_criteria?: {
    pass_threshold?: number
    checks?: Array<{
      check: string
      description: string
      required: boolean
    }>
    scoring_method?: string
  }
  applicability_criteria?: {
    data_types?: string[]
    industries?: string[]
    regions?: string[]
    data_classification?: string[]
    custom_criteria?: Record<string, any>
    description?: string
  }
}

export interface PolicyEnforcement {
  policy_id: string
  policy_name: string
  enforcement: {
    category: string
    enforcement_methods: Array<{
      method: string
      description: string
      keywords?: string[]
      min_length?: number
    }>
    measurement_criteria: Array<{
      criterion: string
      weight: number
      description: string
    }>
    scoring_method: {
      type: string
      description: string
      pass_threshold: number
      warning_threshold: number
    }
    policy_rules?: Record<string, any>
    rule_count?: number
  }
  measurement: {
    policy_name: string
    category: string
    measurement_steps: Array<{
      step: number
      name: string
      description: string
      rules?: string[]
      rag_query?: string
      requirement_count?: number
    }>
    scoring_breakdown: Record<string, {
      weight: number
      calculation: string
      max_score: number
    }>
    final_score_calculation: {
      formula: string
      result_range: string
      status_mapping: {
        pass: string
        warning: string
        fail: string
      }
    }
  }
}

export const complianceApi = {
  checkAgent: async (agentId: string): Promise<ComplianceCheck> => {
    const response = await api.post(`/compliance/agents/${agentId}/check`)
    return response.data
  },

  getChecks: async (agentId: string) => {
    const response = await api.get(`/compliance/agents/${agentId}/checks`)
    return response.data
  },

  listPolicies: async (category?: string) => {
    const response = await api.get('/compliance/policies', {
      params: { category }
    })
    return response.data
  },

  createPolicy: async (data: Partial<Policy>): Promise<Policy> => {
    const response = await api.post('/compliance/policies', data)
    return response.data
  },

  updatePolicy: async (policyId: string, data: Partial<Policy>): Promise<Policy> => {
    const response = await api.patch(`/compliance/policies/${policyId}`, data)
    return response.data
  },
  
  getPolicyEnforcement: async (policyId: string): Promise<PolicyEnforcement> => {
    const response = await api.get(`/compliance/policies/${policyId}/enforcement`)
    return response.data
  }
}

export interface BusinessRule {
  id: string
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

export const businessRulesApi = {
  listRules: async (params?: {
    is_active?: boolean
    rule_type?: string
    applicable_entity?: string
  }): Promise<BusinessRule[]> => {
    const response = await api.get('/business-rules', { params })
    return response.data
  },

  getRule: async (ruleId: string): Promise<BusinessRule> => {
    const response = await api.get(`/business-rules/${ruleId}`)
    return response.data
  },

  createRule: async (data: Partial<BusinessRule>): Promise<BusinessRule> => {
    const response = await api.post('/business-rules', data)
    return response.data
  },

  updateRule: async (ruleId: string, data: Partial<BusinessRule>): Promise<BusinessRule> => {
    const response = await api.patch(`/business-rules/${ruleId}`, data)
    return response.data
  },

  deleteRule: async (ruleId: string): Promise<void> => {
    await api.delete(`/business-rules/${ruleId}`)
  },

  getRuleEntitiesAttributes: async (): Promise<Record<string, any>> => {
    const response = await api.get('/business-rules/entities/attributes')
    return response.data
  },

  getAttributeValues: async (entity: string, attribute: string): Promise<string[]> => {
    const response = await api.get(`/business-rules/entities/${entity}/attributes/${attribute}/values`)
    return response.data
  },

  evaluateRules: async (
    context: Record<string, any>,
    entityType: string,
    screen?: string,
    ruleType?: string,
    autoExecute: boolean = true
  ): Promise<{
    matched_rules: number
    rule_results: any[]
    action_results: {
      executed: any[]
      suggested: any[]
    }
  }> => {
    const response = await api.post('/business-rules/evaluate', {
      context,
      entity_type: entityType,
      screen,
      rule_type: ruleType,
      auto_execute: autoExecute
    })
    return response.data
  },
}

