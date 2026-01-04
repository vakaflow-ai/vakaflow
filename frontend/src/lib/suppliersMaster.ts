import api from './api'

export interface SupplierAgreement {
  id: string
  vendor_id: string
  vendor_name: string
  agreement_type: string
  title: string
  description?: string
  status: string
  effective_date?: string
  expiry_date?: string
  signed_date?: string
  renewal_date?: string
  signed_by_vendor?: string
  signed_by_tenant?: string
  pdf_file_name?: string
  pdf_file_path?: string
  pdf_file_size?: number
  pdf_uploaded_at?: string
  metadata?: Record<string, any>
  tags?: string[]
  created_at: string
  updated_at: string
}

export interface SupplierCVE {
  id: string
  vendor_id: string
  vendor_name: string
  cve_id: string
  title: string
  description?: string
  severity?: string
  cvss_score?: string
  status: string
  confirmed: boolean
  confirmed_at?: string
  affected_products?: string[]
  affected_agents?: string[]
  remediation_notes?: string
  remediation_date?: string
  mitigation_applied: boolean
  discovered_at: string
  created_at: string
  updated_at: string
}

export interface SupplierInvestigation {
  id: string
  vendor_id: string
  vendor_name: string
  title: string
  description?: string
  investigation_type: string
  status: string
  priority?: string
  assigned_to?: string
  assigned_to_name?: string
  opened_at: string
  resolved_at?: string
  findings?: string
  resolution_notes?: string
  created_at: string
  updated_at: string
}

export interface SupplierComplianceIssue {
  id: string
  vendor_id: string
  vendor_name: string
  title: string
  description?: string
  compliance_framework?: string
  requirement?: string
  severity?: string
  status: string
  identified_at: string
  target_resolution_date?: string
  resolved_at?: string
  remediation_plan?: string
  assigned_to?: string
  assigned_to_name?: string
  created_at: string
  updated_at: string
}

export interface SupplierDepartmentRelationship {
  id: string
  vendor_id: string
  vendor_name: string
  department: string
  relationship_type: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  engagement_start_date?: string
  engagement_end_date?: string
  is_active: boolean
  annual_spend?: number
  created_at: string
  updated_at: string
}

export interface SupplierOffering {
  id: string
  vendor_id: string
  vendor_name: string
  name: string
  description?: string
  category?: string
  offering_type?: string
  pricing_model?: string
  price?: number
  currency?: string
  is_active: boolean
  is_approved: boolean
  related_agent_ids?: string[]
  created_at: string
  updated_at: string
}

export interface SupplierMasterView {
  vendor: {
    id: string
    name: string
    contact_email: string
    contact_phone?: string
    address?: string
    website?: string
    description?: string
    logo_url?: string
    registration_number?: string
    compliance_score?: number
    created_at?: string
    updated_at?: string
  }
  offerings: SupplierOffering[]
  agreements: SupplierAgreement[]
  cves: SupplierCVE[]
  investigations: SupplierInvestigation[]
  compliance_issues: SupplierComplianceIssue[]
  department_relationships: SupplierDepartmentRelationship[]
  assessment_history: Array<{
    id: string
    name: string
    type?: string
    status?: string
    assigned_at?: string
    completed_at?: string
  }>
  agents: Array<{
    id: string
    name: string
    type: string
    status: string
    created_at?: string
  }>
}

export const suppliersMasterApi = {
  list: async (include_inactive?: boolean): Promise<SupplierMasterView[]> => {
    const params: any = {}
    if (include_inactive !== undefined) {
      params.include_inactive = include_inactive
    }
    const response = await api.get('/suppliers-master/list', { params })
    return response.data
  },

  get: async (vendorId: string): Promise<SupplierMasterView> => {
    const response = await api.get(`/suppliers-master/${vendorId}`)
    return response.data
  },

  createAgreement: async (vendorId: string, agreementData: {
    agreement_type: string
    title: string
    description?: string
    status?: string
    effective_date?: string
    expiry_date?: string
    signed_date?: string
    renewal_date?: string
    signed_by_vendor?: string
    signed_by_tenant?: string
    vendor_contact_email?: string
    tenant_contact_email?: string
    metadata?: Record<string, any>
    tags?: string[]
  }): Promise<SupplierAgreement> => {
    const response = await api.post('/suppliers-master/agreements', agreementData, {
      params: { vendor_id: vendorId }
    })
    return response.data
  },

  uploadAgreementPDF: async (agreementId: string, file: File): Promise<SupplierAgreement> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/suppliers-master/agreements/${agreementId}/upload-pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
}

