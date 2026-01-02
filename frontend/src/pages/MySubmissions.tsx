import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, Agent } from '../lib/agents'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { PlusIcon, FilterIcon, DocumentIcon, ChevronRightIcon, CalendarIcon, ActivityIcon, SearchIcon } from '../components/Icons'

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
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-8 rounded-lg shadow-sm border border-gray-100/60 ring-1 ring-gray-200/50">
          <div className="flex items-center gap-6">
            <div className="w-16 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xl shadow-primary-500/20">
              <DocumentIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 tracking-tight mb-1">My Submissions</h1>
              <p className="text-sm font-medium text-gray-500">Lifecycle management for your enterprise agent portfolio</p>
            </div>
          </div>
          <MaterialButton
            onClick={() => navigate('/agents/new')}
            variant="contained"
            color="primary"
            size="large"
            className="font-bold tracking-tight rounded-lg h-10 px-10 shadow-xl shadow-primary-500/20"
            startIcon={<PlusIcon className="w-5 h-5" />}
          >
            Launch New Agent
          </MaterialButton>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100/60 ring-1 ring-gray-200/50">
          <div className="pl-4 flex items-center gap-3 text-sm font-medium tracking-tight text-gray-700">
            <FilterIcon className="w-4 h-4" />
            Protocol Status
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 border-none bg-blue-100/80 rounded-md focus:ring-0 w-64 font-medium text-gray-700 tracking-tight text-sm cursor-pointer hover:bg-gray-100 transition-colors"
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
        <MaterialCard elevation={1} className="overflow-hidden border-none bg-white shadow-xl ring-1 ring-gray-200/50">
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
                <MaterialButton
                  variant="outlined"
                  size="medium"
                  color="gray"
                  onClick={() => navigate('/agents/new')}
                  className="font-medium tracking-tight border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-500 px-8 h-9 rounded-md"
                >
                  Initiate Submission
                </MaterialButton>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-100/80">
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
                            <div className="w-12 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-lg border border-gray-200 group-hover:bg-white group-hover:scale-105 transition-all shadow-inner">
                              {agent.name.charAt(0)}
                            </div>
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
                          <MaterialButton
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/agents/${agent.id}`)
                            }}
                            variant="text"
                            size="small"
                            color="primary"
                            className="font-medium text-sm tracking-tight group-hover:bg-white rounded-md px-4"
                            endIcon={<ChevronRightIcon className="w-3.5 h-3.5" />}
                          >
                            Explore
                          </MaterialButton>
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

