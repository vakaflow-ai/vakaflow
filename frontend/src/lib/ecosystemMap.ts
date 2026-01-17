import api from './api'

export interface NetworkGraphNode {
  id: string
  label: string
  type: string
  data: Record<string, any>
}

export interface NetworkGraphEdge {
  source: string
  target: string
  type: string
  label: string
}

export interface NetworkGraphData {
  nodes: NetworkGraphNode[]
  edges: NetworkGraphEdge[]
}

export interface LandscapePosition {
  id: string
  entity_type: string
  entity_id: string
  category: string
  subcategory?: string
  quadrant?: string
  position_x?: number
  position_y?: number
  capability_score?: number
  business_value_score?: number
  maturity_score?: number
  risk_score?: number
}

export interface LandscapeQuadrantData {
  positions: LandscapePosition[]
  category?: string
}

export interface DependencyGraphData {
  nodes: NetworkGraphNode[]
  edges: NetworkGraphEdge[]
}

export interface RiskHeatmapData {
  heatmap_data: Array<{
    entity_type: string
    entity_id: string
    name: string
    category?: string
    risk_score?: number
    compliance_score?: number
  }>
}

export interface EcosystemSummary {
  total_vendors: number
  total_agents: number
  total_products: number
  total_services: number
  risk_distribution: {
    high: number
    medium: number
    low: number
  }
}

export const ecosystemMapApi = {
  getNetworkGraph: async (): Promise<NetworkGraphData> => {
    const response = await api.get('/ecosystem-map/network')
    return response.data
  },

  getLandscapeQuadrant: async (category?: string): Promise<LandscapeQuadrantData> => {
    const params = new URLSearchParams()
    if (category) params.append('category', category)
    const response = await api.get(`/ecosystem-map/landscape?${params.toString()}`)
    return response.data
  },

  getDependencyGraph: async (): Promise<DependencyGraphData> => {
    const response = await api.get('/ecosystem-map/dependencies')
    return response.data
  },

  getRiskHeatmap: async (): Promise<RiskHeatmapData> => {
    const response = await api.get('/ecosystem-map/risk-heatmap')
    return response.data
  },

  getSummary: async (): Promise<EcosystemSummary> => {
    const response = await api.get('/ecosystem-map/summary')
    return response.data
  }
}
