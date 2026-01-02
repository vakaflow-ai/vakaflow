import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentConnectionsApi, AgentConnection, ConnectionCreate } from '../lib/agentConnections'
import Layout from '../components/Layout'

export default function AgentConnections() {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingConnection, setEditingConnection] = useState<AgentConnection | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [formData, setFormData] = useState<ConnectionCreate>({
    name: '',
    app_name: '',
    app_type: '',
    connection_type: 'cloud',
    protocol: '',
    endpoint_url: '',
    authentication_method: '',
    description: '',
    is_active: true,
    is_required: true,
    is_encrypted: true,
    data_classification: '',
    compliance_requirements: [],
    data_types_exchanged: [],
    data_flow_direction: 'bidirectional',
    data_volume: '',
    exchange_frequency: '',
    source_system: '',
    destination_system: '',
    data_schema: '',
  })

  const { data: connections, isLoading } = useQuery({
    queryKey: ['agent-connections', agentId, filterType],
    queryFn: () => agentConnectionsApi.list(agentId!, filterType !== 'all' ? filterType : undefined),
    enabled: !!agentId,
  })

  const createMutation = useMutation({
    mutationFn: (data: ConnectionCreate) => agentConnectionsApi.create(agentId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-connections', agentId] })
      setShowCreate(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ConnectionCreate> }) =>
      agentConnectionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-connections', agentId] })
      setEditingConnection(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => agentConnectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-connections', agentId] })
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      app_name: '',
      app_type: '',
      connection_type: 'cloud',
      protocol: '',
      endpoint_url: '',
      authentication_method: '',
      description: '',
      is_active: true,
      is_required: true,
      is_encrypted: true,
      data_classification: '',
      compliance_requirements: [],
      data_types_exchanged: [],
      data_flow_direction: 'bidirectional',
      data_format: '',
      data_volume: '',
      exchange_frequency: '',
      source_system: '',
      destination_system: '',
      data_schema: '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingConnection) {
      updateMutation.mutate({ id: editingConnection.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (connection: AgentConnection) => {
    setEditingConnection(connection)
    setFormData({
      name: connection.name,
      app_name: connection.app_name,
      app_type: connection.app_type,
      connection_type: connection.connection_type,
      protocol: connection.protocol || '',
      endpoint_url: connection.endpoint_url || '',
      authentication_method: connection.authentication_method || '',
      description: connection.description || '',
      is_active: connection.is_active,
      is_required: connection.is_required,
      is_encrypted: connection.is_encrypted,
      data_classification: connection.data_classification || '',
      compliance_requirements: connection.compliance_requirements || [],
      data_types_exchanged: connection.data_types_exchanged || [],
      data_flow_direction: connection.data_flow_direction || 'bidirectional',
      data_format: connection.data_format || '',
      data_volume: connection.data_volume || '',
      exchange_frequency: connection.exchange_frequency || '',
      source_system: connection.source_system || '',
      destination_system: connection.destination_system || '',
      data_schema: connection.data_schema || '',
    })
    setShowCreate(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this connection?')) {
      deleteMutation.mutate(id)
    }
  }

  const getConnectionTypeColor = (type: string) => {
    switch (type) {
      case 'cloud':
        return 'bg-blue-100 text-blue-800'
      case 'on_premise':
        return 'bg-green-100 text-green-800'
      case 'hybrid':
        return 'bg-purple-100 text-purple-800'
      case 'edge':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <Layout user={null}>
        <div className="text-center py-12">Loading connections...</div>
      </Layout>
    )
  }

  return (
    <Layout user={null}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium mb-2">Agent Connections</h1>
            <p className="text-sm text-muted-foreground">
              Manage apps and services this agent connects to
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="compact-input"
            >
              <option value="all">All Types</option>
              <option value="cloud">Cloud</option>
              <option value="on_premise">On-Premise</option>
              <option value="hybrid">Hybrid</option>
              <option value="edge">Edge</option>
            </select>
            <button
              onClick={() => {
                setEditingConnection(null)
                resetForm()
                setShowCreate(true)
              }}
              className="compact-button-primary"
            >
              Add Connection
            </button>
          </div>
        </div>

        {/* Create/Edit Form */}
        {showCreate && (
          <div className="compact-card">
            <h2 className="unified-section-title mb-4">
              {editingConnection ? 'Edit Connection' : 'Add New Connection'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Connection Name *</label>
                  <input
                    type="text"
                    className="compact-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Salesforce API Connection"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">App Name *</label>
                  <input
                    type="text"
                    className="compact-input"
                    value={formData.app_name}
                    onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                    required
                    placeholder="e.g., Salesforce, PostgreSQL, AWS S3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">App Type *</label>
                  <input
                    type="text"
                    className="compact-input"
                    value={formData.app_type}
                    onChange={(e) => setFormData({ ...formData, app_type: e.target.value })}
                    required
                    placeholder="e.g., CRM, Database, Storage, API"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Connection Type *</label>
                  <select
                    className="compact-input"
                    value={formData.connection_type}
                    onChange={(e) => setFormData({ ...formData, connection_type: e.target.value as any })}
                    required
                  >
                    <option value="cloud">Cloud</option>
                    <option value="on_premise">On-Premise</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="edge">Edge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Connection Type / Protocol</label>
                  <select
                    className="compact-input"
                    value={formData.protocol}
                    onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                  >
                    <option value="">Select Connection Type</option>
                    <option value="api">API</option>
                    <option value="rest_api">REST API</option>
                    <option value="graphql">GraphQL</option>
                    <option value="grpc">gRPC</option>
                    <option value="websocket">WebSocket</option>
                    <option value="db">DB (Database)</option>
                    <option value="database">Database (Generic)</option>
                    <option value="file">File</option>
                    <option value="file_system">File System</option>
                    <option value="tcp_ip">TCP/IP</option>
                    <option value="udp">UDP</option>
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="ftp">FTP</option>
                    <option value="sftp">SFTP</option>
                    <option value="mqtt">MQTT</option>
                    <option value="amqp">AMQP</option>
                    <option value="smtp">SMTP</option>
                    <option value="ldap">LDAP</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Authentication Method</label>
                  <input
                    type="text"
                    className="compact-input"
                    value={formData.authentication_method}
                    onChange={(e) => setFormData({ ...formData, authentication_method: e.target.value })}
                    placeholder="e.g., OAuth 2.0, API Key, Basic Auth"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Endpoint URL</label>
                  <input
                    type="url"
                    className="compact-input"
                    value={formData.endpoint_url}
                    onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                    placeholder="https://api.example.com/v1 or connection string"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    className="compact-input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Describe the connection and its purpose..."
                  />
                </div>
                
                {/* Data Exchange Section */}
                <div className="md:col-span-2 border-t pt-4 mt-4">
                  <h3 className="text-lg font-medium mb-4">Data Exchange Information</h3>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Data Flow Direction *</label>
                  <select
                    className="compact-input"
                    value={formData.data_flow_direction}
                    onChange={(e) => setFormData({ ...formData, data_flow_direction: e.target.value as any })}
                    required
                  >
                    <option value="bidirectional">Bidirectional (Both ways)</option>
                    <option value="inbound">Inbound (To Agent)</option>
                    <option value="outbound">Outbound (From Agent)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Data Format</label>
                  <select
                    className="compact-input"
                    value={formData.data_format}
                    onChange={(e) => setFormData({ ...formData, data_format: e.target.value })}
                  >
                    <option value="">Select Format</option>
                    <option value="JSON">JSON</option>
                    <option value="XML">XML</option>
                    <option value="CSV">CSV</option>
                    <option value="Binary">Binary</option>
                    <option value="Protocol Buffer">Protocol Buffer</option>
                    <option value="Avro">Avro</option>
                    <option value="Parquet">Parquet</option>
                    <option value="SQL">SQL (Database)</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Source System</label>
                  <input
                    type="text"
                    className="compact-input"
                    value={formData.source_system}
                    onChange={(e) => setFormData({ ...formData, source_system: e.target.value })}
                    placeholder="e.g., Salesforce CRM, PostgreSQL DB, AWS S3"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Destination System</label>
                  <input
                    type="text"
                    className="compact-input"
                    value={formData.destination_system}
                    onChange={(e) => setFormData({ ...formData, destination_system: e.target.value })}
                    placeholder="e.g., Agent System, Data Warehouse, Analytics Platform"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Data Volume</label>
                  <input
                    type="text"
                    className="compact-input"
                    value={formData.data_volume}
                    onChange={(e) => setFormData({ ...formData, data_volume: e.target.value })}
                    placeholder="e.g., 1GB/day, 1000 records/hour, Low, Medium, High"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Exchange Frequency</label>
                  <select
                    className="compact-input"
                    value={formData.exchange_frequency}
                    onChange={(e) => setFormData({ ...formData, exchange_frequency: e.target.value })}
                  >
                    <option value="">Select Frequency</option>
                    <option value="Real-time">Real-time</option>
                    <option value="Near Real-time">Near Real-time (seconds)</option>
                    <option value="Batch (hourly)">Batch (hourly)</option>
                    <option value="Batch (daily)">Batch (daily)</option>
                    <option value="Batch (weekly)">Batch (weekly)</option>
                    <option value="On-demand">On-demand</option>
                    <option value="Event-driven">Event-driven</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Data Types Exchanged</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.data_types_exchanged?.map((dt, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm flex items-center gap-1">
                        {dt}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              data_types_exchanged: formData.data_types_exchanged?.filter((_, i) => i !== idx) || []
                            })
                          }}
                          className="hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="compact-input flex-1"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setFormData({
                            ...formData,
                            data_types_exchanged: [...(formData.data_types_exchanged || []), e.target.value]
                          })
                          e.target.value = ''
                        }
                      }}
                    >
                      <option value="">Add Data Type...</option>
                      <option value="PII">PII (Personally Identifiable Information)</option>
                      <option value="PHI">PHI (Protected Health Information)</option>
                      <option value="Financial">Financial Data</option>
                      <option value="Transactional">Transactional Data</option>
                      <option value="Analytical">Analytical Data</option>
                      <option value="Logs">Logs & Metrics</option>
                      <option value="Configuration">Configuration Data</option>
                      <option value="Credentials">Credentials & Secrets</option>
                      <option value="Documents">Documents & Files</option>
                      <option value="Media">Media (Images, Video, Audio)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Data Schema / Structure</label>
                  <textarea
                    className="compact-input font-mono text-xs"
                    value={formData.data_schema}
                    onChange={(e) => setFormData({ ...formData, data_schema: e.target.value })}
                    rows={6}
                    placeholder="Describe the data structure, schema, or provide JSON schema example..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Data Classification</label>
                  <select
                    className="compact-input"
                    value={formData.data_classification}
                    onChange={(e) => setFormData({ ...formData, data_classification: e.target.value })}
                  >
                    <option value="">Select Classification</option>
                    <option value="PII">PII</option>
                    <option value="PHI">PHI</option>
                    <option value="Confidential">Confidential</option>
                    <option value="Internal">Internal</option>
                    <option value="Public">Public</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_required}
                      onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Required</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_encrypted}
                      onChange={(e) => setFormData({ ...formData, is_encrypted: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Encrypted</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="compact-button-primary">
                  {editingConnection ? 'Update' : 'Create'} Connection
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false)
                    setEditingConnection(null)
                    resetForm()
                  }}
                  className="compact-button-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Connections List */}
        {connections && connections.length > 0 ? (
          <div className="space-y-4">
            {connections.map((connection) => (
              <div key={connection.id} className="compact-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium">{connection.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${getConnectionTypeColor(connection.connection_type)}`}>
                        {connection.connection_type.replace('_', '-').toUpperCase()}
                      </span>
                      {connection.is_required && (
                        <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">Required</span>
                      )}
                      {!connection.is_active && (
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">Inactive</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">App:</span>
                        <div className="font-medium">{connection.app_name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <div className="font-medium">{connection.app_type}</div>
                      </div>
                      {connection.protocol && (
                        <div>
                          <span className="text-muted-foreground">Protocol:</span>
                          <div className="font-medium">{connection.protocol.replace('_', ' ').toUpperCase()}</div>
                        </div>
                      )}
                      {connection.authentication_method && (
                        <div>
                          <span className="text-muted-foreground">Auth:</span>
                          <div className="font-medium">{connection.authentication_method}</div>
                        </div>
                      )}
                    </div>
                    {connection.description && (
                      <p className="text-sm text-muted-foreground mt-2">{connection.description}</p>
                    )}
                    {connection.endpoint_url && (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">Endpoint: </span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{connection.endpoint_url}</code>
                      </div>
                    )}
                    {connection.data_classification && (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">Data Classification: </span>
                        <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                          {connection.data_classification}
                        </span>
                      </div>
                    )}
                    {connection.compliance_requirements && connection.compliance_requirements.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-xs text-muted-foreground">Compliance: </span>
                        {connection.compliance_requirements.map((req, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                            {req}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(connection)}
                      className="compact-button-secondary text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(connection.id)}
                      className="compact-button-danger text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="compact-card text-center py-12">
            <p className="text-muted-foreground mb-4">No connections found</p>
            <button
              onClick={() => {
                setEditingConnection(null)
                resetForm()
                setShowCreate(true)
              }}
              className="compact-button-primary"
            >
              Add First Connection
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

