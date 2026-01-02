/**
 * Sortable and filterable column header component
 * Used within drag-and-drop context for reordering
 */
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, GripVertical, X } from 'lucide-react'

interface SortableColumnHeaderProps {
  id: string
  label: string
  sortable?: boolean
  filterable?: boolean
  width?: string
  isSorting: boolean
  sortDirection: 'asc' | 'desc' | null
  onSort: () => void
  filterValue: string
  onFilterChange: (value: string) => void
  showFilter: boolean
  onToggleFilter: () => void
}

export function SortableColumnHeader({
  id,
  label,
  sortable = true,
  filterable = true,
  width,
  isSorting,
  sortDirection,
  onSort,
  filterValue,
  onFilterChange,
  showFilter,
  onToggleFilter
}: SortableColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getSortIcon = () => {
    if (!isSorting) {
      return <ArrowUpDown className="w-3 h-3 text-gray-600" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-indigo-600" />
      : <ArrowDown className="w-3 h-3 text-indigo-600" />
  }

  return (
    <th
      ref={setNodeRef}
      style={{ ...style, width }}
      className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight group relative"
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-3 h-3 text-gray-600" />
        </div>
        
        {/* Column Label with Sort */}
        <div className="flex items-center gap-1 flex-1">
          <button
            onClick={sortable ? onSort : undefined}
            className={`flex items-center gap-1 hover:text-indigo-600 transition-colors ${
              sortable ? 'cursor-pointer' : 'cursor-default'
            }`}
            disabled={!sortable}
          >
            <span>{label}</span>
            {sortable && getSortIcon()}
          </button>
        </div>
        
        {/* Filter Button */}
        {filterable && (
          <button
            onClick={onToggleFilter}
            className={`p-1 hover:bg-gray-200 rounded transition-colors ${
              filterValue || showFilter ? 'text-indigo-600' : 'text-gray-600'
            }`}
            title="Filter column"
          >
            <Filter className="w-3 h-3" />
          </button>
        )}
      </div>
      
      {/* Filter Input (shown when filter is active) */}
      {showFilter && filterable && (
        <div className="mt-2 relative">
          <input
            type="text"
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder={`Filter ${label.toLowerCase()}...`}
            className="unified-filter w-full px-2 py-1"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          {filterValue && (
            <button
              onClick={() => onFilterChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </th>
  )
}
