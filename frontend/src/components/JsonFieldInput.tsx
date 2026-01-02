import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { MaterialButton } from './material'
import JsonFieldTableInput from './JsonFieldTableInput'

interface JsonFieldInputProps {
  value: any
  onChange: (value: any) => void
  placeholder?: string
  disabled?: boolean
  isReadOnly?: boolean
  // Use business-friendly table mode instead of key-value pairs
  useTableMode?: boolean
  // Column headers for table mode (defaults based on field label)
  columnHeaders?: [string, string]
  // Field label for context (used to determine column headers)
  fieldLabel?: string
}

export default function JsonFieldInput({
  value,
  onChange,
  placeholder = 'Add key-value pairs',
  disabled = false,
  isReadOnly = false,
  useTableMode = true, // Default to table mode for business-friendly UX
  columnHeaders,
  fieldLabel,
}: JsonFieldInputProps) {
  // Use table mode for end users (business-friendly)
  if (useTableMode) {
    return (
      <JsonFieldTableInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        isReadOnly={isReadOnly}
        columnHeaders={columnHeaders}
        fieldLabel={fieldLabel}
      />
    )
  }

  // Original key-value mode (for admin/technical users)
  // Parse value into key-value pairs
  const [pairs, setPairs] = useState<Array<{ key: string; value: string }>>([])

  useEffect(() => {
    // Convert JSON value to key-value pairs
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value).map(([key, val]) => ({
        key,
        value: typeof val === 'string' ? val : JSON.stringify(val),
      }))
      setPairs(entries.length > 0 ? entries : [{ key: '', value: '' }])
    } else if (Array.isArray(value) && value.length > 0) {
      // For arrays, show as indexed items
      const entries = value.map((val, idx) => ({
        key: String(idx),
        value: typeof val === 'string' ? val : JSON.stringify(val),
      }))
      setPairs(entries)
    } else {
      setPairs([{ key: '', value: '' }])
    }
  }, [value])

  const handlePairChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const newPairs = [...pairs]
    newPairs[index] = { ...newPairs[index], [field]: newValue }
    setPairs(newPairs)
    updateJsonValue(newPairs)
  }

  const handleAddPair = () => {
    const newPairs = [...pairs, { key: '', value: '' }]
    setPairs(newPairs)
  }

  const handleRemovePair = (index: number) => {
    const newPairs = pairs.filter((_, i) => i !== index)
    if (newPairs.length === 0) {
      newPairs.push({ key: '', value: '' })
    }
    setPairs(newPairs)
    updateJsonValue(newPairs)
  }

  const updateJsonValue = (pairsToUse: Array<{ key: string; value: string }>) => {
    // Filter out empty pairs
    const validPairs = pairsToUse.filter(p => p.key.trim() !== '' || p.value.trim() !== '')
    
    if (validPairs.length === 0) {
      onChange(null)
      return
    }

    // Check if keys are numeric (array indices)
    const isArray = validPairs.every(p => /^\d+$/.test(p.key.trim()))
    
    if (isArray) {
      // Convert to array
      const sortedPairs = validPairs.sort((a, b) => parseInt(a.key) - parseInt(b.key))
      const arrayValue = sortedPairs.map(p => {
        // Try to parse value as JSON, otherwise use as string
        try {
          return JSON.parse(p.value)
        } catch {
          return p.value
        }
      })
      onChange(arrayValue)
    } else {
      // Convert to object
      const objValue: Record<string, any> = {}
      validPairs.forEach(p => {
        if (p.key.trim()) {
          // Try to parse value as JSON, otherwise use as string
          try {
            objValue[p.key.trim()] = JSON.parse(p.value)
          } catch {
            objValue[p.key.trim()] = p.value
          }
        }
      })
      onChange(Object.keys(objValue).length > 0 ? objValue : null)
    }
  }

  if (isReadOnly) {
    // Display as structured key-value pairs in read-only mode (business-friendly)
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
      return (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded">
          <span className="text-gray-400 italic text-sm">No data</span>
        </div>
      )
    }

    if (Array.isArray(value)) {
      return (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded space-y-2">
          {value.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200">
              <span className="text-xs font-medium text-gray-500 min-w-[2rem]">{idx}:</span>
              <span className="text-sm text-gray-700 flex-1">
                {typeof item === 'object' ? JSON.stringify(item) : String(item)}
              </span>
            </div>
          ))}
        </div>
      )
    }

    if (typeof value === 'object') {
      return (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded space-y-2">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200">
              <span className="text-xs font-medium text-gray-700 min-w-[8rem]">{key}:</span>
              <span className="text-sm text-gray-700 flex-1">
                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
              </span>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="p-3 bg-gray-50 border border-gray-200 rounded">
        <span className="text-sm text-gray-700">{String(value)}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {pairs.map((pair, index) => (
          <div key={index} className="flex gap-2 items-start">
            <input
              type="text"
              value={pair.key}
              onChange={(e) => handlePairChange(index, 'key', e.target.value)}
              placeholder="Key"
              className="enterprise-input flex-1 text-sm"
              disabled={disabled}
            />
            <input
              type="text"
              value={pair.value}
              onChange={(e) => handlePairChange(index, 'value', e.target.value)}
              placeholder="Value"
              className="enterprise-input flex-1 text-sm"
              disabled={disabled}
            />
            {pairs.length > 1 && (
              <MaterialButton
                type="button"
                variant="text"
                color="error"
                size="small"
                onClick={() => handleRemovePair(index)}
                disabled={disabled}
                className="!p-1"
              >
                <X className="w-4 h-4" />
              </MaterialButton>
            )}
          </div>
        ))}
      </div>
      <MaterialButton
        type="button"
        variant="outlined"
        color="primary"
        size="small"
        onClick={handleAddPair}
        disabled={disabled}
        className="text-xs"
      >
        <Plus className="w-3 h-3 mr-1" />
        Add Field
      </MaterialButton>
      <p className="text-xs text-gray-500 mt-1">
        {placeholder}
      </p>
    </div>
  )
}

