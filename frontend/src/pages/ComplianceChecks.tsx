import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { complianceApi } from '../lib/compliance'
import { agentsApi } from '../lib/agents'
import Layout from '../components/Layout'
import { Link } from 'react-router-dom'

export default function ComplianceChecks() {
  const navigate = useNavigate()
  const { agentId } = useParams()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(agentId || null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed' | 'pending'>('all')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list(1, 100),
    enabled: !!user
  })

  const { data: complianceData, isLoading } = useQuery({
    queryKey: ['compliance', selectedAgentId],
    queryFn: () => complianceApi.getChecks(selectedAgentId!),
    enabled: !!selectedAgentId
  })

  const runComplianceCheck = useMutation({
    mutationFn: (agentId: string) => complianceApi.checkAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance', selectedAgentId] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    }
  })

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      passed: 'status-badge-success',
      failed: 'status-badge-error',
      pending: 'status-badge-warning',
      warning: 'status-badge-warning',
    }
    return badges[status] || 'status-badge'
  }

  const filteredChecks = complianceData?.checks.filter((check: any) => {
    if (filterStatus === 'all') return true
    return check.status === filterStatus
  }) || []

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1>Compliance Checks</h1>
            <p className="text-body text-muted-foreground">
              View and manage compliance checks for agents
            </p>
          </div>
          {selectedAgentId && (
            <button
              onClick={() => runComplianceCheck.mutate(selectedAgentId)}
              disabled={runComplianceCheck.isPending}
              className="compact-button-primary"
            >
              {runComplianceCheck.isPending ? 'Running...' : 'Run Compliance Check'}
            </button>
          )}
        </div>

        {/* Agent Selector */}
        <div className="compact-card">
          <label className="block text-label mb-2">Select Agent</label>
          <select
            className="compact-input w-full"
            value={selectedAgentId || ''}
            onChange={(e) => setSelectedAgentId(e.target.value || null)}
          >
            <option value="">-- Select an agent --</option>
            {agents?.agents?.filter((a: any) => a.status !== 'draft').map((agent: any) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.status})
              </option>
            ))}
          </select>
        </div>

        {selectedAgentId && (
          <>
            {/* Filters */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`compact-button-secondary ${filterStatus === 'all' ? 'bg-primary text-white' : ''}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('passed')}
                className={`compact-button-secondary ${filterStatus === 'passed' ? 'bg-green-600 text-white' : ''}`}
              >
                Passed
              </button>
              <button
                onClick={() => setFilterStatus('failed')}
                className={`compact-button-secondary ${filterStatus === 'failed' ? 'bg-red-600 text-white' : ''}`}
              >
                Failed
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`compact-button-secondary ${filterStatus === 'pending' ? 'bg-yellow-600 text-white' : ''}`}
              >
                Pending
              </button>
            </div>

            {/* Compliance Checks */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading compliance checks...</div>
            ) : filteredChecks.length === 0 ? (
              <div className="compact-card text-center py-8">
                <div className="text-muted-foreground mb-4">
                  {complianceData?.checks.length === 0 
                    ? 'No compliance checks yet. Run a compliance check to get started.'
                    : 'No checks match the selected filter.'}
                </div>
                {complianceData?.checks.length === 0 && (
                  <button
                    onClick={() => runComplianceCheck.mutate(selectedAgentId)}
                    disabled={runComplianceCheck.isPending}
                    className="compact-button-primary"
                  >
                    Run Compliance Check
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredChecks.map((check: any) => (
                  <div key={check.id} className="compact-card-elevated">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-subheading font-medium">{check.policy_name || 'Compliance Check'}</h3>
                          <span className={`status-badge ${getStatusBadge(check.status)}`}>
                            {check.status}
                          </span>
                        </div>
                        {check.policy_description && (
                          <p className="text-body text-muted-foreground mb-2">{check.policy_description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 text-caption">
                          {check.policy_category && (
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                              Category: {check.policy_category}
                            </span>
                          )}
                          {check.policy_type && (
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                              Type: {check.policy_type}
                            </span>
                          )}
                          {check.policy_region && (
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                              Region: {check.policy_region}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Policy Rules */}
                    {check.policy_rules && check.policy_rules.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-label mb-2">Policy Rules:</h4>
                        <ul className="space-y-1">
                          {check.policy_rules.map((rule: any, idx: number) => (
                            <li key={idx} className="text-body text-muted-foreground flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              <span>{typeof rule === 'string' ? rule : rule.description || JSON.stringify(rule)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Gap Description */}
                    {check.gap_description && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <h4 className="text-label text-yellow-800 mb-1">Gap Identified:</h4>
                        <p className="text-body text-yellow-700">{check.gap_description}</p>
                      </div>
                    )}

                    {/* Details */}
                    {check.details && (
                      <div className="mb-4">
                        <h4 className="text-label mb-2">Details:</h4>
                        <div className="text-body text-muted-foreground whitespace-pre-wrap">
                          {typeof check.details === 'string' ? check.details : JSON.stringify(check.details, null, 2)}
                        </div>
                      </div>
                    )}

                    {/* Requirements */}
                    {check.policy_requirements && check.policy_requirements.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-label mb-2">Requirements:</h4>
                        <ul className="space-y-1">
                          {check.policy_requirements.map((req: any, idx: number) => (
                            <li key={idx} className="text-body text-muted-foreground flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              <span>{typeof req === 'string' ? req : req.description || JSON.stringify(req)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-caption text-muted-foreground">
                        Checked: {check.checked_at ? new Date(check.checked_at).toLocaleString() : 'N/A'}
                      </div>
                      <Link
                        to={`/agents/${selectedAgentId}`}
                        className="text-body text-primary hover:underline"
                      >
                        View Agent Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!selectedAgentId && (
          <div className="compact-card text-center py-12">
            <div className="text-muted-foreground mb-4">
              Select an agent to view compliance checks
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

