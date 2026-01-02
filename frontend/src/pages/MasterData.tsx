import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { masterDataListsApi, MasterDataList, MasterDataListCreate, MasterDataValue } from '../lib/masterDataLists'
import Layout from '../components/Layout'
import { showToast } from '../utils/toast'
import { Plus, Edit, Trash2, X, Save, Database, Filter } from 'lucide-react'

const MASTER_DATA_TYPES = [
  { value: 'question_category', label: 'Question Categories' },
  { value: 'requirement_category', label: 'Requirement Categories' },
  { value: 'department', label: 'Departments' },
  { value: 'location', label: 'Locations' },
  { value: 'workflow_type', label: 'Workflow Types' },
  { value: 'agent_type', label: 'Agent Types' },
  { value: 'agent_status', label: 'Agent Status' },
  { value: 'user_role', label: 'User Roles' },
]

interface User {
  id: string
  role: string
  tenant_id?: string
}

export default function MasterData() {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedList, setSelectedList] = useState<MasterDataList | null>(null)
  const [selectedType, setSelectedType] = useState<string>('')
  const [formData, setFormData] = useState<MasterDataListCreate>({
    name: '',
    description: '',
    list_type: '',
    selection_type: 'single',
    values: [],
    is_active: true,
  })
  const [newValue, setNewValue] = useState({ value: '', label: '', order: 0 })

  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  // Fetch all lists (including inactive) to show system lists like workflow_type
  const { data: lists = [], isLoading, error } = useQuery({
    queryKey: ['master-data-lists', selectedType],
    queryFn: () => masterDataListsApi.list(selectedType || undefined, undefined), // undefined = show all (active and inactive)
    enabled: !!user?.tenant_id,
  })

  const createMutation = useMutation({
    mutationFn: (data: MasterDataListCreate) => masterDataListsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data-lists'] })
      setShowCreateModal(false)
      setFormData({
        name: '',
        description: '',
        list_type: '',
        values: [],
        is_active: true,
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MasterDataList> }) =>
      masterDataListsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data-lists'] })
      setShowEditModal(false)
      setSelectedList(null)
      setFormData({
        name: '',
        description: '',
        list_type: '',
        values: [],
        is_active: true,
      })
    },
    onError: (error: any) => {
      console.error('Update error:', error)
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to update master data list'
      alert(`Error: ${errorMessage}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => masterDataListsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data-lists'] })
    },
  })

  const handleCreate = () => {
    if (!formData.name || !formData.list_type) {
      showToast.warning('Name and Type are required')
      return
    }
    createMutation.mutate(formData)
  }

  const handleEdit = (list: MasterDataList) => {
    setSelectedList(list)
    setFormData({
      name: list.name,
      description: list.description || '',
      list_type: list.list_type,
      selection_type: list.selection_type || 'single',
      values: list.values || [],
      is_active: list.is_active,
    })
    setShowEditModal(true)
  }

  const handleUpdate = () => {
    if (!selectedList) {
      showToast.warning('No list selected for update')
      return
    }
    if (!formData.name || !formData.list_type) {
      showToast.warning('Name and Type are required')
      return
    }
    
    // Prepare update data - ensure all fields are properly formatted
    const updateData: Partial<MasterDataList> = {
      name: formData.name,
      description: formData.description || undefined,
      list_type: formData.list_type,
      selection_type: formData.selection_type || 'single',
      values: formData.values || [],
      is_active: formData.is_active !== undefined ? formData.is_active : true,
    }
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData]
      }
    })
    
    updateMutation.mutate({ id: selectedList.id, data: updateData })
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this master data list?')) {
      deleteMutation.mutate(id)
    }
  }

  const addValue = () => {
    if (!newValue.value || !newValue.label) {
      showToast.warning('Value and Label are required')
      return
    }
    setFormData({
      ...formData,
      values: [...formData.values, { ...newValue, is_active: true }],
    })
    setNewValue({ value: '', label: '', order: formData.values.length })
  }

  const removeValue = (index: number) => {
    setFormData({
      ...formData,
      values: formData.values.filter((_, i) => i !== index),
    })
  }

  const toggleValueActive = (index: number) => {
    const newValues = [...formData.values]
    newValues[index] = { ...newValues[index], is_active: !newValues[index].is_active }
    setFormData({ ...formData, values: newValues })
  }

  if (!user || !['tenant_admin', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied. Master data management access required.</div>
        </div>
      </Layout>
    )
  }

  const filteredLists = selectedType
    ? lists.filter(list => list.list_type === selectedType)
    : lists

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex-1">
            <h1>Master Data</h1>
            <p className="text-body text-gray-600 mt-2">
              Manage key-value pairs for dropdowns and select fields. Organize data by type (Question Categories, Departments, Locations, Workflow Types, etc.)
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({
                name: '',
                description: '',
                list_type: '',
                selection_type: 'single',
                values: [],
                is_active: true,
              })
              setShowCreateModal(true)
            }}
            className="compact-button-primary flex items-center gap-2 px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            Add Master Data List
          </button>
        </div>

        <div className="bg-white border rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-600" />
            <label className="text-label text-gray-700">Filter by Type</label>
          </div>
          {MASTER_DATA_TYPES.length <= 7 ? (
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filterType"
                  value=""
                  checked={selectedType === ''}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-body text-gray-700">All Types</span>
              </label>
              {MASTER_DATA_TYPES.map(type => (
                <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="filterType"
                    value={type.value}
                    checked={selectedType === type.value}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{type.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full md:w-64 px-3 py-2 text-sm rounded-lg border border-gray-300"
            >
              <option value="">All Types</option>
              {MASTER_DATA_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading master data lists...</div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 mb-2">Error loading master data lists. Please try again.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLists.length === 0 ? (
              <div className="bg-white border rounded-lg p-12 text-center">
                <Database className="w-12 h-9 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No master data lists found</p>
                <p className="text-sm text-gray-600">Create your first master data list to get started</p>
              </div>
            ) : (
              filteredLists.map((list) => (
                <div key={list.id} className="bg-white border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-subheading font-medium">{list.name}</h3>
                        <span className="badge-text px-2 py-1 bg-blue-100 text-blue-600 rounded">
                          {MASTER_DATA_TYPES.find(t => t.value === list.list_type)?.label || list.list_type}
                        </span>
                        <span className="badge-text px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          {list.selection_type === 'multi' ? 'Multi-Select' : 'Single-Select'}
                        </span>
                        {list.is_system && (
                          <span className="badge-text px-2 py-1 bg-gray-100 text-gray-700 rounded">System</span>
                        )}
                      </div>
                      {list.description && (
                        <p className="text-body text-gray-600 mb-2">{list.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(list)}
                        className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Edit className="w-3 h-3 inline mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(list.id)}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        disabled={list.is_system}
                      >
                        <Trash2 className="w-3 h-3 inline mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h4 className="text-label font-medium mb-2">Values ({list.values.filter(v => v.is_active).length} active)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {list.values
                        .filter(v => v.is_active)
                        .sort((a, b) => a.order - b.order)
                        .map((value, idx) => (
                          <div key={idx} className="px-3 py-2 bg-gray-50 rounded border text-sm">
                            <div className="font-medium">{value.label}</div>
                            <div className="text-xs text-gray-500">{value.value}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-medium">Add Master Data List</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
                    placeholder="e.g., Question Categories"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Type *</label>
                  <select
                    value={formData.list_type}
                    onChange={(e) => setFormData({ ...formData, list_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
                  >
                    <option value="">Select Type</option>
                    {MASTER_DATA_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Selection Type *</label>
                  <select
                    value={formData.selection_type || 'single'}
                    onChange={(e) => setFormData({ ...formData, selection_type: e.target.value as 'single' | 'multi' })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
                  >
                    <option value="single">Single Select (Dropdown)</option>
                    <option value="multi">Multi Select (Checkboxes/Multi-select)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Controls how this list is displayed in forms: single-select dropdown or multi-select
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Values</h3>
                  <div className="space-y-2 mb-3">
                    {formData.values.map((value, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <span className="flex-1 text-sm">
                          <span className="font-medium">{value.label}</span>
                          <span className="text-gray-500 ml-2">({value.value})</span>
                        </span>
                        <button
                          onClick={() => removeValue(idx)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newValue.value}
                      onChange={(e) => setNewValue({ ...newValue, value: e.target.value })}
                      placeholder="Value (key)"
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300"
                    />
                    <input
                      type="text"
                      value={newValue.label}
                      onChange={(e) => setNewValue({ ...newValue, label: e.target.value })}
                      placeholder="Label (display)"
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300"
                    />
                    <button
                      onClick={addValue}
                      className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Add Value
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!formData.name || !formData.list_type || createMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create List'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedList && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-medium">Edit Master Data List</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                {selectedList.is_system && user.role !== 'platform_admin' && (
                  <div className="bg-blue-50 border border-blue-400 rounded-lg p-3 mb-2">
                    <p className="text-sm text-blue-800">
                      <strong>System List:</strong> You can edit values, description, and active status. 
                      Name and type can only be modified by platform administrators.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
                    disabled={selectedList.is_system && user.role !== 'platform_admin'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Type *</label>
                  <select
                    value={formData.list_type}
                    onChange={(e) => setFormData({ ...formData, list_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
                    disabled={selectedList.is_system && user.role !== 'platform_admin'}
                  >
                    {MASTER_DATA_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                    {/* Show current type if it's not in MASTER_DATA_TYPES (e.g., system types) */}
                    {!MASTER_DATA_TYPES.find(t => t.value === formData.list_type) && (
                      <option value={formData.list_type}>{formData.list_type}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Selection Type *</label>
                  <select
                    value={formData.selection_type || 'single'}
                    onChange={(e) => setFormData({ ...formData, selection_type: e.target.value as 'single' | 'multi' })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
                  >
                    <option value="single">Single Select (Dropdown)</option>
                    <option value="multi">Multi Select (Checkboxes/Multi-select)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Controls how this list is displayed in forms: single-select dropdown or multi-select
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
                    rows={2}
                  />
                </div>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Values</h3>
                  <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
                    {formData.values.map((value, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={value.is_active}
                          onChange={() => toggleValueActive(idx)}
                          className="w-4 h-4"
                        />
                        <span className="flex-1 text-sm">
                          <span className="font-medium">{value.label}</span>
                          <span className="text-gray-500 ml-2">({value.value})</span>
                        </span>
                        <input
                          type="number"
                          value={value.order}
                          onChange={(e) => {
                            const newValues = [...formData.values]
                            newValues[idx] = { ...newValues[idx], order: parseInt(e.target.value) || 0 }
                            setFormData({ ...formData, values: newValues })
                          }}
                          className="w-16 px-2 py-1 text-sm rounded border border-gray-300"
                          placeholder="Order"
                        />
                        <button
                          onClick={() => removeValue(idx)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newValue.value}
                      onChange={(e) => setNewValue({ ...newValue, value: e.target.value })}
                      placeholder="Value (key)"
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300"
                    />
                    <input
                      type="text"
                      value={newValue.label}
                      onChange={(e) => setNewValue({ ...newValue, label: e.target.value })}
                      placeholder="Label (display)"
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300"
                    />
                    <button
                      onClick={addValue}
                      className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Add Value
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={!formData.name || !formData.list_type || updateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Update List'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
