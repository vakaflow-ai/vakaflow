import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialButton, MaterialCard, MaterialChip, MaterialInput } from '../components/material'
import { platformConfigApi, PlatformConfig, PlatformConfigCreate, PlatformConfigUpdate } from '../lib/platformConfig'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { HelpIcon, EditIcon, CheckIcon, XIcon, PlusIcon, CogIcon, SearchIcon } from '../components/Icons'

const CONFIG_CATEGORIES = [
  { value: 'application', label: 'Application' },
  { value: 'security', label: 'Security' },
  { value: 'database', label: 'Database' },
  { value: 'redis', label: 'Redis' },
  { value: 'qdrant', label: 'Qdrant' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'file_storage', label: 'File Storage' },
  { value: 'api', label: 'API' },
  { value: 'cors', label: 'CORS' },
  { value: 'rate_limiting', label: 'Rate Limiting' },
  { value: 'logging', label: 'Logging' },
]

const VALUE_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'JSON' },
  { value: 'secret', label: 'Secret (Encrypted)' },
]

// Help tooltip component
function HelpTooltip({ config }: { config: PlatformConfig }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const getHelpContent = () => {
    if (config.description) {
      return config.description
    }
    
    // Default help based on category and key
    const categoryHelp: Record<string, string> = {
      database: 'Database connection settings. Format: postgresql://user:password@host:port/dbname',
      redis: 'Redis connection URL. Format: redis://host:port or redis://:password@host:port',
      security: 'Security-related settings including encryption keys and token expiration',
      openai: 'OpenAI API configuration. Requires a valid API key from OpenAI',
      file_storage: 'File storage settings including upload directory and size limits',
      cors: 'CORS (Cross-Origin Resource Sharing) settings. Use comma-separated URLs or "*" for all',
      rate_limiting: 'Rate limiting configuration to prevent abuse',
      logging: 'Logging configuration including log levels and output destinations',
    }
    
    return categoryHelp[config.category] || `Configuration parameter for ${config.category} category. ${config.is_secret ? 'This is a secret value and will be encrypted.' : ''}`
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        className="text-blue-500 hover:text-blue-600 focus:outline-none"
        aria-label="Show help"
      >
        <HelpIcon className="w-4 h-4" />
      </button>
      {showTooltip && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTooltip(false)}
          />
          <div className="absolute left-0 top-6 z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium text-sm">{config.config_key}</h4>
              <button
                onClick={() => setShowTooltip(false)}
                className="text-gray-600 hover:text-gray-600"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <div>
                <span className="font-medium">What it controls:</span>
                <p className="mt-1">{getHelpContent()}</p>
              </div>
              <div>
                <span className="font-medium">Type:</span>
                <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">{config.value_type}</span>
              </div>
              {config.is_secret && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  ⚠️ This is a secret value. It will be encrypted and cannot be viewed after setting.
                </div>
              )}
              {config.is_required && (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  ℹ️ This is a required configuration and cannot be deleted.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Inline editable cell component
function EditableCell({ 
  config, 
  onSave 
}: { 
  config: PlatformConfig
  onSave: (value: any) => void 
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (isEditing) {
      if (config.is_secret) {
        setEditValue('')
      } else {
        setEditValue(
          typeof config.value === 'object' 
            ? JSON.stringify(config.value, null, 2) 
            : String(config.value)
        )
      }
    }
  }, [isEditing, config])

  const handleSave = () => {
    setError('')
    let processedValue: any = editValue

    if (config.is_secret && !editValue.trim()) {
      setError('Cannot save empty secret value')
      return
    }

    if (config.is_secret) {
      // For secrets, just pass the value as-is
      processedValue = editValue
    } else if (config.value_type === 'integer') {
      const parsed = parseInt(editValue)
      if (isNaN(parsed)) {
        setError('Invalid integer value')
        return
      }
      processedValue = parsed
    } else if (config.value_type === 'boolean') {
      processedValue = editValue === 'true' || editValue === '1' || editValue.toLowerCase() === 'yes'
    } else if (config.value_type === 'json') {
      try {
        processedValue = JSON.parse(editValue)
      } catch {
        setError('Invalid JSON format')
        return
      }
    }

    onSave(processedValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue('')
    setError('')
  }

  const displayValue = config.is_secret 
    ? (config.display_value || '****') 
    : (typeof config.value === 'object' ? JSON.stringify(config.value) : String(config.value))

  if (!isEditing) {
    return (
      <div className="flex items-start gap-2 group">
        <span className="text-sm font-mono bg-gray-50 px-2 py-1 rounded flex-1 min-w-0 break-words">
          {displayValue}
        </span>
        <button
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-600 flex-shrink-0 mt-1"
          title="Edit value"
        >
          <EditIcon className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {config.value_type === 'boolean' ? (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 text-sm"
          autoFocus
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      ) : config.value_type === 'json' ? (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 text-sm font-mono"
          rows={4}
          autoFocus
        />
      ) : (
        <MaterialInput
          type={config.is_secret ? 'password' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder={config.is_secret ? 'Enter new value' : ''}
          autoFocus
        />
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {config.is_secret && !editValue && (
        <p className="text-xs text-gray-500">Leave empty to keep current value</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="text-green-600 hover:text-green-700"
          title="Save"
        >
          <CheckIcon className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="text-red-600 hover:text-red-700"
          title="Cancel"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function PlatformConfiguration() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [searchKey, setSearchKey] = useState<string>('')
  const [showSecretsOnly, setShowSecretsOnly] = useState<boolean>(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<PlatformConfigCreate>({
    config_key: '',
    value: '',
    category: 'application',
    value_type: 'string',
    description: '',
    is_secret: false,
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Check if user is platform admin
  const isPlatformAdmin = user?.role === 'platform_admin'

  // Load ALL configs at once (no category filter in query)
  const { data: allConfigs, isLoading, error, isError, refetch } = useQuery({
    queryKey: ['platform-config', 'all'],
    queryFn: () => platformConfigApi.list(), // No category parameter - loads all
    enabled: !!user && isPlatformAdmin,
    refetchOnMount: true,
  })

  const createMutation = useMutation({
    mutationFn: (config: PlatformConfigCreate) => platformConfigApi.create(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-config'] })
      setShowCreateForm(false)
      resetForm()
    },
  })

  // Debug: Log query state
  useEffect(() => {
    if (user) {
      console.log('User:', user, 'isPlatformAdmin:', isPlatformAdmin)
      console.log('Query enabled:', !!user && isPlatformAdmin)
      console.log('Configs data:', allConfigs)
      console.log('Configs count:', allConfigs?.length ?? 0)
      console.log('Is loading:', isLoading)
      if (isError) {
        console.error('Query error:', error)
      }
      if (allConfigs && allConfigs.length > 0) {
        console.log('Sample config:', allConfigs[0])
        console.log('Categories found:', [...new Set(allConfigs.map(c => c.category))])
      }
    }
  }, [user, isPlatformAdmin, allConfigs, isLoading, isError, error])

  const updateMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: PlatformConfigUpdate }) =>
      platformConfigApi.update(key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-config'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (key: string) => platformConfigApi.delete(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-config'] })
    },
  })

  const resetForm = () => {
    setFormData({
      config_key: '',
      value: '',
      category: 'application',
      value_type: 'string',
      description: '',
      is_secret: false,
    })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Convert value based on type
    let processedValue: any = formData.value
    if (formData.value_type === 'integer') {
      processedValue = parseInt(formData.value as string)
    } else if (formData.value_type === 'boolean') {
      processedValue = formData.value === 'true' || formData.value === true
    } else if (formData.value_type === 'json') {
      try {
        processedValue = JSON.parse(formData.value as string)
      } catch {
        alert('Invalid JSON format')
        return
      }
    }

    createMutation.mutate({
      ...formData,
      value: processedValue,
    })
  }

  const handleInlineSave = (config: PlatformConfig, value: any) => {
    updateMutation.mutate({
      key: config.config_key,
      data: {
        value: value,
        description: config.description,
      },
    })
  }

  const handleDelete = (configKey: string, isRequired: boolean) => {
    if (isRequired) {
      alert('Cannot delete required configuration')
      return
    }
    if (confirm(`Are you sure you want to delete configuration "${configKey}"?`)) {
      deleteMutation.mutate(configKey)
    }
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

  // Filter configs by multiple criteria on the client side
  const filteredConfigs = (allConfigs || []).filter(config => {
    const matchesCategory = !selectedCategory || config.category === selectedCategory
    const matchesType = !selectedType || config.value_type === selectedType
    const matchesSearch = !searchKey || 
      config.config_key.toLowerCase().includes(searchKey.toLowerCase()) ||
      (config.description && config.description.toLowerCase().includes(searchKey.toLowerCase()))
    const matchesSecret = !showSecretsOnly || config.is_secret
    
    return matchesCategory && matchesType && matchesSearch && matchesSecret
  })

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2 tracking-tight">Platform Configuration</h1>
            <p className="text-gray-500 font-medium">Manage all underlying platform parameters, environment settings, and encrypted secrets</p>
          </div>
          <MaterialButton
            onClick={() => {
              resetForm()
              setShowCreateForm(true)
            }}
            size="large"
            className="rounded-md shadow-lg shadow-primary-500/20 px-8 h-9"
            startIcon={<PlusIcon className="w-5 h-5" />}
          >
            Add Configuration
          </MaterialButton>
        </div>

        {/* Filters - Material Design */}
        <MaterialCard elevation={1} className="mb-10 p-6 border-none overflow-visible bg-white/80 backdrop-blur-sm ring-1 ring-gray-200/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 tracking-tight ml-1">Search Key or Description</label>
              <input
                type="text"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                className="w-full h-11 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
                placeholder="e.g. SECRET_KEY"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 tracking-tight ml-1">Filter by Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-11 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
              >
                <option value="">All Categories</option>
                {CONFIG_CATEGORIES.map((cat) => {
                  const count = (allConfigs || []).filter(c => c.category === cat.value).length
                  return (
                    <option key={cat.value} value={cat.value}>
                      {cat.label} ({count})
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 tracking-tight ml-1">Value Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full h-11 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-medium"
              >
                <option value="">All Types</option>
                {VALUE_TYPES.map((vt) => {
                  const count = (allConfigs || []).filter(c => c.value_type === vt.value).length
                  return (
                    <option key={vt.value} value={vt.value}>
                      {vt.label} ({count})
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <label className="block text-sm font-medium text-gray-700 tracking-tight ml-1">Visibility</label>
                <button
                  onClick={() => setShowSecretsOnly(!showSecretsOnly)}
                  className={`w-full h-11 px-4 rounded-md border transition-all duration-200 flex items-center justify-between font-medium text-xs ${
                    showSecretsOnly 
                      ? 'bg-red-50 border-red-200 text-red-700 shadow-sm ring-2 ring-red-100' 
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {showSecretsOnly ? '🔒 Secrets Only' : '👁️ Show All'}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${showSecretsOnly ? 'bg-red-500' : 'bg-gray-300'}`} />
                </button>
              </div>
              <button
                onClick={() => refetch()}
                className={`h-11 w-11 flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-white hover:text-blue-600 transition-all ${isLoading ? 'animate-spin opacity-50' : ''}`}
                disabled={isLoading}
                title="Refresh configurations"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          {(selectedCategory || selectedType || searchKey || showSecretsOnly) && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
              <span className="text-sm font-medium text-gray-700 tracking-tight">
                Identified <span className="text-gray-900">{filteredConfigs.length}</span> of <span className="text-gray-900">{(allConfigs || []).length}</span> parameters
              </span>
              <MaterialButton
                variant="text"
                size="small"
                color="primary"
                onClick={() => {
                  setSelectedCategory('')
                  setSelectedType('')
                  setSearchKey('')
                  setShowSecretsOnly(false)
                }}
                className="font-medium text-sm tracking-tight"
              >
                Clear all filters
              </MaterialButton>
            </div>
          )}
        </MaterialCard>

        {/* Create Form Modal - Material Design */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <MaterialCard elevation={4} className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border-none">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">New Parameter</h2>
                  <p className="text-sm text-gray-500 font-medium">Define a new platform configuration variable</p>
                </div>
                <button 
                  onClick={() => { setShowCreateForm(false); resetForm(); }}
                  className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
                >
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 tracking-tight ml-1">Configuration Key *</label>
                  <input
                    type="text"
                    value={formData.config_key}
                    onChange={(e) => setFormData({ ...formData, config_key: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    className="w-full h-9 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all duration-200 font-mono text-base font-bold text-primary-700"
                    placeholder="e.g. SMTP_RELAY_HOST"
                    required
                  />
                  <p className="text-xs text-gray-600 font-bold ml-1">System key format required (uppercase, underscores)</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 tracking-tight ml-1">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full h-9 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all font-medium"
                      required
                    >
                      {CONFIG_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 tracking-tight ml-1">Value Type *</label>
                    <select
                      value={formData.value_type}
                      onChange={(e) => {
                        const isSecret = e.target.value === 'secret'
                        setFormData({ ...formData, value_type: e.target.value, is_secret: isSecret })
                      }}
                      className="w-full h-9 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-blue-500 transition-all font-medium"
                      required
                    >
                      {VALUE_TYPES.map((vt) => (
                        <option key={vt.value} value={vt.value}>
                          {vt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 tracking-tight ml-1">Initial Value *</label>
                  {formData.value_type === 'boolean' ? (
                    <select
                      value={String(formData.value)}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value === 'true' })}
                      className="w-full h-9 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white transition-all font-bold text-blue-600"
                      required
                    >
                      <option value="true">True (Enabled)</option>
                      <option value="false">False (Disabled)</option>
                    </select>
                  ) : formData.value_type === 'json' ? (
                    <textarea
                      value={formData.value as string}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      className="w-full min-h-[160px] p-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white transition-all font-mono text-sm shadow-inner"
                      placeholder='{ "config": "value" }'
                      required
                    />
                  ) : (
                    <input
                      type={formData.is_secret ? 'password' : 'text'}
                      value={formData.value as string}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      className="w-full h-9 px-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white transition-all font-medium"
                      placeholder={formData.is_secret ? "Sensitive data won't be visible" : "Enter value..."}
                      required
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 tracking-tight ml-1">Help Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full h-24 p-4 rounded-md border border-gray-200 bg-gray-50 focus:bg-white transition-all text-sm font-medium"
                    placeholder="Describe what this parameter controls and expected formats..."
                  />
                </div>

                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer group">
                  <input
                    type="checkbox"
                    id="is_secret"
                    checked={formData.is_secret}
                    onChange={(e) => setFormData({ ...formData, is_secret: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 transition-all cursor-pointer"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-gray-900">Encrypted Secret</span>
                    <span className="block text-xs text-gray-500 font-medium">Encrypt this value in the database. It will never be shown in plain text.</span>
                  </div>
                </label>

                <div className="flex gap-4 pt-6">
                  <MaterialButton
                    type="button"
                    variant="outlined"
                    color="neutral"
                    onClick={() => {
                      setShowCreateForm(false)
                      resetForm()
                    }}
                    className="flex-1 h-9 rounded-md border-gray-200 font-bold"
                  >
                    Discard
                  </MaterialButton>
                  <MaterialButton
                    type="submit"
                    className="flex-1 h-9 rounded-md shadow-lg shadow-primary-500/20 font-bold"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Syncing...' : 'Create Configuration'}
                  </MaterialButton>
                </div>
              </form>
            </MaterialCard>
          </div>
        )}

        {/* Error Display */}
        {isError && (
          <div className="p-6 mb-8 bg-red-50 border border-red-100 rounded-lg flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
              <XIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-red-800 font-bold tracking-tight">Sync Failure</p>
              <p className="text-red-600 text-sm font-medium mt-1">
                {error instanceof Error ? error.message : 'A network error occurred while fetching platform metadata.'}
              </p>
            </div>
          </div>
        )}

        {/* Configuration Table - Material Design */}
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="inline-block w-12 h-9 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-500 font-bold tracking-tight">Synchronizing system parameters...</p>
          </div>
        ) : filteredConfigs.length === 0 ? (
          <MaterialCard elevation={0} className="py-24 text-center border-2 border-dashed border-gray-200 bg-transparent rounded-lg">
            {allConfigs && allConfigs.length === 0 ? (
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-6 text-gray-600">
                  <CogIcon className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Initialize Configuration</h3>
                <p className="text-gray-500 font-medium mb-8">
                  The platform configuration registry is currently empty. Initialize your first parameters to begin.
                </p>
                <MaterialButton
                  onClick={() => {
                    resetForm()
                    setShowCreateForm(true)
                  }}
                  className="rounded-md shadow-lg shadow-primary-500/20 px-8"
                >
                  Create First Parameter
                </MaterialButton>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-6 text-gray-600">
                  <SearchIcon className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No results matching filters</h3>
                <p className="text-gray-500 font-medium mb-8">
                  We couldn't find any parameters matching your current search criteria.
                </p>
                <MaterialButton
                  variant="text"
                  color="primary"
                  onClick={() => {
                    setSelectedCategory('')
                    setSelectedType('')
                    setSearchKey('')
                    setShowSecretsOnly(false)
                  }}
                  className="font-bold"
                >
                  Reset all filters
                </MaterialButton>
              </div>
            )}
          </MaterialCard>
        ) : (
          <MaterialCard elevation={1} className="p-0 border-none overflow-hidden bg-white shadow-xl ring-1 ring-gray-200/50">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-blue-100/80 border-b border-gray-100">
                    <th className="px-6 py-2.5 text-left text-sm font-medium text-gray-700 tracking-tight w-1/4">Identifier & Logic</th>
                    <th className="px-6 py-2.5 text-left text-sm font-medium text-gray-700 tracking-tight w-[15%]">Classification</th>
                    <th className="px-6 py-2.5 text-left text-sm font-medium text-gray-700 tracking-tight w-[10%]">Data Type</th>
                    <th className="px-6 py-2.5 text-left text-sm font-medium text-gray-700 tracking-tight w-1/3">Configured Value</th>
                    <th className="px-6 py-2.5 text-right text-sm font-medium text-gray-700 tracking-tight w-[10%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredConfigs.map((config) => (
                    <tr key={config.id} className="hover:bg-primary-50/30 transition-colors group">
                      <td className="px-6 py-3 align-top">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold font-mono text-gray-900 break-all">{config.config_key}</span>
                          <HelpTooltip config={config} />
                        </div>
                        {config.description && (
                          <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2" title={config.description}>{config.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-3 align-top">
                        <MaterialChip 
                          label={config.category} 
                          color="primary" 
                          variant="outlined" 
                          size="small" 
                          className="font-medium text-xs h-6 border-primary-100 bg-primary-50/30" 
                        />
                      </td>
                      <td className="px-6 py-3 align-top">
                        <MaterialChip 
                          label={config.value_type} 
                          color="default" 
                          variant="filled" 
                          size="small" 
                          className="font-medium text-xs h-6 bg-gray-100 text-gray-600" 
                        />
                      </td>
                      <td className="px-6 py-3 align-top">
                        <div className="flex flex-col gap-3">
                          <EditableCell 
                            config={config} 
                            onSave={(value) => handleInlineSave(config, value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            {config.is_secret && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-medium tracking-tight border border-red-100">
                                🔒 Encrypted
                              </span>
                            )}
                            {config.is_required && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium tracking-tight border border-amber-100">
                                ⚠️ System Required
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 align-top text-right">
                        {!config.is_required ? (
                          <button
                            onClick={() => handleDelete(config.config_key, config.is_required)}
                            disabled={deleteMutation.isPending}
                            className="text-sm font-medium text-gray-700 hover:text-red-600 transition-colors tracking-tight opacity-0 group-hover:opacity-100"
                          >
                            Delete
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-gray-600 tracking-tight">Locked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MaterialCard>
        )}
      </div>
    </Layout>
  )
}
