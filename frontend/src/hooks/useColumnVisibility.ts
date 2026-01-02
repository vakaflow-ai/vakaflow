/**
 * Custom hook for managing column visibility preferences
 * Persists to localStorage for user preferences
 * 
 * @module hooks/useColumnVisibility
 */

import { useState, useEffect, useCallback } from 'react'

export interface ColumnVisibilityConfig {
  catalogId: boolean
  requirementType: boolean
  label: boolean
  type: boolean
  description: boolean
  metadata: boolean
  status: boolean
  actions: boolean // Always visible
}

const DEFAULT_COLUMNS: ColumnVisibilityConfig = {
  catalogId: true,
  requirementType: true,
  label: true,
  type: false, // Hidden by default - only shown in edit/view modals
  description: true,
  metadata: true,
  status: true,
  actions: true
}

const STORAGE_KEY = 'requirements-grid-columns'

/**
 * Hook for managing column visibility with localStorage persistence
 */
export function useColumnVisibility() {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityConfig>(() => {
    // Load saved preferences from localStorage
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Migrate old 'id' key to 'catalogId' if present
        if (parsed.id !== undefined) {
          parsed.catalogId = parsed.id
          delete parsed.id
        }
        // Ensure all required columns exist with defaults
        return {
          ...DEFAULT_COLUMNS,
          ...parsed,
          actions: true // Always visible
        }
      } catch {
        // If parsing fails, use defaults
        return DEFAULT_COLUMNS
      }
    }
    return DEFAULT_COLUMNS
  })

  // Save to localStorage whenever visibility changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility))
  }, [columnVisibility])

  const toggleColumn = useCallback((columnKey: keyof ColumnVisibilityConfig) => {
    // Don't allow hiding actions column
    if (columnKey === 'actions') return

    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }, [])

  const resetColumns = useCallback(() => {
    setColumnVisibility(DEFAULT_COLUMNS)
  }, [])

  return {
    columnVisibility,
    toggleColumn,
    resetColumns
  }
}
