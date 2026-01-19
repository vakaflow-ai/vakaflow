import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialButton, MaterialCard, MaterialChip, MaterialInput, MaterialSelect } from '../components/material'
import { requestTypeConfigApi, RequestTypeConfig, RequestTypeConfigCreate, RequestTypeConfigUpdate, VisibilityScope } from '../lib/requestTypeConfig'
import { workflowConfigApi, WorkflowConfig } from '../lib/workflowConfig'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { PlusIcon, EditIcon, TrashIcon, SaveIcon, XIcon, EyeIcon, SearchIcon, FileTextIcon, CogIcon } from '../components/Icons'
import { showToast } from '../utils/toast'

const VISIBILITY_OPTIONS = [
  { value: VisibilityScope.INTERNAL, label: 'Internal Portal Only' },
  { value: VisibilityScope.EXTERNAL, label: 'External Portal Only' },
  { value: VisibilityScope.BOTH, label: 'Both Portals' }
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
]

export default function RequestTypeManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<RequestTypeConfig | null>(null)
  const [formData, setFormData] = useState<Partial<RequestTypeConfigCreate>>({
    request_type: '',
    display_name: '',
    visibility_scope: VisibilityScope.BOTH,
    icon_name: '',
    sort_order: 0,
    is_active: true
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Fetch request type configurations with optimized caching
  const { data: configs = [], isLoading: configsLoading, isError: configsError } = useQuery<RequestTypeConfig[]>({
    queryKey: ['request-type-configs', user?.tenant_id],
    queryFn: () => requestTypeConfigApi.getAll(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (renamed from cacheTime)
    retry: 2,
    retryDelay: 1000
  })

  // Fetch available workflows with optimized caching
  const { data: workflows = [], isLoading: workflowsLoading, isError: workflowsError } = useQuery<WorkflowConfig[]>({
    queryKey: ['workflows', 'active', user?.tenant_id],
    queryFn: () => workflowConfigApi.list(),
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes (renamed from cacheTime)
    retry: 2,
    retryDelay: 1000
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: RequestTypeConfigCreate) => requestTypeConfigApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-type-configs'] })
      setShowCreateModal(false)
      resetForm()
      showToast.success('Request type created successfully')
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to create request type')
    }
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RequestTypeConfigUpdate }) => 
      requestTypeConfigApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-type-configs'] })
      setEditingConfig(null)
      resetForm()
      showToast.success('Request type updated successfully')
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to update request type')
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => requestTypeConfigApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-type-configs'] })
      showToast.success('Request type deleted successfully')
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to delete request type')
    }
  })

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
    if (window.confirm('Are you sure you want to delete this request type?')) {
      deleteMutation.mutate(id)
    }
  }

  // Memoize filtered configs to prevent re-computation
  const filteredConfigs = useMemo(() => {
    if (!searchTerm) return configs;
    const term = searchTerm.toLowerCase();
    return configs.filter((config: RequestTypeConfig) =>
      config.request_type.toLowerCase().includes(term) ||
      config.display_name.toLowerCase().includes(term)
    );
  }, [configs, searchTerm]);

  const getVisibilityBadge = (scope: VisibilityScope) => {
    switch (scope) {
      case VisibilityScope.INTERNAL:
        return <MaterialChip label="Internal" color="primary" size="small" />
      case VisibilityScope.EXTERNAL:
        return <MaterialChip label="External" color="success" size="small" />
      case VisibilityScope.BOTH:
        return <MaterialChip label="Both" color="secondary" size="small" />
    }
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

  // Error handling
  if (configsError || workflowsError) {
    return (
      <Layout user={user}>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-medium text-red-800 mb-2">Unable to load data</h3>
            <p className="text-red-600 mb-4">There was an error loading request types or workflows. Please try again.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) return null

  return (
    <Layout user={user}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Request Type Management</h1>
              <p className="text-gray-600 mt-1">
                Manage request categories, workflow mappings, and visibility settings
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

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <MaterialInput
              placeholder="Search request types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Loading State */}
        {(configsLoading || workflowsLoading) ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">
              {configsLoading && workflowsLoading 
                ? 'Loading request types and workflows...' 
                : configsLoading 
                  ? 'Loading request types...' 
                  : 'Loading workflows...'}
            </p>
            <div className="w-64 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: configsLoading && workflowsLoading ? '50%' : '75%' }}
              ></div>
            </div>
          </div>
        ) : (
          /* Request Types List */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredConfigs.map((config: RequestTypeConfig) => (
              <MaterialCard key={config.id} className="hover:shadow-lg transition-shadow">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {config.icon_name ? (
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">{config.icon_name.charAt(0)}</span>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <FileTextIcon className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">{config.display_name}</h3>
                        <p className="text-sm text-gray-500 font-mono">{config.request_type}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <MaterialButton
                        variant="text"
                        size="small"
                        onClick={() => {
                          setEditingConfig(config)
                          setFormData({
                            display_name: config.display_name,
                            visibility_scope: config.visibility_scope,
                            icon_name: config.icon_name || '',
                            sort_order: config.sort_order,
                            is_active: config.is_active
                          })
                        }}
                      >
                        <EditIcon className="w-4 h-4" />
                      </MaterialButton>
                      <MaterialButton
                        variant="text"
                        size="small"
                        color="error"
                        onClick={() => handleDelete(config.id)}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </MaterialButton>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Visibility:</span>
                      {getVisibilityBadge(config.visibility_scope)}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      {getStatusBadge(config.is_active)}
                    </div>

                    {config.workflow_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Workflow:</span>
                        <div className="flex items-center gap-2">
                          <CogIcon className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900">
                            {workflows.find((w: WorkflowConfig) => w.id === config.workflow_id)?.name || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Sort Order:</span>
                      <span className="text-sm font-medium text-gray-900">{config.sort_order}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Created: {new Date(config.created_at).toLocaleDateString()}</span>
                      <span>ID: {config.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              </MaterialCard>
            ))}

            {filteredConfigs.length === 0 && (
              <div className="col-span-full text-center py-12">
                <FileTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No request types found</h3>
                <p className="text-gray-500">
                  {searchTerm ? 'Try adjusting your search terms' : 'Create your first request type to get started'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingConfig) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingConfig ? 'Edit Request Type' : 'Create Request Type'}
                  </h2>
                  <MaterialButton
                    variant="text"
                    onClick={() => {
                      setShowCreateModal(false)
                      setEditingConfig(null)
                      resetForm()
                    }}
                  >
                    <XIcon className="w-5 h-5" />
                  </MaterialButton>
                </div>

                <div className="space-y-6">
                  {/* Request Type (readonly when editing) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Request Type *
                    </label>
                    <MaterialInput
                      placeholder="e.g., agent_onboarding, product_submission"
                      value={formData.request_type || ''}
                      onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
                      disabled={!!editingConfig}
                      helperText={editingConfig ? "Cannot be changed after creation" : "Unique identifier for this request type"}
                    />
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name *
                    </label>
                    <MaterialInput
                      placeholder="e.g., Agent Onboarding, Product Submission"
                      value={formData.display_name || ''}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    />
                  </div>

                  {/* Icon Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Icon Name
                    </label>
                    <MaterialInput
                      placeholder="e.g., robot, cube, building"
                      value={formData.icon_name || ''}
                      onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                      helperText="Used for visual representation in the UI"
                    />
                  </div>

                  {/* Visibility Scope */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visibility Scope
                    </label>
                    <MaterialSelect
                      value={formData.visibility_scope || VisibilityScope.BOTH}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        visibility_scope: e.target.value as VisibilityScope 
                      })}
                      options={VISIBILITY_OPTIONS}
                      fullWidth
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Controls where this request type appears (internal portal, external portal, or both)
                    </p>
                  </div>

                  {/* Workflow Mapping */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Associated Workflow
                    </label>
                    <MaterialSelect
                      value={formData.workflow_id || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        workflow_id: e.target.value || undefined
                      })}
                      options={[
                        { value: '', label: 'No workflow assigned' },
                        ...(workflows as WorkflowConfig[]).map((workflow: WorkflowConfig) => ({
                          value: workflow.id,
                          label: workflow.name
                        }))
                      ]}
                      fullWidth
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Optional: Link this request type to a specific workflow
                    </p>
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sort Order
                    </label>
                    <MaterialInput
                      type="number"
                      placeholder="0"
                      value={formData.sort_order || 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        sort_order: parseInt(e.target.value) || 0 
                      })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Lower numbers appear first in lists
                    </p>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <MaterialSelect
                      value={formData.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        is_active: e.target.value === 'active'
                      })}
                      options={STATUS_OPTIONS}
                      fullWidth
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                  <MaterialButton
                    variant="outlined"
                    onClick={() => {
                      setShowCreateModal(false)
                      setEditingConfig(null)
                      resetForm()
                    }}
                  >
                    Cancel
                  </MaterialButton>
                  <MaterialButton
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    onClick={editingConfig ? handleUpdate : handleCreate}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingConfig ? 'Update' : 'Create'}
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