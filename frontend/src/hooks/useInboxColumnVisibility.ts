/**
 * Custom hook for managing inbox column visibility preferences
 * Persists to localStorage for user preferences
 * 
 * @module hooks/useInboxColumnVisibility
 */

import { useState, useEffect, useCallback } from 'react'

export interface InboxColumnVisibilityConfig {
  title: boolean
  type: boolean
  status: boolean
  priority: boolean
  generatedDate: boolean
  dueDate: boolean
  poc: boolean
  customer: boolean
  workflowTicketId: boolean
  workflowStage: boolean
  vendor: boolean
  agent: boolean
  description: boolean
  actions: boolean // Always visible
}

const DEFAULT_COLUMNS: InboxColumnVisibilityConfig = {
  workflowTicketId: true, // Ticket ID is first and always visible by default
  title: true,
  type: true,
  status: true,
  priority: true,
  generatedDate: true,
  dueDate: true,
  poc: true,
  customer: false, // Hidden by default for non-vendor users
  workflowStage: true, // Show workflow stage by default
  vendor: false,
  agent: false,
  description: false,
  actions: true
}

const STORAGE_KEY = 'inbox-grid-columns'

/**
 * Hook for managing inbox column visibility with localStorage persistence
 */
export function useInboxColumnVisibility() {
  const [columnVisibility, setColumnVisibility] = useState<InboxColumnVisibilityConfig>(() => {
    // Load saved preferences from localStorage
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
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

  const toggleColumn = useCallback((columnKey: keyof InboxColumnVisibilityConfig) => {
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

