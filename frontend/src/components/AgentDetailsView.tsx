import { useState } from 'react'
import { Agent } from '../lib/agents'
import { agentsApi } from '../lib/agents'
import ConnectionDiagram from './ConnectionDiagram'
import MermaidDiagram from './MermaidDiagram'
import { showToast } from '../utils/toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ViewStructure } from '../lib/workflowOrchestration'
import { MaterialCard, MaterialButton, MaterialChip, MaterialInput } from './material'
import { PencilIcon, CheckIcon, XIcon, ShieldCheckIcon } from './Icons'

interface AgentDetailsViewProps {
  agent: Agent
  showAllSections?: boolean
  onDiagramUpdate?: () => void
  canEditDiagram?: boolean
  visibleFields?: string[] // Fields to show based on workflow stage settings
  editableFields?: Record<string, boolean> // Map of field_name -> can_edit
  onFieldUpdate?: () => void // Callback when a field is updated
  sections?: ViewStructure['sections'] // Sections from layout configuration (optional - for dynamic rendering)
}

export default function AgentDetailsView({ 
  agent, 
  onDiagramUpdate,
  canEditDiagram = false,
  visibleFields,
  editableFields = {},
  onFieldUpdate,
  sections
}: AgentDetailsViewProps) {
  const queryClient = useQueryClient()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  
  const updateAgentMutation = useMutation({
    mutationFn: (data: Partial<Agent>) => agentsApi.update(agent.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agent.id] })
      if (onFieldUpdate) onFieldUpdate()
      showToast.success('Field updated successfully')
      setEditingField(null)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to update field'
      showToast.error(errorMessage)
    }
  })
  
  const canEditField = (fieldName: string): boolean => {
    return editableFields[fieldName] === true
  }
  
  const startEditing = (fieldName: string, currentValue: string) => {
    if (!canEditField(fieldName)) return
    setEditingField(fieldName)
    setEditValue(currentValue || '')
  }
  
  const cancelEditing = () => {
    setEditingField(null)
    setEditValue('')
  }
  
  const saveField = (fieldName: string) => {
    const updateData: any = {}
    
    // Map field names to agent API field names
    const fieldMapping: Record<string, string> = {
      'name': 'name',
      'type': 'type',
      'version': 'version',
      'category': 'category',
      'subcategory': 'subcategory',
      'description': 'description',
      'llm_vendor': 'llm_vendor',
      'llm_model': 'llm_model',
      'deployment_type': 'deployment_type',
      'data_usage_purpose': 'data_usage_purpose'
    }
    
    const apiFieldName = fieldMapping[fieldName] || fieldName
    updateData[apiFieldName] = editValue
    
    updateAgentMutation.mutate(updateData)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent, fieldName: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveField(fieldName)
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }
  
  const renderEditableField = (
    fieldName: string,
    value: string | number | null | undefined,
    fieldType: 'text' | 'textarea' = 'text',
    className: string = ''
  ) => {
    const isEditing = editingField === fieldName
    const canEdit = canEditField(fieldName)
    const displayValue = value?.toString() || 'N/A'
    
    if (isEditing) {
      return (
        <div className="space-y-3">
          {fieldType === 'textarea' ? (
            <MaterialInput
              label={fieldName}
              multiline
              rows={4}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, fieldName)}
              autoFocus
            />
          ) : (
            <MaterialInput
              label={fieldName}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, fieldName)}
              autoFocus
            />
          )}
          <div className="flex gap-2">
            <MaterialButton
              onClick={() => saveField(fieldName)}
              disabled={updateAgentMutation.isPending}
              size="small"
              startIcon={<CheckIcon className="w-3 h-3" />}
            >
              {updateAgentMutation.isPending ? 'Saving...' : 'Save'}
            </MaterialButton>
            <MaterialButton
              variant="text"
              onClick={cancelEditing}
              disabled={updateAgentMutation.isPending}
              size="small"
              className="text-gray-600"
              startIcon={<XIcon className="w-3 h-3" />}
            >
              Cancel
            </MaterialButton>
          </div>
        </div>
      )
    }
    
    return (
      <div className="group relative">
        <dd 
          className={`text-body font-medium text-gray-900 ${canEdit ? 'cursor-pointer hover:bg-primary-50/50 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors' : ''} ${className}`}
          onClick={() => canEdit && startEditing(fieldName, displayValue)}
        >
          {displayValue}
        </dd>
        {canEdit && (
          <button
            onClick={() => startEditing(fieldName, displayValue)}
            className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 transition-all p-1 text-primary-500 hover:text-blue-600"
            title="Click to edit"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }
  const architectureInfo = agent.architecture_info || {}
  const dataSharingScope = agent.data_sharing_scope || {}
  const versionInfo = agent.version_info || {}
  
  // Helper to get field value from agent data (handles nested structures and agent_metadata fields)
  const getFieldValue = (fieldName: string): any => {
    // Agent metadata fields are already flattened in the API response
    // These include: llm_vendor, llm_model, regions, capabilities, data_types, 
    // integrations, dependencies, use_cases, features, personas, version_info,
    // deployment_type, data_sharing_scope, data_usage_purpose, architecture_info
    
    // Try direct property first (this includes flattened agent_metadata fields)
    if ((agent as any)[fieldName] !== undefined) {
      return (agent as any)[fieldName]
    }

    // Try nested in architecture_info
    if ((architectureInfo as any)[fieldName] !== undefined) {
      return (architectureInfo as any)[fieldName]
    }
    // Try nested in data_sharing_scope
    if ((dataSharingScope as any)[fieldName] !== undefined) {
      return (dataSharingScope as any)[fieldName]
    }
    // Try nested in version_info
    if ((versionInfo as any)[fieldName] !== undefined) {
      return (versionInfo as any)[fieldName]
    }
    // Try nested paths for complex fields
    const nestedPaths = [
      `architecture_info.${fieldName}`,
      `data_sharing_scope.${fieldName}`,
      `version_info.${fieldName}`
    ]
    for (const path of nestedPaths) {
      const parts = path.split('.')
      let value: any = agent
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part]
        } else {
          value = undefined
          break
        }
      }
      if (value !== undefined) {
        return value
      }
    }
    return null
  }
  
  // Helper to check if a field/section should be visible
  const isFieldVisible = (fieldName: string): boolean => {
    if (!visibleFields || visibleFields.length === 0) {
      return true // Show all fields if no filter specified
    }
    return visibleFields.includes(fieldName)
  }
  
  // Helper to check if a section should be shown
  const shouldShowSection = (fieldNames: string[]): boolean => {
    if (!visibleFields || visibleFields.length === 0) {
      return true
    }
    return fieldNames.some(field => visibleFields.includes(field))
  }
  
  // Format display value for arrays and objects
  const formatDisplayValue = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A'
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'N/A'
    }
    if (typeof value === 'object') {
      // Handle special objects like data_sharing_scope
      if (value.shares_pii !== undefined) {
        // This is a data sharing scope object
        const parts: string[] = []
        if (value.shares_pii) parts.push('PII')
        if (value.shares_phi) parts.push('PHI')
        if (value.shares_financial_data) parts.push('Financial Data')
        if (value.shares_biometric_data) parts.push('Biometric Data')
        return parts.length > 0 ? parts.join(', ') : 'None'
      }
      return JSON.stringify(value, null, 2)
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No'
    }
    return String(value)
  }
  
  // Render a field dynamically based on its configuration
  const renderDynamicField = (field: { field_name: string; label: string; can_view: boolean; can_edit: boolean; is_required: boolean; field_type: string }, index: number) => {
    const fieldName = field.field_name
    const fieldValue = getFieldValue(fieldName)
    const displayValue = formatDisplayValue(fieldValue)
    
    // Don't render if field has no value and it's not a required field
    if (!fieldValue && !field.is_required && displayValue === 'N/A') {
      return null
    }
    
    // Handle special field types
    if (field.field_type === 'textarea' || fieldName === 'description' || fieldName === 'data_usage_purpose') {
      return (
        <div key={`${fieldName}-${index}`} className="md:col-span-2">
          <dt className="text-muted-foreground mb-1">{field.label}</dt>
          {renderEditableField(fieldName, fieldValue, 'textarea')}
        </div>
      )
    }
    
    // Handle status field specially
    if (fieldName === 'status') {
      return (
        <div key={`${fieldName}-${index}`}>
          <dt className="text-sm font-medium text-gray-500 tracking-tight mb-1">Status</dt>
          <dd>
            <MaterialChip 
              label={agent.status.replace(/_/g, ' ')} 
              color={
                agent.status === 'approved' ? 'success' :
                agent.status === 'rejected' ? 'error' :
                agent.status === 'in_review' ? 'warning' :
                'default'
              }
              size="small"
              variant="filled"
              className="font-medium text-xs"
            />
          </dd>
        </div>
      )
    }
    
    // Handle array fields (capabilities, features, use_cases, data_types, regions)
    if (Array.isArray(fieldValue) && fieldValue.length > 0) {
      if (fieldName === 'capabilities' || fieldName === 'features') {
        return (
          <div key={`${fieldName}-${index}`} className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500 tracking-tight mb-2">{field.label}</dt>
            <dd>
              <div className="flex flex-wrap gap-2">
                {fieldValue.map((item: string, idx: number) => (
                  <MaterialChip
                    key={idx}
                    label={item}
                    color={fieldName === 'capabilities' ? 'primary' : 'success'}
                    size="small"
                    variant="outlined"
                    className="font-medium text-sm"
                  />
                ))}
              </div>
            </dd>
          </div>
        )
      }
      if (fieldName === 'use_cases') {
        return (
          <div key={`${fieldName}-${index}`} className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500 tracking-tight mb-2">{field.label}</dt>
            <dd>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {fieldValue.map((useCase: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm font-medium text-gray-700 bg-gray-50/50 p-2.5 rounded-md border border-gray-100">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                    {useCase}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )
      }
      if (fieldName === 'data_types' || fieldName === 'regions') {
        return (
          <div key={`${fieldName}-${index}`}>
            <dt className="text-sm font-medium text-gray-500 tracking-tight mb-2">{field.label}</dt>
            <dd>
              <div className="flex flex-wrap gap-2">
                {fieldValue.map((item: string, idx: number) => (
                  <MaterialChip
                    key={idx}
                    label={item}
                    color={fieldName === 'data_types' ? 'secondary' : 'primary'}
                    size="small"
                    variant="outlined"
                    className="font-medium text-sm"
                  />
                ))}
              </div>
            </dd>
          </div>
        )
      }
      if (fieldName === 'personas') {
        return (
          <div key={`${fieldName}-${index}`} className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500 tracking-tight mb-2">{field.label}</dt>
            <dd>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fieldValue.map((persona: any, idx: number) => (
                  <MaterialCard key={idx} elevation={0} className="p-4 bg-gray-50/30 border border-gray-100/60 rounded-md">
                    <div className="font-medium text-sm text-gray-900 mb-1">{persona.name || `Persona ${idx + 1}`}</div>
                    {persona.description && (
                      <div className="text-xs font-medium text-gray-500 leading-relaxed">{persona.description}</div>
                    )}
                  </MaterialCard>
                ))}
              </div>
            </dd>
          </div>
        )
      }
    }
    
    // Handle connection_diagram specially
    if (fieldName === 'connection_diagram' || fieldName === 'connections') {
      const diagram = architectureInfo.connection_diagram
      if (!diagram) return null
      return (
        <div key={`${fieldName}-${index}`} className="md:col-span-2">
          <dt className="text-sm font-medium text-gray-500 tracking-tight mb-3">{field.label}</dt>
          <dd className="bg-white rounded-lg p-6 border border-gray-100 shadow-sm overflow-hidden">
            {canEditDiagram ? (
              <ConnectionDiagram
                agentId={agent.id}
                diagram={diagram}
                canEdit={canEditDiagram}
                onUpdate={onDiagramUpdate}
              />
            ) : (
              <MermaidDiagram diagram={diagram} />
            )}
          </dd>
        </div>
      )
    }
    
    // Default rendering for simple fields
    return (
      <div key={`${fieldName}-${index}`}>
        <dt className="text-sm font-medium text-gray-500 tracking-tight mb-1">{field.label}</dt>
        {renderEditableField(fieldName, fieldValue)}
      </div>
    )
  }
  
  // If sections are provided, render dynamically from layout configuration
  if (sections && sections.length > 0) {
    // Sort sections by order
    const sortedSections = [...sections].sort((a, b) => (a.order || 0) - (b.order || 0))
    
    return (
      <div className="space-y-6">
        {sortedSections.map((section) => {
          // Filter fields that user can view
          const visibleFieldsInSection = section.fields.filter(f => f.can_view)
          
          // Skip section if no visible fields
          if (visibleFieldsInSection.length === 0) {
            return null
          }
          
          // Check if section should be shown based on visibleFields filter
          if (visibleFields && visibleFields.length > 0) {
            const hasVisibleField = visibleFieldsInSection.some(f => visibleFields.includes(f.field_name))
            if (!hasVisibleField) {
              return null
            }
          }
          
          return (
            <MaterialCard key={section.id} elevation={1} className="p-6 border-none overflow-hidden">
              <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 text-blue-600 flex items-center justify-center">
                  <ShieldCheckIcon className="w-5 h-5" />
                </div>
                {section.title}
              </h3>
              {section.description && (
                <p className="text-sm text-gray-500 mb-6 leading-relaxed -mt-4 ml-11">{section.description}</p>
              )}
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {visibleFieldsInSection
                  .filter(field => {
                    // Apply visibleFields filter if provided
                    if (visibleFields && visibleFields.length > 0) {
                      return visibleFields.includes(field.field_name)
                    }
                    return true
                  })
                  .map((field, fieldIndex) => renderDynamicField(field, fieldIndex))
                  .filter(Boolean) // Remove null entries
                }
              </dl>
            </MaterialCard>
          )
        })}
        
        {/* Compliance Score - always show if available */}
        {agent.compliance_score !== null && agent.compliance_score !== undefined && (
          <MaterialCard elevation={2} className="p-6 border-none bg-blue-600 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheckIcon className="w-24 h-24" />
            </div>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <CheckIcon className="w-5 h-5" />
              Compliance Score
            </h3>
            <div className="flex items-baseline gap-2">
              <div className="text-5xl font-medium">{agent.compliance_score}</div>
              <div className="text-lg opacity-80 font-medium">/ 100</div>
            </div>
            <p className="mt-4 text-sm opacity-90 leading-relaxed max-w-md">
              This score represents the overall compliance posture of the agent based on security reviews and requirement fulfillment.
            </p>
          </MaterialCard>
        ) }
      </div>
    )
  }
  
  // Fallback to hardcoded sections for backward compatibility
  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <MaterialCard elevation={1} className="p-6 border-none overflow-hidden">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-50 text-blue-600 flex items-center justify-center">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          Basic Information
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {isFieldVisible('name') && (
            <div>
              <dt className="text-label text-gray-500 mb-1">Name</dt>
              {renderEditableField('name', agent.name)}
            </div>
          )}
          {isFieldVisible('type') && (
            <div>
              <dt className="text-label text-gray-500 mb-1">Type</dt>
              {renderEditableField('type', agent.type)}
            </div>
          )}
          {isFieldVisible('version') && (
            <div>
              <dt className="text-label text-gray-500 mb-1">Version</dt>
              {renderEditableField('version', agent.version)}
            </div>
          )}
          {isFieldVisible('category') && (
            <div>
              <dt className="text-label text-gray-500 mb-1">Category</dt>
              {renderEditableField('category', agent.category)}
            </div>
          )}
          {isFieldVisible('subcategory') && agent.subcategory && (
            <div>
              <dt className="text-label text-gray-500 mb-1">Subcategory</dt>
              {renderEditableField('subcategory', agent.subcategory)}
            </div>
          )}
          <div>
            <dt className="text-label text-gray-500 mb-1">Status</dt>
            <dd>
              <MaterialChip 
                label={agent.status.replace(/_/g, ' ')} 
                color={
                  agent.status === 'approved' ? 'success' :
                  agent.status === 'rejected' ? 'error' :
                  agent.status === 'in_review' ? 'warning' :
                  'default'
                }
                size="small"
                variant="filled"
              />
            </dd>
          </div>
          {isFieldVisible('description') && agent.description && (
            <div className="md:col-span-2">
              <dt className="text-label text-gray-500 mb-1">Description</dt>
              {renderEditableField('description', agent.description, 'textarea')}
            </div>
          )}
        </dl>
      </MaterialCard>

      {/* AI/LLM Configuration */}
      {shouldShowSection(['llm_vendor', 'llm_model', 'deployment_type']) && 
       (agent.llm_vendor || agent.llm_model || agent.deployment_type) && (
        <MaterialCard elevation={1} className="p-6 border-none overflow-hidden">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-blue-600 flex items-center justify-center">
              <span>🤖</span>
            </div>
            AI & LLM Configuration
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {isFieldVisible('llm_vendor') && agent.llm_vendor && (
              <div>
                <dt className="text-label text-gray-500 mb-1">LLM Vendor</dt>
                {renderEditableField('llm_vendor', agent.llm_vendor)}
              </div>
            )}
            {isFieldVisible('llm_model') && agent.llm_model && (
              <div>
                <dt className="text-label text-gray-500 mb-1">LLM Model(s)</dt>
                {renderEditableField('llm_model', agent.llm_model)}
              </div>
            )}
            {isFieldVisible('deployment_type') && agent.deployment_type && (
              <div>
                <dt className="text-label text-gray-500 mb-1">Deployment Type</dt>
                {renderEditableField('deployment_type', agent.deployment_type)}
              </div>
            )}
          </dl>
        </MaterialCard>
      )}

      {/* Data Sharing & Privacy */}
      {shouldShowSection(['data_sharing_scope', 'data_usage_purpose']) &&
       (dataSharingScope.shares_pii !== undefined || 
        dataSharingScope.shares_phi !== undefined || 
        dataSharingScope.shares_financial_data !== undefined ||
        dataSharingScope.shares_biometric_data !== undefined ||
        dataSharingScope.data_retention_period ||
        dataSharingScope.data_processing_location ||
        agent.data_usage_purpose) && (
        <MaterialCard elevation={1} className="p-6 border-none overflow-hidden">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-blue-600 flex items-center justify-center">
              <span>🔒</span>
            </div>
            Data Sharing & Privacy
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <dt className="text-label text-gray-500 mb-1">Shares PII</dt>
              <dd className="text-body font-medium text-gray-900">{dataSharingScope.shares_pii ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-label text-gray-500 mb-1">Shares PHI</dt>
              <dd className="text-body font-medium text-gray-900">{dataSharingScope.shares_phi ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-label text-gray-500 mb-1">Shares Financial Data</dt>
              <dd className="text-body font-medium text-gray-900">{dataSharingScope.shares_financial_data ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-label text-gray-500 mb-1">Shares Biometric Data</dt>
              <dd className="text-body font-medium text-gray-900">{dataSharingScope.shares_biometric_data ? 'Yes' : 'No'}</dd>
            </div>
            {dataSharingScope.data_retention_period && (
              <div>
                <dt className="text-label text-gray-500 mb-1">Data Retention Period</dt>
                <dd className="text-body font-medium text-gray-900">{dataSharingScope.data_retention_period}</dd>
              </div>
            )}
            {dataSharingScope.data_processing_location && (
              <div>
                <dt className="text-label text-gray-500 mb-1">Data Processing Location</dt>
                <dd className="text-body font-medium text-gray-900">
                  {Array.isArray(dataSharingScope.data_processing_location)
                    ? dataSharingScope.data_processing_location.join(', ')
                    : dataSharingScope.data_processing_location}
                </dd>
              </div>
            )}
            {isFieldVisible('data_usage_purpose') && agent.data_usage_purpose && (
              <div className="md:col-span-2">
                <dt className="text-label text-gray-500 mb-1">Data Usage Purpose</dt>
                {renderEditableField('data_usage_purpose', agent.data_usage_purpose, 'textarea')}
              </div>
            )}
          </dl>
        </MaterialCard>
      )}

      {/* Capabilities & Features */}
      {shouldShowSection(['capabilities', 'features', 'use_cases']) &&
       (agent.capabilities && agent.capabilities.length > 0 || 
        agent.features && agent.features.length > 0 || 
        agent.use_cases && agent.use_cases.length > 0) && (
        <MaterialCard elevation={1} className="p-6 border-none overflow-hidden">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-blue-600 flex items-center justify-center">
              <span>⚡</span>
            </div>
            Capabilities & Features
          </h3>
          <div className="space-y-6">
            {agent.capabilities && agent.capabilities.length > 0 && (
              <div>
                <dt className="text-label text-gray-500 mb-3 font-medium">Capabilities</dt>
                <dd>
                  <div className="flex flex-wrap gap-2">
                    {agent.capabilities.map((cap: string, idx: number) => (
                      <MaterialChip key={idx} label={cap} color="primary" size="small" variant="outlined" />
                    ))}
                  </div>
                </dd>
              </div>
            )}
            {agent.features && agent.features.length > 0 && (
              <div>
                <dt className="text-label text-gray-500 mb-3 font-medium">Features</dt>
                <dd>
                  <div className="flex flex-wrap gap-2">
                    {agent.features.map((feature: string, idx: number) => (
                      <MaterialChip key={idx} label={feature} color="success" size="small" variant="outlined" />
                    ))}
                  </div>
                </dd>
              </div>
            )}
            {agent.use_cases && agent.use_cases.length > 0 && (
              <div>
                <dt className="text-label text-gray-500 mb-3 font-medium">Use Cases</dt>
                <dd>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {agent.use_cases.map((useCase: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                        {useCase}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </div>
        </MaterialCard>
      )}

      {/* Data Types & Regions */}
      {shouldShowSection(['data_types', 'regions']) &&
       (agent.data_types && agent.data_types.length > 0 || agent.regions && agent.regions.length > 0) && (
        <MaterialCard elevation={1} className="p-6 border-none overflow-hidden">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-blue-600 flex items-center justify-center">
              <span>🌍</span>
            </div>
            Data Types & Regions
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {agent.data_types && agent.data_types.length > 0 && (
              <div>
                <dt className="text-label text-gray-500 mb-3 font-medium">Data Types</dt>
                <dd>
                  <div className="flex flex-wrap gap-2">
                    {agent.data_types.map((type: string, idx: number) => (
                      <MaterialChip key={idx} label={type} color="secondary" size="small" variant="outlined" />
                    ))}
                  </div>
                </dd>
              </div>
            )}
            {agent.regions && agent.regions.length > 0 && (
              <div>
                <dt className="text-label text-gray-500 mb-3 font-medium">Regions</dt>
                <dd>
                  <div className="flex flex-wrap gap-2">
                    {agent.regions.map((region: string, idx: number) => (
                      <MaterialChip key={idx} label={region} color="primary" size="small" variant="outlined" />
                    ))}
                  </div>
                </dd>
              </div>
            )}
          </dl>
        </MaterialCard>
      )}

      {/* Target Personas */}
      {isFieldVisible('personas') && agent.personas && agent.personas.length > 0 && (
        <MaterialCard elevation={1} className="p-6 border-none overflow-hidden">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-blue-600 flex items-center justify-center">
              <span>👥</span>
            </div>
            Target Personas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agent.personas.map((persona: any, idx: number) => (
              <MaterialCard key={idx} elevation={0} className="p-4 bg-surface-variant/5 border border-outline/10">
                <div className="font-medium text-body text-gray-900 mb-1">{persona.name || `Persona ${idx + 1}`}</div>
                {persona.description && (
                  <div className="text-sm text-gray-600 leading-relaxed">{persona.description}</div>
                )}
              </MaterialCard>
            ))}
          </div>
        </MaterialCard>
      )}

      {/* Version Information */}
      {shouldShowSection(['version_info']) &&
       (versionInfo.release_notes || 
        versionInfo.changelog || 
        versionInfo.compatibility || 
        versionInfo.known_issues) && (
        <MaterialCard elevation={1} className="p-6 border-none overflow-hidden">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-blue-600 flex items-center justify-center">
              <span>📦</span>
            </div>
            Version Information
          </h3>
          <dl className="space-y-6">
            {versionInfo.release_notes && (
              <div>
                <dt className="text-label text-gray-500 mb-2 font-medium">Release Notes</dt>
                <dd className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">{versionInfo.release_notes}</dd>
              </div>
            )}
            {versionInfo.changelog && (
              <div>
                <dt className="text-label text-gray-500 mb-2 font-medium">Changelog</dt>
                <dd className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">{versionInfo.changelog}</dd>
              </div>
            )}
            {versionInfo.compatibility && (
              <div>
                <dt className="text-label text-gray-500 mb-2 font-medium">Compatibility</dt>
                <dd className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">{versionInfo.compatibility}</dd>
              </div>
            )}
            {versionInfo.known_issues && (
              <div>
                <dt className="text-label text-gray-500 mb-2 font-medium">Known Issues</dt>
                <dd className="text-sm text-error-700 whitespace-pre-wrap leading-relaxed bg-error-50 p-3 rounded-lg border border-error-100">{versionInfo.known_issues}</dd>
              </div>
            )}
          </dl>
        </MaterialCard>
      )}

      {/* Connection Diagram */}
      {isFieldVisible('connections') && architectureInfo.connection_diagram && (
        <MaterialCard elevation={1} className="p-6 border-none overflow-hidden">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-blue-600 flex items-center justify-center">
              <span>🔗</span>
            </div>
            Connection Diagram
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 overflow-hidden">
            {canEditDiagram ? (
              <ConnectionDiagram
                agentId={agent.id}
                diagram={architectureInfo.connection_diagram}
                canEdit={canEditDiagram}
                onUpdate={onDiagramUpdate}
              />
            ) : (
              <MermaidDiagram diagram={architectureInfo.connection_diagram} />
            )}
          </div>
        </MaterialCard>
      )}

      {/* Compliance Score */}
      {agent.compliance_score !== null && agent.compliance_score !== undefined && (
        <MaterialCard elevation={2} className="p-6 border-none bg-blue-600 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheckIcon className="w-24 h-24" />
          </div>
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <CheckIcon className="w-5 h-5" />
            Compliance Score
          </h3>
          <div className="flex items-baseline gap-2">
            <div className="text-5xl font-medium">{agent.compliance_score}</div>
            <div className="text-lg opacity-80 font-medium">/ 100</div>
          </div>
          <p className="mt-4 text-sm opacity-90 leading-relaxed max-w-md">
            This score represents the overall compliance posture of the agent based on security reviews and requirement fulfillment.
          </p>
        </MaterialCard>
      )}
    </div>
  )
}

