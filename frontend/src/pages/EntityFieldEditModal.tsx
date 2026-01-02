import { useState, useEffect } from 'react'
import { MaterialButton, MaterialInput } from '../components/material'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { entityFieldsApi, EntityField } from '../lib/entityFields'

interface EntityFieldEditModalProps {
  field: {
    id: string
    field_name: string
    label?: string
    field_label?: string  // Alternative property name from API
    description?: string
    field_description?: string  // Alternative property name from API
    field_type: string
    field_type_display?: string
    is_required: boolean
    is_enabled: boolean
    entity_name: string
    entity_label: string
    field_config?: Record<string, any> | null
    [key: string]: any  // Allow additional properties from spread operator
  }
  onSave: (updates: any) => void
  onCancel: () => void
}

export default function EntityFieldEditModal({
  field,
  onSave,
  onCancel,
}: EntityFieldEditModalProps) {
  // Initialize all state - will be populated from field prop in useEffect
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)
  const [fieldTypeDisplay, setFieldTypeDisplay] = useState('text')
  
  // Field config state
  const [fieldConfig, setFieldConfig] = useState<Record<string, any>>({})
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([])
  const [newOptionValue, setNewOptionValue] = useState('')
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [dependsOn, setDependsOn] = useState('')
  const [dependsOnLabel, setDependsOnLabel] = useState('')
  // Dependent options: Record<parentFieldValue, Array<{value, label}>>
  const [dependentOptions, setDependentOptions] = useState<Record<string, Array<{ value: string; label: string }>>>({})
  const [placeholder, setPlaceholder] = useState('')

  // Fetch the specific field to ensure we have the latest field_config
  const { data: fetchedField, isLoading: isLoadingField } = useQuery<EntityField>({
    queryKey: ['entity-field', field.entity_name, field.field_name],
    queryFn: () => entityFieldsApi.getField(field.entity_name, field.field_name),
    enabled: !!field.entity_name && !!field.field_name,
    staleTime: 0, // Always fetch fresh data when modal opens
  })

  // Use fetched field if available, otherwise use prop field
  // Prefer fetched field as it has the latest data from API
  const currentField = fetchedField || field

  // Fetch available fields from the same entity for dependency selection
  const { data: availableFields = [] } = useQuery<EntityField[]>({
    queryKey: ['entity-fields-for-dependency', field.entity_name],
    queryFn: () => entityFieldsApi.list({ 
      entity_name: field.entity_name,
      is_enabled: true,
      is_system: false // Exclude system fields like id, created_at
    }),
    enabled: !!field.entity_name,
  })

  // Filter out the current field from available dependencies (can't depend on itself)
  const dependencyFields = availableFields.filter(f => f.field_name !== field.field_name)

  // Sync dependsOnLabel when availableFields loads and dependsOn is already set
  useEffect(() => {
    if (dependsOn && availableFields.length > 0 && !dependsOnLabel) {
      const selectedField = availableFields.find(f => f.field_name === dependsOn)
      if (selectedField) {
        setDependsOnLabel(selectedField.field_label || dependsOn)
      }
    }
  }, [availableFields, dependsOn, dependsOnLabel])

  // Initialize all field values when field prop or fetched field changes
  useEffect(() => {
    // If query is loading, don't initialize yet (wait for fresh data)
    if (isLoadingField) {
      console.log('EntityFieldEditModal: Query is still loading, waiting...')
      return
    }
    
    // Wait for fetched field if query is enabled, otherwise use prop field
    // Prefer fetchedField if it exists (even if null, it means the query completed)
    const fieldToUse = fetchedField !== undefined ? fetchedField : field
    
    console.log('EntityFieldEditModal: Initializing with field', {
      fieldName: fieldToUse.field_name,
      hasFetchedField: fetchedField !== undefined,
      fetchedField,
      propField: field,
      field_config: fieldToUse.field_config,
      field_config_type: typeof fieldToUse.field_config
    })
    
    // Basic field properties
    setLabel(fieldToUse.field_label || fieldToUse.label || '')
    setDescription(fieldToUse.field_description || fieldToUse.description || '')
    setIsRequired(fieldToUse.is_required || false)
    setIsEnabled(fieldToUse.is_enabled ?? true)
    setFieldTypeDisplay(fieldToUse.field_type_display || fieldToUse.field_type || 'text')
    
    // Field config - handle both object and string (JSON) formats
    let config: Record<string, any> = {}
    const rawConfig = fieldToUse.field_config || (fieldToUse as any).field_config
    
    console.log('EntityFieldEditModal: Processing field_config', {
      rawConfig,
      rawConfigType: typeof rawConfig,
      isNull: rawConfig === null,
      isUndefined: rawConfig === undefined
    })
    
    if (rawConfig) {
      if (typeof rawConfig === 'string') {
        try {
          config = JSON.parse(rawConfig)
          console.log('EntityFieldEditModal: Parsed JSON config', config)
        } catch (e) {
          console.error('Failed to parse field_config JSON:', e)
          config = {}
        }
      } else if (typeof rawConfig === 'object' && rawConfig !== null) {
        config = rawConfig
        console.log('EntityFieldEditModal: Using object config directly', config)
      }
    } else {
      console.log('EntityFieldEditModal: No field_config found')
    }
    
    setFieldConfig(config)
    
    // Load options for select, multi_select, and json fields
    console.log('EntityFieldEditModal: Loading options', {
      hasOptions: !!config.options,
      optionsType: typeof config.options,
      isArray: Array.isArray(config.options),
      options: config.options
    })
    
    if (config.options && Array.isArray(config.options) && config.options.length > 0) {
      const opts = config.options.map((opt: any) => ({
        value: typeof opt === 'string' ? opt : (opt.value || opt),
        label: typeof opt === 'string' ? opt : (opt.label || opt.value || opt)
      }))
      console.log('EntityFieldEditModal: Setting options', opts)
      setOptions(opts)
    } else {
      console.log('EntityFieldEditModal: No options found, setting empty array')
      setOptions([])
    }
    
    // Dependency configuration
    const dependsOnValue = config.depends_on || ''
    setDependsOn(dependsOnValue)
    
    // Set dependsOnLabel - prioritize field_config, then try to find from availableFields
    const configDependsOnLabel = config.depends_on_label || ''
    if (configDependsOnLabel) {
      setDependsOnLabel(configDependsOnLabel)
    } else if (dependsOnValue && availableFields.length > 0) {
      const selectedField = availableFields.find(f => f.field_name === dependsOnValue)
      if (selectedField) {
        setDependsOnLabel(selectedField.field_label || dependsOnValue)
      } else {
        setDependsOnLabel('')
      }
    } else if (!dependsOnValue) {
      setDependsOnLabel('')
    }
    
    // Normalize dependent_options to handle both string and object formats
    const deps = config.dependent_options || {}
    console.log('EntityFieldEditModal: Processing dependent_options', { deps, type: typeof deps, keys: Object.keys(deps) })
    const normalized: Record<string, Array<{ value: string; label: string }>> = {}
    Object.entries(deps).forEach(([key, values]) => {
      if (Array.isArray(values)) {
        normalized[key] = values.map((v: any) => {
          if (typeof v === 'string') {
            return { value: v, label: v }
          } else if (v && typeof v === 'object') {
            return { value: v.value || v, label: v.label || v.value || v }
          }
          return { value: String(v), label: String(v) }
        })
      }
    })
    console.log('EntityFieldEditModal: Normalized dependent_options', normalized, 'Keys:', Object.keys(normalized))
    setDependentOptions(normalized)
    
    // Placeholder
    setPlaceholder(config.placeholder || '')
    
    // Reset input fields for adding new options
    setNewOptionValue('')
    setNewOptionLabel('')
  }, [field, fetchedField, availableFields, isLoadingField])
  
  // Sync dependsOnLabel when availableFields loads after dependsOn is already set
  useEffect(() => {
    if (dependsOn && availableFields.length > 0) {
      // Only update if dependsOnLabel is empty or doesn't match the field
      const selectedField = availableFields.find(f => f.field_name === dependsOn)
      if (selectedField) {
        const expectedLabel = selectedField.field_label || dependsOn
        // Update if label is empty or doesn't match (in case field was renamed)
        if (!dependsOnLabel || dependsOnLabel !== expectedLabel) {
          setDependsOnLabel(expectedLabel)
        }
      }
    }
  }, [availableFields, dependsOn])

  const handleAddOption = () => {
    if (newOptionLabel) {
      const value = newOptionValue || newOptionLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      setOptions([...options, { value, label: newOptionLabel }])
      setNewOptionValue('')
      setNewOptionLabel('')
    }
  }

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleAddDependentOption = () => {
    if (dependsOn && newOptionLabel) {
      const value = newOptionValue || newOptionLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      const current = dependentOptions[dependsOn] || []
      setDependentOptions({
        ...dependentOptions,
        [dependsOn]: [...current, { value, label: newOptionLabel }]
      })
      setNewOptionValue('')
      setNewOptionLabel('')
    }
  }

  const handleRemoveDependentOption = (parentField: string, index: number) => {
    const current = dependentOptions[parentField] || []
    setDependentOptions({
      ...dependentOptions,
      [parentField]: current.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Build field_config
    const config: Record<string, any> = {}
    
    // Include options for select, multi_select, and json fields
    if (options.length > 0 && (fieldTypeDisplay === 'select' || fieldTypeDisplay === 'multi_select' || fieldTypeDisplay === 'json')) {
      config.options = options.map(opt => ({
        value: opt.value,
        label: opt.label
      }))
    }
    
    if (dependsOn) {
      config.depends_on = dependsOn
      if (dependsOnLabel) {
        config.depends_on_label = dependsOnLabel
      }
      if (Object.keys(dependentOptions).length > 0) {
        // Convert to format expected by backend: Record<parentValue, Array<{value, label}>>
        config.dependent_options = dependentOptions
      }
    }
    
    if (placeholder) {
      config.placeholder = placeholder
    }

    const updates: any = {
      label,
      description,
      is_required: isRequired,
      is_enabled: isEnabled,
      field_type_display: fieldTypeDisplay,
      field_config: Object.keys(config).length > 0 ? config : null,
    }

    onSave(updates)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-md shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Edit Field Definition</h3>
            <p className="text-sm text-gray-500 mt-1">
              Update your field properties below. {field.field_config && (field.field_config.options || field.field_config.depends_on) && (
                <span className="text-purple-600">⭐ Special field with configuration</span>
              )}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-600 hover:text-gray-800 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Field Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="enterprise-input w-full"
                placeholder="e.g., Data Sharing Scope"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Field Type <span className="text-red-500">*</span>
              </label>
              <select
                value={fieldTypeDisplay}
                onChange={(e) => setFieldTypeDisplay(e.target.value)}
                className="enterprise-input w-full"
                required
              >
                <optgroup label="Text Input">
                  <option value="text">Single Line Text</option>
                  <option value="textarea">Multi-Line Text</option>
                </optgroup>
                <optgroup label="Selection">
                  <option value="select">Dropdown List</option>
                  <option value="multi_select">Multiple Choice (Checkbox Group)</option>
                </optgroup>
                <optgroup label="Data Types">
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="email">Email Address</option>
                  <option value="url">Website URL</option>
                </optgroup>
                <optgroup label="Advanced">
                  <option value="json">JSON</option>
                  <option value="checkbox">Checkbox</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description / Help Text
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="enterprise-input w-full min-h-[80px]"
              placeholder="Instructions for users filling this field..."
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-300 rounded-lg">
            <input
              type="checkbox"
              id="is_required"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
            <label htmlFor="is_required" className="text-sm font-medium text-blue-900 cursor-pointer">
              Mark as Required
              <span className="block text-xs text-blue-600 font-normal">Users must fill this field before they can submit the form.</span>
            </label>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <input
              type="checkbox"
              id="is_enabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-5 h-5 text-gray-600 rounded"
            />
            <label htmlFor="is_enabled" className="text-sm font-medium text-gray-900 cursor-pointer">
              Field Enabled
              <span className="block text-xs text-gray-600 font-normal">Field will be visible and usable in forms.</span>
            </label>
          </div>

          {/* Field Configuration Section */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-purple-500 text-xl">⭐</span>
              <h4 className="text-lg font-semibold text-gray-900">Special Field Configuration</h4>
              <span className="text-xs text-gray-500 ml-2">Configure options, dependencies, and placeholders</span>
            </div>

            {/* Options for select/multi_select/json */}
            {(fieldTypeDisplay === 'select' || fieldTypeDisplay === 'multi_select' || fieldTypeDisplay === 'json') && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  {fieldTypeDisplay === 'json' ? 'Attributes / Values' : 'Options'}
                  {fieldTypeDisplay === 'json' && (
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      (Review and update the values available for this JSON field)
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOptionValue}
                    onChange={(e) => setNewOptionValue(e.target.value)}
                    placeholder="Value (optional)"
                    className="enterprise-input flex-1"
                  />
                  <input
                    type="text"
                    value={newOptionLabel}
                    onChange={(e) => setNewOptionLabel(e.target.value)}
                    placeholder="Label"
                    className="enterprise-input flex-1"
                  />
                  <MaterialButton
                    type="button"
                    variant="outlined"
                    color="primary"
                    onClick={handleAddOption}
                    disabled={!newOptionLabel}
                  >
                    Add
                  </MaterialButton>
                </div>
                {options.length > 0 && (
                  <div className="space-y-1 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    <div className="text-xs text-gray-500 mb-2 px-2">
                      {fieldTypeDisplay === 'json' 
                        ? `${options.length} attribute${options.length !== 1 ? 's' : ''} configured` 
                        : `${options.length} option${options.length !== 1 ? 's' : ''} configured`}
                    </div>
                    {options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                        <span className="flex-1 text-sm">
                          <span className="font-mono text-xs text-gray-500">{opt.value}</span>
                          <span className="ml-2">{opt.label}</span>
                        </span>
                        <MaterialButton
                          type="button"
                          variant="text"
                          color="gray"
                          size="small"
                          onClick={() => handleRemoveOption(idx)}
                        >
                          Remove
                        </MaterialButton>
                      </div>
                    ))}
                  </div>
                )}
                {options.length === 0 && fieldTypeDisplay === 'json' && (
                  <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded border border-gray-200">
                    No attributes configured. Add values below to define the available options for this JSON field.
                  </div>
                )}
              </div>
            )}

            {/* Dependency Configuration */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Field Dependency (Optional)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Depends On Field
                  </label>
                  <select
                    value={dependsOn}
                    onChange={(e) => {
                      const selectedFieldName = e.target.value
                      setDependsOn(selectedFieldName)
                      // Auto-populate label from selected field
                      const selectedField = dependencyFields.find(f => f.field_name === selectedFieldName)
                      if (selectedField) {
                        setDependsOnLabel(selectedField.field_label || selectedFieldName)
                      } else {
                        setDependsOnLabel('')
                      }
                    }}
                    className="enterprise-input w-full"
                  >
                    <option value="">-- Select a field --</option>
                    {dependencyFields.map((f) => (
                      <option key={f.id} value={f.field_name}>
                        {f.field_label} ({f.field_name})
                      </option>
                    ))}
                  </select>
                  {dependencyFields.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      No other fields available in {field.entity_label || field.entity_name}
                    </p>
                  )}
                </div>
                <MaterialInput
                  label="Depends On Label"
                  value={dependsOnLabel}
                  onChange={(e) => setDependsOnLabel(e.target.value)}
                  placeholder="e.g., LLM Vendor"
                />
              </div>
              
              {dependsOn && (
                <div className="space-y-2 p-3 bg-blue-50 rounded border border-blue-200">
                  <label className="block text-sm font-medium text-gray-700">
                    Dependent Options for "{dependsOn}"
                  </label>
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600 font-medium">Add new option (enter parent value first, then option):</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOptionValue}
                        onChange={(e) => setNewOptionValue(e.target.value)}
                        placeholder="Parent Value (e.g., OpenAI)"
                        className="enterprise-input flex-1"
                      />
                      <input
                        type="text"
                        value={newOptionLabel}
                        onChange={(e) => setNewOptionLabel(e.target.value)}
                        placeholder="Option Label (e.g., GPT-4)"
                        className="enterprise-input flex-1"
                      />
                      <MaterialButton
                        type="button"
                        variant="outlined"
                        color="primary"
                        onClick={handleAddDependentOption}
                        disabled={!newOptionLabel || !newOptionValue}
                      >
                        Add
                      </MaterialButton>
                    </div>
                  </div>
                  {/* Display all dependent options grouped by parent value */}
                  {Object.keys(dependentOptions).length > 0 && (
                    <div className="space-y-3 mt-3 max-h-60 overflow-y-auto border border-blue-300 rounded-lg p-3 bg-white">
                      <div className="text-xs text-gray-500 mb-2 px-2">
                        {Object.values(dependentOptions).reduce((sum, opts) => sum + opts.length, 0)} option{Object.values(dependentOptions).reduce((sum, opts) => sum + opts.length, 0) !== 1 ? 's' : ''} across {Object.keys(dependentOptions).length} parent value{Object.keys(dependentOptions).length !== 1 ? 's' : ''}
                      </div>
                      {Object.entries(dependentOptions).map(([parentValue, options]) => (
                        <div key={parentValue} className="space-y-2 pb-3 border-b border-gray-200 last:border-b-0 last:pb-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800 text-sm">{parentValue}</span>
                            <span className="text-xs text-gray-500">({options.length} {options.length === 1 ? 'option' : 'options'})</span>
                          </div>
                          <div className="space-y-1 pl-4">
                            {options.map((opt, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                                <span className="flex-1 text-sm">
                                  <span className="font-mono text-xs text-gray-500">{opt.value}</span>
                                  <span className="ml-2">{opt.label}</span>
                                </span>
                                <MaterialButton
                                  type="button"
                                  variant="text"
                                  color="gray"
                                  size="small"
                                  onClick={() => handleRemoveDependentOption(parentValue, idx)}
                                >
                                  Remove
                                </MaterialButton>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {Object.keys(dependentOptions).length === 0 && (
                    <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded border border-gray-200 mt-2">
                      No dependent options configured. Add values above by entering a parent value (e.g., "OpenAI") in the first field and an option label (e.g., "GPT-4") in the second field.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Placeholder */}
            <MaterialInput
              label="Placeholder Text"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Enter placeholder text..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t sticky bottom-0 bg-white z-10">
            <MaterialButton
              type="button"
              variant="outlined"
              color="gray"
              onClick={onCancel}
            >
              Cancel
            </MaterialButton>
            <MaterialButton
              type="submit"
              variant="contained"
              color="primary"
            >
              Save Changes
            </MaterialButton>
          </div>
        </form>
      </div>
    </div>
  )
}

