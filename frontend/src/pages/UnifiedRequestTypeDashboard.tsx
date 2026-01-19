import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { MaterialButton, MaterialCard, MaterialChip, MaterialInput, MaterialSelect } from '../components/material'
import { 
  requestTypeConfigApi, 
  RequestTypeConfig, 
  RequestTypeConfigCreate, 
  RequestTypeConfigUpdate, 
  VisibilityScope,
  FormAssociation
} from '../lib/requestTypeConfig'
import { formLayoutsApi, FormLayout } from '../lib/formLayouts'
import { workflowConfigApi, WorkflowConfig } from '../lib/workflowConfig'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { 
  PlusIcon, 
  EditIcon, 
  TrashIcon, 
  SaveIcon, 
  EyeIcon, 
  SearchIcon, 
  FileTextIcon, 
  CogIcon,
  LinkIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '../components/Icons'
import { showToast } from '../utils/toast'
import { CACHE_CONFIG, QUERY_KEYS } from '../utils/cacheUtils'

// Types for our unified dashboard
interface UnifiedRequestType extends RequestTypeConfig {
  associatedForms: FormAssociation[]
}

const VISIBILITY_OPTIONS = [
  { value: VisibilityScope.INTERNAL, label: 'Internal Portal Only' },
  { value: VisibilityScope.EXTERNAL, label: 'External Portal Only' },
  { value: VisibilityScope.BOTH, label: 'Both Portals' }
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
]

const FORM_VARIATION_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'custom', label: 'Custom' }
]

export default function UnifiedRequestTypeDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterScope, setFilterScope] = useState('all')
  const [selectedRequestType, setSelectedRequestType] = useState<UnifiedRequestType | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFormAssociationModal, setShowFormAssociationModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<RequestTypeConfig | null>(null)
  
  const [formData, setFormData] = useState<Partial<RequestTypeConfigCreate>>({
    request_type: '',
    display_name: '',
    visibility_scope: VisibilityScope.BOTH,
    icon_name: '',
    sort_order: 0,
    is_active: true
  })

  // State for form association
  const [formAssociationData, setFormAssociationData] = useState({
    form_layout_id: '',
    display_order: 0,
    is_primary: false,
    form_variation_type: 'standard'
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Fetch request type configurations with form associations
  const { 
    data: configs = [], 
    isLoading: configsLoading, 
    isError: configsError, 
    error: configsErrorDetail 
  } = useQuery<UnifiedRequestType[]>({
    queryKey: QUERY_KEYS.REQUEST_TYPES(user?.tenant_id),
    queryFn: async () => {
      try {
        // First get basic request type configs
        console.log('Fetching request type configs...')
        const basicConfigs = await requestTypeConfigApi.getAll()
        console.log('Got basic configs:', basicConfigs.length)
        
        // Then get form associations for each config
        const configsPromises = basicConfigs.map(async (config) => {
          try {
            console.log(`Fetching forms for config ${config.id}...`)
            const forms = await requestTypeConfigApi.getAssociatedForms(config.id)
            console.log(`Got ${forms.length} forms for config ${config.id}`)
            return { ...config, associatedForms: forms }
          } catch (error: any) {
            console.warn(`Failed to fetch forms for request type ${config.id}:`, error)
            // Return config with empty forms array instead of failing completely
            return { ...config, associatedForms: [] }
          }
        })
        
        const result = await Promise.all(configsPromises)
        console.log('Final result:', result.length, 'configs')
        return result
      } catch (error: any) {
        console.error('Failed to fetch request type configs:', error)
        throw error
      }
    },
    enabled: !!user && !!user.tenant_id,
    ...CACHE_CONFIG.REQUEST_TYPES,
    retry: 2,
    retryDelay: 1000
  })

  // Fetch available workflows
  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<WorkflowConfig[]>({
    queryKey: QUERY_KEYS.WORKFLOWS(user?.tenant_id),
    queryFn: () => workflowConfigApi.list(),
    enabled: !!user,
    ...CACHE_CONFIG.WORKFLOWS
  })

  // Fetch all form layouts for association modal
  const { data: allForms = [], isLoading: formsLoading } = useQuery<FormLayout[]>({
    queryKey: ['form-layouts', 'all'],
    queryFn: () => formLayoutsApi.list(),
    enabled: !!user,
    staleTime: 10 * 60 * 1000
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: RequestTypeConfigCreate) => requestTypeConfigApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUEST_TYPES(user?.tenant_id) })
      setShowCreateModal(false)
      resetForm()
      showToast.success('Request type created successfully')
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to create request type')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RequestTypeConfigUpdate }) => 
      requestTypeConfigApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUEST_TYPES(user?.tenant_id) })
      setShowEditModal(false)
      setEditingConfig(null)
      resetForm()
      showToast.success('Request type updated successfully')
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to update request type')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => requestTypeConfigApi.delete(id),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUEST_TYPES(user?.tenant_id) })
      if (selectedRequestType?.id === id) {
        setSelectedRequestType(null)
      }
      showToast.success('Request type deleted successfully')
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to delete request type')
    }
  })

  const associateFormMutation = useMutation({
    mutationFn: ({ requestTypeId, data }: { requestTypeId: string; data: any }) => 
      requestTypeConfigApi.associateForm(requestTypeId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUEST_TYPES(user?.tenant_id) })
      // Also invalidate the specific request type's form associations
      queryClient.invalidateQueries({ queryKey: ['request-type-forms', variables.requestTypeId] })
      setShowFormAssociationModal(false)
      resetFormAssociation()
      showToast.success('Form associated successfully')
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to associate form')
    }
  })

  const dissociateFormMutation = useMutation({
    mutationFn: ({ requestTypeId, formId }: { requestTypeId: string; formId: string }) => 
      requestTypeConfigApi.dissociateForm(requestTypeId, formId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUEST_TYPES(user?.tenant_id) })
      queryClient.invalidateQueries({ queryKey: ['request-type-forms', variables.requestTypeId] })
      showToast.success('Form dissociated successfully')
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to dissociate form')
    }
  })

  // Filtered and searched configs
  const filteredConfigs = useMemo(() => {
    let result: UnifiedRequestType[] = [...configs]
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(config => 
        config.request_type.toLowerCase().includes(term) ||
        config.display_name.toLowerCase().includes(term)
      )
    }
    
    // Apply scope filter
    if (filterScope !== 'all') {
      result = result.filter(config => config.visibility_scope === filterScope)
    }
    
    return result
  }, [configs, searchTerm, filterScope])

  // Reset functions
  const resetForm = () => {
    setFormData({
      request_type: '',
      display_name: '',
      visibility_scope: VisibilityScope.BOTH,
      icon_name: '',
      sort_order: 0,
      is_active: true
    })
  }

  const resetFormAssociation = () => {
    setFormAssociationData({
      form_layout_id: '',
      display_order: 0,
      is_primary: false,
      form_variation_type: 'standard'
    })
  }

  // Handler functions
  const handleCreate = () => {
    if (!formData.request_type || !formData.display_name) {
      showToast.error('Request type and display name are required')
      return
    }
    createMutation.mutate(formData as RequestTypeConfigCreate)
  }

  const handleUpdate = () => {
    if (!editingConfig || !formData.display_name) {
      showToast.error('Display name is required')
      return
    }
    updateMutation.mutate({
      id: editingConfig.id,
      data: formData as RequestTypeConfigUpdate
    })
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this request type? This will not delete associated forms.')) {
      deleteMutation.mutate(id)
    }
  }

  const handleAssociateForm = () => {
    if (!selectedRequestType || !formAssociationData.form_layout_id) {
      showToast.error('Request type and form must be selected')
      return
    }
    
    associateFormMutation.mutate({
      requestTypeId: selectedRequestType.id,
      data: formAssociationData
    })
  }

  const handleDissociateForm = (formId: string) => {
    if (!selectedRequestType) return
    
    if (window.confirm('Are you sure you want to remove this form association?')) {
      dissociateFormMutation.mutate({
        requestTypeId: selectedRequestType.id,
        formId
      })
    }
  }

  const handleSelectRequestType = (config: UnifiedRequestType) => {
    setSelectedRequestType(config)
  }

  const getVisibilityBadge = (scope: VisibilityScope) => {
    const colors = {
      [VisibilityScope.INTERNAL]: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Internal' },
      [VisibilityScope.EXTERNAL]: { bg: 'bg-green-100', text: 'text-green-800', label: 'External' },
      [VisibilityScope.BOTH]: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Both' }
    }
    
    const color = colors[scope]
    return (
      <MaterialChip 
        label={color.label}
        size="small"
        className={`${color.bg} ${color.text} border border-opacity-20`}
      />
    )
  }

  const getStatusBadge = (isActive: boolean) => {
    return (
      <MaterialChip 
        label={isActive ? 'Active' : 'Inactive'} 
        color={isActive ? 'success' : 'default'} 
        size="small" 
      />
    )
  }

  const getFormVariationBadge = (variationType: string | null) => {
    if (!variationType) return null
    
    const variationColors: Record<string, string> = {
      'standard': 'bg-gray-100 text-gray-800',
      'advanced': 'bg-blue-100 text-blue-800',
      'minimal': 'bg-green-100 text-green-800',
      'custom': 'bg-purple-100 text-purple-800'
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${variationColors[variationType] || 'bg-gray-100 text-gray-800'}`}>
        {variationType}
      </span>
    )
  }

  // Error handling
  if (configsError) {
    return (
      <Layout user={user}>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-medium text-red-800 mb-2">Unable to load data</h3>
            <p className="text-red-600 mb-4">There was an error loading request types. Please try again.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  // Error display
  if (configsError) {
    return (
      <Layout user={user}>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-800">Unable to load request types</h3>
                <div className="mt-2 text-red-700">
                  <p>There was an error loading request type data.</p>
                  {configsErrorDetail && (
                    <p className="mt-1 text-sm">
                      Error details: {String(configsErrorDetail)}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Reload Page
                  </button>
                  <button
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUEST_TYPES(user?.tenant_id) })
                    }}
                    className="px-4 py-2 bg-white text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Workflow Configuration</h1>
              <p className="text-gray-600 mt-1">
                Manage request types and their associated forms in one place
              </p>
            </div>
            <MaterialButton
              variant="contained"
              color="primary"
              startIcon={<PlusIcon />}
              onClick={() => setShowCreateModal(true)}
            >
              New Request Type
            </MaterialButton>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Request Type List */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200">
              <div className="space-y-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <MaterialInput
                    placeholder="Search request types..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <MaterialSelect
                  value={filterScope}
                  onChange={(e) => setFilterScope(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Scopes' },
                    { value: VisibilityScope.INTERNAL, label: 'Internal Only' },
                    { value: VisibilityScope.EXTERNAL, label: 'External Only' },
                    { value: VisibilityScope.BOTH, label: 'Both Portals' }
                  ]}
                  fullWidth
                />
              </div>
            </div>

            {/* Loading State */}
            {configsLoading ? (
              <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-600">Loading request types...</p>
              </div>
            ) : (
              /* Request Types List */
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                  {filteredConfigs.map((config) => (
                    <MaterialCard 
                      key={config.id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedRequestType?.id === config.id 
                          ? 'ring-2 ring-blue-500 border-blue-500' 
                          : 'hover:border-gray-300'
                      }`}
                      onClick={() => handleSelectRequestType(config)}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {config.icon_name ? (
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 font-semibold">{config.icon_name.charAt(0)}</span>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <FileTextIcon className="w-5 h-5 text-gray-500" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-gray-900 truncate">{config.display_name}</h3>
                              <p className="text-sm text-gray-500 font-mono truncate">{config.request_type}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-2">
                            {getVisibilityBadge(config.visibility_scope)}
                            {getStatusBadge(config.is_active)}
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              {config.associatedForms.length} forms
                            </span>
                          </div>
                        </div>
                        
                        {/* Form Preview Chips */}
                        {config.associatedForms.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {config.associatedForms.slice(0, 3).map((form) => (
                              <span 
                                key={form.id} 
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                {form.form_layout?.name || 'Unnamed Form'}
                              </span>
                            ))}
                            {config.associatedForms.length > 3 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-600">
                                +{config.associatedForms.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </MaterialCard>
                  ))}

                  {filteredConfigs.length === 0 && (
                    <div className="text-center py-12">
                      <FileTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No request types found</h3>
                      <p className="text-gray-500">
                        {searchTerm || filterScope !== 'all'
                          ? 'Try adjusting your search or filter criteria'
                          : 'Create your first request type to get started'}
                      </p>
                      {!searchTerm && filterScope === 'all' && (
                        <MaterialButton
                          variant="contained"
                          color="primary"
                          startIcon={<PlusIcon />}
                          onClick={() => setShowCreateModal(true)}
                          className="mt-4"
                        >
                          Create Request Type
                        </MaterialButton>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Detail View */}
          <div className="w-1/2 flex flex-col">
            {selectedRequestType ? (
              <>
                {/* Detail Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedRequestType.display_name}</h2>
                      <p className="text-gray-600 mt-1">{selectedRequestType.request_type}</p>
                    </div>
                    <div className="flex gap-2">
                      <MaterialButton
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setEditingConfig(selectedRequestType)
                          setFormData({
                            request_type: selectedRequestType.request_type,
                            display_name: selectedRequestType.display_name,
                            visibility_scope: selectedRequestType.visibility_scope,
                            icon_name: selectedRequestType.icon_name || '',
                            sort_order: selectedRequestType.sort_order,
                            is_active: selectedRequestType.is_active,
                            workflow_id: selectedRequestType.workflow_id
                          })
                          setShowEditModal(true)
                        }}
                      >
                        Edit
                      </MaterialButton>
                      <MaterialButton
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<TrashIcon />}
                        onClick={() => handleDelete(selectedRequestType.id)}
                      >
                        Delete
                      </MaterialButton>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mt-4">
                    {getVisibilityBadge(selectedRequestType.visibility_scope)}
                    {getStatusBadge(selectedRequestType.is_active)}
                    <div className="flex items-center gap-1">
                      <FileTextIcon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {selectedRequestType.associatedForms.length} associated forms
                      </span>
                    </div>
                  </div>
                </div>

                {/* Forms Section */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Associated Forms</h3>
                      <MaterialButton
                        variant="contained"
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={() => setShowFormAssociationModal(true)}
                      >
                        Associate Form
                      </MaterialButton>
                    </div>

                    {selectedRequestType.associatedForms.length === 0 ? (
                      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                        <FileTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">No forms associated</h4>
                        <p className="text-gray-600 mb-4">
                          Associate forms with this request type to define the workflow
                        </p>
                        <MaterialButton
                          variant="outlined"
                          startIcon={<LinkIcon />}
                          onClick={() => setShowFormAssociationModal(true)}
                        >
                          Associate First Form
                        </MaterialButton>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedRequestType.associatedForms.map((form) => (
                          <MaterialCard key={form.id} className="hover:shadow-md transition-shadow">
                            <div className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-gray-900 truncate">{form.form_layout?.name || 'Unnamed Form'}</h4>
                                    {getFormVariationBadge(form.is_default ? 'primary' : 'standard')}
                                  </div>
                                  {form.form_layout?.description && (
                                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                      {form.form_layout.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span>Order: {form.sort_order}</span>
                                    <span className={`inline-flex items-center ${form.form_layout?.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                      {form.form_layout?.is_active ? '● Active' : '● Inactive'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 ml-4">
                                  <MaterialButton
                                    variant="text"
                                    size="small"
                                    startIcon={<EyeIcon />}
                                    onClick={() => navigate(`/admin/form-designer/${form.form_layout_id}`)}
                                  >
                                    Edit Form
                                  </MaterialButton>
                                  <MaterialButton
                                    variant="text"
                                    size="small"
                                    color="error"
                                    startIcon={<XIcon />}
                                    onClick={() => handleDissociateForm(form.form_layout_id)}
                                  >
                                    Remove
                                  </MaterialButton>
                                </div>
                              </div>
                            </div>
                          </MaterialCard>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <FileTextIcon className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">Select a Request Type</h3>
                <p className="text-gray-600 max-w-md">
                  Choose a request type from the list to view details and manage associated forms
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {showCreateModal ? 'New Request Type' : 'Edit Request Type'}
                    </h3>
                    <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="text-gray-400 hover:text-gray-500">
                      <XIcon className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Display Name</label>
                      <MaterialInput
                        fullWidth
                        value={formData.display_name}
                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                        placeholder="e.g. Agent Onboarding"
                      />
                    </div>
                    {showCreateModal && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Request Type ID</label>
                        <MaterialInput
                          fullWidth
                          value={formData.request_type}
                          onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
                          placeholder="e.g. agent_onboarding_workflow"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Visibility Scope</label>
                      <MaterialSelect
                        fullWidth
                        value={formData.visibility_scope}
                        onChange={(e) => setFormData({ ...formData, visibility_scope: e.target.value as VisibilityScope })}
                        options={VISIBILITY_OPTIONS}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Sort Order</label>
                      <MaterialInput
                        fullWidth
                        type="number"
                        value={formData.sort_order}
                        onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">Active</label>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <MaterialButton
                    variant="contained"
                    color="primary"
                    onClick={showCreateModal ? handleCreate : handleUpdate}
                    className="sm:ml-3"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {showCreateModal ? 'Create' : 'Save Changes'}
                  </MaterialButton>
                  <MaterialButton
                    variant="outlined"
                    onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                  >
                    Cancel
                  </MaterialButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Association Modal */}
        {showFormAssociationModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowFormAssociationModal(false)}>
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Associate Form</h3>
                    <button onClick={() => setShowFormAssociationModal(false)} className="text-gray-400 hover:text-gray-500">
                      <XIcon className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Select Form</label>
                      <MaterialSelect
                        fullWidth
                        value={formAssociationData.form_layout_id}
                        onChange={(e) => setFormAssociationData({ ...formAssociationData, form_layout_id: e.target.value })}
                        options={allForms.map(f => ({ value: f.id, label: f.name }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Variation Type</label>
                      <MaterialSelect
                        fullWidth
                        value={formAssociationData.form_variation_type}
                        onChange={(e) => setFormAssociationData({ ...formAssociationData, form_variation_type: e.target.value })}
                        options={FORM_VARIATION_TYPES}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Display Order</label>
                      <MaterialInput
                        fullWidth
                        type="number"
                        value={formAssociationData.display_order}
                        onChange={(e) => setFormAssociationData({ ...formAssociationData, display_order: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formAssociationData.is_primary}
                        onChange={(e) => setFormAssociationData({ ...formAssociationData, is_primary: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">Primary Form</label>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <MaterialButton
                    variant="contained"
                    color="primary"
                    onClick={handleAssociateForm}
                    className="sm:ml-3"
                    disabled={associateFormMutation.isPending}
                  >
                    Associate
                  </MaterialButton>
                  <MaterialButton
                    variant="outlined"
                    onClick={() => setShowFormAssociationModal(false)}
                  >
                    Cancel
                  </MaterialButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
