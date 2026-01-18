import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { offboardingApi, OffboardingRequest } from '../lib/offboarding'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { FilterIcon, ArrowUpIcon, ActivityIcon, ChevronRightIcon, DatabaseIcon, SearchIcon } from '../components/Icons'

export default function OffboardingManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const [page, setPage] = useState(1)
  const limit = 20

  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['offboarding', statusFilter, page],
    queryFn: () => offboardingApi.list(page, limit, statusFilter || undefined),
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds
  })

  const requests = requestsData?.requests || []

  const analyzeMutation = useMutation({
    mutationFn: (requestId: string) => offboardingApi.analyze(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offboarding'] })
    }
  })

  const extractKnowledgeMutation = useMutation({
    mutationFn: (requestId: string) => offboardingApi.extractKnowledge(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offboarding'] })
    }
  })

  const completeMutation = useMutation({
    mutationFn: (requestId: string) => offboardingApi.complete(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offboarding'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    }
  })

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-9 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <div className="text-gray-500 font-bold tracking-tight text-sm">Synchronizing decommissioning data...</div>
          </div>
        </div>
      </Layout>
    )
  }

  const getStatusInfo = (status: string) => {
    const infos: Record<string, { color: 'warning' | 'primary' | 'success' | 'error', label: string }> = {
      initiated: { color: 'warning', label: 'Initiated' },
      in_progress: { color: 'primary', label: 'In Progress' },
      completed: { color: 'success', label: 'Completed' },
      cancelled: { color: 'error', label: 'Cancelled' },
    }
    return infos[status] || { color: 'warning', label: status }
  }

  return (
    <Layout user={user}>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
              <div className="w-2 h-8 bg-error-500 rounded-full" />
              Offboarding Hub
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-2 flex items-center gap-2">
              <ActivityIcon className="w-4 h-4" />
              Manage agent decommissioning, knowledge extraction and impact analysis
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-lg shadow-sm border border-gray-100">
            <div className="pl-3 flex items-center gap-2 text-sm font-bold tracking-tight text-gray-600">
              <FilterIcon className="w-3.5 h-3.5" />
              Status
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 border-none bg-blue-100/80 rounded-md focus:ring-0 w-44 font-medium text-gray-700 text-sm cursor-pointer transition-all hover:bg-gray-100"
            >
              <option value="">All Operational States</option>
              <option value="initiated">Initiated</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Requests List */}
        <MaterialCard elevation={1} className="overflow-hidden border-none">
          <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-9 rounded-lg bg-gray-900 flex items-center justify-center text-white shadow-lg shadow-gray-200">
                <ArrowUpIcon className="w-6 h-6 rotate-45" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 tracking-tight text-sm">Active Requests</h3>
                {requestsData && (
                  <p className="text-sm font-medium text-gray-700 tracking-tight mt-0.5">
                    {requests.length} of {requestsData.total || 0} Records Identified
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-0">
            {!requests || requests.length === 0 ? (
              <div className="py-32 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-6 text-gray-200 border border-gray-100">
                  <DatabaseIcon className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Zero decommissioning activity</h3>
                <p className="text-sm text-gray-600 mt-2 max-w-xs mx-auto">No offboarding requests matching your current filters were found in the archive.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {requests.map((request: OffboardingRequest) => {
                  const statusInfo = getStatusInfo(request.status)
                  return (
                    <div key={request.id} className="p-8 hover:bg-primary-50/30 transition-all group">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="flex-1 flex gap-6 items-start">
                          <div className={`w-12 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-inner border border-gray-100 ${
                            request.status === 'completed' ? 'bg-success-50 text-green-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <DatabaseIcon className="w-6 h-6" />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold tracking-tight text-gray-600">Agent Identifier</span>
                              <code className="text-sm font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-lg">{request.agent_id.substring(0, 12)}...</code>
                              <MaterialChip 
                                label={statusInfo.label} 
                                color={statusInfo.color} 
                                size="small" 
                                variant="filled" 
                                className="font-medium text-xs tracking-tight h-5"
                              />
                            </div>
                            <h4 className="text-xl font-semibold text-gray-900 leading-tight">
                              Reason: {request.reason.replace('_', ' ')}
                            </h4>
                            {request.reason_details && (
                              <p className="text-sm text-gray-500 font-medium bg-white/50 p-3 rounded-md border border-gray-100 italic">
                                "{request.reason_details}"
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm font-bold tracking-tight text-gray-600 mt-4">
                              <span className="flex items-center gap-1.5">
                                <ActivityIcon className="w-3 h-3" />
                                Created {new Date(request.created_at).toLocaleDateString()}
                              </span>
                              {request.knowledge_extractions?.length > 0 && (
                                <span className="flex items-center gap-1.5 text-green-600">
                                  <SearchIcon className="w-3 h-3" />
                                  {request.knowledge_extractions.length} Knowledge Blocks Extracted
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 lg:self-center">
                          <MaterialButton
                            variant="outlined"
                            size="small"
                            onClick={() => navigate(`/offboarding/${request.id}`)}
                            className="text-sm font-bold tracking-tight border-gray-200 text-gray-600 hover:border-gray-900 hover:text-gray-900 bg-white"
                            endIcon={<ChevronRightIcon className="w-3 h-3" />}
                          >
                            Inspection
                          </MaterialButton>
                          
                          {request.status === 'initiated' && (
                            <>
                              <MaterialButton
                                onClick={() => analyzeMutation.mutate(request.id)}
                                disabled={analyzeMutation.isPending}
                                variant="contained"
                                color="primary"
                                size="small"
                                className="text-sm font-medium tracking-tight"
                              >
                                {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Impact'}
                              </MaterialButton>
                              <MaterialButton
                                onClick={() => extractKnowledgeMutation.mutate(request.id)}
                                disabled={extractKnowledgeMutation.isPending}
                                variant="contained"
                                color="primary"
                                size="small"
                                className="text-sm font-bold tracking-tight"
                              >
                                {extractKnowledgeMutation.isPending ? 'Extracting...' : 'Extract IQ'}
                              </MaterialButton>
                            </>
                          )}
                          
                          {request.status === 'in_progress' && (
                            <MaterialButton
                              onClick={() => completeMutation.mutate(request.id)}
                              disabled={completeMutation.isPending}
                              variant="contained"
                              color="primary"
                              size="small"
                              className="text-sm font-bold tracking-tight px-6"
                            >
                              Finalize Decommission
                            </MaterialButton>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {requestsData && requestsData.total > limit && (
            <div className="p-8 border-t border-gray-50 flex items-center justify-between bg-gray-50/20">
              <div className="text-sm font-bold tracking-tight text-gray-600">
                Archive Page {page} of {Math.ceil((requestsData.total || 0) / limit)}
              </div>
              <div className="flex gap-3">
                <MaterialButton
                  variant="text"
                  size="small"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-sm font-bold tracking-tight"
                >
                  Previous
                </MaterialButton>
                <div className="w-px h-8 bg-gray-200" />
                <MaterialButton
                  variant="text"
                  size="small"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil((requestsData.total || 0) / limit)}
                  className="text-sm font-bold tracking-tight"
                >
                  Next
                </MaterialButton>
              </div>
            </div>
          )}
        </MaterialCard>
      </div>
    </Layout>
  )
}

