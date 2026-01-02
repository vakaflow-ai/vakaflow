import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { WorkflowStep, StageSettings } from '../lib/workflowConfig'
import { formLayoutsApi, FormLayout } from '../lib/formLayouts'

interface StageSettingsModalProps {
  step: WorkflowStep | null
  isOpen: boolean
  onClose: () => void
  onSave: (step: WorkflowStep) => void
  availableFields?: string[] // Available fields from agent submission
  requestType?: string // Request type from workflow config (e.g., 'agent_onboarding_workflow', 'vendor_submission_workflow')
}

// Available fields from agent submission form
const DEFAULT_AVAILABLE_FIELDS = [
  'name',
  'type',
  'category',
  'subcategory',
  'description',
  'version',
  'llm_vendor',
  'llm_model',
  'deployment_type',
  'data_sharing_scope',
  'data_usage_purpose',
  'capabilities',
  'data_types',
  'regions',
  'use_cases',
  'features',
  'personas',
  'version_info',
  'connections',
  'compliance_requirements',
  'requirements'
]

export default function StageSettingsModal({
  step,
  isOpen,
  onClose,
  onSave,
  availableFields = DEFAULT_AVAILABLE_FIELDS,
  requestType = 'agent_onboarding_workflow' // Default to agent_onboarding_workflow, but can be overridden
}: StageSettingsModalProps) {
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<StageSettings>({
    visible_fields: [],
    email_notifications: {
      enabled: false,
      recipients: [],
      reminders: []
    }
  })

  // Map step_type to action name in Workflow Layout Manager
  // step_type: 'review' | 'approval' → "Approval" action
  // step_type: 'notification' → might not need layout, but show all available
  const getActionNamesForStep = (stepType: string | undefined, stepName: string | undefined): string[] => {
    const actionNames: string[] = []
    
    // Map step_type to action names
    if (stepType === 'review' || stepType === 'approval') {
      actionNames.push('approval')
      // Also include 'review' if step name contains "review"
      if (stepName?.toLowerCase().includes('review')) {
        actionNames.push('review')
      }
    } else if (stepType === 'notification') {
      // For notifications, show all available layouts
      actionNames.push('approval', 'submission', 'rejection', 'completion')
    } else {
      // Default: show all approver-related layouts
      actionNames.push('approval', 'review')
    }
    
    return actionNames
  }

  // Fetch available form layouts for approver screens
  // IMPORTANT: Fetch layouts from Workflow Layout Manager (FormType/WorkflowLayoutGroup) stage_mappings
  // These are the layouts mapped in Process Designer, not directly from form_layouts
  const { data: layouts } = useQuery({
    queryKey: ['form-layouts', 'mapped', requestType, step?.step_type, step?.step_name],
    queryFn: async () => {
      try {
        const actionNames = getActionNamesForStep(step?.step_type, step?.step_name)
        console.log('StageSettingsModal - Fetching mapped layouts from Workflow Layout Manager:', {
          requestType,
          stepType: step?.step_type,
          stepName: step?.step_name,
          actionNames
        })
        
        // Step 1: Get WorkflowLayoutGroups (FormType) for this request_type
        const groups = await formLayoutsApi.listGroups(requestType)
        console.log('StageSettingsModal - Found WorkflowLayoutGroups:', {
          requestType,
          groupsCount: groups.length,
          groups: groups.map((g: any) => ({
            id: g.id,
            name: g.name,
            request_type: g.request_type,
            is_active: g.is_active,
            is_default: g.is_default,
            stage_mappings: Object.keys(g.stage_mappings || {})
          }))
        })
        
        // Step 2: CRITICAL - Only use DEFAULT group for this request_type
        // Stages are workflow-specific, so we MUST only show layouts from the default group
        // that matches the workflow's request_type
        const defaultGroup = groups.find((g: any) => 
          g.is_default === true && 
          g.is_active === true && 
          g.request_type === requestType
        )
        
        if (!defaultGroup) {
          console.warn('StageSettingsModal - No default group found for request_type:', {
            requestType,
            availableGroups: groups.map((g: any) => ({
              name: g.name,
              request_type: g.request_type,
              is_default: g.is_default,
              is_active: g.is_active
            }))
          })
          return [] // No default group = no layouts to show
        }
        
        const groupsToCheck = [defaultGroup] // ONLY use default group
        
        console.log('StageSettingsModal - Using default group:', {
          requestType,
          defaultGroupName: defaultGroup.name,
          defaultGroupRequestType: defaultGroup.request_type,
          stageMappings: Object.keys(defaultGroup.stage_mappings || {})
        })
        
        // Step 3: Extract layout IDs from stage_mappings for relevant actions (case-insensitive)
        const mappedLayoutIds = new Set<string>()
        const mappedLayoutNames = new Map<string, string>()
        
        for (const group of groupsToCheck) {
          const stageMappings = group.stage_mappings || {}
          
          // Check for mappings matching the action names
          for (const [actionName, mapping] of Object.entries(stageMappings)) {
            const actionLower = actionName.toLowerCase()
            
            // Check if this action matches any of the target actions
            const matches = actionNames.some(targetAction => 
              actionLower === targetAction.toLowerCase() || 
              actionLower.includes(targetAction.toLowerCase())
            )
            
            if (matches && mapping && typeof mapping === 'object' && 'layout_id' in mapping) {
              const layoutId = mapping.layout_id as string
              const layoutName = (mapping.name as string) || layoutId
              if (layoutId && layoutId !== 'null' && layoutId !== 'undefined') {
                mappedLayoutIds.add(layoutId)
                mappedLayoutNames.set(layoutId, layoutName)
              }
            }
          }
          
          // If we found mappings in the default group, stop here (don't check other groups)
          if (defaultGroup && mappedLayoutIds.size > 0) {
            console.log('StageSettingsModal - Found layouts in default group, stopping search')
            break
          }
        }
        
        console.log('StageSettingsModal - Mapped layout IDs from Workflow Layout Manager:', {
          requestType,
          actionNames,
          mappedLayoutIds: Array.from(mappedLayoutIds),
          mappedLayoutNames: Object.fromEntries(mappedLayoutNames)
        })
        
        // Step 4: Fetch the actual layouts from form library
        // NOTE: Forms from the library are workflow-agnostic (request_type: "").
        // They're connected to workflows via Workflow Layout Manager mappings,
        // so we don't filter by request_type - if it's mapped, it's valid for this workflow.
        const mappedLayouts: FormLayout[] = []
        for (const layoutId of mappedLayoutIds) {
          try {
            const layout = await formLayoutsApi.get(layoutId)
            // Verify it's active and not a template
            // Don't filter by request_type - forms are workflow-agnostic and connected via mappings
            if (layout && layout.is_active && !layout.is_template) {
              mappedLayouts.push(layout)
            } else {
              console.warn(`StageSettingsModal - Layout ${layoutId} filtered out:`, {
                is_active: layout?.is_active,
                is_template: layout?.is_template,
                request_type: layout?.request_type
              })
            }
          } catch (error) {
            console.warn(`StageSettingsModal - Failed to fetch layout ${layoutId}:`, error)
            // Layout might have been deleted, but still referenced in mapping - skip it
          }
        }
        
        console.log('StageSettingsModal - Final mapped layouts from Workflow Layout Manager:', {
          requestType,
          totalMappedLayouts: mappedLayouts.length,
          layouts: mappedLayouts.map((l: FormLayout) => ({ 
            id: l.id, 
            name: l.name, 
            workflow_stage: l.workflow_stage,
            layout_type: l.layout_type,
            is_active: l.is_active,
            is_template: l.is_template,
            request_type: l.request_type
          }))
        })
        
        return mappedLayouts
      } catch (error) {
        console.error('StageSettingsModal - Error fetching mapped layouts from Workflow Layout Manager:', error)
        return []
      }
    },
    enabled: isOpen && !!requestType && !!step,
    staleTime: 0, // Always fetch fresh data (no caching)
    gcTime: 0 // Don't cache old data (React Query v5 - was cacheTime in v4)
  })

  // Fetch fields from the selected layout (or from mapped layout for this stage)
  // This loads fields from the form mapped in Process Designer (Workflow Layout Manager)
  const { data: mappedLayoutFields } = useQuery({
    queryKey: ['form-layout-fields', requestType, step?.step_type, step?.step_name, settings.layout_id],
    queryFn: async () => {
      try {
        // If a layout is already selected, fetch its fields
        if (settings.layout_id) {
          const layout = await formLayoutsApi.get(settings.layout_id)
          if (layout?.sections) {
            // Extract all field names from all sections
            const allFields = new Set<string>()
            layout.sections.forEach((section: any) => {
              if (section.fields && Array.isArray(section.fields)) {
                section.fields.forEach((field: string) => allFields.add(field))
              }
            })
            console.log('StageSettingsModal - Loaded fields from selected layout:', {
              layoutId: settings.layout_id,
              layoutName: layout.name,
              fieldsCount: allFields.size,
              fields: Array.from(allFields)
            })
            return Array.from(allFields)
          }
        }
        
        // Otherwise, try to get fields from the mapped layout for this stage
        const actionNames = getActionNamesForStep(step?.step_type, step?.step_name)
        const groups = await formLayoutsApi.listGroups(requestType)
        const defaultGroup = groups.find((g: any) => 
          g.is_default === true && 
          g.is_active === true && 
          g.request_type === requestType
        )
        
        if (defaultGroup) {
          const stageMappings = defaultGroup.stage_mappings || {}
          for (const [actionName, mapping] of Object.entries(stageMappings)) {
            const actionLower = actionName.toLowerCase()
            const matches = actionNames.some(targetAction => 
              actionLower === targetAction.toLowerCase() || 
              actionLower.includes(targetAction.toLowerCase())
            )
            
            if (matches && mapping && typeof mapping === 'object' && 'layout_id' in mapping) {
              const layoutId = mapping.layout_id as string
              if (layoutId && layoutId !== 'null' && layoutId !== 'undefined') {
                try {
                  const layout = await formLayoutsApi.get(layoutId)
                  if (layout?.sections) {
                    const allFields = new Set<string>()
                    layout.sections.forEach((section: any) => {
                      if (section.fields && Array.isArray(section.fields)) {
                        section.fields.forEach((field: string) => allFields.add(field))
                      }
                    })
                    console.log('StageSettingsModal - Loaded fields from mapped layout:', {
                      requestType,
                      stepType: step?.step_type,
                      stepName: step?.step_name,
                      actionName,
                      layoutId,
                      layoutName: layout.name,
                      fieldsCount: allFields.size,
                      fields: Array.from(allFields)
                    })
                    return Array.from(allFields)
                  }
                } catch (error) {
                  console.warn(`StageSettingsModal - Failed to fetch mapped layout ${layoutId} for fields:`, error)
                }
              }
            }
          }
        }
        
        return null // No mapped layout found
      } catch (error) {
        console.error('StageSettingsModal - Error fetching fields from mapped layout:', error)
        return null
      }
    },
    enabled: isOpen && !!requestType && !!step,
    staleTime: 0,
    gcTime: 0
  })

  // Determine available fields: use mapped layout fields if available, otherwise fall back to prop/default
  const effectiveAvailableFields = mappedLayoutFields && mappedLayoutFields.length > 0
    ? mappedLayoutFields
    : availableFields

  // Invalidate cache when modal opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
      // Invalidate form-layouts cache to ensure we get fresh data from Workflow Layout Manager
      queryClient.invalidateQueries({ queryKey: ['form-layouts', 'mapped', requestType] })
      queryClient.invalidateQueries({ queryKey: ['form-layouts', 'approver', 'mapped', requestType] })
      queryClient.invalidateQueries({ queryKey: ['form-layouts', 'approver', requestType] })
      queryClient.invalidateQueries({ queryKey: ['form-layouts'] })
      queryClient.invalidateQueries({ queryKey: ['form-layouts', 'groups'] }) // Invalidate WorkflowLayoutGroups cache
      queryClient.invalidateQueries({ queryKey: ['form-layout-fields'] }) // Invalidate fields cache
    }
  }, [isOpen, requestType, step?.step_type, step?.step_name, queryClient])

  // Invalidate fields query when layout_id changes (user selects a different layout)
  useEffect(() => {
    if (settings.layout_id) {
      queryClient.invalidateQueries({ queryKey: ['form-layout-fields', requestType, step?.step_type, step?.step_name, settings.layout_id] })
    }
  }, [settings.layout_id, requestType, step?.step_type, step?.step_name, queryClient])

  useEffect(() => {
    if (isOpen && step) {
      if (step.stage_settings) {
        // Deep clone to avoid mutating the original
        const existingSettings = step.stage_settings
        setSettings({
          visible_fields: existingSettings.visible_fields ? [...existingSettings.visible_fields] : [],
          layout_id: existingSettings.layout_id || undefined,
          email_notifications: existingSettings.email_notifications ? {
            enabled: existingSettings.email_notifications.enabled || false,
            recipients: existingSettings.email_notifications.recipients ? [...existingSettings.email_notifications.recipients] : [],
            reminders: existingSettings.email_notifications.reminders ? [...existingSettings.email_notifications.reminders] : []
          } : {
            enabled: false,
            recipients: [],
            reminders: []
          }
        })
      } else {
        setSettings({
          visible_fields: [],
          layout_id: undefined,
          email_notifications: {
            enabled: false,
            recipients: [],
            reminders: []
          }
        })
      }
    }
  }, [step, isOpen])

  if (!isOpen || !step) return null

  const handleSave = () => {
    const updatedStep: WorkflowStep = {
      ...step,
      stage_settings: settings
    }
    onSave(updatedStep)
    onClose()
  }

  const toggleField = (field: string) => {
    const currentFields = settings.visible_fields || []
    if (currentFields.includes(field)) {
      setSettings({
        ...settings,
        visible_fields: currentFields.filter(f => f !== field)
      })
    } else {
      setSettings({
        ...settings,
        visible_fields: [...currentFields, field]
      })
    }
  }

  const toggleRecipient = (recipient: 'user' | 'vendor' | 'next_approver') => {
    const currentRecipients = settings.email_notifications?.recipients || []
    if (currentRecipients.includes(recipient)) {
      setSettings({
        ...settings,
        email_notifications: {
          ...settings.email_notifications!,
          recipients: currentRecipients.filter(r => r !== recipient)
        }
      })
    } else {
      setSettings({
        ...settings,
        email_notifications: {
          ...settings.email_notifications!,
          recipients: [...currentRecipients, recipient]
        }
      })
    }
  }

  const toggleReminder = (days: number) => {
    const currentReminders = settings.email_notifications?.reminders || []
    if (currentReminders.includes(days)) {
      setSettings({
        ...settings,
        email_notifications: {
          ...settings.email_notifications!,
          reminders: currentReminders.filter(r => r !== days)
        }
      })
    } else {
      setSettings({
        ...settings,
        email_notifications: {
          ...settings.email_notifications!,
          reminders: [...currentReminders, days]
        }
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Stage Settings: {step.step_name}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Visible Fields Section */}
          <div>
            <h4 className="text-sm font-medium mb-3">Visible Fields</h4>
            <p className="text-xs text-gray-600 mb-3">
              Fields loaded from the form mapped in Process Designer (Workflow Layout Manager). Select which fields will be visible to reviewers/approvers at this stage.
            </p>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {effectiveAvailableFields.length > 0 ? (
                effectiveAvailableFields.map((field) => (
                  <label
                    key={field}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={(settings.visible_fields || []).includes(field)}
                      onChange={() => toggleField(field)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">
                      {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </label>
                ))
              ) : (
                <div className="col-span-3 text-sm text-gray-500 text-center py-4">
                  {settings.layout_id 
                    ? 'Loading fields from mapped form...'
                    : 'Select a form layout in "Approver Screen Layout" to load fields from Process Designer'}
                </div>
              )}
            </div>
            {(settings.visible_fields || []).length === 0 && (
              <p className="text-xs text-gray-500 mt-2">
                No fields selected. All fields will be visible by default.
              </p>
            )}
          </div>

          {/* Form Layout Section */}
          <div>
            <h4 className="text-sm font-medium mb-3">Approver Screen Layout</h4>
            <p className="text-xs text-gray-600 mb-3">
              Select a form layout to use for approver screen tabs at this stage
            </p>
            <select
              value={settings.layout_id || ''}
              onChange={(e) => setSettings({
                ...settings,
                layout_id: e.target.value || undefined
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Default Layout (No custom layout)</option>
              {Array.isArray(layouts) && layouts.map((layout: FormLayout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
            {(!Array.isArray(layouts) || layouts.length === 0) && (
              <p className="text-xs text-gray-500 mt-2">
                No approver layouts mapped in Workflow Layout Manager. Go to Process Designer → Workflow Layout Manager → Map a form to the "Approval" action for this workflow.
              </p>
            )}
          </div>

          {/* Email Notifications Section */}
          <div>
            <h4 className="text-sm font-medium mb-3">Email Notifications</h4>
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.email_notifications?.enabled || false}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_notifications: {
                      ...settings.email_notifications!,
                      enabled: e.target.checked
                    }
                  })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Enable Email Notifications</span>
              </label>

              {settings.email_notifications?.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Recipients</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(settings.email_notifications?.recipients || []).includes('user')}
                          onChange={() => toggleRecipient('user')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">User (Submitter)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(settings.email_notifications?.recipients || []).includes('vendor')}
                          onChange={() => toggleRecipient('vendor')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Vendor</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(settings.email_notifications?.recipients || []).includes('next_approver')}
                          onChange={() => toggleRecipient('next_approver')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Next Approver</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Reminder Settings (Days)</label>
                    <div className="flex gap-3">
                      {[1, 2, 3, 5, 7].map((days) => (
                        <label key={days} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(settings.email_notifications?.reminders || []).includes(days)}
                            onChange={() => toggleReminder(days)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{days} day{days > 1 ? 's' : ''}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 mt-4 border-t">
          <button
            onClick={handleSave}
            className="compact-button-primary flex-1"
          >
            Save Settings
          </button>
          <button
            onClick={onClose}
            className="compact-button-secondary flex-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

