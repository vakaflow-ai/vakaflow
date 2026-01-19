import api from './api'

export interface GovernanceEntity {
  id: string
  tenant_id: string
  vendor_id: string
  name: string
  entity_type: 'agent' | 'product' | 'service'
  category?: string
  subcategory?: string
  description?: string
  version?: string
  status: string
  department?: string
  organization?: string
  service_account?: string
  kill_switch_enabled: boolean
  last_governance_review?: string
  governance_owner_id?: string
  skills?: string[]
  compliance_score?: number
  risk_score?: number
  security_controls?: string[]
  compliance_standards?: string[]
  documentation_urls?: Record<string, string>
  architecture_diagrams?: string[]
  landscape_diagrams?: string[]
  related_entity_ids?: string[]
  submission_date?: string
  approval_date?: string
  activation_date?: string
  created_at: string
  updated_at?: string
  vendor_name?: string
  governance_owner_name?: string
}

export interface GovernanceProfile {
  id: string
  tenant_id: string
  name: string
  profile_type: string
  description?: string
  security_controls?: string[]
  compliance_standards?: string[]
  monitoring_requirements?: string[]
  documentation_templates?: Record<string, string>
  entity_count: number
  last_applied?: string
  created_by?: string
  created_at: string
  updated_at?: string
}

export interface StudioDashboard {
  total_entities: number
  entities_by_type: Record<string, number>
  entities_by_status: Record<string, number>
  entities_by_department: Record<string, number>
  entities_by_risk_level: Record<string, number>
  compliance_summary: {
    average_compliance_score: number
    fully_compliant_count: number
    needs_attention_count: number
  }
  recent_activities: Array<{
    timestamp: string
    entity_name: string
    entity_type: string
    event_type: string
    status_change: string
    triggered_by: string | null
  }>
  governance_alerts: Array<{
    type: string
    title: string
    message: string
    count: number
    severity: string
  }>
  upcoming_reviews: Array<{
    entity_id: string
    entity_name: string
    entity_type: string
    last_review: string
    days_until_due: number
  }>
}

export interface GovernanceEntityCreate {
  name: string
  entity_type: 'agent' | 'product' | 'service'
  category?: string
  subcategory?: string
  description?: string
  version?: string
  department?: string
  organization?: string
  governance_owner_id?: string
  skills?: string[]
  service_account?: string
  kill_switch_enabled?: boolean
  compliance_standards?: string[]
  security_controls?: string[]
  documentation_urls?: Record<string, string>
  architecture_diagrams?: string[]
  landscape_diagrams?: string[]
}

export interface GovernanceEntityUpdate {
  name?: string
  category?: string
  subcategory?: string
  description?: string
  version?: string
  department?: string
  organization?: string
  governance_owner_id?: string
  skills?: string[]
  service_account?: string
  kill_switch_enabled?: boolean
  compliance_standards?: string[]
  security_controls?: string[]
  documentation_urls?: Record<string, string>
  architecture_diagrams?: string[]
  landscape_diagrams?: string[]
  status?: string
}

export interface GovernanceProfileCreate {
  name: string
  profile_type: string
  description?: string
  security_controls?: string[]
  compliance_standards?: string[]
  monitoring_requirements?: string[]
  documentation_templates?: Record<string, string>
}

class AgentStudioApi {
  async getDashboard(tenantId: string): Promise<StudioDashboard> {
    const response = await api.get(`/agent-studio/dashboard`)
    return response.data
  }

  async listEntities(params?: {
    entity_types?: string
    statuses?: string
    department?: string
    organization?: string
    search?: string
  }): Promise<GovernanceEntity[]> {
    const response = await api.get('/agent-studio/entities', { params })
    return response.data
  }

  async getEntity(entityId: string): Promise<GovernanceEntity> {
    const response = await api.get(`/agent-studio/entities/${entityId}`)
    return response.data
  }

  async createEntity(data: GovernanceEntityCreate): Promise<GovernanceEntity> {
    const response = await api.post('/agent-studio/entities', data)
    return response.data
  }

  async updateEntity(entityId: string, data: GovernanceEntityUpdate): Promise<GovernanceEntity> {
    const response = await api.patch(`/agent-studio/entities/${entityId}`, data)
    return response.data
  }

  async updateEntityStatus(
    entityId: string, 
    status: string, 
    reason?: string, 
    workflow_step?: string
  ): Promise<{ message: string; entity_id: string; new_status: string }> {
    const response = await api.patch(`/agent-studio/entities/${entityId}/status`, {
      status,
      reason,
      workflow_step
    })
    return response.data
  }

  async listProfiles(profileType?: string): Promise<GovernanceProfile[]> {
    const params = profileType ? { profile_type: profileType } : {}
    const response = await api.get('/agent-studio/profiles', { params })
    return response.data
  }

  async createProfile(data: GovernanceProfileCreate): Promise<GovernanceProfile> {
    const response = await api.post('/agent-studio/profiles', data)
    return response.data
  }

  async applyProfile(entityId: string, profileId: string): Promise<{ 
    message: string; 
    entity_id: string; 
    profile_id: string 
  }> {
    const response = await api.post(`/agent-studio/entities/${entityId}/apply-profile/${profileId}`)
    return response.data
  }

  async getLifecycleHistory(entityId: string): Promise<any[]> {
    const response = await api.get(`/agent-studio/entities/${entityId}/lifecycle-history`)
    return response.data
  }
}

export const agentStudioApi = new AgentStudioApi()