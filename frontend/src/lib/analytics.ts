import api from './api'

export interface DashboardStats {
  total_agents: number
  agents_by_status: Record<string, number>
  total_reviews: number
  reviews_by_stage: Record<string, number>
  compliance_score_avg?: number
  agents_by_type: Record<string, number>
  recent_activity: any[]
}

export interface TimeSeriesData {
  date: string
  value: number
}

export interface AnalyticsResponse {
  stats: DashboardStats
  agent_trends: TimeSeriesData[]
  review_trends: TimeSeriesData[]
  compliance_trends: TimeSeriesData[]
}

export interface AIPostureDashboard {
  model_usage: Record<string, Record<string, number>>
  total_models_in_use: number
  unique_vendors: number
  risk_distribution: Record<string, number>
  risk_by_model: Record<string, {
    avg_risk: number
    count: number
    agents: Array<{ id: string; name: string; risk_score: number }>
  }>
  high_risk_agents: Array<{
    id: string
    name: string
    risk_score: number
    compliance_score?: number
    llm_vendor?: string
    llm_model?: string
    status: string
  }>
  compliance_distribution: Record<string, number>
  compliance_by_model: Record<string, {
    avg_compliance: number
    count: number
    agents: Array<{ id: string; name: string; compliance_score: number }>
  }>
  compliance_checks_summary: Record<string, number>
  active_compliance_frameworks: string[]
  deployment_distribution: Record<string, number>
  deployment_by_model: Record<string, Record<string, number>>
  data_sharing_analysis: {
    pii_sharing: number
    phi_sharing: number
    financial_data_sharing: number
    biometric_data_sharing: number
    total_agents_with_data_sharing: number
  }
  data_classification_heatmap: Array<{
    agent_id: string
    agent_name: string
    llm_vendor?: string
    llm_model?: string
    pii: boolean
    phi: boolean
    financial: boolean
    biometric: boolean
    risk_score?: number
    compliance_score?: number
  }>
  integration_connections: {
    total_connections: number
    by_type: Record<string, number>
    encrypted_connections: number
    active_connections: number
  }
  connection_types: Record<string, number>
  overall_posture: {
    posture_score: number
    avg_risk_score?: number
    avg_compliance_score?: number
    total_agents: number
    approved_agents: number
    in_review_agents: number
    posture_level: string
  }
  posture_trends: Array<{
    date: string
    posture_score: number
    avg_risk?: number
    avg_compliance?: number
    agent_count: number
  }>
  agents_by_status: Record<string, number>
  agents_by_category: Record<string, number>
  cost_analytics: {
    total_cost: number
    cost_by_model: Record<string, number>
    cost_by_agent: Record<string, { cost: number; requests: number; tokens: number }>
    cost_trends: Array<{ date: string; cost: number; requests: number }>
    monthly_cost: number
    daily_cost: number
  }
  prompt_usage: {
    total_requests: number
    total_tokens: number
    requests_by_model: Record<string, number>
    tokens_by_model: Record<string, number>
    usage_trends: Array<{ date: string; requests: number; tokens: number }>
  }
  usage_by_role: Record<string, { requests: number; cost: number; tokens: number }>
  usage_by_department: Record<string, { requests: number; cost: number; tokens: number; user_count: number }>
}

export const analyticsApi = {
  getDashboard: async (days = 30): Promise<AnalyticsResponse> => {
    const response = await api.get('/analytics/dashboard', {
      params: { days }
    })
    return response.data
  },

  getAgentReport: async (startDate?: string, endDate?: string, statusFilter?: string) => {
    const response = await api.get('/analytics/reports/agents', {
      params: { start_date: startDate, end_date: endDate, status_filter: statusFilter }
    })
    return response.data
  },

  getAIPosture: async (): Promise<AIPostureDashboard> => {
    const response = await api.get('/analytics/ai-posture')
    return response.data
  },

  getEcosystemMap: async (
    loadStep: number = 5,
    filterBy?: string,
    filterValue?: string
  ): Promise<{
    nodes: Array<{
      id: string
      label: string
      type: 'customer' | 'vendor' | 'llm_provider' | 'agent' | 'system'
      metadata: Record<string, any>
    }>
    links: Array<{
      source: string
      target: string
      type: string
      metadata: Record<string, any>
    }>
  }> => {
    const params: any = { load_step: loadStep }
    if (filterBy) params.filter_by = filterBy
    if (filterValue) params.filter_value = filterValue
    
    const response = await api.get('/analytics/ecosystem-map', { params })
    return response.data
  }
}

