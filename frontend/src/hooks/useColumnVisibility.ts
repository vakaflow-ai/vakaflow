import { useState, useEffect } from 'react'

interface ColumnVisibilityConfig {
  [key: string]: boolean
}

export function useColumnVisibility(
  storageKey: string,
  defaultColumns: ColumnVisibilityConfig
) {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityConfig>(defaultColumns)

  // Load saved column visibility from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge with defaults to handle new columns
        setColumnVisibility(prev => ({
          ...defaultColumns,
          ...parsed
        }))
      }
    } catch (error) {
      console.warn('Failed to load column visibility settings:', error)
      setColumnVisibility(defaultColumns)
    }
  }, [storageKey, defaultColumns])

  // Save column visibility to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility))
    } catch (error) {
      console.warn('Failed to save column visibility settings:', error)
    }
  }, [columnVisibility, storageKey])

  const toggleColumn = (columnKey: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  const showColumn = (columnKey: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: true
    }))
  }

  const hideColumn = (columnKey: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: false
    }))
  }

  const resetColumns = () => {
    setColumnVisibility(defaultColumns)
  }

  const setVisibleColumns = (columns: ColumnVisibilityConfig) => {
    setColumnVisibility(columns)
  }

  return {
    columnVisibility,
    toggleColumn,
    showColumn,
    hideColumn,
    resetColumns,
    setVisibleColumns
  }
}