import { useState } from 'react'

interface CustomAttributesEditorProps {
  attributes: Record<string, any>
  onChange: (attributes: Record<string, any>) => void
}

export default function CustomAttributesEditor({ attributes, onChange }: CustomAttributesEditorProps) {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)

  const handleAdd = () => {
    if (!newKey.trim()) return
    
    const updated = { ...attributes }
    
    // Try to parse as JSON if it looks like JSON
    let parsedValue: any = newValue
    if (newValue.trim().startsWith('{') || newValue.trim().startsWith('[')) {
      try {
        parsedValue = JSON.parse(newValue)
      } catch {
        // Not valid JSON, use as string
      }
    } else if (newValue === 'true' || newValue === 'false') {
      parsedValue = newValue === 'true'
    } else if (!isNaN(Number(newValue)) && newValue.trim() !== '') {
      parsedValue = Number(newValue)
    }
    
    updated[newKey.trim()] = parsedValue
    onChange(updated)
    setNewKey('')
    setNewValue('')
  }

  const handleRemove = (key: string) => {
    const updated = { ...attributes }
    delete updated[key]
    onChange(updated)
  }

  const handleUpdate = (key: string, value: any) => {
    const updated = { ...attributes }
    updated[key] = value
    onChange(updated)
    setEditingKey(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Custom Attributes
        </label>
        <span className="text-xs text-gray-500">
          {Object.keys(attributes).length} attribute(s)
        </span>
      </div>

      {/* Existing Attributes */}
      {Object.keys(attributes).length > 0 && (
        <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
          {Object.entries(attributes).map(([key, value]) => (
            <div key={key} className="flex items-start justify-between group">
              <div className="flex-1 min-w-0">
                {editingKey === key ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue={String(value)}
                      onBlur={(e) => {
                        let parsedValue: any = e.target.value
                        if (e.target.value.trim().startsWith('{') || e.target.value.trim().startsWith('[')) {
                          try {
                            parsedValue = JSON.parse(e.target.value)
                          } catch {
                            parsedValue = e.target.value
                          }
                        } else if (e.target.value === 'true' || e.target.value === 'false') {
                          parsedValue = e.target.value === 'true'
                        } else if (!isNaN(Number(e.target.value)) && e.target.value.trim() !== '') {
                          parsedValue = Number(e.target.value)
                        }
                        handleUpdate(key, parsedValue)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur()
                        }
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-700">{key}:</span>
                      <span className="text-xs text-gray-600 font-mono">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingKey(editingKey === key ? null : key)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  {editingKey === key ? 'Save' : 'Edit'}
                </button>
                <button
                  onClick={() => handleRemove(key)}
                  className="text-red-600 hover:text-red-800 text-xs"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Attribute */}
      <div className="border border-gray-200 rounded-lg p-3 bg-white">
        <div className="space-y-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Attribute name"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newKey.trim()) {
                e.preventDefault()
                document.getElementById('new-attr-value')?.focus()
              }
            }}
          />
          <div className="flex space-x-2">
            <input
              id="new-attr-value"
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value (string, number, true/false, or JSON)"
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newKey.trim() && newValue.trim()) {
                  e.preventDefault()
                  handleAdd()
                }
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!newKey.trim()}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Examples: "priority": "high", "timeout": 30, "enabled": true, "config": {'{"key": "value"}'}
          </p>
        </div>
      </div>
    </div>
  )
}
