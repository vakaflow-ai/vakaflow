import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { MaterialButton, MaterialCard, MaterialInput, MaterialSelect } from '../components/material'
import { REQUEST_TYPE_CONFIG } from '../config/appConfig'
import { showToast } from '../utils/toast'
import { Plus, Trash2, Edit, Save, X } from 'lucide-react'

interface ActionType {
  id: string
  name: string
  description: string
  is_system: boolean
  is_active: boolean
  created_at: string
}

const ENTITIES = [
  { id: 'product', name: 'Product', icon: '📦' },
  { id: 'service', name: 'Service', icon: '💼' },
  { id: 'agent', name: 'Agent', icon: '🤖' },
  { id: 'vendor', name: 'Vendor', icon: '🏢' },
  { id: 'user', name: 'User', icon: '👤' },
  { id: 'assessment', name: 'Assessment', icon: '📋' }
]

export default function ActionTypeManagement() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingActionType, setEditingActionType] = useState<ActionType | null>(null)
  const [newActionType, setNewActionType] = useState({ name: '', description: '' })
  const [entityMappings, setEntityMappings] = useState<Record<string, string[]>>({})

  // Initialize with seeded data
  useEffect(() => {
    const initialMappings: Record<string, string[]> = {}
    ENTITIES.forEach(entity => {
      initialMappings[entity.id] = REQUEST_TYPE_CONFIG.actionTypes
        .slice(0, 3)
        .map(at => at.id)
    })
    setEntityMappings(initialMappings)
  }, [])

  // Mock data loading
  const { data: actionTypes = [], isLoading } = useQuery<ActionType[]>({
    queryKey: ['action-types'],
    queryFn: async () => {
      // System action types from config
      const systemTypes = REQUEST_TYPE_CONFIG.actionTypes.map(at => ({
        id: at.id,
        name: at.name,
        description: at.description,
        is_system: true,
        is_active: true,
        created_at: new Date().toISOString()
      }))

      // Custom action types
      const customTypes: ActionType[] = [
        {
          id: 'renewal',
          name: 'Renewal',
          description: 'Periodic renewal process',
          is_system: false,
          is_active: true,
          created_at: new Date().toISOString()
        }
      ]

      return [...systemTypes, ...customTypes]
    },
    staleTime: 5 * 60 * 1000
  })

  const createActionTypeMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: data.name.toLowerCase().replace(/\s+/g, '_'),
        name: data.name,
        description: data.description,
        is_system: false,
        is_active: true,
        created_at: new Date().toISOString()
      }
    },
    onSuccess: (newType) => {
      queryClient.setQueryData(['action-types'], (old: ActionType[] = []) => [...old, newType])
      showToast.success('Action type created')
      setShowCreateModal(false)
      setNewActionType({ name: '', description: '' })
    }
  })

  const updateActionTypeMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string }) => {
      await new Promise(resolve => setTimeout(resolve, 300))
      return { ...data, updated_at: new Date().toISOString() }
    },
    onSuccess: (updatedType) => {
      queryClient.setQueryData(['action-types'], (old: ActionType[] = []) =>
        old.map(at => at.id === updatedType.id ? updatedType : at)
      )
      showToast.success('Action type updated')
      setEditingActionType(null)
    }
  })

  const deleteActionTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, 300))
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(['action-types'], (old: ActionType[] = []) =>
        old.filter(at => at.id !== deletedId)
      )
      showToast.success('Action type deleted')
    }
  })

  const toggleEntityMapping = (entityId: string, actionTypeId: string) => {
    setEntityMappings(prev => {
      const current = prev[entityId] || []
      const updated = current.includes(actionTypeId)
        ? current.filter(id => id !== actionTypeId)
        : [...current, actionTypeId]
      return { ...prev, [entityId]: updated }
    })
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading action types...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Action Type Management</h1>
          <p className="text-gray-600">Configure and manage action types for request workflows</p>
        </div>
        <MaterialButton
          variant="contained"
          startIcon={<Plus className="w-5 h-5" />}
          onClick={() => setShowCreateModal(true)}
        >
          New Action Type
        </MaterialButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Types Table */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Action Types</h2>
          <MaterialCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {actionTypes.map((actionType) => (
                    <tr key={actionType.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{actionType.name}</div>
                          <div className="text-sm text-gray-500">{actionType.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          actionType.is_system 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {actionType.is_system ? 'System' : 'Custom'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {!actionType.is_system && (
                          <>
                            <button
                              onClick={() => setEditingActionType(actionType)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete ${actionType.name}?`)) {
                                  deleteActionTypeMutation.mutate(actionType.id)
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MaterialCard>
        </div>

        {/* Entity Mapping Grid */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Entity-Action Mapping</h2>
          <div className="space-y-4">
            {ENTITIES.map((entity) => (
              <MaterialCard key={entity.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{entity.icon}</span>
                  <h3 className="font-semibold text-gray-900">{entity.name}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {actionTypes.map((actionType) => {
                    const isSelected = entityMappings[entity.id]?.includes(actionType.id) || false
                    return (
                      <label 
                        key={`${entity.id}-${actionType.id}`} 
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                          isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEntityMapping(entity.id, actionType.id)}
                          disabled={actionType.is_system}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-sm ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                          {actionType.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </MaterialCard>
            ))}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Create Action Type</h2>
                <button 
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewActionType({ name: '', description: '' })
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <MaterialInput
                  label="Name *"
                  value={newActionType.name}
                  onChange={(e) => setNewActionType({...newActionType, name: e.target.value})}
                  placeholder="e.g., Renewal, Audit"
                />
                
                <MaterialInput
                  label="Description"
                  value={newActionType.description}
                  onChange={(e) => setNewActionType({...newActionType, description: e.target.value})}
                  placeholder="Describe this action type"
                  multiline
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <MaterialButton
                  variant="outlined"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewActionType({ name: '', description: '' })
                  }}
                >
                  Cancel
                </MaterialButton>
                <MaterialButton
                  variant="contained"
                  startIcon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    if (newActionType.name.trim()) {
                      createActionTypeMutation.mutate(newActionType)
                    }
                  }}
                  disabled={!newActionType.name.trim() || createActionTypeMutation.isPending}
                >
                  {createActionTypeMutation.isPending ? 'Creating...' : 'Create'}
                </MaterialButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingActionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Edit Action Type</h2>
                <button 
                  onClick={() => setEditingActionType(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <MaterialInput
                  label="Name *"
                  value={editingActionType.name}
                  onChange={(e) => setEditingActionType({...editingActionType, name: e.target.value})}
                  placeholder="e.g., Renewal, Audit"
                />
                
                <MaterialInput
                  label="Description"
                  value={editingActionType.description}
                  onChange={(e) => setEditingActionType({...editingActionType, description: e.target.value})}
                  placeholder="Describe this action type"
                  multiline
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <MaterialButton
                  variant="outlined"
                  onClick={() => setEditingActionType(null)}
                >
                  Cancel
                </MaterialButton>
                <MaterialButton
                  variant="contained"
                  startIcon={<Save className="w-4 h-4" />}
                  onClick={() => {
                    if (editingActionType.name.trim()) {
                      updateActionTypeMutation.mutate({
                        id: editingActionType.id,
                        name: editingActionType.name,
                        description: editingActionType.description
                      })
                    }
                  }}
                  disabled={!editingActionType.name.trim() || updateActionTypeMutation.isPending}
                >
                  {updateActionTypeMutation.isPending ? 'Saving...' : 'Save'}
                </MaterialButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}