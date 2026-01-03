import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, Agent } from '../lib/agents'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { PlusIcon, FilterIcon, DocumentIcon, ChevronRightIcon, CalendarIcon, ActivityIcon, SearchIcon } from '../components/Icons'

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

export default function MySubmissions() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
    
    // Sync URL params with state
    const statusParam = searchParams.get('status')
    if (statusParam && statusParam !== statusFilter) {
      setStatusFilter(statusParam)
    }
  }, [navigate, searchParams])
  
  useEffect(() => {
    // Update URL when filter changes
    if (statusFilter) {
      setSearchParams({ status: statusFilter })
    } else {
      setSearchParams({})
    }
  }, [statusFilter, setSearchParams])

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents', 'my', statusFilter],
    queryFn: () => agentsApi.list(1, 100, statusFilter || undefined),
  })

  const agents = agentsData?.agents || []

  const getStatusInfo = (status: string) => {
    const infos: Record<string, { color: 'default' | 'primary' | 'warning' | 'success' | 'error', label: string }> = {
      draft: { color: 'default', label: 'Draft' },
      submitted: { color: 'primary', label: 'Submitted' },
      in_review: { color: 'warning', label: 'In Review' },
      approved: { color: 'success', label: 'Approved' },
      rejected: { color: 'error', label: 'Rejected' },
    }
    return infos[status] || { color: 'default', label: status }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-9 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700 tracking-tight">Retrieving submission logs...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-8 rounded-lg border border-gray-200">
          <div className="flex items-center gap-6">
            <div className="w-16 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <DocumentIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="unified-page-title mb-1">My Submissions</h1>
              <p className="unified-page-subtitle">Lifecycle management for your enterprise agent portfolio</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/agents/new')}
            className="btn-primary h-10 px-10 flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Launch New Agent
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
          <div className="pl-4 flex items-center gap-3 text-sm font-medium tracking-tight text-gray-700">
            <FilterIcon className="w-4 h-4" />
            Protocol Status
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="enterprise-input h-11 w-64 cursor-pointer"
          >
            <option value="">All Operational States</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Submissions Table */}
        <MaterialCard elevation={0} className="overflow-hidden border border-gray-200 bg-white">
          {agents.length === 0 ? (
            <div className="py-32 text-center">
              <div className="w-24 h-24 bg-gray-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-gray-200 border border-gray-100 border-dashed">
                <SearchIcon className="w-12 h-9" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">No Active Pipelines</h3>
              <p className="text-gray-600 mt-4 max-w-sm mx-auto font-medium leading-relaxed">
                Initiate your first synchronization by submitting a new agent to the platform.
              </p>
              <div className="mt-10">
                <button
                  onClick={() => navigate('/agents/new')}
                  className="btn-primary px-8 h-9"
                >
                  Initiate Submission
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-8 py-3 text-left text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">Identity</th>
                    <th className="px-8 py-3 text-left text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">Protocol Type</th>
                    <th className="px-8 py-3 text-left text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">State</th>
                    <th className="px-8 py-3 text-left text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">Audit Score</th>
                    <th className="px-8 py-3 text-left text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">Timestamp</th>
                    <th className="px-8 py-3 text-right text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {agents.map((agent: Agent) => {
                    const statusInfo = getStatusInfo(agent.status)
                    return (
                      <tr
                        key={agent.id}
                        className="group hover:bg-primary-50/30 cursor-pointer transition-all"
                        onClick={() => navigate(`/agents/${agent.id}`)}
                      >
                        <td className="px-8 py-3">
                          <div className="flex items-center gap-4">
                            {(() => {
                              const avatarColor = getAvatarColor(agent.name)
                              return (
                                <div className={`w-12 h-9 rounded-lg ${avatarColor.bg} ${avatarColor.text} flex items-center justify-center font-semibold text-lg border ${avatarColor.border} transition-colors`}>
                                  {agent.name.charAt(0)}
                                </div>
                              )
                            })()}
                            <div className="flex flex-col">
                              <span className="text-[15px] font-semibold text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight">{agent.name}</span>
                              <span className="text-xs font-medium text-gray-700 tracking-tight">ID: {agent.id.substring(0, 8)}...</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-3">
                          <MaterialChip 
                            label={agent.type} 
                            color="default" 
                            variant="outlined" 
                            size="small" 
                            className="font-medium text-xs h-6 bg-blue-100/80" 
                          />
                        </td>
                        <td className="px-8 py-3">
                          <MaterialChip 
                            label={statusInfo.label} 
                            color={statusInfo.color} 
                            size="small" 
                            variant="filled" 
                            className="font-medium text-xs h-6 px-3"
                          />
                        </td>
                        <td className="px-8 py-3">
                          {agent.compliance_score !== null ? (
                            <div className="flex flex-col gap-2 w-32">
                              <div className="flex items-center justify-between text-xs font-medium text-gray-600 tracking-tight">
                                <span>Audit</span>
                                <span className="text-gray-900 font-medium">{agent.compliance_score}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-50">
                                <div
                                  className="h-full bg-success-500 rounded-full shadow-lg transition-all duration-1000 group-hover:bg-green-500"
                                  style={{ width: `${agent.compliance_score}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-gray-600 tracking-tight">Pending Sync</span>
                          )}
                        </td>
                        <td className="px-8 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 tabular-nums">
                              <CalendarIcon className="w-3.5 h-3.5 text-gray-700" />
                              {formatDate(agent.submission_date)}
                            </div>
                            <span className="text-xs font-medium text-gray-700 tracking-tight">Last Modified</span>
                          </div>
                        </td>
                        <td className="px-8 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/agents/${agent.id}`)
                            }}
                            className="btn-secondary text-sm flex items-center gap-1.5 px-4"
                          >
                            Explore
                            <ChevronRightIcon className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </MaterialCard>
      </div>
    </Layout>
  )
}

