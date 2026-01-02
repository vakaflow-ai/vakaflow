/**
 * Generic Workflow View Component
 * 
 * Automatically renders views for any entity/workflow based on:
 * - Layout configuration (sections become tabs)
 * - Hierarchical permissions (fields auto-filtered)
 * - Workflow stage (determines which layout to use)
 * 
 * No hardcoding - everything is configuration-driven!
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workflowOrchestrationApi, ViewStructure } from '../lib/workflowOrchestration'
import { authApi } from '../lib/auth'

interface GenericWorkflowViewProps {
  entityName: string  // e.g., "agents", "vendors", "assessments"
  requestType: string  // e.g., "agent_onboarding_workflow", "vendor_submission_workflow"
  workflowStage: string  // e.g., "new", "pending_approval", "approved"
  entityId?: string  // Entity ID (for editing existing entities)
  entityData?: Record<string, any>  // Entity data
  agentType?: string
  agentCategory?: string
  onFieldChange?: (fieldName: string, value: any) => void
  onSubmit?: (data: Record<string, any>) => void
  readOnly?: boolean
}

export default function GenericWorkflowView({
  entityName,
  requestType,
  workflowStage,
  entityId,
  entityData = {},
  agentType,
  agentCategory,
  onFieldChange,
  onSubmit,
  readOnly = false,
}: GenericWorkflowViewProps) {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<string>('')
  const [formData, setFormData] = useState<Record<string, any>>(entityData)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {})
  }, [])

  // Generate view structure automatically
  const { data: viewStructure, isLoading } = useQuery({
    queryKey: ['workflow-view', entityName, requestType, workflowStage, agentType, agentCategory],
    queryFn: () => workflowOrchestrationApi.generateViewStructure({
      entity_name: entityName,
      request_type: requestType,
      workflow_stage: workflowStage,
      agent_type: agentType,
      agent_category: agentCategory,
    }),
    enabled: !!user,
  })

  // Set active tab to first tab when view structure loads
  useEffect(() => {
    if (viewStructure && viewStructure.tabs.length > 0 && !activeTab) {
      setActiveTab(viewStructure.tabs[0].id)
    }
  }, [viewStructure, activeTab])

  // Update form data when entityData changes
  useEffect(() => {
    if (entityData) {
      setFormData(entityData)
    }
  }, [entityData])

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }))
    onFieldChange?.(fieldName, value)
  }

  const handleSubmit = () => {
    onSubmit?.(formData)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading view...</div>
      </div>
    )
  }

  if (!viewStructure || viewStructure.tabs.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">No view configuration found for this workflow stage</div>
      </div>
    )
  }

  // Get active section
  const activeSection = viewStructure.sections.find(s => s.id === activeTab)

  return (
    <div className="space-y-4">
      {/* Tabs - Auto-generated from layout sections */}
      {viewStructure.tabs.length > 1 && (
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {viewStructure.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Sections - Auto-generated from layout */}
      <div className="space-y-6">
        {viewStructure.sections
          .filter(section => !activeTab || section.id === activeTab)  // Show only active tab if tabs exist
          .map((section) => (
            <div key={section.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">{section.title}</h3>
              {section.description && (
                <p className="text-sm text-gray-600 mb-4">{section.description}</p>
              )}

              {/* Fields - Auto-filtered by permissions */}
              <div className="space-y-4">
                {section.fields.map((field, fieldIndex) => (
                  <div key={`${field.field_name}-${fieldIndex}`} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {field.label}
                      {field.is_required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    
                    {field.can_edit && !readOnly ? (
                      <input
                        type={field.field_type === 'textarea' ? 'textarea' : 'text'}
                        value={formData[field.field_name] || ''}
                        onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        required={field.is_required}
                      />
                    ) : (
                      <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                        {formData[field.field_name] || '-'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Submit button */}
      {onSubmit && !readOnly && (
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  )
}

