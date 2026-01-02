import { useState, useEffect } from 'react'
import { AgenticFlow } from '../lib/studio'

interface FlowSettingsModalProps {
  flow: AgenticFlow | null
  onClose: () => void
  onSave: (flowId: string, updates: FlowUpdate) => Promise<void>
  onDelete?: (flowId: string) => Promise<void>
}

export interface FlowUpdate {
  name?: string
  description?: string
  category?: string
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
  tags?: string[]
  is_template?: boolean
  max_concurrent_executions?: number
  timeout_seconds?: number
  retry_on_failure?: boolean
  retry_count?: number
  context_id_template?: string
  context_type_default?: string
}

export default function FlowSettingsModal({ flow, onClose, onSave, onDelete }: FlowSettingsModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<'draft' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'>('draft')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isTemplate, setIsTemplate] = useState(false)
  const [maxConcurrentExecutions, setMaxConcurrentExecutions] = useState(10)
  const [timeoutSeconds, setTimeoutSeconds] = useState<number | undefined>(undefined)
  const [retryOnFailure, setRetryOnFailure] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [contextIdTemplate, setContextIdTemplate] = useState('')
  const [contextTypeDefault, setContextTypeDefault] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (flow) {
      setName(flow.name || '')
      setDescription(flow.description || '')
      setCategory(flow.category || '')
      setStatus(flow.status as any || 'draft')
      setTags(flow.tags || [])
      setIsTemplate(flow.is_template || false)
      setMaxConcurrentExecutions(10) // Default, not stored in flow model currently
      setTimeoutSeconds(undefined) // Default, not stored in flow model currently
      setRetryOnFailure(false) // Default, not stored in flow model currently
      setRetryCount(0) // Default, not stored in flow model currently
      setContextIdTemplate((flow as any).context_id_template || '')
      setContextTypeDefault((flow as any).context_type_default || '')
      setErrors({})
    }
  }, [flow])

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSave = async () => {
    if (!flow) return

    const newErrors: Record<string, string> = {}
    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }
    if (maxConcurrentExecutions < 1) {
      newErrors.maxConcurrentExecutions = 'Must be at least 1'
    }
    if (timeoutSeconds !== undefined && timeoutSeconds < 1) {
      newErrors.timeoutSeconds = 'Must be at least 1 second'
    }
    if (retryOnFailure && retryCount < 0) {
      newErrors.retryCount = 'Must be 0 or greater'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSaving(true)
    try {
      const updates: FlowUpdate = {
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        status,
        tags: tags.length > 0 ? tags : undefined,
        is_template: isTemplate,
        max_concurrent_executions: maxConcurrentExecutions,
        timeout_seconds: timeoutSeconds || undefined,
        retry_on_failure: retryOnFailure,
        retry_count: retryCount,
        context_id_template: contextIdTemplate.trim() || undefined,
        context_type_default: contextTypeDefault.trim() || undefined
      }

      await onSave(flow.id, updates)
      onClose()
    } catch (error: any) {
      setErrors({ save: error.message || 'Failed to save flow settings' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!flow || !onDelete) return

    setIsDeleting(true)
    try {
      await onDelete(flow.id)
      onClose()
    } catch (error: any) {
      setErrors({ delete: error.message || 'Failed to delete flow' })
      setIsDeleting(false)
    }
  }

  if (!flow) return null

  const nodeCount = flow.flow_definition?.nodes?.length || 0
  const edgeCount = flow.flow_definition?.edges?.length || 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-2 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-medium text-gray-900">Flow Settings</h2>
            <p className="text-sm text-gray-500 mt-1">
              {flow.name}
            </p>
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
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Flow description..."
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., TPRM, Assessment, i18n"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a tag..."
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Execution Settings */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Execution Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Concurrent Executions
                </label>
                <input
                  type="number"
                  value={maxConcurrentExecutions}
                  onChange={(e) => setMaxConcurrentExecutions(parseInt(e.target.value) || 1)}
                  min={1}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.maxConcurrentExecutions ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.maxConcurrentExecutions && (
                  <p className="text-xs text-red-500 mt-1">{errors.maxConcurrentExecutions}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Maximum number of simultaneous executions</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={timeoutSeconds || ''}
                  onChange={(e) => setTimeoutSeconds(e.target.value ? parseInt(e.target.value) : undefined)}
                  min={1}
                  placeholder="No timeout"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.timeoutSeconds ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.timeoutSeconds && (
                  <p className="text-xs text-red-500 mt-1">{errors.timeoutSeconds}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Leave empty for no timeout</p>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={retryOnFailure}
                  onChange={(e) => setRetryOnFailure(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Retry on failure</span>
              </label>

              {retryOnFailure && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retry Count
                  </label>
                  <input
                    type="number"
                    value={retryCount}
                    onChange={(e) => setRetryCount(parseInt(e.target.value) || 0)}
                    min={0}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.retryCount ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.retryCount && (
                    <p className="text-xs text-red-500 mt-1">{errors.retryCount}</p>
                  )}
                </div>
              )}

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isTemplate}
                  onChange={(e) => setIsTemplate(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Use as template (can be copied by others)</span>
              </label>
            </div>
          </div>

          {/* Context Configuration */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Context Configuration</h3>
            <p className="text-xs text-gray-500 mb-3">
              Configure default context for flow execution. If set, execution will not prompt for context.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Context ID Template
                </label>
                <input
                  type="text"
                  value={contextIdTemplate}
                  onChange={(e) => setContextIdTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., agent_id, vendor_id, or a specific UUID"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The context ID to use when executing this flow. Can be a variable name (e.g., "agent_id") or a specific value.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Context Type
                </label>
                <input
                  type="text"
                  value={contextTypeDefault}
                  onChange={(e) => setContextTypeDefault(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., agent, vendor, assessment"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The type of context (e.g., "agent", "vendor", "assessment").
                </p>
              </div>
            </div>
          </div>

          {/* Read-only Information */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Flow Information (Read-only)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Nodes:</span>
                <span className="text-gray-900">{nodeCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Edges:</span>
                <span className="text-gray-900">{edgeCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900">
                  {new Date(flow.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Updated:</span>
                <span className="text-gray-900">
                  {new Date(flow.updated_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {errors.save && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{errors.save}</p>
            </div>
          )}

          {errors.delete && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{errors.delete}</p>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-2 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
          <div>
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving || isDeleting}
                className="px-4 py-2 text-red-700 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Flow
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={isSaving || isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Flow</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete "{flow.name}"? This action cannot be undone and will delete all associated executions.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
