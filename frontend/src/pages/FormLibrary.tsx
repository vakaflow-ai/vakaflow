import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialButton, MaterialCard, MaterialChip, MaterialInput, MaterialSelect } from '../components/material'
import { formLayoutsApi, FormLayout } from '../lib/formLayouts'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { PlusIcon, SearchIcon, FileTextIcon, EyeIcon, LinkIcon, EditIcon, TrashIcon, FilterIcon } from '../components/Icons'
import { showToast } from '../utils/toast'
import { MoreVertical, Clock, CheckCircle, AlertCircle, Copy, Settings } from 'lucide-react'
import CreateFormModal from '../components/CreateFormModal'
import EditFormModal from '../components/EditFormModal'

export default function FormLibrary() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [selectedForms, setSelectedForms] = useState<string[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedForm, setSelectedForm] = useState<any>(null)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const queryClient = useQueryClient()

  // Fetch form library
  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['form-library'],
    queryFn: () => formLayoutsApi.getLibrary(),
    enabled: !!user
  })

  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: (formId: string) => formLayoutsApi.delete(formId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-library'] })
      showToast.success('Form deleted successfully')
      setSelectedForms([])
    },
    onError: (error: any) => {
      showToast.error('Failed to delete form: ' + (error.message || 'Unknown error'))
    }
  })

  const filteredForms = forms
    .filter(form => {
      const matchesSearch = form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           form.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           form.request_type.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = filterStatus === 'all' || (form.is_active ? 'active' : 'inactive') === filterStatus
      const matchesType = filterType === 'all' || form.request_type === filterType
      
      return matchesSearch && matchesStatus && matchesType
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'type':
          comparison = a.request_type.localeCompare(b.request_type)
          break
        case 'updated':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          break
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        default:
          comparison = 0
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'draft': return <Clock className="w-4 h-4 text-yellow-600" />
      case 'inactive': return <AlertCircle className="w-4 h-4 text-gray-600" />
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />
    }
  }

  const handleDeleteForm = (formId: string, formName: string) => {
    if (window.confirm(`Are you sure you want to delete the form "${formName}"? This action cannot be undone.`)) {
      deleteFormMutation.mutate(formId)
    }
  }

  const handleCreateForm = async (formData: { name: string; description: string; type: string }) => {
    try {
      // Store form details in localStorage/sessionStorage to pass to form designer
      sessionStorage.setItem('pendingFormDetails', JSON.stringify(formData))
      
      // Navigate to form designer with pre-filled data
      navigate('/admin/form-library/designer')
      
      // Close modal
      setShowCreateModal(false)
      
      showToast.success(`Creating form: ${formData.name}`)
    } catch (error) {
      showToast.error('Failed to initiate form creation')
      throw error
    }
  }

  const handleEditForm = (form: any) => {
    setSelectedForm(form)
    setShowEditModal(true)
  }

  const handleUpdateForm = (updatedForm: any) => {
    // Update local state or let query refetch
    setShowEditModal(false)
    setSelectedForm(null)
  }

  const handleBulkDelete = () => {
    if (selectedForms.length === 0) return
    
    if (window.confirm(`Are you sure you want to delete ${selectedForms.length} selected forms? This action cannot be undone.`)) {
      selectedForms.forEach(formId => {
        deleteFormMutation.mutate(formId)
      })
      setSelectedForms([])
    }
  }

  const toggleFormSelection = (formId: string) => {
    setSelectedForms(prev => 
      prev.includes(formId) 
        ? prev.filter(id => id !== formId)
        : [...prev, formId]
    )
  }

  const selectAllForms = () => {
    if (selectedForms.length === filteredForms.length) {
      setSelectedForms([])
    } else {
      setSelectedForms(filteredForms.map(form => form.id))
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'agent_onboarding_workflow': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'vendor_submission_workflow': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'product_submission_workflow': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'service_submission_workflow': return 'bg-pink-100 text-pink-800 border-pink-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (!user) return null

  return (
    <Layout user={user}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Form Library</h1>
              <p className="text-gray-600 mt-1">
                Manage and organize forms for workflow mapping and submissions
              </p>
            </div>
            <div className="flex items-center gap-3">
              {selectedForms.length > 0 && (
                <MaterialButton
                  variant="outlined"
                  color="error"
                  startIcon={<TrashIcon />}
                  onClick={handleBulkDelete}
                  disabled={deleteFormMutation.isPending}
                >
                  Delete Selected ({selectedForms.length})
                </MaterialButton>
              )}
              <MaterialButton
                variant="contained"
                color="primary"
                startIcon={<PlusIcon />}
                onClick={() => setShowCreateModal(true)}
              >
                Create New Form
              </MaterialButton>
            </div>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <MaterialInput
              placeholder="Search forms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <MaterialSelect
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Draft' },
              { value: 'inactive', label: 'Inactive' }
            ]}
            startAdornment={<FilterIcon className="w-4 h-4" />}
            fullWidth
          />
          
          <MaterialSelect
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'agent_onboarding_workflow', label: 'Agent Onboarding' },
              { value: 'vendor_submission_workflow', label: 'Vendor Submission' },
              { value: 'product_submission_workflow', label: 'Product Submission' },
              { value: 'service_submission_workflow', label: 'Service Submission' }
            ]}
            startAdornment={<FilterIcon className="w-4 h-4" />}
            fullWidth
          />
          
          <MaterialSelect
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-')
              setSortBy(newSortBy)
              setSortOrder(newSortOrder)
            }}
            options={[
              { value: 'name-asc', label: 'Name A-Z' },
              { value: 'name-desc', label: 'Name Z-A' },
              { value: 'type-asc', label: 'Type A-Z' },
              { value: 'updated-desc', label: 'Recently Updated' },
              { value: 'created-desc', label: 'Recently Created' }
            ]}
            startAdornment={<Settings className="w-4 h-4" />}
            fullWidth
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Forms List View */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
                <div className="col-span-5">Form Name</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-1 text-center">Sections</div>
                <div className="col-span-1 text-center">Fields</div>
                <div className="col-span-1 text-center">Updated</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
              
              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {filteredForms.map((form) => (
                  <div key={form.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                    {/* Form Name and Description */}
                    <div className="col-span-5">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedForms.includes(form.id)}
                          onChange={() => toggleFormSelection(form.id)}
                          className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileTextIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            <h3 className="font-medium text-gray-900 truncate">{form.name}</h3>
                            {getStatusIcon(form.is_active ? 'active' : 'inactive')}
                          </div>
                          {form.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {form.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            ID: {form.id}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Type */}
                    <div className="col-span-2 flex items-center">
                      <MaterialChip 
                        label={form.request_type.replace('_workflow', '').replace('_', ' ')}
                        size="small"
                        className={getTypeColor(form.request_type)}
                      />
                    </div>
                    
                    {/* Status */}
                    <div className="col-span-1 flex items-center justify-center">
                      <MaterialChip 
                        label={form.is_active ? 'active' : 'inactive'} 
                        size="small"
                        className={getStatusColor(form.is_active ? 'active' : 'inactive')}
                      />
                    </div>
                    
                    {/* Sections Count */}
                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-900">
                        {form.sections?.length || 0}
                      </span>
                    </div>
                    
                    {/* Fields Count */}
                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-900">
                        {form.sections?.reduce((acc, section) => acc + (section.fields?.length || 0), 0) || 0}
                      </span>
                    </div>
                    
                    {/* Last Updated */}
                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-sm text-gray-600">
                        {new Date(form.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end gap-2">
                      <MaterialButton
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon className="w-4 h-4" />}
                        onClick={() => handleEditForm(form)}
                        className="px-2 py-1"
                      >
                        Edit Details
                      </MaterialButton>
                      <MaterialButton
                        variant="outlined"
                        size="small"
                        startIcon={<Settings className="w-4 h-4" />}
                        onClick={() => navigate(`/admin/form-library/designer/${form.id}`)}
                        className="px-2 py-1"
                      >
                        Edit in Designer
                      </MaterialButton>
                      <MaterialButton
                        variant="outlined"
                        size="small"
                        startIcon={<Copy className="w-4 h-4" />}
                        onClick={() => {
                          navigator.clipboard.writeText(form.id)
                          showToast.success('Form ID copied to clipboard')
                        }}
                        className="px-2 py-1"
                      >
                        Copy ID
                      </MaterialButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Empty State */}
            {filteredForms.length === 0 && (
              <div className="text-center py-12">
                <FileTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No forms found</h3>
                <p className="text-gray-500">
                  {searchTerm || filterStatus !== 'all' || filterType !== 'all'
                    ? 'Try adjusting your search or filter criteria'
                    : 'Create your first form to get started'}
                </p>
                {!searchTerm && filterStatus === 'all' && filterType === 'all' && (
                  <MaterialButton
                    variant="contained"
                    color="primary"
                    startIcon={<PlusIcon />}
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4"
                  >
                    Create Your First Form
                  </MaterialButton>
                )}
              </div>
            )}
          </>
        )}
        
        {/* Stats Summary */}
        {!isLoading && forms.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Library Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{forms.length}</div>
                <div className="text-sm text-gray-600">Total Forms</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-green-600">
                  {forms.filter(f => f.is_active).length}
                </div>
                <div className="text-sm text-gray-600">Active Forms</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-blue-600">
                  {new Set(forms.map(f => f.request_type)).size}
                </div>
                <div className="text-sm text-gray-600">Form Types</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-purple-600">
                  {forms.reduce((acc, form) => acc + (form.sections?.length || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Sections</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-orange-600">
                  {forms.reduce((acc, form) => 
                    acc + form.sections?.reduce((secAcc, section) => secAcc + (section.fields?.length || 0), 0) || 0, 0
                  )}
                </div>
                <div className="text-sm text-gray-600">Total Fields</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Create Form Modal */}
        <CreateFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateForm}
        />
        
        {/* Edit Form Modal */}
        <EditFormModal
          isOpen={showEditModal}
          form={selectedForm}
          onClose={() => {
            setShowEditModal(false)
            setSelectedForm(null)
          }}
          onUpdate={handleUpdateForm}
        />
      </div>
    </Layout>
  )
}