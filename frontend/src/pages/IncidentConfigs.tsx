import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { incidentConfigsApi, IncidentConfig, IncidentConfigCreate } from '../lib/incidentConfigs'
import Layout from '../components/Layout'
import { MaterialButton, MaterialCard, MaterialInput, MaterialChip } from '../components/material'
import { PlusIcon, EditIcon, TrashIcon, SaveIcon, XIcon } from '../components/Icons'
import toast from 'react-hot-toast'

export default function IncidentConfigs() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const dialog = useDialogContext()
  const [user, setUser] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<IncidentConfigCreate>>({
    name: '',
    description: '',
    trigger_type: 'cve_detected',
    external_system: 'servicenow',
    auto_push: true,
    is_active: true,
    priority: 100
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: configs, isLoading } = useQuery({
    queryKey: ['incident-configs'],
    queryFn: () => incidentConfigsApi.list(),
    enabled: !!user
  })

  const { data: config } = useQuery({
    queryKey: ['incident-config', id],
    queryFn: () => incidentConfigsApi.get(id!),
    enabled: !!id && !!user
  })

  useEffect(() => {
    if (config) {
      setFormData({
        name: config.name,
        description: config.description,
        trigger_type: config.trigger_type,
        trigger_conditions: config.trigger_conditions,
        entity_types: config.entity_types,
        entity_categories: config.entity_categories,
        external_system: config.external_system,
        auto_push: config.auto_push,
        field_mapping: config.field_mapping,
        severity_mapping: config.severity_mapping,
        is_active: config.is_active,
        priority: config.priority
      })
      setIsEditing(true)
    } else if (id === 'new') {
      setIsEditing(true)
    }
  }, [config, id])

  const createMutation = useMutation({
    mutationFn: (data: IncidentConfigCreate) => incidentConfigsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident-configs'] })
      toast.success('Incident configuration created successfully')
      navigate('/incident-configs')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to create incident configuration')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IncidentConfigCreate }) =>
      incidentConfigsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident-configs'] })
      queryClient.invalidateQueries({ queryKey: ['incident-config', id] })
      toast.success('Incident configuration updated successfully')
      navigate('/incident-configs')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to update incident configuration')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => incidentConfigsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident-configs'] })
      toast.success('Incident configuration deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete incident configuration')
    }
  })

  if (!user) {
    return <div>Loading...</div>
  }

  if (isEditing) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              {id === 'new' ? 'Create Incident Configuration' : 'Edit Incident Configuration'}
            </h1>
            <MaterialButton
              variant="text"
              onClick={() => navigate('/incident-configs')}
            >
              <XIcon className="w-4 h-4 mr-2" />
              Cancel
            </MaterialButton>
          </div>

          <MaterialCard className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <MaterialInput
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Configuration name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type *</label>
                  <select
                    value={formData.trigger_type || 'cve_detected'}
                    onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="cve_detected">CVE Detected</option>
                    <option value="qualification_failed">Qualification Failed</option>
                    <option value="risk_threshold_exceeded">Risk Threshold Exceeded</option>
                    <option value="compliance_gap_detected">Compliance Gap Detected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">External System *</label>
                  <select
                    value={formData.external_system || 'servicenow'}
                    onChange={(e) => setFormData({ ...formData, external_system: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="servicenow">ServiceNow</option>
                    <option value="jira">Jira</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.auto_push ?? true}
                    onChange={(e) => setFormData({ ...formData, auto_push: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Auto-push incidents</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active ?? true}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority (1-1000, lower = higher priority)</label>
                <MaterialInput
                  type="number"
                  value={formData.priority || 100}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                  min={1}
                  max={1000}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Mapping (JSON)</label>
                <textarea
                  value={JSON.stringify(formData.field_mapping || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      setFormData({ ...formData, field_mapping: JSON.parse(e.target.value) })
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md font-mono text-sm"
                  rows={8}
                  placeholder='{"short_description": "{{incident.title}}", "description": "{{incident.description}}"}'
                />
              </div>

              <div className="flex justify-end gap-2">
                <MaterialButton
                  variant="outlined"
                  onClick={() => navigate('/incident-configs')}
                >
                  Cancel
                </MaterialButton>
                <MaterialButton
                  onClick={() => {
                    if (id === 'new') {
                      createMutation.mutate(formData as IncidentConfigCreate)
                    } else if (id) {
                      updateMutation.mutate({ id, data: formData as IncidentConfigCreate })
                    }
                  }}
                  disabled={createMutation.isPending || updateMutation.isPending || !formData.name}
                >
                  <SaveIcon className="w-4 h-4 mr-2" />
                  {id === 'new' ? 'Create' : 'Save'}
                </MaterialButton>
              </div>
            </div>
          </MaterialCard>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Incident Configurations</h1>
            <p className="text-sm text-gray-500 mt-1">Configure automatic incident creation and field mapping</p>
          </div>
          <MaterialButton onClick={() => navigate('/incident-configs/new')}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Configuration
          </MaterialButton>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading configurations...</div>
        ) : !configs || configs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No incident configurations found</p>
            <MaterialButton onClick={() => navigate('/incident-configs/new')}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Create First Configuration
            </MaterialButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {configs.map((config) => (
              <MaterialCard key={config.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{config.name}</h3>
                    {config.description && (
                      <p className="text-sm text-gray-600">{config.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <MaterialButton
                      size="small"
                      variant="text"
                      onClick={() => navigate(`/incident-configs/${config.id}`)}
                    >
                      <EditIcon className="w-4 h-4" />
                    </MaterialButton>
                    <MaterialButton
                      size="small"
                      variant="text"
                      onClick={async () => {
                        const confirmed = await dialog.confirm({
                          title: 'Delete Configuration',
                          message: 'Are you sure you want to delete this configuration? This action cannot be undone.',
                          variant: 'destructive'
                        })
                        if (confirmed) {
                          deleteMutation.mutate(config.id)
                        }
                      }}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </MaterialButton>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MaterialChip
                      label={config.trigger_type.replace('_', ' ')}
                      size="small"
                      className="bg-blue-100 text-blue-800"
                    />
                    <MaterialChip
                      label={config.external_system}
                      size="small"
                      className="bg-green-100 text-green-800"
                    />
                    {config.is_active ? (
                      <MaterialChip label="Active" size="small" className="bg-green-100 text-green-800" />
                    ) : (
                      <MaterialChip label="Inactive" size="small" className="bg-gray-100 text-gray-800" />
                    )}
                  </div>

                  {config.entity_types && config.entity_types.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Entity Types:</p>
                      <div className="flex flex-wrap gap-1">
                        {config.entity_types.map((type) => (
                          <span key={type} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Priority: {config.priority} | Auto-push: {config.auto_push ? 'Yes' : 'No'}
                  </div>
                </div>
              </MaterialCard>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
