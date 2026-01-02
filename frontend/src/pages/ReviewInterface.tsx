import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi } from '../lib/agents'
import { reviewsApi, ReviewCreate } from '../lib/reviews'
import { authApi } from '../lib/auth'
import { workflowStageSettingsApi } from '../lib/workflowStageSettings'
import { workflowActionsApi } from '../lib/workflowActions'
import { workflowConfigApi } from '../lib/workflowConfig'
import Layout from '../components/Layout'
import ReviewChecklist from '../components/ReviewChecklist'
import AgentDetailsView from '../components/AgentDetailsView'
import CommentsSection from '../components/CommentsSection'

export default function ReviewInterface() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [comment, setComment] = useState('')
  const [findings, setFindings] = useState<string[]>([])
  const [newFinding, setNewFinding] = useState('')
  const [ragQuery, setRagQuery] = useState('')
  const [ragResults, setRagResults] = useState<any[]>([])

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: agent, isLoading, error: agentError, isError } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.get(id!),
    enabled: !!id,
    retry: false
  })

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => reviewsApi.list(id!),
    enabled: !!id && !!agent, // Only fetch reviews if agent exists
    retry: false
  })

  // Get workflow stage settings for field filtering
  const { data: stageSettings } = useQuery({
    queryKey: ['stage-settings', id],
    queryFn: () => workflowStageSettingsApi.getForAgent(id!),
    enabled: !!id,
    retry: false
  })

  // Get onboarding request for workflow actions
  const { data: onboardingRequest } = useQuery({
    queryKey: ['onboarding-request', id],
    queryFn: () => workflowConfigApi.getOnboardingRequestByAgent(id!),
    enabled: !!id,
    retry: false
  })

  // Get workflow actions
  const { data: workflowActions } = useQuery({
    queryKey: ['workflow-actions', onboardingRequest?.id],
    queryFn: () => workflowActionsApi.getActions(onboardingRequest!.id),
    enabled: !!onboardingRequest?.id
  })

  // Get audit trail
  const { data: auditTrail } = useQuery({
    queryKey: ['audit-trail', onboardingRequest?.id],
    queryFn: () => workflowActionsApi.getAuditTrail(onboardingRequest!.id),
    enabled: !!onboardingRequest?.id
  })

  // Forward workflow mutation
  const forwardMutation = useMutation({
    mutationFn: ({ requestId, forwardedTo, comments }: { requestId: string; forwardedTo: string; comments?: string }) =>
      workflowActionsApi.forward(requestId, { forwarded_to: forwardedTo, comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-actions', onboardingRequest?.id] })
      queryClient.invalidateQueries({ queryKey: ['audit-trail', onboardingRequest?.id] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-request', id] })
    }
  })

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: ({ requestId, comments }: { requestId: string; comments: string }) =>
      workflowActionsApi.addComment(requestId, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-actions', onboardingRequest?.id] })
      queryClient.invalidateQueries({ queryKey: ['audit-trail', onboardingRequest?.id] })
    }
  })

  const [showForwardModal, setShowForwardModal] = useState(false)
  const [forwardTo, setForwardTo] = useState('')
  const [forwardComments, setForwardComments] = useState('')
  const [workflowComment, setWorkflowComment] = useState('')

  const getStageForRole = (role: string) => {
    const mapping: Record<string, string> = {
      security_reviewer: 'security',
      compliance_reviewer: 'compliance',
      technical_reviewer: 'technical',
      business_reviewer: 'business',
    }
    return mapping[role] || 'security'
  }

  const createReview = useMutation({
    mutationFn: (data: ReviewCreate) => reviewsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', id] })
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      navigate('/reviews')
    }
  })

  const queryRAG = async () => {
    if (!ragQuery.trim() || !id) return
    try {
      const results = await reviewsApi.queryRAG(id, ragQuery)
      setRagResults(Array.isArray(results.results) ? results.results : [])
    } catch (err) {
      console.error('RAG query failed:', err)
      setRagResults([])
    }
  }

  const addFinding = () => {
    if (newFinding.trim()) {
      setFindings([...findings, newFinding])
      setNewFinding('')
    }
  }

  const removeFinding = (index: number) => {
    setFindings(findings.filter((_, i) => i !== index))
  }

  const handleSubmit = (status: 'approved' | 'rejected' | 'needs_revision') => {
    if (!id) return
    createReview.mutate({
      agent_id: id,
      stage: getStageForRole(user?.role),
      status,
      comment,
      findings: findings.length > 0 ? findings : undefined
    })
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  // Handle loading state
  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading agent details...</div>
        </div>
      </Layout>
    )
  }

  // Handle 404 or agent not found - check after loading completes
  if (isError || !agent) {
    const is404 = agentError && (agentError as any)?.response?.status === 404
    return (
      <Layout user={user}>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-medium mb-2">Agent Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {is404 
              ? `The agent with ID "${id}" could not be found. It may have been deleted or the ID is incorrect.`
              : 'Unable to load agent details. Please try again later.'}
          </p>
          {agentError && !is404 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              Error: {(agentError as any)?.message || 'Unknown error occurred'}
            </div>
          )}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/reviews')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Back to Reviews
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
            >
              Go Back
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate('/reviews')}
            className="text-muted-foreground hover:text-foreground mb-4"
          >
            ← Back to Reviews
          </button>
          <h1 className="text-2xl font-medium mb-2">Review: {agent?.name || 'Unknown Agent'}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {getStageForRole(user?.role)} Review
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Review Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Complete Agent Information */}
            <AgentDetailsView 
              agent={agent} 
              showAllSections={true}
              onDiagramUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['agent', id] })
              }}
              canEditDiagram={true}
            />

            {/* RAG Query */}
            <div className="compact-card">
              <h2 className="text-lg font-medium mb-4">Knowledge Base Query</h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && queryRAG()}
                    placeholder="Ask about policies, requirements, best practices..."
                    className="flex-1 compact-input"
                  />
                  <button
                    onClick={queryRAG}
                    className="compact-button-primary"
                  >
                    Query
                  </button>
                </div>
                {ragResults.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {ragResults.map((result, idx) => (
                      <div key={idx} className="p-3 bg-muted rounded text-sm">
                        <div className="font-medium mb-1">Result {idx + 1}</div>
                        <div className="text-muted-foreground">{result.content}</div>
                        {result.score && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Relevance: {(result.score * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comments Section - for communication with vendor */}
            <CommentsSection 
              resourceType="agent" 
              resourceId={id!}
              currentUser={user}
            />

            {/* Review Checklist */}
            <ReviewChecklist stage={getStageForRole(user?.role)} />

            {/* Review Decision */}
            <div className="compact-card-elevated border-2 border-primary/20 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-2xl">📝</span>
                Review Decision
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Review Comments</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={6}
                    className="w-full compact-input"
                    placeholder="Add your review comments. These will be visible to the vendor..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Comments will be shared with the vendor for clarification or revision requests.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Findings / Issues</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newFinding}
                      onChange={(e) => setNewFinding(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addFinding()}
                      placeholder="Add a finding or issue..."
                      className="flex-1 compact-input"
                    />
                    <button
                      onClick={addFinding}
                      className="compact-button-secondary"
                    >
                      Add
                    </button>
                  </div>
                  {findings.length > 0 && (
                    <div className="space-y-1">
                      {findings.map((finding, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">{finding}</span>
                          <button
                            onClick={() => removeFinding(idx)}
                            className="text-xs text-destructive hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => handleSubmit('approved')}
                    disabled={createReview.isPending}
                    className="flex-1 py-3 px-6 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all"
                  >
                    {createReview.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span> Submitting...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        ✅ Approve
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleSubmit('needs_revision')}
                    disabled={createReview.isPending}
                    className="flex-1 py-3 px-6 rounded-lg font-medium bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    {createReview.isPending ? 'Submitting...' : '🔄 Request Revision'}
                  </button>
                  <button
                    onClick={() => handleSubmit('rejected')}
                    disabled={createReview.isPending}
                    className="flex-1 py-3 px-6 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    {createReview.isPending ? 'Submitting...' : '❌ Reject'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  <strong>Request Revision:</strong> Agent returns to draft for vendor to address comments.<br/>
                  <strong>Reject:</strong> Agent is rejected and cannot proceed further.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Review Status by Stage */}
            <div className="compact-card">
              <h2 className="text-lg font-medium mb-4">Review Status by Stage</h2>
              {reviewsData?.reviews.length === 0 ? (
                <div className="text-sm text-muted-foreground">No reviews yet</div>
              ) : (
                <div className="space-y-3">
                  {['security', 'compliance', 'technical', 'business'].map((stage) => {
                    const stageReview = reviewsData?.reviews.find((r: any) => r.stage === stage)
                    return (
                      <div key={stage} className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize text-sm">{stage} Review</span>
                          {stageReview ? (
                            <span className={`status-badge text-xs ${
                              stageReview.status === 'approved' ? 'status-badge-success' :
                              stageReview.status === 'rejected' ? 'status-badge-error' :
                              stageReview.status === 'needs_revision' ? 'status-badge-warning' :
                              'status-badge-info'
                            }`}>
                              {stageReview.status}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </div>
                        {stageReview && stageReview.comment && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {stageReview.comment}
                          </div>
                        )}
                        {stageReview && stageReview.findings && stageReview.findings.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {stageReview.findings.length} finding(s)
                          </div>
                        )}
                        {stageReview && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(stageReview.created_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Audit Trail */}
            {auditTrail && auditTrail.length > 0 && (
              <div className="compact-card">
                <h2 className="text-lg font-medium mb-4">Audit Trail</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditTrail.map((entry) => (
                    <div key={entry.id} className="p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm capitalize">{entry.action}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      {entry.step_name && (
                        <div className="text-xs text-gray-600 mb-1">
                          Step: {entry.step_name} (#{entry.step_number})
                        </div>
                      )}
                      {entry.comments && (
                        <div className="text-xs text-gray-700 mt-1">{entry.comments}</div>
                      )}
                      {entry.action_details && Object.keys(entry.action_details).length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {JSON.stringify(entry.action_details, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forward Modal */}
      {showForwardModal && onboardingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Forward Workflow</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Forward To (User Email)</label>
                <input
                  type="email"
                  value={forwardTo}
                  onChange={(e) => setForwardTo(e.target.value)}
                  className="compact-input w-full"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Comments (Optional)</label>
                <textarea
                  value={forwardComments}
                  onChange={(e) => setForwardComments(e.target.value)}
                  className="compact-input w-full"
                  rows={3}
                  placeholder="Add a note about why you're forwarding this..."
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    if (forwardTo.trim()) {
                      forwardMutation.mutate({
                        requestId: onboardingRequest.id,
                        forwardedTo: forwardTo.trim(),
                        comments: forwardComments.trim() || undefined
                      })
                      setShowForwardModal(false)
                      setForwardTo('')
                      setForwardComments('')
                    }
                  }}
                  disabled={!forwardTo.trim() || forwardMutation.isPending}
                  className="compact-button-primary flex-1"
                >
                  Forward
                </button>
                <button
                  onClick={() => {
                    setShowForwardModal(false)
                    setForwardTo('')
                    setForwardComments('')
                  }}
                  className="compact-button-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

