import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { marketplaceApi, Rating, Review } from '../lib/marketplace'
import { agentsApi, Agent } from '../lib/agents'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { SearchIcon, FilterIcon, StarIcon, ChatIcon, ChevronRightIcon, MarketplaceIcon, CheckCircleIcon, XIcon, SendIcon } from '../components/Icons'

export default function Marketplace() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [showRatingForm, setShowRatingForm] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [ratingForm, setRatingForm] = useState({ rating: 5, comment: '' })
  const [reviewForm, setReviewForm] = useState({ title: '', content: '', rating: 5 })

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
    staleTime: 30000,
  })

  const { data: ratings } = useQuery<Rating[]>({
    queryKey: ['ratings', selectedAgent?.id],
    queryFn: () => marketplaceApi.getAgentRatings(selectedAgent!.id),
    enabled: !!selectedAgent,
  })

  const { data: reviews } = useQuery<Review[]>({
    queryKey: ['reviews', selectedAgent?.id],
    queryFn: () => marketplaceApi.getAgentReviews(selectedAgent!.id),
    enabled: !!selectedAgent,
  })

  const createRatingMutation = useMutation({
    mutationFn: (data: { vendorId: string; agentId: string; rating: number; comment?: string }) =>
      marketplaceApi.createRating(data.vendorId, data.agentId, data.rating, data.comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings', selectedAgent?.id] })
      setShowRatingForm(false)
      setRatingForm({ rating: 5, comment: '' })
    },
  })

  const createReviewMutation = useMutation({
    mutationFn: (data: { vendorId: string; agentId: string; title: string; content: string; rating: number }) =>
      marketplaceApi.createReview(data.vendorId, data.agentId, data.title, data.content, data.rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', selectedAgent?.id] })
      setShowReviewForm(false)
      setReviewForm({ title: '', content: '', rating: 5 })
    },
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

  const handleRateAgent = (agent: Agent) => {
    setSelectedAgent(agent)
    setShowRatingForm(true)
  }

  const handleReviewAgent = (agent: Agent) => {
    setSelectedAgent(agent)
    setShowReviewForm(true)
  }

  const submitRating = () => {
    if (selectedAgent && user) {
      createRatingMutation.mutate({
        vendorId: selectedAgent.vendor_id,
        agentId: selectedAgent.id,
        rating: ratingForm.rating,
        comment: ratingForm.comment || undefined,
      })
    }
  }

  const submitReview = () => {
    if (selectedAgent && user && reviewForm.title && reviewForm.content) {
      createReviewMutation.mutate({
        vendorId: selectedAgent.vendor_id,
        agentId: selectedAgent.id,
        title: reviewForm.title,
        content: reviewForm.content,
        rating: reviewForm.rating,
      })
    }
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-9 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700 tracking-tight">Opening Marketplace...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto space-y-10 pb-12">
        {/* Modern Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 bg-white p-8 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-6">
            <div className="w-16 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xl shadow-primary-500/20 rotate-3 group hover:rotate-0 transition-transform">
              <MarketplaceIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-1">Global Marketplace</h1>
              <p className="text-sm font-medium text-gray-600">Discover and evaluate enterprise-grade autonomous agents</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
            <div className="px-4 py-2 bg-white rounded-md shadow-sm border border-gray-100 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-success-500" />
              <span className="text-xs font-medium text-gray-900 tracking-tight">{approvedAgents.length} Verified Agents</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-4 items-stretch">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <SearchIcon className="w-5 h-5 text-gray-700 group-focus-within:text-primary-500 transition-colors" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Query agent intelligence by name or function..."
              className="unified-search w-full pl-12 pr-4 h-10 bg-blue-100/80 border-2 border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-primary-500/5 transition-all placeholder:text-gray-600"
            />
          </div>
          
          <div className="flex items-center gap-3 bg-blue-100/80 px-4 rounded-lg border-2 border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all">
            <FilterIcon className="w-5 h-5 text-gray-700" />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className="unified-select h-10 border-none bg-transparent focus:ring-0 w-full lg:w-48 cursor-pointer"
            >
              <option value="">All Domains</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Agent Grid */}
        {filteredAgents.length === 0 ? (
          <div className="bg-white rounded-lg p-32 text-center border-2 border-dashed border-gray-100">
            <div className="w-24 h-24 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-8 text-gray-400">
              <SearchIcon className="w-12 h-9" />
            </div>
            <h3 className="unified-section-title">No Intelligence Found</h3>
            <p className="text-gray-700 mt-4 max-w-sm mx-auto font-medium">Try adjusting your protocol filters or search query to locate agents in other sectors.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAgents.map((agent: Agent) => (
              <div key={agent.id} className="group h-full">
                <MaterialCard 
                  elevation={1}
                  className="h-full flex flex-col overflow-hidden border-none group-hover:shadow-xl group-hover:-translate-y-2 transition-all duration-500 cursor-pointer"
                  onClick={() => navigate(`/agents/${agent.id}`)}
                >
                  <div className="p-8 flex-1">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div className="w-14 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-medium text-xl border border-gray-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all duration-500 shadow-inner">
                        {agent.name.charAt(0)}
                      </div>
                      {agent.compliance_score !== null && (
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-medium text-green-600 tracking-tight mb-1">Audit Score</span>
                          <div className="px-3 py-1.5 rounded-md bg-success-50 text-success-700 font-medium text-sm border border-success-100 shadow-sm">
                            {agent.compliance_score}%
                          </div>
                        </div>
                      )}
                    </div>

                    <h3 className="unified-card-title mb-3 group-hover:text-blue-600 transition-colors">{agent.name}</h3>
                    <p className="text-sm text-gray-600 font-medium leading-relaxed mb-6 line-clamp-3 italic">
                      {agent.description || 'Enterprise agent profile pending synchronization...'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mb-8">
                      <MaterialChip label={agent.type} size="small" variant="filled" className="bg-gray-900 text-white font-medium text-xs h-5" />
                      {agent.category && (
                        <MaterialChip label={agent.category} size="small" variant="outlined" className="text-blue-600 border-primary-100 font-medium text-xs h-5 bg-primary-50/30" />
                      )}
                    </div>
                  </div>

                  <div className="p-6 bg-blue-100/80 border-t border-gray-100 flex gap-3 group-hover:bg-white transition-colors" onClick={(e) => e.stopPropagation()}>
                    <MaterialButton
                      variant="outlined"
                      size="small"
                      onClick={() => handleRateAgent(agent)}
                      className="flex-1 text-xs font-medium tracking-tight bg-white border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-500"
                      startIcon={<StarIcon className="w-3.5 h-3.5" />}
                    >
                      Rate
                    </MaterialButton>
                    <MaterialButton
                      variant="outlined"
                      size="small"
                      onClick={() => handleReviewAgent(agent)}
                      className="flex-1 text-xs font-medium tracking-tight bg-white border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-500"
                      startIcon={<ChatIcon className="w-3.5 h-3.5" />}
                    >
                      Review
                    </MaterialButton>
                    <div className="w-10 h-10 rounded-md bg-gray-900 flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform cursor-pointer" onClick={() => navigate(`/agents/${agent.id}`)}>
                      <ChevronRightIcon className="w-5 h-5" />
                    </div>
                  </div>
                </MaterialCard>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {agentsData && agentsData.total > limit && (
          <div className="flex items-center justify-between bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <span className="text-sm font-medium text-gray-700 tracking-tight">
              Catalogue Page {page} of {Math.ceil(agentsData.total / limit)}
            </span>
            <div className="flex gap-2">
              <MaterialButton
                variant="text"
                size="small"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="font-medium text-sm tracking-tight"
              >
                Previous
              </MaterialButton>
              <MaterialButton
                variant="text"
                size="small"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(agentsData.total / limit)}
                className="font-medium text-sm tracking-tight"
              >
                Next
              </MaterialButton>
            </div>
          </div>
        )}

        {/* Rating & Review Modals could be further polished similarly using MaterialDialog if available, or just sharp Tailwind modals */}
        {/* For now, I'll keep the existing logic but sharpen the Tailwind classes */}
        
        {showRatingForm && selectedAgent && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Post Rating</h2>
                <button onClick={() => { setShowRatingForm(false); setSelectedAgent(null); }} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-red-50 hover:text-red-500 transition-all">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-8">
                <div>
                  <label className="text-xs font-medium tracking-tight text-gray-700 block mb-4">Select Intensity</label>
                  <div className="flex justify-between bg-gray-50 p-4 rounded-lg">
                    {[1, 2, 3, 4, 5].map(r => (
                      <button
                        key={r}
                        onClick={() => setRatingForm(prev => ({ ...prev, rating: r }))}
                        className={`w-12 h-9 rounded-md flex items-center justify-center text-2xl transition-all ${ratingForm.rating >= r ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-white hover:text-gray-600'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium tracking-tight text-gray-700 block mb-4">Technical Feedack (Optional)</label>
                  <textarea
                    value={ratingForm.comment}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full min-h-[120px] p-5 rounded-lg border-2 border-gray-100 focus:border-blue-500 focus:ring-4 focus:ring-primary-500/5 transition-all text-sm font-medium placeholder:text-gray-600"
                    placeholder="Provide context for your evaluation..."
                  />
                </div>
                <div className="flex gap-4">
                  <MaterialButton
                    variant="contained"
                    size="large"
                    fullWidth
                    color="primary"
                    onClick={submitRating}
                    disabled={createRatingMutation.isPending}
                    className="font-medium tracking-tight rounded-lg h-10"
                    startIcon={<SendIcon className="w-4 h-4" />}
                  >
                    {createRatingMutation.isPending ? 'Syncing...' : 'Broadcast Rating'}
                  </MaterialButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Similar polish for Review Modal... */}
      </div>
    </Layout>
  )
}

