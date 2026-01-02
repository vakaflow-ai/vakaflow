import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorsApi, VendorWithDetails } from '../lib/vendors'
import { agentsApi } from '../lib/agents'

interface VendorSelectorProps {
  value: string | string[] // Single vendor ID or array of vendor IDs
  onChange: (value: string | string[]) => void
  required?: boolean
  helpText?: string
  allowMultiple?: boolean
}

export default function VendorSelector({ 
  value, 
  onChange, 
  required = false,
  helpText,
  allowMultiple = false 
}: VendorSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterAgentType, setFilterAgentType] = useState<string>('')
  const [selectedVendors, setSelectedVendors] = useState<string[]>(
    Array.isArray(value) ? value : value ? [value] : []
  )

  // Sync selectedVendors with external value changes
  useEffect(() => {
    const newSelection = Array.isArray(value) ? value : value ? [value] : []
    setSelectedVendors(newSelection)
  }, [value])

  // Fetch vendors
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors-for-selector'],
    queryFn: () => vendorsApi.list(true)
  })

  // Fetch agents to get categories and types for filtering
  const { data: agentsData } = useQuery({
    queryKey: ['agents-for-vendor-filter'],
    queryFn: () => agentsApi.list(1, 100)
  })

  // Get unique categories from agents
  const categories = useMemo(() => {
    if (!agentsData?.agents) return []
    return Array.from(
      new Set(
        agentsData.agents
          .map(agent => agent.category)
          .filter((cat): cat is string => !!cat)
      )
    ).sort()
  }, [agentsData])

  // Get unique agent types from agents
  const agentTypes = useMemo(() => {
    if (!agentsData?.agents) return []
    return Array.from(
      new Set(
        agentsData.agents
          .map(agent => agent.type)
          .filter((type): type is string => !!type)
      )
    ).sort()
  }, [agentsData])

  // Filter vendors based on search, category, and agent type
  const filteredVendors = useMemo(() => {
    if (!vendorsData) return []

    let filtered = vendorsData

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(vendor => 
        vendor.name.toLowerCase().includes(searchLower) ||
        vendor.description?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by category (vendors that have agents in this category)
    if (filterCategory && agentsData?.agents) {
      const vendorIdsWithCategory = new Set(
        agentsData.agents
          .filter(agent => agent.category === filterCategory && agent.vendor_id)
          .map(agent => agent.vendor_id)
      )
      filtered = filtered.filter(vendor => vendorIdsWithCategory.has(vendor.id))
    }

    // Filter by agent type (vendors that have agents of this type)
    if (filterAgentType && agentsData?.agents) {
      const vendorIdsWithType = new Set(
        agentsData.agents
          .filter(agent => agent.type === filterAgentType && agent.vendor_id)
          .map(agent => agent.vendor_id)
      )
      filtered = filtered.filter(vendor => vendorIdsWithType.has(vendor.id))
    }

    return filtered
  }, [vendorsData, searchTerm, filterCategory, filterAgentType, agentsData])

  const handleVendorToggle = (vendorId: string) => {
    let newSelection: string[]
    
    if (allowMultiple) {
      if (selectedVendors.includes(vendorId)) {
        newSelection = selectedVendors.filter(id => id !== vendorId)
      } else {
        newSelection = [...selectedVendors, vendorId]
      }
    } else {
      newSelection = selectedVendors.includes(vendorId) ? [] : [vendorId]
    }
    
    setSelectedVendors(newSelection)
    onChange(allowMultiple ? newSelection : (newSelection[0] || ''))
  }

  if (vendorsLoading) {
    return <div className="text-sm text-gray-500">Loading vendors...</div>
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="space-y-2 p-3 bg-gray-50 rounded-md border border-gray-200">
        <div className="text-xs font-medium text-gray-700 mb-2">Filter Vendors</div>
        
        {/* Search */}
        <div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vendors by name..."
            className="unified-search"
          />
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">By Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="unified-select"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}

        {/* Agent Type Filter */}
        {agentTypes.length > 0 && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">By Agent Type</label>
            <select
              value={filterAgentType}
              onChange={(e) => setFilterAgentType(e.target.value)}
              className="unified-select"
            >
              <option value="">All Agent Types</option>
              {agentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clear Filters */}
        {(searchTerm || filterCategory || filterAgentType) && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('')
              setFilterCategory('')
              setFilterAgentType('')
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Vendor List */}
      <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
        {filteredVendors.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            {searchTerm || filterCategory || filterAgentType 
              ? 'No vendors match the selected filters'
              : 'No vendors available'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredVendors.map((vendor) => {
              const isSelected = selectedVendors.includes(vendor.id)
              // Get vendor's agent categories and types for display
              const vendorCategories = new Set(
                agentsData?.agents
                  .filter(agent => agent.vendor_id === vendor.id && agent.category)
                  .map(agent => agent.category)
                  .filter((cat): cat is string => !!cat)
              )
              const vendorTypes = new Set(
                agentsData?.agents
                  .filter(agent => agent.vendor_id === vendor.id && agent.type)
                  .map(agent => agent.type)
                  .filter((type): type is string => !!type)
              )

              return (
                <label
                  key={vendor.id}
                  className={`flex items-start p-3 cursor-pointer hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type={allowMultiple ? 'checkbox' : 'radio'}
                    checked={isSelected}
                    onChange={() => handleVendorToggle(vendor.id)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    required={required && selectedVendors.length === 0}
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-sm text-gray-900">{vendor.name}</div>
                    {vendor.agents_count !== undefined && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {vendor.agents_count} agent{vendor.agents_count !== 1 ? 's' : ''}
                      </div>
                    )}
                    {(vendorCategories.size > 0 || vendorTypes.size > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Array.from(vendorCategories).slice(0, 3).map(cat => (
                          <span
                            key={cat}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                          >
                            {cat}
                          </span>
                        ))}
                        {Array.from(vendorTypes).slice(0, 2).map(type => (
                          <span
                            key={type}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected Vendors Summary */}
      {selectedVendors.length > 0 && (
        <div className="p-2 bg-blue-50 border border-blue-400 rounded-md">
          <div className="text-xs font-medium text-blue-900 mb-1">
            Selected: {selectedVendors.length} vendor{selectedVendors.length !== 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedVendors.map(vendorId => {
              const vendor = vendorsData?.find(v => v.id === vendorId)
              return vendor ? (
                <span
                  key={vendorId}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white"
                >
                  {vendor.name}
                  <button
                    type="button"
                    onClick={() => handleVendorToggle(vendorId)}
                    className="ml-1 hover:text-blue-200"
                  >
                    ×
                  </button>
                </span>
              ) : null
            })}
          </div>
        </div>
      )}

      {helpText && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  )
}

