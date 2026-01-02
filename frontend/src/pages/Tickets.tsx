import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ticketsApi, TicketActivity } from '../lib/tickets'
import Layout from '../components/Layout'
import { authApi } from '../lib/auth'
import { MessageSquare, RefreshCw } from 'lucide-react'
import { showToast } from '../utils/toast'

const STAGE_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  security_review: 'Security Review',
  compliance_review: 'Compliance Review',
  technical_review: 'Technical Review',
  business_review: 'Business Review',
  approval: 'Approval',
  completed: 'Completed'
}

const STAGE_ORDER = [
  'submitted',
  'security_review',
  'compliance_review',
  'technical_review',
  'business_review',
  'approval',
  'completed'
]

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-purple-100 text-purple-800',
  pending_approval: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-800'
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  if (email) {
    return email.substring(0, 2).toUpperCase()
  }
  return '??'
}

function getAvatarColor(name?: string, email?: string): string {
  const str = name || email || ''
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-teal-500'
  ]
  const index = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[index % colors.length]
}

function TicketDetail({ ticketId }: { ticketId: string }) {
  const navigate = useNavigate()
  
  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketsApi.get(ticketId),
    enabled: !!ticketId
  })
  
  const { data: activities } = useQuery({
    queryKey: ['ticket-activities', ticketId],
    queryFn: () => ticketsApi.getActivities(ticketId),
    enabled: !!ticketId
  })
  
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-2 text-muted-foreground">Loading ticket...</p>
      </div>
    )
  }
  
  if (error || !ticket) {
    return (
      <div className="vaka-card text-center py-12">
        <p className="text-red-600 mb-4">Failed to load ticket. Please try again.</p>
        <button onClick={() => navigate('/tickets')} className="compact-button-primary">
          Back to Tickets
        </button>
      </div>
    )
  }
  
  // If agent is approved but ticket shows incomplete, use agent status
  const isAgentApproved = ticket.agent_status === 'approved'
  const effectiveStage = isAgentApproved && ticket.current_stage !== 'completed' 
    ? 'completed' 
    : ticket.current_stage
  
  const ticketStageIndex = STAGE_ORDER.indexOf(effectiveStage)
  const progressPercent = isAgentApproved 
    ? 100 
    : ((ticketStageIndex + 1) / STAGE_ORDER.length) * 100
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/tickets')}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
          >
            ← Back to Tickets
          </button>
          <div className="flex items-center gap-3">
            <h1>{ticket.ticket_number}</h1>
            <span className={`badge-text px-3 py-1 rounded-full ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>
              {ticket.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-body text-gray-600 mt-1">{ticket.title}</p>
        </div>
      </div>
      
      {/* Progress */}
      <div className="vaka-card p-6">
        <h2 className="mb-4">Approval Progress</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-body">
            <span className="text-gray-600 font-medium">{STAGE_LABELS[ticket.current_stage] || ticket.current_stage}</span>
            <span className="text-gray-600">{Math.round(progressPercent)}%</span>
          </div>
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            {STAGE_ORDER.map((stage, index) => {
              const isCompleted = index < ticketStageIndex
              const isCurrent = index === ticketStageIndex
              
              return (
                <div key={stage} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center badge-text mb-1 ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                    title={STAGE_LABELS[stage]}
                  >
                    {index + 1}
                  </div>
                  <div className="text-caption text-gray-600 text-center hidden sm:block">
                    {STAGE_LABELS[stage].split(' ')[0]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ticket Info */}
        <div className="vaka-card p-6">
          <h2 className="mb-4">Ticket Information</h2>
          <div className="space-y-3 text-body">
            <div>
              <span className="text-gray-600">Agent:</span>
              <span className="ml-2 font-medium text-gray-900">{ticket.agent_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-600">Submitted:</span>
              <span className="ml-2 font-medium text-gray-900">
                {new Date(ticket.submitted_at).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Last Updated:</span>
              <span className="ml-2 font-medium text-gray-900">
                {new Date(ticket.last_updated_at).toLocaleString()}
              </span>
            </div>
            {ticket.completed_at && (
              <div>
                <span className="text-gray-600">Completed:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {new Date(ticket.completed_at).toLocaleString()}
                </span>
              </div>
            )}
            {ticket.description && (
              <div>
                <span className="text-gray-600">Description:</span>
                <p className="mt-1 text-gray-900">{ticket.description}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* People */}
        <div className="vaka-card p-6">
          <h2 className="mb-4">People</h2>
          <div className="space-y-3 text-body">
            {ticket.submitted_by_name && (
              <div>
                <span className="text-muted-foreground">Submitted by:</span>
                <span className="ml-2 font-medium">{ticket.submitted_by_name}</span>
              </div>
            )}
            {ticket.assigned_to_name && (
              <div>
                <span className="text-muted-foreground">Assigned to:</span>
                <span className="ml-2 font-medium">{ticket.assigned_to_name}</span>
              </div>
            )}
            {ticket.approved_by_name && (
              <div>
                <span className="text-muted-foreground">Approved by:</span>
                <span className="ml-2 font-medium">{ticket.approved_by_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Activities */}
      {activities && activities.length > 0 && (
        <div className="vaka-card p-6">
          <h2 className="text-lg font-medium mb-4">Activity Log</h2>
          <div className="space-y-3">
            {activities.map((activity: TicketActivity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm border-b border-gray-200 pb-3 last:border-0">
                <div className={`${getAvatarColor(activity.user_name, activity.user_email)} w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}>
                  {getInitials(activity.user_name, activity.user_email)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{activity.user_name || 'System'}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(activity.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-foreground mt-1">{activity.description || activity.activity_type}</p>
                  {activity.old_value && activity.new_value && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Changed from <span className="font-medium">{activity.old_value}</span> to <span className="font-medium">{activity.new_value}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate(`/agents/${ticket.agent_id}`)}
          className="compact-button-primary"
        >
          View Agent Details
        </button>
      </div>
    </div>
  )
}

export default function Tickets() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const queryClient = useQueryClient()
  
  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {})
  }, [])
  
  const syncMutation = useMutation({
    mutationFn: () => ticketsApi.sync(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      showToast.success(`Synced ${data.synced_count} ticket(s) with agent approval status`)
    },
    onError: (error: any) => {
      showToast.error(`Failed to sync tickets: ${error?.response?.data?.detail || error.message}`)
    }
  })
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', page, statusFilter],
    queryFn: () => ticketsApi.list(page, 20, statusFilter || undefined),
    staleTime: 30000,
    enabled: !id // Only fetch list when not viewing detail
  })
  
  if (!user) {
    return <div>Loading...</div>
  }
  
  // Show detail view if ID is in URL
  if (id) {
    return (
      <Layout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <TicketDetail ticketId={id} />
        </div>
      </Layout>
    )
  }
  
  // Show list view
  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track agent submission progress</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Sync tickets with agent approval status"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync Tickets'}
            </button>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="compact-input text-sm"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_review">Pending Review</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
        
        {/* Tickets Table Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-muted-foreground">Loading tickets...</p>
          </div>
        ) : error ? (
          <div className="vaka-card text-center py-12">
            <p className="text-red-600">Failed to load tickets. Please try again.</p>
          </div>
        ) : data && data.tickets.length === 0 ? (
          <div className="vaka-card text-center py-12">
            <p className="text-muted-foreground">No tickets found.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-hidden">
                <table className="w-full divide-y divide-gray-200 table-fixed">
                  <thead>
                    <tr>
                      <th className="px-3 py-3 text-left table-header" style={{ width: '8%' }}>
                        Request #
                      </th>
                      <th className="px-2 py-3 text-left table-header" style={{ width: '7%' }}>
                        Sequence
                      </th>
                      <th className="px-2 py-3 text-left table-header" style={{ width: '9%' }}>
                        Type
                      </th>
                      <th className="px-3 py-3 text-left table-header" style={{ width: '10%' }}>
                        Entity Name
                      </th>
                      <th className="px-3 py-3 text-left table-header" style={{ width: '22%' }}>
                        Title
                      </th>
                      <th className="px-2 py-3 text-left table-header" style={{ width: '7%' }}>
                        Status
                      </th>
                      <th className="px-2 py-3 text-left table-header" style={{ width: '10%' }}>
                        Current Stage
                      </th>
                      <th className="px-2 py-3 text-left table-header" style={{ width: '9%' }}>
                        Assigned To
                      </th>
                      <th className="px-2 py-3 text-left table-header" style={{ width: '9%' }}>
                        Submitted
                      </th>
                      <th className="px-2 py-3 text-left table-header" style={{ width: '9%' }}>
                        Last Updated
                      </th>
                      {data?.tickets.some(t => t.completed_at) && (
                        <th className="px-2 py-3 text-left table-header" style={{ width: '9%' }}>
                          Completed
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data?.tickets.map((ticket) => {
                      // If agent is approved but ticket shows incomplete, use agent status
                      const isAgentApproved = ticket.agent_status === 'approved'
                      const effectiveStage = isAgentApproved && ticket.current_stage !== 'completed' 
                        ? 'completed' 
                        : ticket.current_stage
                      
                      const currentStageIndex = STAGE_ORDER.indexOf(effectiveStage)
                      const progressPercent = isAgentApproved 
                        ? 100 
                        : ((currentStageIndex + 1) / STAGE_ORDER.length) * 100
                      const currentStageLabel = isAgentApproved 
                        ? 'Completed' 
                        : (STAGE_LABELS[effectiveStage] || effectiveStage)
                      
                      return (
                        <tr
                          key={ticket.id}
                          className="hover:bg-gray-50 cursor-pointer bg-white transition-colors"
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                        >
                          <td className="px-3 py-3">
                            <div className="table-cell-primary truncate" title={ticket.ticket_number}>{ticket.ticket_number}</div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex flex-col">
                              <div className="table-cell-primary">
                                {currentStageIndex >= 0 ? `Step ${currentStageIndex + 1}` : '-'}
                              </div>
                              <div className="table-cell-meta mt-0.5">{Math.round(progressPercent)}%</div>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center">
                              <div className="p-1.5 rounded bg-blue-100 text-blue-600 flex-shrink-0">
                                <MessageSquare className="w-3.5 h-3.5" />
                              </div>
                              <span className="ml-1.5 table-cell-secondary truncate">Workflow</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="table-cell-primary truncate" title={ticket.agent_name || 'N/A'}>
                              {ticket.agent_name || 'N/A'}
                            </div>
                            {ticket.agent_status && (
                              <div className="table-cell-meta mt-0.5 truncate">{ticket.agent_status}</div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="table-cell-primary truncate" title={ticket.title}>
                              {ticket.title}
                            </div>
                            {ticket.description && (
                              <div className="table-cell-meta mt-0.5 line-clamp-1 truncate">
                                {ticket.description}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            {isAgentApproved && ticket.status !== 'approved' ? (
                              <span className={`inline-flex px-2 py-0.5 rounded-full badge-text ${STATUS_COLORS.approved}`} title="Agent is approved (ticket status may be stale)">
                                approved
                              </span>
                            ) : (
                              <span className={`inline-flex px-2 py-0.5 rounded-full badge-text ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>
                                {ticket.status.replace('_', ' ')}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <div className="table-cell-secondary font-medium mb-1">{currentStageLabel}</div>
                            <div className="relative w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            {ticket.assigned_to_name ? (
                              <div className="flex items-center">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0 ${getAvatarColor(ticket.assigned_to_name)}`}>
                                  {getInitials(ticket.assigned_to_name)}
                                </div>
                                <span className="ml-1.5 table-cell-secondary truncate" title={ticket.assigned_to_name}>
                                  {ticket.assigned_to_name}
                                </span>
                              </div>
                            ) : (
                              <span className="table-cell-secondary italic text-gray-600">Unassigned</span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <div className="table-cell-secondary text-gray-900">
                              {new Date(ticket.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </div>
                            <div className="table-cell-meta mt-0.5">
                              {new Date(ticket.submitted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="table-cell-secondary text-gray-900">
                              {new Date(ticket.last_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </div>
                            <div className="table-cell-meta mt-0.5">
                              {new Date(ticket.last_updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          {data.tickets.some(t => t.completed_at) && (
                            <td className="px-2 py-3">
                              <div className="table-cell-secondary text-green-600">
                                {ticket.completed_at ? new Date(ticket.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '-'}
                              </div>
                              {ticket.completed_at && (
                                <div className="table-cell-meta text-green-500 mt-0.5">
                                  {new Date(ticket.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Pagination */}
            {data && data.total > data.limit && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * data.limit + 1} to {Math.min(page * data.limit, data.total)} of {data.total} tickets
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="compact-button"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * data.limit >= data.total}
                    className="compact-button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

