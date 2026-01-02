import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StudioAgent } from '../lib/studio'
import { usersApi, User } from '../lib/users'
import { masterDataListsApi, MasterDataList } from '../lib/masterDataLists'

interface AgentSettingsModalProps {
  agent: StudioAgent | null
  onClose: () => void
  onSave: (agentId: string, updates: AgentUpdate) => Promise<void>
}

export interface AgentUpdate {
  name?: string
  description?: string
  category?: string
  tags?: string[]
  icon_url?: string
  is_available?: boolean
  is_featured?: boolean
  capabilities?: Record<string, any>
  // Master data attributes
  owner_id?: string
  department?: string
  organization?: string
  master_data_attributes?: Record<string, any>
}

export default function AgentSettingsModal({ agent, onClose, onSave }: AgentSettingsModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [isFeatured, setIsFeatured] = useState(false)
  const [capabilities, setCapabilities] = useState<Record<string, any>>({})
  const [capabilitiesJson, setCapabilitiesJson] = useState('')
  const [ownerId, setOwnerId] = useState<string>('')
  const [department, setDepartment] = useState<string>('')
  const [organization, setOrganization] = useState<string>('')
  const [masterDataAttributes, setMasterDataAttributes] = useState<Record<string, string>>({})
  const [masterDataAttributesJson, setMasterDataAttributesJson] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch users for owner dropdown
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: !!agent
  })

  // Fetch master data lists for department and organization
  const { data: departmentValues } = useQuery({
    queryKey: ['master-data-departments'],
    queryFn: () => masterDataListsApi.getValuesByType('department'),
    enabled: !!agent
  })

  const { data: organizationValues } = useQuery({
    queryKey: ['master-data-organizations'],
    queryFn: () => masterDataListsApi.getValuesByType('organization'),
    enabled: !!agent
  })

  // Get departments from master data list (fallback to users if not found)
  const departments = departmentValues && departmentValues.length > 0
    ? departmentValues.filter((v: any) => v.is_active !== false).map((v: any) => v.value || v.label)
    : (users ? [...new Set(users.map(u => u.department).filter(Boolean))] : [])
  
  // Get organizations from master data list (fallback to users if not found)
  const organizations = organizationValues && organizationValues.length > 0
    ? organizationValues.filter((v: any) => v.is_active !== false).map((v: any) => v.value || v.label)
    : (users ? [...new Set(users.map(u => u.organization).filter(Boolean))] : [])

  useEffect(() => {
    if (agent) {
      setName(agent.name || '')
      setDescription(agent.description || '')
      setCategory(agent.category || '')
      setTags((agent as any).tags || [])
      setIconUrl((agent as any).icon_url || '')
      setIsAvailable(agent.is_available !== false)
      setIsFeatured(agent.is_featured || false)
      setCapabilities(agent.capabilities || {})
      setCapabilitiesJson(JSON.stringify(agent.capabilities || {}, null, 2))
      setOwnerId(agent.owner_id || '')
      setDepartment(agent.department || '')
      setOrganization(agent.organization || '')
      setMasterDataAttributes(agent.master_data_attributes || {})
      setMasterDataAttributesJson(JSON.stringify(agent.master_data_attributes || {}, null, 2))
      setErrors({})
    }
  }, [agent])

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleCapabilitiesChange = (value: string) => {
    setCapabilitiesJson(value)
    try {
      const parsed = JSON.parse(value)
      setCapabilities(parsed)
      setErrors(prev => ({ ...prev, capabilities: '' }))
    } catch (e) {
      setErrors(prev => ({ ...prev, capabilities: 'Invalid JSON format' }))
    }
  }

  const handleSave = async () => {
    if (!agent) return

    const newErrors: Record<string, string> = {}
    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSaving(true)
    setErrors({})
    try {
      // Build updates object - always include fields that can be cleared (owner_id, department, organization)
      // Use null instead of undefined so Pydantic includes them in the request
      const updates: AgentUpdate = {
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        icon_url: iconUrl.trim() || undefined,
        is_available: isAvailable,
        is_featured: isFeatured,
        capabilities: Object.keys(capabilities).length > 0 ? capabilities : undefined,
        // Always include these fields - use undefined to clear, or the value to set
        owner_id: ownerId && ownerId.trim() ? ownerId.trim() : undefined,
        department: department.trim() || undefined,
        organization: organization.trim() || undefined,
        master_data_attributes: Object.keys(masterDataAttributes).length > 0 ? masterDataAttributes : undefined
      }

      console.log('Saving agent settings:', { agentId: agent.id, updates })
      console.log('Updates payload:', JSON.stringify(updates, null, 2))
      const result = await onSave(agent.id, updates)
      console.log('Agent settings saved successfully, response:', result)
      // Don't close immediately - let the parent handle it after query invalidation
      // onClose() will be called by the parent's onSuccess handler
    } catch (error: any) {
      console.error('Error saving agent settings:', error)
      setErrors({ save: error.message || 'Failed to save agent settings' })
    } finally {
      setIsSaving(false)
    }
  }

  if (!agent) return null

  const isVakaAgent = agent.source === 'vaka'
  const canEditCore = !isVakaAgent  // VAKA agents have read-only core properties

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-2 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-medium text-gray-900">Agent Settings</h2>
            <p className="text-sm text-gray-500 mt-1">
              {agent.name} ({agent.agent_type})
            </p>
            {isVakaAgent && (
              <p className="text-xs text-blue-600 mt-1">
                VAKA agents have limited editing - some properties are read-only
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name {canEditCore ? '*' : '(Read-only)'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEditCore}
                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  } ${!canEditCore ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Agent description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., GRC, Assessment, Vendor Management"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Icon URL
                </label>
                <input
                  type="url"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/icon.png"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a tag..."
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-normal bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-blue-600 hover:text-blue-800 font-normal"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Availability & Features */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Availability & Features</h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 font-normal">Available for use in flows</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 font-normal">Featured agent (shown prominently)</span>
              </label>
            </div>
          </div>

          {/* Master Data Attributes */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Master Data Attributes</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner
                </label>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Owner</option>
                  {users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
                {ownerId && users && (
                  <p className="text-xs text-gray-500 mt-1">
                    {users.find(u => u.id === ownerId)?.department && 
                      `Department: ${users.find(u => u.id === ownerId)?.department}`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <div className="flex space-x-2">
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select or enter custom</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={departments.includes(department) ? '' : department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Or enter custom"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onFocus={(e) => {
                      // Clear if it's a selected value from dropdown
                      if (departments.includes(department)) {
                        setDepartment('')
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select from existing departments or enter a custom value
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <div className="flex space-x-2">
                  <select
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select or enter custom</option>
                    {organizations.map((org) => (
                      <option key={org} value={org}>
                        {org}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={organizations.includes(organization) ? '' : organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Or enter custom"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onFocus={(e) => {
                      // Clear if it's a selected value from dropdown
                      if (organizations.includes(organization)) {
                        setOrganization('')
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select from existing organizations or enter a custom value
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Master Data Attributes (JSON)
                </label>
                <textarea
                  value={masterDataAttributesJson}
                  onChange={(e) => {
                    setMasterDataAttributesJson(e.target.value)
                    try {
                      const parsed = JSON.parse(e.target.value)
                      setMasterDataAttributes(parsed)
                      setErrors(prev => ({ ...prev, masterDataAttributes: '' }))
                    } catch (err) {
                      setErrors(prev => ({ ...prev, masterDataAttributes: 'Invalid JSON format' }))
                    }
                  }}
                  rows={4}
                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                    errors.masterDataAttributes ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='{"business_unit": "Engineering", "location": "US-West", "cost_center": "CC-1234"}'
                />
                {errors.masterDataAttributes && (
                  <p className="text-xs text-red-500 mt-1">{errors.masterDataAttributes}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Additional master data attributes as key-value pairs (JSON format)
                </p>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Capabilities (JSON)</h3>
            <textarea
              value={capabilitiesJson}
              onChange={(e) => handleCapabilitiesChange(e.target.value)}
              rows={6}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                errors.capabilities ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder='{"key": "value"}'
            />
            {errors.capabilities && (
              <p className="text-xs text-red-500 mt-1">{errors.capabilities}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Additional capabilities and metadata (JSON format)
            </p>
          </div>

          {/* Read-only Information */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">System Information (Read-only)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Agent Type:</span>
                <span className="text-gray-900">{agent.agent_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Source:</span>
                <span className="text-gray-900">{agent.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Skills:</span>
                <span className="text-gray-900">{agent.skills.join(', ')}</span>
              </div>
              {agent.owner_name && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Owner:</span>
                  <span className="text-gray-900">{agent.owner_name}</span>
                </div>
              )}
              {agent.department && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Department:</span>
                  <span className="text-gray-900">{agent.department}</span>
                </div>
              )}
              {agent.organization && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Organization:</span>
                  <span className="text-gray-900">{agent.organization}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Usage Count:</span>
                <span className="text-gray-900">{agent.usage_count}</span>
              </div>
              {agent.last_used_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Used:</span>
                  <span className="text-gray-900">
                    {new Date(agent.last_used_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {errors.save && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{errors.save}</p>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-2 border-t border-gray-200 flex items-center justify-end space-x-3 flex-shrink-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
