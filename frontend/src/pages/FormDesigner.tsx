import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formLayoutsApi, FormLayout, FormLayoutCreate, SectionDefinition, FieldAccess, FieldAccessCreate, AvailableFields, AgentFieldDefinition } from '../lib/formLayouts'
import { submissionRequirementsApi, SubmissionRequirement } from '../lib/submissionRequirements'
import Layout from '../components/Layout'
import DynamicForm from '../components/DynamicForm'
import { authApi } from '../lib/auth'

const formTypeLabels: Record<string, string> = {
  vendor: 'Vendor Submission',
  admin: 'Admin',
  approver: 'Approver',
  end_user: 'End User',
}

export default function FormDesigner() {
  const [user, setUser] = useState<any>(null)
  const [selectedRequestType, setSelectedScreenType] = useState<'admin' | 'approver' | 'end_user' | 'vendor'>('vendor')
  const [showAllLayouts, setShowAllLayouts] = useState(false) // Toggle to show all layouts
  const [selectedLayout, setSelectedLayout] = useState<FormLayout | null>(null)
  const [editingLayout, setEditingLayout] = useState<Partial<FormLayoutCreate> | null>(null)
  const [showFieldAccess, setShowFieldAccess] = useState(true) // Auto-expand by default
  const [selectedFieldAccess, setSelectedFieldAccess] = useState<FieldAccess | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewFormData, setPreviewFormData] = useState<Record<string, any>>({})

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {})
  }, [])

  const queryClient = useQueryClient()

  // Fetch layouts - fetch all layouts, not filtered by screen type initially
  const { data: allLayouts, isLoading: layoutsLoading, error: layoutsError } = useQuery({
    queryKey: ['form-layouts', 'all'],
    queryFn: () => formLayoutsApi.list(undefined, undefined, true), // Get all active layouts
    enabled: !!user,
    retry: 1,
  })

  // Filter layouts by selected screen type (unless showAllLayouts is true)
  const layouts = showAllLayouts 
    ? (allLayouts || [])
    : (allLayouts?.filter((layout) => layout.request_type === selectedRequestType) || [])

  // Fetch submission requirements (for field selection)
  const { data: requirements } = useQuery({
    queryKey: ['submission-requirements'],
    queryFn: () => submissionRequirementsApi.list(undefined, undefined, undefined, true),
    enabled: !!user,
  })

  // Fetch all available fields from database (submission requirements + agent fields)
  const { data: availableFieldsData, isLoading: fieldsLoading, error: fieldsError } = useQuery({
    queryKey: ['available-fields'],
    queryFn: () => formLayoutsApi.getAvailableFields(),
    enabled: !!user,
  })

  // Fetch field access controls - auto-load when component mounts
  const { data: fieldAccessList, isLoading: fieldAccessLoading } = useQuery({
    queryKey: ['field-access', selectedRequestType],
    queryFn: () => {
      if (!selectedRequestType || !['admin', 'approver', 'end_user', 'vendor'].includes(selectedRequestType)) {
        return Promise.resolve([])
      }
      return formLayoutsApi.listFieldAccess(selectedRequestType, undefined, true).catch((error) => {
        // Handle 400 and 422 errors gracefully (validation errors or missing data)
        if (error?.response?.status === 400 || error?.response?.status === 422) {
          console.warn(`Field access query returned ${error?.response?.status}, returning empty array`)
          return []
        }
        throw error
      })
    },
    enabled: !!user && !!selectedRequestType && ['admin', 'approver', 'end_user', 'vendor'].includes(selectedRequestType), // Always fetch, not just when expanded
    retry: false, // Don't retry on error to avoid console spam
  })

  // Create layout mutation
  const createLayoutMutation = useMutation({
    mutationFn: (layout: FormLayoutCreate) => formLayoutsApi.create(layout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-layouts'] })
      setEditingLayout(null)
    },
  })

  // Update layout mutation
  const updateLayoutMutation = useMutation({
    mutationFn: ({ id, layout }: { id: string; layout: Partial<FormLayoutCreate> }) =>
      formLayoutsApi.update(id, layout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-layouts'] })
      setEditingLayout(null)
      setSelectedLayout(null)
    },
  })

  // Delete layout mutation
  const deleteLayoutMutation = useMutation({
    mutationFn: (id: string) => formLayoutsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-layouts'] })
      setSelectedLayout(null)
    },
  })

  // Create field access mutation
  const createFieldAccessMutation = useMutation({
    mutationFn: (access: FieldAccessCreate) => formLayoutsApi.createFieldAccess(access),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-access'] })
      setSelectedFieldAccess(null)
    },
  })

  // Helper function to get default fields based on screen type
  const getDefaultFieldsForScreenType = (requestType: string): string[] => {
    const commonFields = ['name', 'type', 'description'] // Always include these core agent fields
    
    switch (requestType) {
      case 'vendor':
        return [...commonFields, 'category', 'subcategory', 'version']
      case 'admin':
        return [...commonFields, 'status', 'category', 'version']
      case 'approver':
        return ['name', 'type', 'description', 'status'] // Focus on review-relevant fields
      case 'end_user':
        return [...commonFields, 'category']
      default:
        return commonFields
    }
  }

  const handleCreateLayout = () => {
    const config = getRequestTypeConfig(selectedRequestType)
    const defaultSections = config.defaultSteps.map(step => ({
      id: `section-${Date.now()}-${step.id}`,
      title: step.title,
      description: step.description,
      fields: step.standardFields || [],
    }))

    setEditingLayout({
      name: `New ${selectedRequestType} Layout`,
      request_type: selectedRequestType,
      description: '',
      agent_type: null,
      sections: defaultSections,
      is_default: false,
    })
    setSelectedLayout(null)
    setPreviewMode(false) // Ensure preview mode is off when creating
  }

  const handleCreateFromTemplate = (templateKey: string) => {
    // Get fresh template with current screen type defaults
    const getTemplate = (key: string): Partial<FormLayoutCreate> => {
      const commonFields = ['name', 'type', 'description']
      
      switch (key) {
        case 'basic':
          return {
            name: 'Basic Form',
            request_type: selectedRequestType,
            sections: [
              {
                id: 'section-1',
                title: 'Basic Information',
                order: 1,
                fields: getDefaultFieldsForScreenType(selectedRequestType),
              },
            ],
            is_default: false,
          }
        case 'detailed':
          return {
            name: 'Detailed Form',
            request_type: selectedRequestType,
            sections: [
              {
                id: 'section-1',
                title: 'Basic Information',
                order: 1,
                fields: getDefaultFieldsForScreenType(selectedRequestType),
              },
              {
                id: 'section-2',
                title: 'Additional Details',
                order: 2,
                fields: selectedRequestType === 'vendor' 
                  ? ['category', 'subcategory', 'version', 'capabilities', 'data_types']
                  : ['category', 'version'],
              },
              {
                id: 'section-3',
                title: 'Review Notes',
                order: 3,
                fields: selectedRequestType === 'approver' ? ['status'] : [],
              },
            ],
            is_default: false,
          }
        case 'approver':
          return {
            name: 'Approver Review Form',
            request_type: 'approver',
            sections: [
              {
                id: 'section-1',
                title: 'Review Summary',
                order: 1,
                fields: ['name', 'type', 'description', 'status'],
              },
              {
                id: 'section-2',
                title: 'Approval Decision',
                order: 2,
                fields: ['status'],
              },
            ],
            is_default: false,
          }
        default:
          const config = getRequestTypeConfig(selectedRequestType)
          return {
            name: 'New Form',
            request_type: selectedRequestType,
            sections: config.defaultSteps.map((step, idx) => ({
              id: `section-${idx + 1}`,
              title: step.title,
              order: idx + 1,
              fields: step.standardFields || [],
            })),
            is_default: false,
          }
      }
    }
    
    const template = getTemplate(templateKey)
    if (template) {
      setEditingLayout({
        ...template,
        name: `${template.name} - ${selectedRequestType}`,
        request_type: selectedRequestType,
      })
      setSelectedLayout(null)
    }
  }

  const handleEditLayout = (layout: FormLayout) => {
    setEditingLayout({
      name: layout.name,
      request_type: layout.request_type,
      description: layout.description,
      sections: layout.sections,
      agent_type: layout.agent_type,
      agent_category: layout.agent_category,
      field_dependencies: layout.field_dependencies,
      is_default: layout.is_default,
    })
    setSelectedLayout(layout)
  }

  // Track if we've auto-loaded for this screen type
  const [autoLoadedForScreen, setAutoLoadedForScreen] = useState<string | null>(null)

  // Reset selection when screen type changes
  useEffect(() => {
    setSelectedLayout(null)
    setEditingLayout(null)
    setPreviewMode(false)
    setPreviewFormData({})
    setAutoLoadedForScreen(null) // Reset auto-load flag when screen type changes
  }, [selectedRequestType])

  // Auto-load default layout when layouts are fetched (after screen type change)
  useEffect(() => {
    // Only auto-load once per screen type, and only if no layout is currently selected
    if (
      layouts && 
      layouts.length > 0 && 
      !editingLayout && 
      !selectedLayout &&
      autoLoadedForScreen !== selectedRequestType
    ) {
      // Find default layout for current screen type
      const defaultLayout = layouts.find((layout) => layout.is_default && layout.is_active)
      if (defaultLayout) {
        setAutoLoadedForScreen(selectedRequestType)
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          handleEditLayout(defaultLayout)
        }, 100) // Small delay to ensure state is reset
      } else {
        // Mark as checked even if no default found
        setAutoLoadedForScreen(selectedRequestType)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layouts, selectedRequestType, autoLoadedForScreen])

  const handleSaveLayout = () => {
    if (!editingLayout) return

    if (selectedLayout) {
      updateLayoutMutation.mutate({ id: selectedLayout.id, layout: editingLayout })
    } else {
      createLayoutMutation.mutate(editingLayout as FormLayoutCreate)
    }
  }

  const handleAddSection = () => {
    if (!editingLayout) return
    const newSection: SectionDefinition = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      order: editingLayout.sections?.length || 0,
      fields: [],
    }
    setEditingLayout({
      ...editingLayout,
      sections: [...(editingLayout.sections || []), newSection],
    })
  }

  const handleAddFieldToSection = (sectionId: string, fieldName: string) => {
    if (!editingLayout) return
    
    // Check if field already exists in ANY section (prevent duplicates across all sections)
    const allFieldsInLayout = editingLayout.sections?.flatMap(s => s.fields) || []
    if (allFieldsInLayout.includes(fieldName)) {
      const fieldInfo = availableFieldsList.find(f => f.field_name === fieldName)
      const fieldLabel = fieldInfo?.label || fieldName
      // Find which section(s) contain this field
      const sectionsWithField = editingLayout.sections?.filter(s => s.fields.includes(fieldName)) || []
      const sectionNames = sectionsWithField.map(s => s.title).join(', ')
      alert(`Field "${fieldLabel}" is already added to the form${sectionNames ? ` (in section${sectionsWithField.length > 1 ? 's' : ''}: ${sectionNames})` : ''}. Duplicate fields are not allowed.`)
      return
    }
    
    const sections = editingLayout.sections?.map((section) => {
      if (section.id === sectionId && !section.fields.includes(fieldName)) {
        return { ...section, fields: [...section.fields, fieldName] }
      }
      return section
    })
    setEditingLayout({ ...editingLayout, sections })
  }

  const handleRemoveFieldFromSection = (sectionId: string, fieldName: string) => {
    if (!editingLayout) return
    const sections = editingLayout.sections?.map((section) => {
      if (section.id === sectionId) {
        return { ...section, fields: section.fields.filter((f) => f !== fieldName) }
      }
      return section
    })
    setEditingLayout({ ...editingLayout, sections })
  }

  const handleDeleteSection = (sectionId: string) => {
    if (!editingLayout) return
    setEditingLayout({
      ...editingLayout,
      sections: editingLayout.sections?.filter((s) => s.id !== sectionId) || [],
    })
  }

  // Combine all available fields from different sources
  const getAllAvailableFields = (): Array<{ field_name: string; label: string; source: string; description?: string }> => {
    const fields: Array<{ field_name: string; label: string; source: string; description?: string }> = []
    
    // Add submission requirements
    if (requirements) {
      requirements.forEach((req) => {
        fields.push({
          field_name: req.field_name,
          label: req.label,
          source: 'submission_requirement',
          description: req.description
        })
      })
    }
    
    // Add agent fields from database
    if (availableFieldsData) {
      // Agent table fields (always available, even if empty array)
      if (availableFieldsData.agent && Array.isArray(availableFieldsData.agent)) {
        availableFieldsData.agent.forEach((field) => {
          fields.push({
            field_name: field.field_name,
            label: field.label,
            source: 'agent',
            description: field.description
          })
        })
      }
      
      // AgentMetadata table fields
      if (availableFieldsData.agent_metadata && Array.isArray(availableFieldsData.agent_metadata)) {
        availableFieldsData.agent_metadata.forEach((field) => {
          fields.push({
            field_name: field.field_name,
            label: field.label,
            source: 'agent_metadata',
            description: field.description
          })
        })
      }
    }
    
    return fields
  }
  
  const availableFieldsList = getAllAvailableFields()
  const availableFields = availableFieldsList.map((f) => f.field_name)

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <Layout user={user}>
      <div className="w-full max-w-[95%] mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Process Designer</h1>
          <p className="text-gray-600 mt-2">
            Configure form layouts and role-based field access for admin, approver, and end user screens
          </p>
        </div>

        {/* Request Type Selector */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Request Type Filter</label>
              <select
                value={selectedRequestType}
                onChange={(e) => {
                  setSelectedScreenType(e.target.value as any)
                  setSelectedLayout(null)
                  setEditingLayout(null)
                }}
                className="enterprise-input"
                disabled={showAllLayouts}
              >
                <option value="vendor">Vendor Submission</option>
                <option value="admin">Admin</option>
                <option value="approver">Approver</option>
                <option value="end_user">End User</option>
              </select>
            </div>
            <div className="pt-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllLayouts}
                  onChange={(e) => {
                    setShowAllLayouts(e.target.checked)
                    if (e.target.checked) {
                      setSelectedLayout(null)
                      setEditingLayout(null)
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Show all layouts</span>
              </label>
            </div>
            {allLayouts && allLayouts.length > 0 && (
              <div className="text-sm text-gray-600 pt-8">
                {showAllLayouts ? (
                  <>Showing all {allLayouts.length} layouts</>
                ) : (
                  <>Showing {layouts.length} of {allLayouts.length} total layouts</>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Display - Only show if there's an actual error */}
        {(fieldsError || layoutsError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
            {fieldsError && (
              <div className="mb-2">
                <div className="font-medium text-red-800 mb-1">Error Loading Fields:</div>
                <div className="text-red-700">{String(fieldsError)}</div>
              </div>
            )}
            {layoutsError && (
              <div>
                <div className="font-medium text-red-800 mb-1">Error Loading Layouts:</div>
                <div className="text-red-700">{String(layoutsError)}</div>
              </div>
            )}
          </div>
        )}

        {/* Layouts Grid Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-medium text-gray-900">Screen Layouts</h2>
              <p className="text-sm text-gray-600 mt-1">
                Select a layout to edit or create a new one
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => handleCreateFromTemplate('basic')}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  Basic Template
                </button>
                <button
                  onClick={() => handleCreateFromTemplate('detailed')}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  Detailed Template
                </button>
                {selectedRequestType === 'approver' && (
                  <button
                    onClick={() => handleCreateFromTemplate('approver')}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                  >
                    Approver Template
                  </button>
                )}
              </div>
              <button
                onClick={handleCreateLayout}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                + New Layout
              </button>
            </div>
          </div>

          {layoutsLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-500">Loading layouts...</div>
            </div>
          ) : layouts && layouts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {layouts.map((layout) => (
                <div
                  key={layout.id}
                  className={`bg-white border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    selectedLayout?.id === layout.id 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleEditLayout(layout)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900 text-lg flex-1">{layout.name}</h3>
                    {layout.is_default && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  
                  {layout.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{layout.description}</p>
                  )}
                  
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Screen:</span>
                      <span className="capitalize">{layout.request_type.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Sections:</span>
                      <span>{layout.sections?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Fields:</span>
                      <span>
                        {layout.sections?.reduce((total: number, section: SectionDefinition) => 
                          total + (section.fields?.length || 0), 0) || 0}
                      </span>
                    </div>
                    {layout.agent_type && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Agent Type:</span>
                        <span>{layout.agent_type}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditLayout(layout)
                      }}
                      className="w-full px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                    >
                      Edit Layout
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="text-gray-600 mb-2">
                <svg className="mx-auto h-9 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No layouts found</h3>
              <p className="text-sm text-gray-500 mb-4">
                Get started by creating a new layout or using a template
              </p>
              <button
                onClick={handleCreateLayout}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                Create Your First Layout
              </button>
            </div>
          )}
        </div>

        {/* Field Access Control Section */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <button
            onClick={() => setShowFieldAccess(!showFieldAccess)}
            className="w-full text-left font-medium text-gray-700 flex items-center justify-between"
          >
            <span>Field Access Control</span>
            <span>{showFieldAccess ? '▼' : '▶'}</span>
          </button>
          {showFieldAccess && (
            <div className="mt-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Available Fields</h3>
                {availableFieldsList.length > 0 ? (
                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <div className="text-xs text-gray-600 mb-2">Fields available for access control:</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {availableFieldsList.map((field) => {
                        const isSpecialField = ['data_sharing_scope', 'data_usage_purpose', 'data_types', 'regions', 'connection_diagram'].includes(field.field_name)
                        return (
                        <div
                          key={`${field.source}-${field.field_name}`}
                            className={`text-xs p-2 bg-white border rounded flex items-center justify-between ${
                              isSpecialField ? 'border-blue-300 bg-blue-50' : ''
                            }`}
                            title={isSpecialField ? 'Special field with custom rendering' : ''}
                        >
                          <span className="font-medium">{field.label}</span>
                          <span className="text-gray-600 ml-2">({field.source})</span>
                            {isSpecialField && (
                              <span className="ml-1 text-blue-600" title="Special field">★</span>
                            )}
                        </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-400 rounded text-xs">
                      <strong>Special Fields:</strong> Fields marked with ★ (data_sharing_scope, data_usage_purpose, data_types, regions, connection_diagram) have custom rendering with enhanced UI (checkboxes, Mermaid diagrams, etc.) when added to form layouts.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 mb-3">No fields available</div>
                )}
              </div>

              <button
                onClick={() => setSelectedFieldAccess({} as FieldAccess)}
                className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm mb-2"
              >
                + Configure Field Access
              </button>
              
              {fieldAccessLoading ? (
                <div className="text-sm text-gray-500 py-2">Loading field access controls...</div>
              ) : fieldAccessList && fieldAccessList.length > 0 ? (
                <div>
                  <div className="text-xs text-gray-600 mb-2">Configured field access:</div>
                  <div className="space-y-2">
                    {fieldAccessList.map((access) => (
                      <div
                        key={access.id}
                        className="p-3 border rounded text-sm cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedFieldAccess(access)}
                      >
                        <div className="font-medium">{access.field_name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Screen: {access.request_type} | Source: {access.field_source}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Roles: {Object.keys(access.role_permissions || {}).length} configured
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-2">
                  No field access controls configured yet. Click "+ Configure Field Access" to get started.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Layout Editor */}
        {editingLayout && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium">
                {selectedLayout ? 'Edit Layout' : 'Create Layout'}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`px-3 py-1 rounded text-sm ${
                    previewMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {previewMode ? '✕ Hide Preview' : '👁️ Preview'}
                </button>
              </div>
            </div>

                {previewMode ? (
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-medium mb-4">Form Preview</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Preview how the form will look with the current layout configuration
                    </p>
                    <div className="bg-gray-50 p-4 rounded">
                      <FormPreview
                        layout={editingLayout}
                        requestType={selectedRequestType}
                        requirements={requirements || []}
                        availableFieldsList={availableFieldsList}
                        formData={previewFormData}
                        onChange={(fieldName, value) => {
                          setPreviewFormData({ ...previewFormData, [fieldName]: value })
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Layout Name</label>
                      <input
                        type="text"
                        value={editingLayout.name || ''}
                        onChange={(e) => setEditingLayout({ ...editingLayout, name: e.target.value })}
                        className="enterprise-input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={editingLayout.description || ''}
                        onChange={(e) => setEditingLayout({ ...editingLayout, description: e.target.value })}
                        className="enterprise-input w-full"
                        rows={3}
                        placeholder="Enter a description for this layout..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Request Type *</label>
                        <select
                          value={editingLayout.request_type || selectedRequestType}
                          onChange={(e) => setEditingLayout({ ...editingLayout, request_type: e.target.value as any })}
                          className="enterprise-input w-full"
                          required
                        >
                          <option value="vendor">Vendor Submission</option>
                          <option value="admin">Admin</option>
                          <option value="approver">Approver</option>
                          <option value="end_user">End User</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Select the screen type this layout applies to</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Agent Type</label>
                        <select
                          value={editingLayout.agent_type || ''}
                          onChange={(e) => setEditingLayout({ 
                            ...editingLayout, 
                            agent_type: e.target.value || null 
                          })}
                          className="enterprise-input w-full"
                        >
                          <option value="">None (All Agent Types)</option>
                          <option value="inhouse">Inhouse</option>
                          <option value="external">External</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Filter by agent type (optional)</p>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-400 rounded-lg p-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingLayout.is_default || false}
                          onChange={(e) => {
                            const newValue = e.target.checked
                            // If setting as default, warn user if another default exists for same screen type
                            if (newValue && allLayouts) {
                              const existingDefault = allLayouts.find(
                                (l: FormLayout) => 
                                  l.id !== selectedLayout?.id && 
                                  l.request_type === (editingLayout.request_type || selectedRequestType) &&
                                  l.is_default &&
                                  l.is_active
                              )
                              if (existingDefault) {
                                const confirm = window.confirm(
                                  `Another default layout exists for ${formTypeLabels[editingLayout.request_type || selectedRequestType] || editingLayout.request_type || selectedRequestType}: "${existingDefault.name}".\n\nSetting this as default will replace it. Continue?`
                                )
                                if (!confirm) {
                                  return
                                }
                              }
                            }
                            setEditingLayout({ ...editingLayout, is_default: newValue })
                          }}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Set as default layout</div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            This layout will be used as the default for {formTypeLabels[editingLayout.request_type || selectedRequestType] || editingLayout.request_type || selectedRequestType} screen type
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Field Dependencies */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">Field Dependencies</label>
                        <button
                          onClick={() => {
                            // Add a new dependency
                            const fieldName = prompt('Enter field name that should be conditionally visible:')
                            if (fieldName && availableFields.includes(fieldName)) {
                              const dependsOn = prompt('Enter field name this depends on:')
                              if (dependsOn && availableFields.includes(dependsOn)) {
                                const condition = prompt('Enter condition (equals, not_equals, contains, is_empty, etc.):') || 'equals'
                                const value = prompt('Enter value to check against (leave empty for is_empty/is_not_empty):')
                                
                                const dependencies = editingLayout.field_dependencies || {}
                                dependencies[fieldName] = {
                                  depends_on: dependsOn,
                                  condition: condition as any,
                                  value: value || undefined,
                                }
                                setEditingLayout({ ...editingLayout, field_dependencies: dependencies })
                              }
                            }
                          }}
                          className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                        >
                          + Add Dependency
                        </button>
                      </div>
                      {editingLayout.field_dependencies && Object.keys(editingLayout.field_dependencies).length > 0 && (
                        <div className="space-y-2">
                          {Object.entries(editingLayout.field_dependencies).map(([fieldName, dep]: [string, any]) => {
                            const fieldInfo = availableFieldsList.find((f) => f.field_name === fieldName)
                            const dependsOnInfo = availableFieldsList.find((f) => f.field_name === dep.depends_on)
                            const displayLabel = fieldInfo?.label || fieldName
                            const dependsOnLabel = dependsOnInfo?.label || dep.depends_on
                            return (
                              <div key={fieldName} className="p-2 border rounded text-sm">
                                <div className="font-medium">{displayLabel} ({fieldName})</div>
                                <div className="text-xs text-gray-600">
                                  Depends on: {dependsOnLabel} ({dep.depends_on}) - {dep.condition} {dep.value !== undefined ? `"${dep.value}"` : ''}
                                </div>
                                <button
                                  onClick={() => {
                                    const dependencies = { ...(editingLayout.field_dependencies || {}) }
                                    delete dependencies[fieldName]
                                    setEditingLayout({ ...editingLayout, field_dependencies: dependencies })
                                  }}
                                  className="text-red-600 hover:text-red-800 text-xs mt-1"
                                >
                                  Remove
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Sections */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">Sections</label>
                        <button
                          onClick={handleAddSection}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                        >
                          + Add Section
                        </button>
                      </div>

                      <div className="space-y-4">
                        {editingLayout.sections?.map((section, idx) => (
                          <div key={section.id} className="border rounded p-4">
                            <div className="flex justify-between items-start mb-2">
                              <input
                                type="text"
                                value={section.title}
                                onChange={(e) => {
                                  const sections = [...(editingLayout.sections || [])]
                                  sections[idx].title = e.target.value
                                  setEditingLayout({ ...editingLayout, sections })
                                }}
                                className="enterprise-input flex-1 mr-2"
                                placeholder="Section Title"
                              />
                              <button
                                onClick={() => handleDeleteSection(section.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Delete
                              </button>
                            </div>

                            <div className="mt-2">
                              <label className="block text-xs text-gray-600 mb-1">Fields in this section:</label>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {section.fields.map((fieldName, fieldIndex) => {
                                  const fieldInfo = availableFieldsList.find((f) => f.field_name === fieldName)
                                  const displayLabel = fieldInfo?.label || fieldName
                                  return (
                                    <span
                                      key={`${fieldName}-${fieldIndex}`}
                                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm flex items-center gap-1"
                                      title={fieldInfo?.description || fieldName}
                                    >
                                      {displayLabel}
                                      <button
                                        onClick={() => handleRemoveFieldFromSection(section.id, fieldName)}
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  )
                                })}
                              </div>
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAddFieldToSection(section.id, e.target.value)
                                    e.target.value = ''
                                  }
                                }}
                                className="enterprise-input text-sm"
                                disabled={fieldsLoading}
                              >
                                <option value="">
                                  {fieldsLoading ? 'Loading fields...' : fieldsError ? 'Error loading fields' : availableFieldsList.length === 0 ? 'No fields available' : 'Add field...'}
                                </option>
                                {fieldsLoading ? null : (
                                  <>
                                    {/* Group by source */}
                                    {['submission_requirement', 'agent', 'agent_metadata'].map((source) => {
                                      // Get all fields already in the form (across all sections) to prevent duplicates
                                      const allFieldsInForm = editingLayout.sections?.flatMap(s => s.fields) || []
                                      const sourceFields = availableFieldsList.filter(
                                        (f) => f.source === source && !allFieldsInForm.includes(f.field_name)
                                      )
                                      if (sourceFields.length === 0) return null
                                      
                                      const sourceLabel = source === 'submission_requirement' 
                                        ? 'Submission Requirements' 
                                        : source === 'agent'
                                        ? 'Agent Fields'
                                        : 'Agent Metadata'
                                      
                                      return (
                                        <optgroup key={source} label={sourceLabel}>
                                          {sourceFields
                                            .sort((a, b) => (a.label || a.field_name || '').localeCompare(b.label || b.field_name || ''))
                                            .map((field) => (
                                            <option key={`${field.source}-${field.field_name}`} value={field.field_name} title={field.description}>
                                              {field.label} ({field.field_name})
                                            </option>
                                          ))}
                                        </optgroup>
                                      )
                                    })}
                                  </>
                                )}
                              </select>
                              {fieldsError && (
                                <p className="text-xs text-red-600 mt-1">
                                  Error loading fields. Please refresh the page.
                                </p>
                              )}
                              {!fieldsLoading && !fieldsError && availableFieldsList.length === 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  No fields available. Agent fields should load automatically.
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveLayout}
                        disabled={createLayoutMutation.isPending || updateLayoutMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        {createLayoutMutation.isPending || updateLayoutMutation.isPending ? 'Saving...' : 'Save Layout'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingLayout(null)
                          setSelectedLayout(null)
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                      {selectedLayout && (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this layout?')) {
                              deleteLayoutMutation.mutate(selectedLayout.id)
                            }
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
          </div>
        )}

        {/* Field Access Modal */}
        {selectedFieldAccess && (
          <FieldAccessModal
            fieldAccess={selectedFieldAccess}
            requestType={selectedRequestType}
            availableFields={availableFields}
            availableFieldsList={availableFieldsList}
            onClose={() => setSelectedFieldAccess(null)}
            onSave={(access) => {
              if (selectedFieldAccess.id) {
                // Update existing
                formLayoutsApi.updateFieldAccess(selectedFieldAccess.id, access).then(() => {
                  queryClient.invalidateQueries({ queryKey: ['field-access'] })
                  setSelectedFieldAccess(null)
                })
              } else {
                // Create new
                createFieldAccessMutation.mutate(access as FieldAccessCreate)
              }
            }}
          />
        )}
      </div>
    </Layout>
  )
}

function FieldAccessModal({
  fieldAccess,
  requestType,
  availableFields,
  availableFieldsList,
  onClose,
  onSave,
}: {
  fieldAccess: FieldAccess | Partial<FieldAccess>
  requestType: string
  availableFields: string[]
  availableFieldsList: Array<{ field_name: string; label: string; source: string; description?: string }>
  onClose: () => void
  onSave: (access: FieldAccessCreate | Partial<FieldAccessCreate>) => void
}) {
  const [fieldName, setFieldName] = useState(fieldAccess.field_name || '')
  // Auto-detect source from selected field
  const selectedField = availableFieldsList.find((f) => f.field_name === fieldName)
  const [fieldSource, setFieldSource] = useState<'submission_requirement' | 'agent'>(
    fieldAccess.field_source || (selectedField?.source === 'agent' || selectedField?.source === 'agent_metadata' ? 'agent' : 'submission_requirement')
  )
  
  // Update source when field changes
  useEffect(() => {
    if (fieldName && selectedField) {
      const newSource = selectedField.source === 'agent' || selectedField.source === 'agent_metadata' ? 'agent' : 'submission_requirement'
      setFieldSource(newSource)
    }
  }, [fieldName, selectedField])
  const [rolePermissions, setRolePermissions] = useState<Record<string, { view: boolean; edit: boolean }>>(
    fieldAccess.role_permissions || {}
  )

  const roles = [
    'tenant_admin',
    'approver',
    'security_reviewer',
    'compliance_reviewer',
    'technical_reviewer',
    'business_reviewer',
    'vendor_user',
    'end_user',
  ]

  const handleSave = () => {
    if (!fieldName) {
      alert('Please select a field')
      return
    }

    onSave({
      field_name: fieldName,
      field_source: fieldSource,
      request_type: requestType as any,
      role_permissions: rolePermissions,
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-medium mb-4">Configure Field Access</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
            <select
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="enterprise-input w-full"
              disabled={!!fieldAccess.id}
            >
              <option value="">Select field...</option>
              {/* Group by source */}
              {['submission_requirement', 'agent', 'agent_metadata'].map((source) => {
                const sourceFields = availableFieldsList.filter((f) => f.source === source)
                if (sourceFields.length === 0) return null
                
                const sourceLabel = source === 'submission_requirement' 
                  ? 'Submission Requirements' 
                  : source === 'agent'
                  ? 'Agent Fields'
                  : 'Agent Metadata'
                
                return (
                  <optgroup key={source} label={sourceLabel}>
                    {sourceFields
                      .sort((a, b) => (a.label || a.field_name || '').localeCompare(b.label || b.field_name || ''))
                      .map((field) => (
                      <option key={`${field.source}-${field.field_name}`} value={field.field_name} title={field.description}>
                        {field.label} ({field.field_name})
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            {selectedField?.description && (
              <p className="text-xs text-gray-500 mt-1">{selectedField.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Source</label>
            <select
              value={fieldSource}
              onChange={(e) => setFieldSource(e.target.value as any)}
              className="enterprise-input w-full"
              disabled={!!fieldAccess.id}
            >
              <option value="submission_requirement">Submission Requirement</option>
              <option value="agent">Agent Field</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role Permissions</label>
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role} className="flex items-center gap-4 p-2 border rounded">
                  <div className="flex-1 font-medium">{role}</div>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={rolePermissions[role]?.view || false}
                      onChange={(e) => {
                        setRolePermissions({
                          ...rolePermissions,
                          [role]: {
                            ...rolePermissions[role],
                            view: e.target.checked,
                            edit: e.target.checked ? rolePermissions[role]?.edit || false : false,
                          },
                        })
                      }}
                    />
                    View
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={rolePermissions[role]?.edit || false}
                      onChange={(e) => {
                        setRolePermissions({
                          ...rolePermissions,
                          [role]: {
                            ...rolePermissions[role],
                            edit: e.target.checked,
                            view: e.target.checked ? true : rolePermissions[role]?.view || false,
                          },
                        })
                      }}
                      disabled={!rolePermissions[role]?.view}
                    />
                    Edit
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Preview component that renders form without API calls
function FormPreview({
  layout,
  requestType,
  requirements,
  availableFieldsList,
  formData,
  onChange,
}: {
  layout: Partial<FormLayoutCreate> | null
  requestType: string
  requirements: SubmissionRequirement[]
  availableFieldsList: Array<{ field_name: string; label: string; source: string; description?: string }>
  formData: Record<string, any>
  onChange: (fieldName: string, value: any) => void
}) {
  if (!layout || !layout.sections || layout.sections.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Add sections and fields to see preview
      </div>
    )
  }

  const requirementsMap = new Map<string, SubmissionRequirement>()
  requirements.forEach((req) => {
    requirementsMap.set(req.field_name, req)
  })

  const renderField = (fieldName: string, sectionId: string) => {
    const requirement = requirementsMap.get(fieldName)
    const fieldInfo = availableFieldsList.find((f) => f.field_name === fieldName)
    const value = formData[fieldName] || ''
    const displayLabel = fieldInfo?.label || fieldName.replace(/_/g, ' ')
    
    // Get field_config and field_type_display from fieldInfo
    const fieldConfig = (fieldInfo as any)?.field_config || {}
    const fieldOptions = fieldConfig.options || []
    const fieldType = (fieldInfo as any)?.field_type_display || fieldInfo?.field_type || 'text'
    
    // Normalize field value based on field type
    let fieldValue = value
    if (fieldType === 'multi_select' || (fieldType === 'json' && fieldOptions.length > 0)) {
      if (!Array.isArray(fieldValue)) {
        if (fieldValue && typeof fieldValue === 'string') {
          try {
            const parsed = JSON.parse(fieldValue)
            fieldValue = Array.isArray(parsed) ? parsed : [parsed]
          } catch {
            fieldValue = fieldValue.includes(',') ? fieldValue.split(',').map((v: string) => v.trim()) : [fieldValue]
          }
        } else {
          fieldValue = fieldValue ? [fieldValue] : []
        }
      }
    } else {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) {
        fieldValue = fieldValue[0]
      } else if (Array.isArray(fieldValue)) {
        fieldValue = ''
      }
    }

    // Handle special fields with field_config (before checking requirement)
    if (fieldInfo && (fieldOptions.length > 0 || fieldConfig.depends_on)) {
      // Handle select fields with options (but not dependent fields)
      if (fieldType === 'select' && fieldOptions.length > 0 && !fieldConfig.depends_on) {
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
            )}
            <select
              value={fieldValue || ''}
              onChange={(e) => {
                const updates: any = { [fieldName]: e.target.value }
                if (fieldName === 'llm_vendor') {
                  updates.llm_model = ''
                }
                onChange(fieldName, e.target.value)
                // Also update dependent fields if needed
                if (fieldName === 'llm_vendor' && formData) {
                  onChange('llm_model', '')
                }
              }}
              className="enterprise-input"
            >
              <option value="">Select {displayLabel.toLowerCase()}...</option>
              {fieldOptions.map((opt: any) => {
                const optionValue = typeof opt === 'string' ? opt : opt.value
                const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value)
                return (
                  <option key={optionValue} value={optionValue}>
                    {optionLabel}
                  </option>
                )
              })}
            </select>
          </div>
        )
      }
      
      // Handle multi_select fields with options (checkboxes)
      if ((fieldType === 'multi_select' || (fieldType === 'json' && fieldOptions.length > 0)) && fieldOptions.length > 0) {
        const selectedValues = Array.isArray(fieldValue) ? fieldValue : (fieldValue ? [fieldValue] : [])
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">{displayLabel}</label>
            {fieldInfo?.description && (
              <p className="text-xs text-gray-500 mb-3">{fieldInfo.description}</p>
            )}
            <div className="grid grid-cols-2 gap-3 border border-gray-200 rounded-lg p-4">
              {fieldOptions.map((opt: any) => {
                const optionValue = typeof opt === 'string' ? opt : opt.value
                const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value)
                return (
                  <label key={optionValue} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(optionValue)}
                      onChange={(e) => {
                        const newValues = e.target.checked
                          ? [...selectedValues, optionValue]
                          : selectedValues.filter((v: any) => v !== optionValue)
                        onChange(fieldName, newValues)
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{optionLabel}</span>
                  </label>
                )
              })}
            </div>
            {selectedValues.length > 0 && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-400 rounded text-xs">
                <strong>Selected:</strong> {selectedValues.map((v: any) => {
                  const opt = fieldOptions.find((o: any) => (typeof o === 'string' ? o : o.value) === v)
                  return typeof opt === 'string' ? opt : (opt?.label || v)
                }).join(', ')}
              </div>
            )}
          </div>
        )
      }
      
      // Handle dependent select fields (e.g., llm_model depends on llm_vendor)
      if (fieldType === 'select' && fieldConfig.depends_on) {
        const dependsOnValue = formData[fieldConfig.depends_on] || ''
        const dependentOptions = dependsOnValue && fieldConfig.dependent_options 
          ? (fieldConfig.dependent_options[dependsOnValue] || [])
          : []
        
        if (!dependsOnValue) {
          return (
            <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
              <label className="enterprise-label">{displayLabel}</label>
              {fieldInfo?.description && (
                <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
              )}
              <div className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded border border-gray-200">
                Please select {fieldConfig.depends_on_label || fieldConfig.depends_on.replace(/_/g, ' ')} first
              </div>
            </div>
          )
        }
        
        if (dependentOptions.length > 0) {
          return (
            <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
              <label className="enterprise-label">{displayLabel}</label>
              {fieldInfo?.description && (
                <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
              )}
              <select
                value={fieldValue || ''}
                onChange={(e) => onChange(fieldName, e.target.value)}
                className="enterprise-input"
              >
                <option value="">Select {displayLabel.toLowerCase()}...</option>
                {dependentOptions.map((opt: any) => {
                  const optionValue = typeof opt === 'string' ? opt : opt.value
                  const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value)
                  return (
                    <option key={optionValue} value={optionValue}>
                      {optionLabel}
                    </option>
                  )
                })}
              </select>
            </div>
          )
        } else {
          // No predefined options, show text input
          return (
            <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
              <label className="enterprise-label">{displayLabel}</label>
              {fieldInfo?.description && (
                <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
              )}
              <input
                type="text"
                value={fieldValue || ''}
                onChange={(e) => onChange(fieldName, e.target.value)}
                className="enterprise-input"
                placeholder={fieldConfig.placeholder || `Enter ${displayLabel.toLowerCase()}...`}
              />
            </div>
          )
        }
      }
    }

    if (!requirement) {
      // Simple text field for unknown fields (agent fields)
      return (
        <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
          <label className="enterprise-label">{displayLabel}</label>
          {fieldInfo?.description && (
            <p className="text-xs text-gray-500 mb-1">{fieldInfo.description}</p>
          )}
          <input
            type="text"
            value={fieldValue}
            onChange={(e) => onChange(fieldName, e.target.value)}
            className="enterprise-input"
            placeholder={fieldInfo?.description}
          />
        </div>
      )
    }

    switch (requirement.field_type) {
      case 'textarea':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">
              {requirement.label}
              {requirement.is_required && <span className="text-red-600 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => onChange(fieldName, e.target.value)}
              className="enterprise-input"
              rows={4}
              placeholder={requirement.placeholder}
            />
          </div>
        )
      case 'select':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">
              {requirement.label}
              {requirement.is_required && <span className="text-red-600 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => onChange(fieldName, e.target.value)}
              className="enterprise-input"
            >
              <option value="">Select...</option>
              {requirement.options?.map((opt: any) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label || opt.value}
                </option>
              ))}
            </select>
          </div>
        )
      case 'checkbox':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => onChange(fieldName, e.target.checked)}
                className="mr-2"
              />
              {requirement.label}
              {requirement.is_required && <span className="text-red-600 ml-1">*</span>}
            </label>
          </div>
        )
      default:
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">
              {requirement.label}
              {requirement.is_required && <span className="text-red-600 ml-1">*</span>}
            </label>
            <input
              type={requirement.field_type === 'number' ? 'number' : requirement.field_type === 'email' ? 'email' : 'text'}
              value={value}
              onChange={(e) => onChange(fieldName, e.target.value)}
              className="enterprise-input"
              placeholder={requirement.placeholder}
            />
          </div>
        )
    }
  }

  return (
    <form className="space-y-6">
      {layout.sections
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <div key={section.id} className="border rounded-lg p-4 bg-white">
            <h3 className="text-lg font-medium mb-4">{section.title}</h3>
            {section.description && (
              <p className="text-sm text-gray-600 mb-4">{section.description}</p>
            )}
            <div className="space-y-4">
              {section.fields.map((fieldName) => renderField(fieldName, section.id))}
            </div>
          </div>
        ))}
    </form>
  )
}
