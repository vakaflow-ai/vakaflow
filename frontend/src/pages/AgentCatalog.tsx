import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, Agent } from '../lib/agents'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip, MaterialInput } from '../components/material'
import { SearchIcon, FilterIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/Icons'

export default function AgentCatalog() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const [page, setPage] = useState(1)
  const limit = 20

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents', 'approved', categoryFilter, page],
    queryFn: () => agentsApi.list(page, limit, 'approved'),
    staleTime: 30000, // Cache for 30 seconds
  })

  const approvedAgents = agentsData?.agents || []
  const filteredAgents = approvedAgents.filter(agent => {
    const matchesSearch = !searchQuery || 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !categoryFilter || agent.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(approvedAgents.map(a => a.category).filter(Boolean)))

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium mb-2">Agent Catalog</h1>
            <p className="text-sm text-gray-600">
              Browse and discover approved agents within the platform
            </p>
          </div>
        </div>

        {/* Filters - Material Design */}
        <MaterialCard elevation={1} className="p-4 border-none">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <MaterialInput
                placeholder="Search agents by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<SearchIcon className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="md:w-48 w-full relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600">
                  <FilterIcon className="w-4 h-4" />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full pl-10 pr-3 py-1.5 h-9 text-sm border border-gray-200 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-blue-500 focus:ring-primary-500/50 transition-all duration-200"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <MaterialButton
                variant="text"
                size="small"
                onClick={() => {
                  setSearchQuery('')
                  setCategoryFilter('')
                }}
                className="text-gray-500 whitespace-nowrap"
              >
                Clear Filters
              </MaterialButton>
            </div>
          </div>
        </MaterialCard>

        {/* Agent Grid */}
        {filteredAgents.length === 0 ? (
          <MaterialCard elevation={1} className="text-center py-20 border-none">
            <div className="text-gray-500 mb-4">
              <SearchIcon className="w-16 h-12 mx-auto opacity-20" />
            </div>
            <div className="text-lg font-medium text-gray-500">
              {approvedAgents.length === 0 
                ? 'No approved agents yet'
                : 'No agents match your search'}
            </div>
            <p className="text-sm text-gray-600 mt-1">Try adjusting your filters or search terms</p>
          </MaterialCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent: Agent) => (
              <MaterialCard
                key={agent.id}
                elevation={1}
                hover
                className="cursor-pointer border-none flex flex-col h-full"
                onClick={() => navigate(`/agents/${agent.id}`)}
              >
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="unified-card-title line-clamp-1 group-hover:text-blue-600 transition-colors">{agent.name}</h3>
                      <div className="text-xs text-gray-500 mt-0.5">{agent.type}</div>
                    </div>
                    {agent.compliance_score !== null && agent.compliance_score !== undefined && (
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm ${
                        agent.compliance_score >= 80 ? 'bg-success-50 text-success-700' :
                        agent.compliance_score >= 60 ? 'bg-warning-50 text-warning-700' :
                        'bg-error-50 text-error-700'
                      }`}>
                        {agent.compliance_score}/100
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-6 line-clamp-3 leading-relaxed flex-1">
                    {agent.description || 'No description provided for this agent.'}
                  </p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
                    {agent.category ? (
                      <MaterialChip label={agent.category} color="secondary" size="small" variant="outlined" />
                    ) : (
                      <div />
                    )}
                    <div className="text-sm font-medium text-blue-600 tracking-tight flex items-center gap-1">
                      View details
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </MaterialCard>
            ))}
          </div>
        )}

        {/* Pagination - Material Design */}
        {agentsData && agentsData.total > limit && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            <div className="text-sm text-gray-500 font-medium">
              Page <span className="text-gray-900">{page}</span> of {Math.ceil(agentsData.total / limit)} 
              <span className="mx-2">•</span> 
              Showing {agentsData.agents.length} of {agentsData.total} agents
            </div>
            <div className="flex gap-2">
              <MaterialButton
                variant="outlined"
                size="small"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                startIcon={<ChevronLeftIcon className="w-4 h-4" />}
                className="border-outline/10"
              >
                Previous
              </MaterialButton>
              <MaterialButton
                variant="outlined"
                size="small"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(agentsData.total / limit)}
                endIcon={<ChevronRightIcon className="w-4 h-4" />}
                className="border-outline/10"
              >
                Next
              </MaterialButton>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

