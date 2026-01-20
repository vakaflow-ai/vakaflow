import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialButton, MaterialCard, MaterialChip, MaterialInput, MaterialSelect } from '../components/material'
import { requestTypeConfigApi, RequestTypeConfig, RequestTypeConfigCreate, RequestTypeConfigUpdate, VisibilityScope } from '../lib/requestTypeConfig'
import { workflowConfigApi, WorkflowConfig } from '../lib/workflowConfig'
import { formLayoutsApi, FormLayout } from '../lib/formLayouts'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import GuidedRequestTypeCreator from '../components/GuidedRequestTypeCreator'
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, FileTextIcon } from '../components/Icons'
import { showToast } from '../utils/toast'
import { StandardPageContainer, StandardPageHeader } from '../components/StandardizedLayout'

// Constants
const VISIBILITY_OPTIONS = [
  { value: VisibilityScope.INTERNAL, label: 'Internal Portal Only' },
  { value: VisibilityScope.EXTERNAL, label: 'External Portal Only' },
  { value: VisibilityScope.BOTH, label: 'Both Portals' }
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
]

export default function RequestTypeListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<RequestTypeConfig | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Fetch request types
  const { data: requestTypes = [], isLoading, isError, error } = useQuery<RequestTypeConfig[]>({
    queryKey: ['request-types'],
    queryFn: () => requestTypeConfigApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  })

  // Fetch workflows for mapping
  const { data: workflows = [] } = useQuery<WorkflowConfig[]>({
    queryKey: ['workflows'],
    queryFn: () => workflowConfigApi.list(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch forms for mapping
  const { data: forms = [] } = useQuery<FormLayout[]>({
    queryKey: ['form-layouts'],
    queryFn: () => formLayoutsApi.getLibrary(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch form associations for each request type to get accurate counts
  const { data: formCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['request-type-form-counts', requestTypes],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const rt of requestTypes) {
        try {
          const associations = await requestTypeConfigApi.getAssociatedForms(rt.id);
          counts[rt.id] = associations.length;
        } catch (error) {
          counts[rt.id] = 0;
        }
      }
      return counts;
    },
    enabled: requestTypes.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RequestTypeConfigUpdate }) => 
      requestTypeConfigApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-types'] })
      // Simplified - removed editing config state
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
      queryClient.invalidateQueries({ queryKey: ['request-types'] })
      showToast.success('Request type deleted successfully')
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to delete request type')
    }
  })

  // Filter request types
  const filteredRequestTypes = requestTypes.filter(config => {
    const matchesSearch = config.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         config.request_type.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesVisibility = !visibilityFilter || config.visibility_scope === visibilityFilter
    const matchesStatus = !statusFilter || 
                         (statusFilter === 'active' && config.is_active) || 
                         (statusFilter === 'inactive' && !config.is_active)
    
    return matchesSearch && matchesVisibility && matchesStatus
  })

  const getVisibilityBadge = (scope: VisibilityScope) => {
    switch (scope) {
      case VisibilityScope.INTERNAL:
        return <MaterialChip label="Internal" color="primary" size="small" />
      case VisibilityScope.EXTERNAL:
        return <MaterialChip label="External" color="success" size="small" />
      case VisibilityScope.BOTH:
        return <MaterialChip label="Both" color="secondary" size="small" />
      default:
        return <MaterialChip label="Unknown" color="default" size="small" />
    }
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive 
      ? <MaterialChip label="Active" color="success" size="small" />
      : <MaterialChip label="Inactive" color="error" size="small" />
  }

  const handleEdit = (config: RequestTypeConfig) => {
    setEditingConfig(config)
    setShowEditModal(true)
  }

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <StandardPageContainer>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </StandardPageContainer>
      </Layout>
    )
  }

  if (isError) {
    return (
      <Layout user={user}>
        <StandardPageContainer>
          <div className="text-center py-12">
            <div className="text-red-500 text-lg mb-2">Error loading request types</div>
            <div className="text-gray-600">{(error as any)?.message || 'An unknown error occurred'}</div>
          </div>
        </StandardPageContainer>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <StandardPageContainer>
        <StandardPageHeader
          title="Request Types"
          subtitle="Manage request types, their configurations, and associated workflows"
          actions={
            <MaterialButton
              variant="contained"
              onClick={() => setShowCreateModal(true)}
              startIcon={<PlusIcon />}
            >
              Create Request Type
            </MaterialButton>
          }
        />

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <MaterialInput
            label="Search"
            placeholder="Search by name, type, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            startAdornment={<SearchIcon className="w-4 h-4 text-gray-400" />}
          />
          
          <MaterialSelect
            label="Visibility"
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            options={[
              { value: '', label: 'All Visibilities' },
              ...VISIBILITY_OPTIONS
            ]}
          />
          
          <MaterialSelect
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              ...STATUS_OPTIONS
            ]}
          />
          
          <div className="flex items-end">
            <MaterialButton
              variant="outlined"
              onClick={() => {
                setSearchTerm('')
                setVisibilityFilter('')
                setStatusFilter('')
              }}
              fullWidth
            >
              Clear Filters
            </MaterialButton>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <MaterialCard className="p-4">
            <div className="text-2xl font-bold text-blue-600">{requestTypes.length}</div>
            <div className="text-sm text-gray-600">Total Request Types</div>
          </MaterialCard>
          
          <MaterialCard className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {requestTypes.filter(rt => rt.is_active).length}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </MaterialCard>
          
          <MaterialCard className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {Object.keys(VISIBILITY_OPTIONS).length}
            </div>
            <div className="text-sm text-gray-600">Visibilities</div>
          </MaterialCard>
          
          <MaterialCard className="p-4">
            <div className="text-2xl font-bold text-orange-600">{workflows.length}</div>
            <div className="text-sm text-gray-600">Workflows</div>
          </MaterialCard>
        </div>

        {/* Request Types List */}
        <div className="space-y-4">
          {filteredRequestTypes.length === 0 ? (
            <MaterialCard className="p-12 text-center">
              <div className="text-gray-300 mx-auto mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No request types found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || visibilityFilter || statusFilter 
                  ? 'Try adjusting your filters or search term'
                  : 'Get started by creating your first request type'
                }
              </p>
              {!searchTerm && !visibilityFilter && !statusFilter && (
                <MaterialButton
                  variant="contained"
                  onClick={() => setShowCreateModal(true)}
                  startIcon={<PlusIcon />}
                >
                  Create Request Type
                </MaterialButton>
              )}
            </MaterialCard>
          ) : (
            filteredRequestTypes.map((config) => (
              <MaterialCard key={config.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{config.display_name}</h3>
                      {getStatusBadge(config.is_active)}
                      {getVisibilityBadge(config.visibility_scope)}
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <span className="font-medium">Type:</span> {config.request_type}
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span>
                          {config.workflow_id ? '1' : '0'} workflow{config.workflow_id ? '' : 's'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <FileTextIcon className="w-4 h-4" />
                        <span>
                          {(formCounts[config.id] ?? 0)} form{(formCounts[config.id] !== 1) ? 's' : ''}
                        </span>
                      </div>
                      
                      {config.created_at && (
                        <div className="flex items-center gap-1">
                          <span>Created: {new Date(config.created_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <MaterialButton
                      variant="outlined"
                      size="small"
                      onClick={() => handleEdit(config)}
                      startIcon={<EditIcon />}
                    >
                      Edit
                    </MaterialButton>
                    
                    <MaterialButton
                      variant="outlined"
                      size="small"
                      color="error"
                      onClick={() => handleDelete(config.id, config.display_name)}
                      startIcon={<TrashIcon />}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </MaterialButton>
                  </div>
                </div>
              </MaterialCard>
            ))
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <GuidedRequestTypeCreator
            onClose={() => setShowCreateModal(false)}
            onSubmit={(data) => {
              // Handle successful creation
              console.log('Created request type with wizard:', data)
            }}
          />
        )}

        {/* Edit Modal */}
        {showEditModal && editingConfig && (
          <GuidedRequestTypeCreator
            onClose={() => {
              setShowEditModal(false)
              setEditingConfig(null)
            }}
            initialData={editingConfig}
            onSubmit={(data) => {
              // Handle successful update
              console.log('Updated request type with wizard:', data)
              setShowEditModal(false)
              setEditingConfig(null)
              queryClient.invalidateQueries({ queryKey: ['request-types'] })
              showToast.success('Request type updated successfully')
            }}
          />
        )}
      </StandardPageContainer>
    </Layout>
  )
}