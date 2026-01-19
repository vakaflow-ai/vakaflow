import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MaterialButton, MaterialCard, MaterialChip, MaterialInput, MaterialSelect } from '../components/material'
import { formLayoutsApi, FormLayout } from '../lib/formLayouts'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { PlusIcon, SearchIcon, FileTextIcon, EyeIcon, LinkIcon } from '../components/Icons'
import { showToast } from '../utils/toast'

export default function FormLibrary() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Fetch form layouts
  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['form-layouts', 'library'],
    queryFn: () => formLayoutsApi.list(),
    enabled: !!user
  })

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.request_type.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || (form.is_active ? 'active' : 'inactive') === filterStatus
    const matchesType = filterType === 'all' || form.request_type === filterType
    
    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
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
                Browse and manage available forms for workflow mapping
              </p>
            </div>
            <MaterialButton
              variant="contained"
              color="primary"
              startIcon={<PlusIcon />}
              onClick={() => navigate('/admin/form-designer/new')}
            >
              Create New Form
            </MaterialButton>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
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
            fullWidth
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          /* Forms Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredForms.map((form) => (
              <MaterialCard key={form.id} className="hover:shadow-lg transition-shadow">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <FileTextIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{form.name}</h3>
                        <p className="text-sm text-gray-500">{form.request_type}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <MaterialChip 
                        label={form.is_active ? 'active' : 'inactive'} 
                        size="small"
                        className={getStatusColor(form.is_active ? 'active' : 'inactive')}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  {form.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {form.description}
                    </p>
                  )}

                  {/* Details */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Type:</span>
                      <MaterialChip 
                        label={form.request_type.replace('_workflow', '').replace('_', ' ')}
                        size="small"
                        className={getTypeColor(form.request_type)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Sections:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {form.sections?.length || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Sections:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {form.sections?.length || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Last Updated:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(form.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <MaterialButton
                      variant="outlined"
                      size="small"
                      className="flex-1"
                      startIcon={<EyeIcon />}
                      onClick={() => navigate(`/admin/form-designer/${form.id}`)}
                    >
                      Edit
                    </MaterialButton>
                    <MaterialButton
                      variant="outlined"
                      size="small"
                      startIcon={<LinkIcon />}
                      onClick={() => {
                        // Copy form ID to clipboard for mapping
                        navigator.clipboard.writeText(form.id)
                        showToast.success('Form ID copied to clipboard')
                      }}
                    >
                      Copy ID
                    </MaterialButton>
                  </div>
                </div>
              </MaterialCard>
            ))}

            {filteredForms.length === 0 && (
              <div className="col-span-full text-center py-12">
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
                    onClick={() => navigate('/admin/form-designer/new')}
                    className="mt-4"
                  >
                    Create Your First Form
                  </MaterialButton>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats Summary */}
        {!isLoading && forms.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}