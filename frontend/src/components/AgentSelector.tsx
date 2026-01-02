import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentsApi } from '../lib/agents'
import { vendorsApi } from '../lib/vendors'

interface AgentSelectorProps {
  value: any
  onChange: (value: any) => void
  required?: boolean
  helpText?: string
  allowMultiple?: boolean
}

type SelectionMode = 'agent' | 'category' | 'vendor' | 'all'

export default function AgentSelector({ 
  value, 
  onChange, 
  required = false,
  helpText,
  allowMultiple = false 
}: AgentSelectorProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('agent')
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [condition, setCondition] = useState<'select_one' | 'all'>('select_one')

  // Fetch agents (with pagination if needed)
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents-for-selector'],
    queryFn: () => agentsApi.list(1, 100) // API limit is 100
  })

  // Fetch vendors
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors-for-selector'],
    queryFn: () => vendorsApi.list(true)
  })

  // Get unique categories from agents
  const categories = Array.from(
    new Set(
      agentsData?.agents
        .map(agent => agent.category)
        .filter((cat): cat is string => !!cat)
    )
  ).sort()

  // Entity relation discovery (database-based for structured relations)
  // When vendor is selected, find related agents, categories, and entities
  // Note: This uses direct database queries for structured relationships.
  // For semantic similarity (e.g., "similar vendors"), RAG would be used separately.
  const getRelatedEntities = (vendorId?: string, category?: string) => {
    if (!agentsData?.agents) return { agents: [], categories: [], vendors: [] }
    
    let relatedAgents = agentsData.agents
    let relatedCategories: string[] = []
    let relatedVendors: string[] = []
    
    // If vendor is selected, find agents and categories related to that vendor
    if (vendorId) {
      relatedAgents = agentsData.agents.filter(agent => agent.vendor_id === vendorId)
      relatedCategories = Array.from(new Set(
        relatedAgents
          .map(agent => agent.category)
          .filter((cat): cat is string => !!cat)
      ))
      // Find vendors with agents in similar categories (database-based relation discovery)
      // This finds vendors that have agents in the same categories as the selected vendor
      // For semantic similarity (e.g., "vendors with similar business models"), RAG would be used
      const vendorCategories = relatedCategories
      relatedVendors = Array.from(new Set(
        agentsData.agents
          .filter(agent => 
            agent.vendor_id !== vendorId && 
            agent.category && 
            vendorCategories.includes(agent.category)
          )
          .map(agent => agent.vendor_id)
          .filter((id): id is string => !!id)
      ))
    }
    
    // If category is selected, find agents and vendors in that category
    if (category) {
      relatedAgents = agentsData.agents.filter(agent => agent.category === category)
      relatedVendors = Array.from(new Set(
        relatedAgents
          .map(agent => agent.vendor_id)
          .filter((id): id is string => !!id)
      ))
    }
    
    return {
      agents: relatedAgents,
      categories: relatedCategories.length > 0 ? relatedCategories : categories,
      vendors: relatedVendors
    }
  }

  // Get related entities based on current selection (memoized to avoid redeclaration)
  const relatedEntities = useMemo(() => {
    return getRelatedEntities(
      selectedVendors[0],
      selectedCategories[0]
    )
  }, [selectedVendors, selectedCategories, agentsData?.agents, categories])

  useEffect(() => {
    // Parse existing value
    if (value) {
      if (typeof value === 'string' && value.startsWith('${trigger_data.')) {
        // Trigger data - keep as is
        return
      } else if (typeof value === 'object') {
        // Complex selection object
        if (value.mode === 'all') {
          setSelectionMode('all')
          setSelectAll(true)
          setCondition(value.condition || 'all')
        } else if (value.mode === 'category') {
          setSelectionMode('category')
          setSelectedCategories(value.categories || [])
        } else if (value.mode === 'vendor') {
          setSelectionMode('vendor')
          setSelectedVendors(value.vendors || [])
        } else if (value.agent_ids) {
          setSelectionMode('agent')
          setSelectedAgents(value.agent_ids || [])
        }
      } else if (typeof value === 'string') {
        // Single agent ID
        setSelectionMode('agent')
        setSelectedAgents([value])
      }
    }
  }, [value])

  const updateValue = (mode: SelectionMode, data: any) => {
    if (mode === 'all') {
      onChange({
        mode: 'all',
        condition: condition,
        rule: 'all_agents'
      })
    } else if (mode === 'category') {
      onChange({
        mode: 'category',
        categories: data.categories || [],
        condition: condition
      })
    } else if (mode === 'vendor') {
      onChange({
        mode: 'vendor',
        vendors: data.vendors || [],
        condition: condition
      })
    } else if (mode === 'agent') {
      if (allowMultiple) {
        onChange({
          mode: 'agent',
          agent_ids: data.agent_ids || [],
          condition: condition
        })
      } else {
        // Single agent selection
        onChange(data.agent_ids?.[0] || '')
      }
    }
  }

  const handleModeChange = (mode: SelectionMode) => {
    setSelectionMode(mode)
    setSelectedAgents([])
    setSelectedCategories([])
    setSelectedVendors([])
    setSelectAll(false)
    
    if (mode === 'all') {
      updateValue('all', {})
    } else {
      updateValue(mode, {})
    }
  }

  const handleAgentToggle = (agentId: string) => {
    const newAgents = selectedAgents.includes(agentId)
      ? selectedAgents.filter(id => id !== agentId)
      : allowMultiple
      ? [...selectedAgents, agentId]
      : [agentId]
    
    setSelectedAgents(newAgents)
    updateValue('agent', { agent_ids: newAgents })
  }

  const handleCategoryToggle = (category: string) => {
    const isSelected = selectedCategories.includes(category)
    let newCategories: string[]
    
    if (isSelected) {
      // Deselect category
      newCategories = selectedCategories.filter(cat => cat !== category)
    } else {
      // Select category - when condition is 'all', all agents in category are auto-selected
      newCategories = [...selectedCategories, category]
    }
    
    setSelectedCategories(newCategories)
    updateValue('category', { categories: newCategories })
  }

  const handleVendorToggle = (vendorId: string) => {
    const isSelected = selectedVendors.includes(vendorId)
    let newVendors: string[]
    
    if (isSelected) {
      // Deselect vendor
      newVendors = selectedVendors.filter(id => id !== vendorId)
    } else {
      // Select vendor - when condition is 'all', all agents from vendor are auto-selected
      newVendors = [...selectedVendors, vendorId]
    }
    
    setSelectedVendors(newVendors)
    updateValue('vendor', { vendors: newVendors })
  }

  const handleSelectAllToggle = () => {
    const newSelectAll = !selectAll
    setSelectAll(newSelectAll)
    if (newSelectAll) {
      updateValue('all', {})
    }
  }

  const handleConditionChange = (newCondition: 'select_one' | 'all') => {
    setCondition(newCondition)
    // Update current selection with new condition
    updateValue(selectionMode, {
      agent_ids: selectedAgents,
      categories: selectedCategories,
      vendors: selectedVendors
    })
  }

  // Get agents by category (database-based relation discovery)
  const getAgentsByCategory = (category: string) => {
    const related = getRelatedEntities(undefined, category)
    return related.agents
  }

  // Get agents by vendor (database-based relation discovery)
  const getAgentsByVendor = (vendorId: string) => {
    const related = getRelatedEntities(vendorId)
    return related.agents
  }

  // Get selected agents count
  const getSelectedCount = () => {
    if (selectionMode === 'all') {
      return agentsData?.total || 0
    } else if (selectionMode === 'category') {
      return selectedCategories.reduce((count, cat) => {
        return count + getAgentsByCategory(cat).length
      }, 0)
    } else if (selectionMode === 'vendor') {
      return selectedVendors.reduce((count, vendorId) => {
        return count + getAgentsByVendor(vendorId).length
      }, 0)
    } else {
      return selectedAgents.length
    }
  }

  return (
    <div className="space-y-4">
      {/* Selection Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selection Mode
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => handleModeChange('agent')}
            className={`px-2 py-1.5 text-xs rounded border ${
              selectionMode === 'agent'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Agent
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('category')}
            className={`px-2 py-1.5 text-xs rounded border ${
              selectionMode === 'category'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Category
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('vendor')}
            className={`px-2 py-1.5 text-xs rounded border ${
              selectionMode === 'vendor'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Vendor
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('all')}
            className={`px-2 py-1.5 text-xs rounded border ${
              selectionMode === 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Condition Selection */}
      {selectionMode !== 'all' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Condition
          </label>
          <select
            value={condition}
            onChange={(e) => handleConditionChange(e.target.value as 'select_one' | 'all')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="select_one">Select 1</option>
            <option value="all">All Matching</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {condition === 'select_one' 
              ? 'Select only one agent from the matching results'
              : 'Select all agents matching the criteria'}
          </p>
        </div>
      )}

      {/* Agent Selection Mode */}
      {selectionMode === 'agent' && condition === 'select_one' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Agent{allowMultiple ? 's' : ''} {required && <span className="text-red-500">*</span>}
          </label>
          {agentsLoading ? (
            <div className="text-sm text-gray-500">Loading agents...</div>
          ) : (
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              <div className="divide-y divide-gray-200">
                {agentsData?.agents.map((agent) => (
                  <label
                    key={agent.id}
                    className="flex items-start p-2.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type={allowMultiple ? 'checkbox' : 'radio'}
                      name="agent-selection"
                      checked={selectedAgents.includes(agent.id)}
                      onChange={() => handleAgentToggle(agent.id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 flex-shrink-0"
                    />
                    <div className="ml-2.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-gray-900 truncate">{agent.name}</p>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">
                            {agent.type}
                          </span>
                          {agent.category && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded truncate max-w-[80px]">
                              {agent.category}
                            </span>
                          )}
                        </div>
                      </div>
                      {agent.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{agent.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          {selectedAgents.length > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              {selectedAgents.length} agent(s) selected
            </p>
          )}
        </div>
      )}
      
      {/* Show summary when "All Matching" is selected - no individual checkboxes */}
      {selectionMode === 'agent' && condition === 'all' && (
        <div className="p-3 bg-blue-50 border border-blue-400 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">All Matching Agents Selected</p>
          <p className="text-xs text-blue-600 mt-1">
            All agents matching the current criteria will be automatically selected. No individual selection needed.
          </p>
        </div>
      )}

      {/* Category Selection Mode */}
      {selectionMode === 'category' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Categories {required && <span className="text-red-500">*</span>}
          </label>
          {condition === 'all' && selectedCategories.length > 0 ? (
            <div className="p-2.5 bg-blue-50 border border-blue-400 rounded-lg">
              <p className="text-xs text-blue-800 font-medium">All Matching Agents Selected</p>
              <p className="text-xs text-blue-600 mt-0.5">
                All {getSelectedCount()} agent(s) from {selectedCategories.length} categor{selectedCategories.length !== 1 ? 'ies' : 'y'} will be included.
              </p>
            </div>
          ) : condition === 'all' ? (
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-600">Select categories first</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              <div className="divide-y divide-gray-200">
                {categories.map((category) => {
                  const categoryAgents = getAgentsByCategory(category)
                  const isSelected = selectedCategories.includes(category)
                  return (
                    <div key={category}>
                      <label
                        className="flex items-start p-2.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCategoryToggle(category)}
                          className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 flex-shrink-0"
                        />
                        <div className="ml-2.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-gray-900 truncate">{category}</p>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {categoryAgents.length} agent(s)
                            </span>
                          </div>
                        </div>
                      </label>
                      {/* Auto-show agents when category is selected */}
                      {isSelected && condition === 'select_one' && categoryAgents.length > 0 && (
                        <div className="ml-6 mb-2 pl-3 border-l-2 border-blue-400">
                          <p className="text-xs text-gray-500 mb-1">Agents in this category:</p>
                          <div className="space-y-1">
                            {categoryAgents.slice(0, 3).map((agent) => (
                              <div key={agent.id} className="text-xs text-gray-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                <span className="truncate">{agent.name}</span>
                              </div>
                            ))}
                            {categoryAgents.length > 3 && (
                              <p className="text-xs text-gray-600">+{categoryAgents.length - 3} more</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {selectedCategories.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-600">
                {getSelectedCount()} agent(s) will be selected from {selectedCategories.length} categor{selectedCategories.length !== 1 ? 'ies' : 'y'}
              </p>
              {relatedEntities && relatedEntities.vendors.length > 0 && (
                <p className="text-xs text-blue-600">
                  💡 Found {relatedEntities.vendors.length} vendor{relatedEntities.vendors.length !== 1 ? 's' : ''} with agents in these categor{selectedCategories.length !== 1 ? 'ies' : 'y'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Vendor Selection Mode */}
      {selectionMode === 'vendor' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Vendors {required && <span className="text-red-500">*</span>}
          </label>
          {vendorsLoading ? (
            <div className="text-sm text-gray-500">Loading vendors...</div>
          ) : (
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              <div className="divide-y divide-gray-200">
                {vendorsData?.map((vendor) => {
                  const vendorAgents = getAgentsByVendor(vendor.id)
                  return (
                    <label
                      key={vendor.id}
                      className="flex items-start p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes(vendor.id)}
                        onChange={() => handleVendorToggle(vendor.id)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{vendor.name}</p>
                          <span className="text-xs text-gray-500">
                            {vendorAgents.length} agent(s)
                          </span>
                        </div>
                        {vendor.description && (
                          <p className="text-xs text-gray-500 mt-1">{vendor.description}</p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          {selectedVendors.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-600">
                {getSelectedCount()} agent(s) will be selected from {selectedVendors.length} vendor(s)
              </p>
              {relatedEntities && relatedEntities.categories.length > 0 && (
                <p className="text-xs text-blue-600">
                  💡 Found {relatedEntities.categories.length} related categor{relatedEntities.categories.length !== 1 ? 'ies' : 'y'} and {relatedEntities.vendors.length} vendor{relatedEntities.vendors.length !== 1 ? 's' : ''} with similar categories
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* All Agents Mode */}
      {selectionMode === 'all' && (
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAllToggle}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm font-medium text-gray-900">
              Select All Agents {required && <span className="text-red-500">*</span>}
            </span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            This will select all {agentsData?.total || 0} agents in the system
          </p>
        </div>
      )}

      {/* Summary */}
      {getSelectedCount() > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-400 rounded">
          <p className="text-sm font-medium text-blue-900">
            {getSelectedCount()} agent(s) will be processed
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Mode: {selectionMode} | Condition: {condition === 'select_one' ? 'Select 1' : 'All Matching'}
          </p>
        </div>
      )}

      {helpText && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  )
}
