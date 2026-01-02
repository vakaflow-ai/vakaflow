import api from './api'

export interface SecurityIncident {
  id: string
  tenant_id?: string
  incident_type: 'cve' | 'data_breach' | 'security_alert' | 'vulnerability'
  external_id: string
  title: string
  description?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  cvss_score?: number
  cvss_vector?: string
  affected_products?: string[]
  affected_vendors?: string[]
  source: string
  source_url?: string
  published_date?: string
  status: string
  acknowledged_by?: string
  acknowledged_at?: string
  ignored_by?: string
  ignored_at?: string
  cleared_by?: string
  cleared_at?: string
  action_notes?: string
  created_at: string
  updated_at: string
  incident_metadata?: {
    cve_id?: string
    solutions?: Array<{
      text: string
      organization?: string
      last_modified?: string
    }>
    workarounds?: Array<{
      text: string
      organization?: string
      last_modified?: string
    }>
    remediation_info?: {
      recommended_version?: string
      vendor_comment?: {
        text: string
        organization?: string
        last_modified?: string
      }
    }
    product_details?: Array<{
      vendor?: string
      product: string
      version?: string
      version_range?: {
        start?: string
        end?: string
      }
      vulnerable: boolean
    }>
    patch_urls?: Array<{
      url: string
      tags?: string[]
      source?: string
    }>
    advisory_urls?: Array<{
      url: string
      tags?: string[]
      source?: string
    }>
    raw_cve_data?: any
  }
}

export interface VendorSecurityTracking {
  id: string
  tenant_id?: string
  vendor_id: string
  incident_id: string
  match_confidence: number
  match_method: string
  match_details?: any
  risk_qualification_status: string
  risk_level?: string
  risk_assessment?: any
  status: string
  resolution_type?: string
  resolution_notes?: string
  created_at: string
  vendor_name?: string
}

export interface MonitoringConfig {
  id: string
  tenant_id: string
  cve_monitoring_enabled: boolean
  cve_scan_frequency: string
  cve_severity_threshold: string
  cve_cvss_threshold: number
  breach_monitoring_enabled: boolean
  auto_create_tasks: boolean
  auto_send_alerts: boolean
  auto_trigger_assessments: boolean
  auto_start_workflows: boolean
  min_match_confidence: number
}

export interface MonitoringConfigUpdate {
  cve_monitoring_enabled?: boolean
  cve_scan_frequency?: string
  cve_severity_threshold?: string
  cve_cvss_threshold?: number
  breach_monitoring_enabled?: boolean
  auto_create_tasks?: boolean
  auto_send_alerts?: boolean
  auto_trigger_assessments?: boolean
  auto_start_workflows?: boolean
  min_match_confidence?: number
}

export interface RiskAssessmentUpdate {
  risk_assessment: Record<string, any>
  risk_level: 'low' | 'medium' | 'high' | 'critical'
}

export interface ResolutionUpdate {
  resolution_type: 'resolved' | 'false_positive' | 'not_applicable'
  resolution_notes?: string
}

export interface IncidentActionRequest {
  action: 'acknowledge' | 'track' | 'ignore' | 'clear' | 'reopen'
  notes?: string
}

export interface IncidentActionHistory {
  id: string
  incident_id: string
  action: string
  performed_by: string
  performed_at: string
  notes?: string
  previous_status?: string
  new_status?: string
  action_metadata?: any
  created_at: string
}

export const securityIncidentsApi = {
  list: async (
    incidentType?: string,
    severity?: string,
    status?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ incidents: SecurityIncident[]; total: number; limit: number; offset: number }> => {
    const params: any = { limit, offset }
    if (incidentType) params.incident_type = incidentType
    if (severity) params.severity = severity
    if (status) params.status = status
    const response = await api.get('/security-incidents', { params })
    return response.data
  },

  get: async (incidentId: string): Promise<SecurityIncident> => {
    const response = await api.get(`/security-incidents/${incidentId}`)
    return response.data
  },

  getVendorTrackings: async (
    vendorId: string,
    status?: string,
    riskStatus?: string
  ): Promise<VendorSecurityTracking[]> => {
    const params: any = {}
    if (status) params.status = status
    if (riskStatus) params.risk_status = riskStatus
    const response = await api.get(`/security-incidents/vendors/${vendorId}/trackings`, { params })
    return response.data
  },

  updateTrackingRisk: async (
    trackingId: string,
    riskData: RiskAssessmentUpdate
  ): Promise<VendorSecurityTracking> => {
    const response = await api.post(`/security-incidents/trackings/${trackingId}/risk`, riskData)
    return response.data
  },

  resolveTracking: async (
    trackingId: string,
    resolutionData: ResolutionUpdate
  ): Promise<VendorSecurityTracking> => {
    const response = await api.post(`/security-incidents/trackings/${trackingId}/resolve`, resolutionData)
    return response.data
  },

  getMonitoringConfig: async (): Promise<MonitoringConfig> => {
    const response = await api.get('/security-incidents/monitoring/config')
    return response.data
  },

  updateMonitoringConfig: async (config: MonitoringConfigUpdate): Promise<MonitoringConfig> => {
    const response = await api.put('/security-incidents/monitoring/config', config)
    return response.data
  },

  scanCVEs: async (daysBack: number = 7): Promise<{ scanned: number; matched_vendors: number; message: string }> => {
    const response = await api.post('/security-incidents/scan', null, {
      params: { days_back: daysBack }
    })
    return response.data
  },

  performAction: async (incidentId: string, action: IncidentActionRequest): Promise<SecurityIncident> => {
    const response = await api.post(`/security-incidents/${incidentId}/actions`, action)
    return response.data
  },

  getActionHistory: async (incidentId: string, limit: number = 50): Promise<IncidentActionHistory[]> => {
    const response = await api.get(`/security-incidents/${incidentId}/history`, { params: { limit } })
    return response.data
  },

  getIncidentTrackings: async (incidentId: string): Promise<VendorSecurityTracking[]> => {
    const response = await api.get(`/security-incidents/${incidentId}/trackings`)
    return response.data
  },
}

