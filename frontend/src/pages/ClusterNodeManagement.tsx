import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clusterNodesApi, ClusterNode, ClusterNodeCreate, ClusterNodeUpdate } from '../lib/clusterNodes'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialInput, MaterialChip } from '../components/material'
import { PlusIcon, XIcon, ShieldCheckIcon, SearchIcon } from '../components/Icons'

const NODE_TYPES = [
  { value: 'application', label: 'Application' },
  { value: 'database', label: 'Database' },
  { value: 'redis', label: 'Redis' },
  { value: 'qdrant', label: 'Qdrant' },
  { value: 'load_balancer', label: 'Load Balancer' },
  { value: 'worker', label: 'Worker' },
]

const STATUS_COLORS = {
  healthy: 'bg-green-100 text-green-800',
  unhealthy: 'bg-red-100 text-red-800',
  offline: 'bg-gray-100 text-gray-800',
  unknown: 'bg-yellow-100 text-yellow-800',
}

export default function ClusterNodeManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingNode, setEditingNode] = useState<ClusterNode | null>(null)
  const [selectedNodeType, setSelectedNodeType] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  
  const [formData, setFormData] = useState<ClusterNodeCreate>({
    hostname: '',
    ip_address: '',
    node_type: 'application',
    ssh_username: '',
    ssh_password: '',
    ssh_port: 22,
    description: '',
    location: '',
    tags: [],
    is_monitored: true,
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const isPlatformAdmin = user?.role === 'platform_admin'

  const { data: nodes, isLoading, refetch } = useQuery({
    queryKey: ['cluster-nodes', selectedNodeType, selectedStatus],
    queryFn: () => clusterNodesApi.list(selectedNodeType || undefined, selectedStatus || undefined),
    enabled: !!user && isPlatformAdmin,
  })

  const createMutation = useMutation({
    mutationFn: (node: ClusterNodeCreate) => clusterNodesApi.create(node),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster-nodes'] })
      setShowCreateForm(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClusterNodeUpdate }) =>
      clusterNodesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster-nodes'] })
      setEditingNode(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clusterNodesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster-nodes'] })
    },
  })

  const setRoleMutation = useMutation({
    mutationFn: ({ nodeId, role }: { nodeId: string; role: 'primary' | 'secondary' }) =>
      clusterNodesApi.setNodeRole(nodeId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster-nodes'] })
    },
  })

  const healthCheckMutation = useMutation({
    mutationFn: (nodeId: string) => clusterNodesApi.checkHealth(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster-nodes'] })
    },
  })

  const testConnectionMutation = useMutation({
    mutationFn: (nodeId: string) => clusterNodesApi.testConnection(nodeId),
  })

  const checkAllHealthMutation = useMutation({
    mutationFn: () => clusterNodesApi.checkAllHealth(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster-nodes'] })
    },
  })

  const resetForm = () => {
    setFormData({
      hostname: '',
      ip_address: '',
      node_type: 'application',
      ssh_username: '',
      ssh_password: '',
      ssh_port: 22,
      description: '',
      location: '',
      tags: [],
      is_monitored: true,
    })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingNode) return
    updateMutation.mutate({ id: editingNode.id, data: formData })
  }

  const startEdit = (node: ClusterNode) => {
    setEditingNode(node)
    setFormData({
      hostname: node.hostname,
      ip_address: node.ip_address,
      node_type: node.node_type,
      ssh_username: node.ssh_username,
      ssh_password: '', // Don't populate password
      ssh_port: node.ssh_port,
      description: node.description || '',
      location: node.location || '',
      tags: node.tags || [],
      is_monitored: node.is_monitored,
    })
  }

  if (!user) {
    return <div>Loading...</div>
  }

  if (!isPlatformAdmin) {
    return (
      <Layout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="vaka-card p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p className="text-muted-foreground">Only platform administrators can access this page.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const stats = {
    total: nodes?.length || 0,
    healthy: nodes?.filter(n => n.status === 'healthy').length || 0,
    unhealthy: nodes?.filter(n => n.status === 'unhealthy').length || 0,
    offline: nodes?.filter(n => n.status === 'offline').length || 0,
    unknown: nodes?.filter(n => n.status === 'unknown').length || 0,
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium mb-2 text-gray-900">Cluster Node Management</h1>
            <p className="text-sm text-gray-600">Manage and monitor cluster infrastructure nodes</p>
          </div>
          <div className="flex gap-3">
            <MaterialButton
              variant="outlined"
              onClick={() => checkAllHealthMutation.mutate()}
              disabled={checkAllHealthMutation.isPending}
              startIcon={<span className="text-sm">🔄</span>}
              className="border-outline/10 hover:bg-gray-50"
            >
              {checkAllHealthMutation.isPending ? 'Checking...' : 'Check All Health'}
            </MaterialButton>
            <MaterialButton
              onClick={() => {
                resetForm()
                setShowCreateForm(true)
                setEditingNode(null)
              }}
              startIcon={<PlusIcon className="w-4 h-4" />}
              className="shadow-md-elevation-4"
            >
              Add Node
            </MaterialButton>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MaterialCard elevation={1} className="p-4 bg-white">
            <div className="text-xs font-medium text-gray-500 tracking-tight mb-1">Total Nodes</div>
            <div className="text-2xl font-medium text-gray-900">{stats.total}</div>
          </MaterialCard>
          <MaterialCard elevation={1} className="p-4 bg-success-50/30 border-success-100">
            <div className="text-xs font-medium text-success-700 tracking-tight mb-1">Healthy</div>
            <div className="text-2xl font-medium text-success-700">{stats.healthy}</div>
          </MaterialCard>
          <MaterialCard elevation={1} className="p-4 bg-error-50/30 border-error-100">
            <div className="text-xs font-medium text-error-700 tracking-tight mb-1">Unhealthy</div>
            <div className="text-2xl font-medium text-error-700">{stats.unhealthy}</div>
          </MaterialCard>
          <MaterialCard elevation={1} className="p-4 bg-blue-100/80 border-gray-200">
            <div className="text-xs font-medium text-gray-500 tracking-tight mb-1">Offline</div>
            <div className="text-2xl font-medium text-gray-600">{stats.offline}</div>
          </MaterialCard>
          <MaterialCard elevation={1} className="p-4 bg-warning-50/30 border-warning-100">
            <div className="text-xs font-medium text-warning-700 tracking-tight mb-1">Unknown</div>
            <div className="text-2xl font-medium text-warning-700">{stats.unknown}</div>
          </MaterialCard>
        </div>

        {/* Filters */}
        <MaterialCard elevation={0} className="p-4 bg-surface-variant/5 border-none">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <MaterialInput
                label="Filter by Node Type"
                type="select"
                value={selectedNodeType}
                onChange={(e) => setSelectedNodeType(e.target.value)}
                options={[
                  { value: '', label: 'All Types' },
                  ...NODE_TYPES
                ]}
              />
            </div>
            <div className="flex-1">
              <MaterialInput
                label="Filter by Status"
                type="select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'healthy', label: 'Healthy' },
                  { value: 'unhealthy', label: 'Unhealthy' },
                  { value: 'offline', label: 'Offline' },
                  { value: 'unknown', label: 'Unknown' }
                ]}
              />
            </div>
          </div>
        </MaterialCard>

        {/* Create/Edit Form Modal */}
        {(showCreateForm || editingNode) && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <MaterialCard elevation={24} className="max-w-2xl w-full mx-4 border-none overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b bg-surface-variant/10 flex items-center justify-between">
                <h2 className="text-xl font-medium text-gray-900">
                  {editingNode ? 'Edit Cluster Node' : 'Add Cluster Node'}
                </h2>
                <MaterialButton variant="text" size="small" onClick={() => { setShowCreateForm(false); setEditingNode(null); resetForm(); }} className="!p-2 text-gray-600">
                  <XIcon className="w-6 h-6" />
                </MaterialButton>
              </div>
              
              <form onSubmit={editingNode ? handleUpdate : handleCreate} className="p-6 space-y-5 bg-background">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <MaterialInput
                    label="Hostname *"
                    type="text"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    required
                  />
                  <MaterialInput
                    label="IP Address *"
                    type="text"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <MaterialInput
                    label="Node Type *"
                    type="select"
                    value={formData.node_type}
                    onChange={(e) => setFormData({ ...formData, node_type: e.target.value })}
                    required
                    options={NODE_TYPES}
                  />
                  <MaterialInput
                    label="SSH Port"
                    type="number"
                    value={formData.ssh_port}
                    onChange={(e) => setFormData({ ...formData, ssh_port: parseInt(e.target.value) || 22 })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <MaterialInput
                    label="SSH Username *"
                    type="text"
                    value={formData.ssh_username}
                    onChange={(e) => setFormData({ ...formData, ssh_username: e.target.value })}
                    required
                  />
                  <MaterialInput
                    label={editingNode ? 'SSH Password (optional)' : 'SSH Password *'}
                    type="password"
                    value={formData.ssh_password}
                    onChange={(e) => setFormData({ ...formData, ssh_password: e.target.value })}
                    required={!editingNode}
                    placeholder={editingNode ? 'Leave empty to keep current' : 'Enter SSH password'}
                  />
                </div>

                <MaterialInput
                  label="SSH Key Path (Optional)"
                  type="text"
                  value={formData.ssh_key_path || ''}
                  onChange={(e) => setFormData({ ...formData, ssh_key_path: e.target.value || undefined })}
                  placeholder="/path/to/ssh/key"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <MaterialInput
                    label="Location"
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value || undefined })}
                    placeholder="Data center, region, etc."
                  />
                  <MaterialInput
                    label="Description"
                    type="text"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value || undefined })}
                  />
                </div>

                <label className="flex items-center gap-3 p-4 bg-surface-variant/5 rounded-md border border-outline/5 cursor-pointer hover:bg-surface-variant/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_monitored}
                    onChange={(e) => setFormData({ ...formData, is_monitored: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable health monitoring
                  </span>
                </label>

                <div className="flex gap-3 justify-end pt-4 border-t bg-surface-variant/5 -mx-6 -mb-6 p-6 mt-6">
                  <MaterialButton
                    variant="text"
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setEditingNode(null)
                      resetForm()
                    }}
                    className="text-gray-600"
                  >
                    Cancel
                  </MaterialButton>
                  <MaterialButton
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="shadow-md-elevation-4"
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Processing...' : editingNode ? 'Update Node' : 'Create Node'}
                  </MaterialButton>
                </div>
              </form>
            </MaterialCard>
          </div>
        )}

        {/* Nodes Table */}
        {isLoading ? (
          <div className="text-center py-24 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4" />
            <div className="text-muted-foreground font-medium">Loading infrastructure nodes...</div>
          </div>
        ) : !nodes || nodes.length === 0 ? (
          <MaterialCard elevation={1} className="text-center py-24 border-none">
            <div className="w-20 h-20 bg-surface-variant/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl text-gray-500">🖥️</span>
            </div>
            <p className="text-xl font-medium text-gray-900 mb-2">No cluster nodes found</p>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">Register your infrastructure nodes to start monitoring their health and status.</p>
            <MaterialButton
              onClick={() => {
                resetForm()
                setShowCreateForm(true)
              }}
              startIcon={<PlusIcon className="w-4 h-4" />}
              className="shadow-md-elevation-4"
            >
              Add First Node
            </MaterialButton>
          </MaterialCard>
        ) : (
          <MaterialCard elevation={2} className="overflow-hidden border-none">
            <div className="p-6 border-b bg-surface-variant/10">
              <h2 className="text-lg font-medium text-gray-900">Infrastructure Nodes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-surface-variant/30">
                  <tr>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Hostname</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">IP Address</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Type</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Role</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Status</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Resources</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Last Check</th>
                    <th className="px-6 py-2 text-right text-xs font-medium text-gray-500 tracking-tight">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {nodes.map((node) => (
                    <tr key={node.id} className="hover:bg-primary-50/20 transition-all duration-150">
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">{node.hostname}</div>
                          {node.is_current_node && (
                            <MaterialChip label="Active" color="success" size="small" variant="filled" className="h-5 text-xs" />
                          )}
                        </div>
                        {node.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{node.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-600">{node.ip_address}</td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip label={node.node_type} size="small" variant="outlined" color="primary" />
                      </td>
                      <td className="px-6 py-2">
                        <div className="flex flex-col gap-2">
                          {node.node_role ? (
                            <MaterialChip 
                              label={node.node_role === 'primary' ? 'Primary' : 'Secondary'} 
                              color={node.node_role === 'primary' ? 'primary' : 'default'} 
                              size="small" 
                              variant="filled"
                              className="h-6 text-xs font-medium"
                            />
                          ) : (
                            <span className="text-sm text-gray-600 italic">Not assigned</span>
                          )}
                          <select
                            value={node.node_role || ''}
                            onChange={(e) => {
                              const role = e.target.value as 'primary' | 'secondary'
                              if (role) {
                                setRoleMutation.mutate({ nodeId: node.id, role })
                              }
                            }}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white hover:border-primary-300 transition-colors"
                            disabled={setRoleMutation.isPending}
                          >
                            <option value="">Assign Role...</option>
                            <option value="primary">Primary</option>
                            <option value="secondary">Secondary</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip 
                          label={node.status} 
                          color={
                            node.status === 'healthy' ? 'success' :
                            node.status === 'unhealthy' ? 'error' :
                            node.status === 'offline' ? 'default' :
                            'warning'
                          } 
                          size="small" 
                          variant="filled" 
                        />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="text-sm space-y-1 text-gray-600 font-medium">
                          {node.cpu_usage && <div className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-400"></span>CPU: {node.cpu_usage}</div>}
                          {node.memory_usage && <div className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-purple-400"></span>Mem: {node.memory_usage}</div>}
                          {node.disk_usage && <div className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-orange-400"></span>Disk: {node.disk_usage}</div>}
                        </div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-xs text-gray-500">
                        {node.last_health_check
                          ? new Date(node.last_health_check).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-right">
                        <div className="flex gap-1.5 justify-end">
                          <MaterialButton
                            variant="text"
                            size="small"
                            onClick={() => healthCheckMutation.mutate(node.id)}
                            disabled={healthCheckMutation.isPending}
                            title="Check Health"
                            className="!p-2"
                          >
                            🔍
                          </MaterialButton>
                          <MaterialButton
                            variant="text"
                            size="small"
                            onClick={() => testConnectionMutation.mutate(node.id)}
                            disabled={testConnectionMutation.isPending}
                            title="Test SSH Connection"
                            className="!p-2"
                          >
                            🔌
                          </MaterialButton>
                          <MaterialButton
                            variant="text"
                            size="small"
                            onClick={() => startEdit(node)}
                            title="Edit"
                            className="!p-2 text-gray-600"
                          >
                            ✏️
                          </MaterialButton>
                          <MaterialButton
                            variant="text"
                            size="small"
                            color="error"
                            onClick={() => {
                              if (confirm(`Delete node ${node.hostname}?`)) {
                                deleteMutation.mutate(node.id)
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            title="Delete"
                            className="!p-2"
                          >
                            🗑️
                          </MaterialButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MaterialCard>
        )}

        {/* Test Connection Result */}
        {testConnectionMutation.data && (
          <div className="animate-in slide-in-from-bottom-2 duration-300">
            <MaterialCard elevation={1} className={`p-4 border-none ${testConnectionMutation.data.success ? 'bg-success-50 text-success-800' : 'bg-error-50 text-error-800'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${testConnectionMutation.data.success ? 'bg-success-100 text-green-600' : 'bg-error-100 text-red-600'}`}>
                  {testConnectionMutation.data.success ? '✓' : '✗'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {testConnectionMutation.data.success
                      ? `SSH connection successful`
                      : `SSH connection failed`}
                  </p>
                  <p className="text-xs opacity-80 mt-0.5">
                    {testConnectionMutation.data.success
                      ? `Connection established in ${testConnectionMutation.data.connection_time?.toFixed(2)}s`
                      : testConnectionMutation.data.error}
                  </p>
                </div>
                <MaterialButton variant="text" size="small" onClick={() => testConnectionMutation.reset()} className="text-current opacity-60 hover:opacity-100">
                  Dismiss
                </MaterialButton>
              </div>
            </MaterialCard>
          </div>
        )}
      </div>
    </Layout>
  )
}
