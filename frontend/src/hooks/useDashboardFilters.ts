import { useState, useEffect, useCallback } from 'react'

interface FilterState {
  [key: string]: any
}

export function useDashboardFilters(storageKey: string, initialFilters: FilterState = {}) {
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return { ...initialFilters, ...JSON.parse(saved) }
        } catch (e) {
          console.error('Failed to parse saved filters:', e)
        }
      }
    }
    return initialFilters
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(filters))
    }
  }, [filters, storageKey])

  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(initialFilters)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
    }
  }, [initialFilters, storageKey])

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters
  }
}

