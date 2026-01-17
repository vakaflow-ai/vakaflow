import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { marketplaceApi, Rating, Review } from '../lib/marketplace'
import { agentsApi, Agent } from '../lib/agents'
import Layout from '../components/Layout'
import PageContainer, { PageHeader } from '../components/PageContainer'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { SearchIcon, FilterIcon, StarIcon, ChatIcon, ChevronRightIcon, MarketplaceIcon, CheckCircleIcon, XIcon, SendIcon } from '../components/Icons'

// Color palette for agent avatars - vibrant and distinct
const AVATAR_COLORS = [
  { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
  { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
  { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-600' },
  { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-600' },
  { bg: 'bg-red-500', text: 'text-white', border: 'border-red-600' },
  { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
  { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' },
  { bg: 'bg-yellow-500', text: 'text-white', border: 'border-yellow-600' },
  { bg: 'bg-lime-500', text: 'text-white', border: 'border-lime-600' },
  { bg: 'bg-green-500', text: 'text-white', border: 'border-green-600' },
  { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  { bg: 'bg-teal-500', text: 'text-white', border: 'border-teal-600' },
  { bg: 'bg-cyan-500', text: 'text-white', border: 'border-cyan-600' },
  { bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-600' },
]

// Get avatar color based on agent name (deterministic)
const getAvatarColor = (name: string) => {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

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
      <PageContainer spacing="lg">
        {/* Modern Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 bg-white p-8 rounded-lg border border-gray-200 mb-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <MarketplaceIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Global Marketplace</h1>
              <p className="text-sm text-gray-500">Discover and evaluate enterprise-grade autonomous agents</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
            <div className="px-4 py-2 bg-white rounded-md border border-gray-200 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-green-600" />
              <span className="text-sm font-normal text-gray-900">{approvedAgents.length} Verified Agents</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 flex flex-col lg:flex-row gap-4 items-stretch">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <SearchIcon className="w-5 h-5 text-gray-500 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Query agent intelligence by name or function..."
              className="enterprise-input w-full pl-12 pr-4 h-10"
            />
          </div>
          
          <div className="flex items-center gap-3 px-4 rounded-lg border border-gray-300 focus-within:border-blue-500 transition-colors">
            <FilterIcon className="w-5 h-5 text-gray-500" />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className="enterprise-input h-10 border-none bg-transparent focus:ring-0 w-full lg:w-48 cursor-pointer"
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
          <div className="bg-white rounded-lg p-32 text-center border-2 border-dashed border-gray-200">
            <div className="w-24 h-24 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-8 text-gray-400">
              <SearchIcon className="w-12 h-9" />
            </div>
            <h3 className="unified-section-title">No Intelligence Found</h3>
            <p className="text-body mt-4 max-w-sm mx-auto">Try adjusting your protocol filters or search query to locate agents in other sectors.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAgents.map((agent: Agent) => (
              <div key={agent.id} className="group h-full">
                <MaterialCard 
                  elevation={0}
                  className="h-full flex flex-col overflow-hidden border border-gray-200 group-hover:border-gray-300 transition-colors duration-150 cursor-pointer"
                  onClick={() => navigate(`/agents/${agent.id}`)}
                >
                  <div className="p-8 flex-1">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      {(() => {
                        const avatarColor = getAvatarColor(agent.name)
                        return (
                          <div className={`w-14 h-10 rounded-lg ${avatarColor.bg} ${avatarColor.text} flex items-center justify-center font-medium text-xl border ${avatarColor.border} transition-colors duration-150`}>
                            {agent.name.charAt(0)}
                          </div>
                        )
                      })()}
                      {agent.compliance_score !== null && (
                        <div className="flex flex-col items-end">
                          <span className="text-caption font-medium text-green-600 mb-1">Audit Score</span>
                          <div className="px-3 py-1.5 rounded-md bg-green-50 text-green-700 font-medium text-sm border border-green-200">
                            {agent.compliance_score}%
                          </div>
                        </div>
                      )}
                    </div>

                    <h3 className="unified-card-title mb-3 group-hover:text-blue-600 transition-colors">{agent.name}</h3>
                    <p className="text-body mb-6 line-clamp-3">
                      {agent.description || 'Enterprise agent profile pending synchronization...'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mb-8">
                      <MaterialChip label={agent.type} size="small" variant="filled" className="bg-gray-900 text-white font-normal text-xs h-5" />
                      {agent.category && (
                        <MaterialChip label={agent.category} size="small" variant="outlined" className="text-blue-600 border-blue-200 font-normal text-xs h-5 bg-blue-50" />
                      )}
                    </div>
                  </div>

                  <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3 group-hover:bg-white transition-colors" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleRateAgent(agent)}
                      className="btn-secondary flex-1 text-xs h-9 flex items-center justify-center gap-1.5"
                    >
                      <StarIcon className="w-3.5 h-3.5" />
                      Rate
                    </button>
                    <button
                      onClick={() => handleReviewAgent(agent)}
                      className="btn-secondary flex-1 text-xs h-9 flex items-center justify-center gap-1.5"
                    >
                      <ChatIcon className="w-3.5 h-3.5" />
                      Review
                    </button>
                    <button
                      onClick={() => navigate(`/agents/${agent.id}`)}
                      className="btn-primary w-10 h-10 p-0 flex items-center justify-center"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                </MaterialCard>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {agentsData && agentsData.total > limit && (
          <div className="flex items-center justify-between bg-white p-6 rounded-lg border border-gray-200">
            <span className="text-body">
              Catalogue Page {page} of {Math.ceil(agentsData.total / limit)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(agentsData.total / limit)}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Rating & Review Modals could be further polished similarly using MaterialDialog if available, or just sharp Tailwind modals */}
        {/* For now, I'll keep the existing logic but sharpen the Tailwind classes */}
        
        {showRatingForm && selectedAgent && (
          <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-lg p-10 max-w-md w-full border border-gray-200">
              <div className="flex items-center justify-between mb-8">
                <h2 className="unified-section-title">Post Rating</h2>
                <button onClick={() => { setShowRatingForm(false); setSelectedAgent(null); }} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-8">
                <div>
                  <label className="text-label block mb-4">Select Intensity</label>
                  <div className="flex justify-between bg-gray-50 p-4 rounded-lg">
                    {[1, 2, 3, 4, 5].map(r => (
                      <button
                        key={r}
                        onClick={() => setRatingForm(prev => ({ ...prev, rating: r }))}
                        className={`w-12 h-9 rounded-md flex items-center justify-center text-2xl transition-colors ${ratingForm.rating >= r ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-label block mb-4">Technical Feedback (Optional)</label>
                  <textarea
                    value={ratingForm.comment}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="enterprise-input w-full min-h-[120px]"
                    placeholder="Provide context for your evaluation..."
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={submitRating}
                    disabled={createRatingMutation.isPending}
                    className="btn-primary w-full h-10 flex items-center justify-center gap-2"
                  >
                    <SendIcon className="w-4 h-4" />
                    {createRatingMutation.isPending ? 'Syncing...' : 'Broadcast Rating'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Similar polish for Review Modal... */}
      </PageContainer>
    </Layout>
  )
}

