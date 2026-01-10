import api from './api'

export interface SectionDefinition {
  id: string
  title: string
  order: number
  fields: string[]
  description?: string
  required_fields?: string[] // Names of required fields in this section
}

export interface FieldDependency {
  depends_on: string
  condition: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
  value?: any
}

export interface CustomField {
  id?: string // ID for catalog fields
  field_name: string
  field_type: 'file_upload' | 'external_link' | 'text' | 'textarea' | 'select' | 'multi_select' | 'number' | 'date' | 'email' | 'url' | 'mermaid_diagram' | 'json' | 'rich_text' | 'architecture_diagram' | 'visualization' | 'dependent_select' | 'assessment_response_grid'
  label: string
  description?: string
  placeholder?: string
  is_required?: boolean
  accepted_file_types?: string
  link_text?: string
  // Data binding for dropdowns/selects
  master_data_list_id?: string  // ID of master data list to bind to
  options?: Array<{ value: string; label: string }>  // Static options (if not using master data)
  // Role-based permissions
  role_permissions?: Record<string, { view: boolean; edit: boolean }>  // { role: { view: boolean, edit: boolean } }
  created_at?: string
  updated_at?: string
}

export interface FormLayout {
  id: string
  tenant_id: string
  name: string
  request_type: 'agent_onboarding_workflow' | 'vendor_submission_workflow' | 'assessment_workflow'
  workflow_stage: 'new' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected' | 'closed' | 'cancelled' | 'pending_review' | 'needs_revision' // DEPRECATED: Use layout_type instead
  layout_type?: 'submission' | 'approver' | 'completed' // Simplified layout type: 'submission' (for submission/rejection) or 'approver' (for approval/completed). 'completed' is deprecated and maps to 'approver'.
  description?: string
  servicenow_table?: string
  servicenow_state_mapping?: Record<string, number>
  sections: SectionDefinition[]
  agent_type?: string
  agent_category?: string
  field_dependencies?: Record<string, FieldDependency>
  custom_field_ids?: string[] // Array of CustomFieldCatalog UUIDs (preferred - no duplication)
  custom_fields?: CustomField[] // Resolved from catalog (for backward compatibility and display)
  is_active: boolean
  is_default: boolean
  is_template: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface FormLayoutCreate {
  name: string
  request_type?: 'agent_onboarding_workflow' | 'vendor_submission_workflow' | 'assessment_workflow' // Optional - if not provided, saves to Forms entity (workflow-agnostic)
  workflow_stage?: 'new' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected' | 'closed' | 'cancelled' | 'pending_review' | 'needs_revision' // DEPRECATED: Use layout_type instead
  layout_type?: 'submission' | 'approver' | 'completed' // Simplified layout type: 'submission' (for submission/rejection) or 'approver' (for approval/completed). 'completed' is deprecated and maps to 'approver'.
  description?: string
  servicenow_table?: string
  servicenow_state_mapping?: Record<string, number>
  sections: SectionDefinition[]
  agent_type?: string
  agent_category?: string
  field_dependencies?: Record<string, FieldDependency>
  custom_field_ids?: string[] // Array of CustomFieldCatalog UUIDs (preferred - no duplication)
  custom_fields?: CustomField[] // DEPRECATED: Use custom_field_ids instead
  is_default?: boolean
  is_template?: boolean
}

export interface FormLayoutUpdate {
  name?: string
  description?: string
  workflow_stage?: 'new' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected' | 'closed' | 'cancelled' | 'pending_review' | 'needs_revision' // DEPRECATED: Use layout_type instead
  layout_type?: 'submission' | 'approver' | 'completed' // Simplified layout type: 'submission' (for submission/rejection) or 'approver' (for approval/completed). 'completed' is deprecated and maps to 'approver'.
  sections?: SectionDefinition[]
  servicenow_table?: string
  servicenow_state_mapping?: Record<string, number>
  agent_type?: string
  agent_category?: string
  custom_field_ids?: string[] // Array of CustomFieldCatalog UUIDs (preferred - no duplication)
  custom_fields?: CustomField[] // DEPRECATED: Use custom_field_ids instead
  is_active?: boolean
  is_default?: boolean
  is_template?: boolean
}

export interface RolePermission {
  view: boolean
  edit: boolean
}

export interface FieldAccess {
  id: string
  tenant_id: string
  field_name: string
  field_source: 'submission_requirement' | 'agent'
  field_source_id?: string
  request_type: 'agent_onboarding_workflow' | 'vendor_submission_workflow' | 'assessment_workflow'
  workflow_stage: 'new' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected' | 'closed' | 'cancelled' | 'pending_review' | 'needs_revision'
  role_permissions: Record<string, RolePermission>
  agent_type?: string
  agent_category?: string
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface FieldAccessCreate {
  field_name: string
  field_source: 'submission_requirement' | 'agent'
  field_source_id?: string
  request_type: 'agent_onboarding_workflow' | 'vendor_submission_workflow' | 'assessment_workflow'
  workflow_stage: 'new' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected' | 'closed' | 'cancelled' | 'pending_review' | 'needs_revision'
  role_permissions: Record<string, RolePermission>
  agent_type?: string
  agent_category?: string
}

export interface FieldAccessUpdate {
  role_permissions?: Record<string, RolePermission>
  agent_type?: string
  agent_category?: string
  is_active?: boolean
}

export interface FieldAccessForRole {
  field_name: string
  can_view: boolean
  can_edit: boolean
  field_source: 'submission_requirement' | 'agent'
  field_source_id?: string
}

export interface AgentFieldDefinition {
  field_name: string
  field_type: string
  label: string
  description?: string
  source: string
  entity_user_level?: 'business' | 'advanced' | 'system'
  entity_name?: string
  entity_label?: string
  field_config?: Record<string, any>  // Add field_config to interface
}

export interface AvailableFields {
  submission_requirements: AgentFieldDefinition[]
  agent: AgentFieldDefinition[]
  agent_metadata: AgentFieldDefinition[]
  custom_fields?: AgentFieldDefinition[]
  entity_fields?: Record<string, AgentFieldDefinition[]>
  master_data?: AgentFieldDefinition[]
  entity_business_owner?: AgentFieldDefinition[]
  logged_in_user?: AgentFieldDefinition[]
  workflow_ticket?: AgentFieldDefinition[]
}

export interface WorkflowLayoutGroup {
  id: string
  tenant_id: string
  name: string
  request_type: string
  workflow_config_id?: string  // Business process to workflow mapping
  description?: string
  covered_entities: string[]
  stage_mappings: Record<string, { layout_id: string; name: string }>
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowLayoutGroupCreate {
  name: string
  request_type: string
  description?: string
  covered_entities: string[]
  stage_mappings?: Record<string, { layout_id: string; name: string }>
  is_default?: boolean
}

export interface WorkflowLayoutGroupUpdate {
  name?: string
  request_type?: string  // Allow updating workflow context
  workflow_config_id?: string  // Business process to workflow mapping
  description?: string
  covered_entities?: string[]
  stage_mappings?: Record<string, { layout_id: string; name: string }>
  is_active?: boolean
  is_default?: boolean
}

export const formLayoutsApi = {
  // Layout CRUD
  list: async (requestType?: string, agentType?: string, isActive?: boolean): Promise<FormLayout[]> => {
    const params: any = {}
    if (requestType) params.request_type = requestType
    if (agentType) params.agent_type = agentType
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get('/form-layouts', { params })
    return response.data
  },

  get: async (id: string): Promise<FormLayout> => {
    const response = await api.get(`/form-layouts/${id}`)
    return response.data
  },

  create: async (layout: FormLayoutCreate): Promise<FormLayout> => {
    const response = await api.post('/form-layouts', layout)
    return response.data
  },

  update: async (id: string, layout: FormLayoutUpdate): Promise<FormLayout> => {
    const response = await api.patch(`/form-layouts/${id}`, layout)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/form-layouts/${id}`)
  },

  getActiveForScreen: async (
    requestType: string,
    workflowStage: string = 'new',
    agentType?: string,
    agentCategory?: string
  ): Promise<FormLayout> => {
    const params: any = {}
    if (agentType) params.agent_type = agentType
    if (agentCategory) params.agent_category = agentCategory
    const response = await api.get(`/form-layouts/request-type/${requestType}/workflow-stage/${workflowStage}/active`, { params })
    return response.data
  },

  // Workflow Layout Group (FormType) CRUD
  listGroups: async (requestType?: string, isActive?: boolean): Promise<WorkflowLayoutGroup[]> => {
    const params: any = {}
    if (requestType) params.request_type = requestType
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get('/form-layouts/groups', { params })
    return response.data
  },

  getGroup: async (id: string): Promise<WorkflowLayoutGroup> => {
    const response = await api.get(`/form-layouts/groups/${id}`)
    return response.data
  },

  createGroup: async (group: WorkflowLayoutGroupCreate): Promise<WorkflowLayoutGroup> => {
    const response = await api.post('/form-layouts/groups', group)
    return response.data
  },

  updateGroup: async (id: string, group: WorkflowLayoutGroupUpdate): Promise<WorkflowLayoutGroup> => {
    const response = await api.patch(`/form-layouts/groups/${id}`, group)
    return response.data
  },

  deleteGroup: async (id: string): Promise<void> => {
    await api.delete(`/form-layouts/groups/${id}`)
  },

  // Form Library (Templates)
  getLibrary: async (): Promise<FormLayout[]> => {
    const response = await api.get('/form-layouts/library')
    return response.data
  },

  // Field Access CRUD
  listFieldAccess: async (
    requestType?: string,
    workflowStage?: string,
    fieldName?: string,
    isActive?: boolean
  ): Promise<FieldAccess[]> => {
    const params: any = {}
    if (requestType) params.request_type = requestType
    if (workflowStage) params.workflow_stage = workflowStage
    if (fieldName) params.field_name = fieldName
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get('/form-layouts/field-access', { params })
    return response.data
  },

  createFieldAccess: async (access: FieldAccessCreate): Promise<FieldAccess> => {
    const response = await api.post('/form-layouts/field-access', access)
    return response.data
  },

  updateFieldAccess: async (id: string, access: FieldAccessUpdate): Promise<FieldAccess> => {
    const response = await api.patch(`/form-layouts/field-access/${id}`, access)
    return response.data
  },

  getFieldsWithAccessForRole: async (
    requestType: string,
    role?: string,
    agentType?: string,
    workflowStage: string = 'new'
  ): Promise<FieldAccessForRole[]> => {
    const params: any = {
      workflow_stage: workflowStage
    }
    if (role) params.role = role
    if (agentType) params.agent_type = agentType
    const response = await api.get(`/form-layouts/request-type/${requestType}/fields-with-access`, { params })
    return response.data
  },

  // Get all available fields from database
  getAvailableFields: async (): Promise<AvailableFields> => {
    const response = await api.get('/form-layouts/available-fields')
    return response.data
  },

  // Get workflow types from master data
  getWorkflowTypes: async (): Promise<Array<{ value: string; label: string; order: number; is_active: boolean; selection_type?: 'single' | 'multi' }>> => {
    const response = await api.get('/form-layouts/workflow-types')
    return response.data
  },

  // Cleanup multiple defaults - ensure only one default per request_type
  cleanupDefaults: async (): Promise<{ message: string; fixed_count: number }> => {
    const response = await api.post('/form-layouts/cleanup-defaults')
    return response.data
  },
}
