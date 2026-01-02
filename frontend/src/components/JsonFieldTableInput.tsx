import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { MaterialButton } from './material'

interface JsonFieldTableInputProps {
  value: any
  onChange: (value: any) => void
  placeholder?: string
  disabled?: boolean
  isReadOnly?: boolean
  // Business-friendly column headers (defaults to "Item" and "Description")
  columnHeaders?: [string, string] // [firstColumn, secondColumn]
  // Field label for context (used to determine column headers if not provided)
  fieldLabel?: string
}

export default function JsonFieldTableInput({
  value,
  onChange,
  placeholder = 'Add items to the list',
  disabled = false,
  isReadOnly = false,
  columnHeaders,
  fieldLabel,
}: JsonFieldTableInputProps) {
  // Determine column headers based on field label or use defaults
  const getColumnHeaders = (): [string, string] => {
    if (columnHeaders) return columnHeaders
    
    // Auto-detect based on field label
    const label = (fieldLabel || '').toLowerCase()
    if (label.includes('use case')) {
      return ['Use Case', 'Description']
    } else if (label.includes('capability')) {
      return ['Capability', 'Description']
    } else if (label.includes('feature')) {
      return ['Feature', 'Description']
    } else if (label.includes('integration')) {
      return ['Integration', 'Description']
    } else if (label.includes('architecture')) {
      return ['Component', 'Description']
    } else if (label.includes('data sharing')) {
      return ['Scope', 'Description']
    } else {
      return ['Item', 'Description']
    }
  }

  const [headers] = useState<[string, string]>(getColumnHeaders())
  const [rows, setRows] = useState<Array<{ col1: string; col2: string }>>([])

  useEffect(() => {
    // Convert JSON value to table rows
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Object: convert to rows where key is col1, value is col2
      const entries = Object.entries(value).map(([key, val]) => ({
        col1: key,
        col2: typeof val === 'string' ? val : JSON.stringify(val),
      }))
      setRows(entries.length > 0 ? entries : [{ col1: '', col2: '' }])
    } else if (Array.isArray(value) && value.length > 0) {
      // Array: if items are objects with 2 keys, use those; otherwise treat as list
      if (value.every(item => typeof item === 'object' && item !== null && Object.keys(item).length === 2)) {
        // Array of objects with 2 keys - use as table rows
        const tableRows = value.map((item: any) => {
          const keys = Object.keys(item)
          return {
            col1: String(item[keys[0]] || ''),
            col2: String(item[keys[1]] || ''),
          }
        })
        setRows(tableRows.length > 0 ? tableRows : [{ col1: '', col2: '' }])
      } else {
        // Array of strings/values - show as enumerated list in col2
        const tableRows = value.map((item: any, idx: number) => ({
          col1: String(idx + 1),
          col2: typeof item === 'string' ? item : JSON.stringify(item),
        }))
        setRows(tableRows)
      }
    } else {
      setRows([{ col1: '', col2: '' }])
    }
  }, [value])

  const handleRowChange = (index: number, field: 'col1' | 'col2', newValue: string) => {
    const newRows = [...rows]
    newRows[index] = { ...newRows[index], [field]: newValue }
    setRows(newRows)
    updateJsonValue(newRows)
  }

  const handleAddRow = () => {
    const newRows = [...rows, { col1: '', col2: '' }]
    setRows(newRows)
  }

  const handleRemoveRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index)
    if (newRows.length === 0) {
      newRows.push({ col1: '', col2: '' })
    }
    setRows(newRows)
    updateJsonValue(newRows)
  }

  const updateJsonValue = (rowsToUse: Array<{ col1: string; col2: string }>) => {
    // Filter out empty rows
    const validRows = rowsToUse.filter(r => r.col1.trim() !== '' || r.col2.trim() !== '')
    
    if (validRows.length === 0) {
      onChange(null)
      return
    }

    // Check if col1 values are numeric (1, 2, 3...) - indicates enumerated list
    const isEnumeratedList = validRows.every(r => /^\d+$/.test(r.col1.trim()))
    
    if (isEnumeratedList) {
      // Convert to array (enumerated list)
      const sortedRows = validRows.sort((a, b) => parseInt(a.col1) - parseInt(b.col1))
      const arrayValue = sortedRows.map(r => {
        // Try to parse col2 as JSON, otherwise use as string
        try {
          return JSON.parse(r.col2)
        } catch {
          return r.col2
        }
      })
      onChange(arrayValue)
    } else {
      // Convert to object (key-value pairs)
      const objValue: Record<string, any> = {}
      validRows.forEach(r => {
        if (r.col1.trim()) {
          // Try to parse col2 as JSON, otherwise use as string
          try {
            objValue[r.col1.trim()] = JSON.parse(r.col2)
          } catch {
            objValue[r.col1.trim()] = r.col2
          }
        }
      })
      onChange(Object.keys(objValue).length > 0 ? objValue : null)
    }
  }

  if (isReadOnly) {
    // Display as business-friendly table in read-only mode
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
      return (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded">
          <span className="text-gray-400 italic text-sm">No data</span>
        </div>
      )
    }

    if (Array.isArray(value)) {
      return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {headers[0]}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {headers[1]}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {value.map((item: any, idx: number) => {
                if (typeof item === 'object' && item !== null) {
                  const keys = Object.keys(item)
                  return (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm text-gray-900">{String(item[keys[0]] || '')}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{String(item[keys[1]] || '')}</td>
                    </tr>
                  )
                }
                return (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900">{idx + 1}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{String(item)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    }

    if (typeof value === 'object') {
      return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {headers[0]}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {headers[1]}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(value).map(([key, val]) => (
                <tr key={key}>
                  <td className="px-4 py-2 text-sm text-gray-900">{key}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    <div className="space-y-3">
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                {headers[0]}
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                {headers[1]}
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider w-16">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={row.col1}
                    onChange={(e) => handleRowChange(index, 'col1', e.target.value)}
                    placeholder={headers[0]}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={disabled}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={row.col2}
                    onChange={(e) => handleRowChange(index, 'col2', e.target.value)}
                    placeholder={headers[1]}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={disabled}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  {rows.length > 1 && (
                    <MaterialButton
                      type="button"
                      variant="text"
                      color="error"
                      size="small"
                      onClick={() => handleRemoveRow(index)}
                      disabled={disabled}
                      className="!p-1"
                      title="Remove row"
                    >
                      <X className="w-4 h-4" />
                    </MaterialButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MaterialButton
        type="button"
        variant="outlined"
        color="primary"
        size="small"
        onClick={handleAddRow}
        disabled={disabled}
        className="text-xs"
      >
        <Plus className="w-3 h-3 mr-1" />
        Add Row
      </MaterialButton>
      {placeholder && (
        <p className="text-xs text-gray-500 mt-1">
          {placeholder}
        </p>
      )}
    </div>
  )
}

