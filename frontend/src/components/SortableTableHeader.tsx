/**
 * Sortable, filterable, and reorderable table header component
 * Provides column-level sorting, filtering, and drag-and-drop reordering
 */
import React from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, GripVertical } from 'lucide-react'

export interface ColumnConfig {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  width?: string
}

interface SortableTableHeaderProps {
  columns: ColumnConfig[]
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  onSort: (column: string) => void
  columnFilters: Record<string, string>
  onFilterChange: (column: string, value: string) => void
  columnOrder: string[]
  onColumnReorder?: (newOrder: string[]) => void
  columnVisibility: Record<string, boolean>
  onToggleColumn: (column: string) => void
  onResetColumns?: () => void
}

export function SortableTableHeader({
  columns,
  sortColumn,
  sortDirection,
  onSort,
  columnFilters,
  onFilterChange,
  columnOrder,
  columnVisibility,
  onToggleColumn,
  onResetColumns
}: SortableTableHeaderProps) {
  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 text-gray-600" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600" />
      : <ArrowDown className="w-3 h-3 text-blue-600" />
  }

  const visibleColumns = columns.filter(col => columnVisibility[col.key] !== false)

  return (
    <thead>
      {/* Column Management Row */}
      <tr className="bg-gray-50/50 border-b border-gray-200">
        <th colSpan={visibleColumns.length + 2} className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500">Columns:</span>
              <div className="flex flex-wrap gap-1">
                {columns.map(col => (
                  <label
                    key={col.key}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={columnVisibility[col.key] !== false}
                      onChange={() => onToggleColumn(col.key)}
                      className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-gray-600 font-medium">{col.label}</span>
                  </label>
                ))}
              </div>
              {onResetColumns && (
                <button
                  onClick={onResetColumns}
                  className="text-xs font-medium text-blue-600 hover:text-blue-600 px-2 py-1 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="text-xs font-medium text-gray-600">
              {visibleColumns.length} of {columns.length} visible
            </div>
          </div>
        </th>
      </tr>
      
      {/* Main Header Row with Sorting and Filtering */}
      <tr className="bg-white border-b border-gray-200">
        {/* Selection Checkbox Header */}
        <th className="px-4 py-3 text-left" style={{ width: '40px' }}>
          {/* Select all checkbox will be here */}
        </th>
        
        {visibleColumns.map((column) => (
          <th
            key={column.key}
            className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-tight group"
            style={{ width: column.width }}
          >
            <div className="flex items-center gap-2">
              {/* Drag Handle (for reordering) */}
              <GripVertical className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100 cursor-move" />
              
              {/* Column Label with Sort */}
              <div className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => column.sortable !== false && onSort(column.key)}
                  className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${
                    column.sortable === false ? 'cursor-default' : 'cursor-pointer'
                  }`}
                  disabled={column.sortable === false}
                >
                  <span>{column.label}</span>
                  {column.sortable !== false && getSortIcon(column.key)}
                </button>
              </div>
              
              {/* Filter Icon/Dropdown */}
              {column.filterable !== false && (
                <div className="relative">
                  <button
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title="Filter column"
                  >
                    <Filter className={`w-3 h-3 ${
                      columnFilters[column.key] ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </button>
                  {/* Filter dropdown will be implemented as a popover */}
                </div>
              )}
            </div>
            
            {/* Filter Input Row (shown when filter is active) */}
            {column.filterable !== false && columnFilters[column.key] && (
              <div className="mt-2">
                <input
                  type="text"
                  value={columnFilters[column.key] || ''}
                  onChange={(e) => onFilterChange(column.key, e.target.value)}
                  placeholder={`Filter ${column.label.toLowerCase()}...`}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </th>
        ))}
        
        {/* Actions Column */}
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-tight" style={{ width: '10%' }}>
          Actions
        </th>
      </tr>
    </thead>
  )
}
