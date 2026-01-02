import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { studioApi } from '../lib/studio'
import BusinessRulesIndicator from './BusinessRulesIndicator'

interface FlowExecutionMonitorProps {
  flowId: string
  executionId?: string
  onClose?: () => void
}

export default function FlowExecutionMonitor({ flowId, executionId, onClose }: FlowExecutionMonitorProps) {
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(executionId || null)
  const [pollingEnabled, setPollingEnabled] = useState(true)
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Fetch executions list
  const { data: executions, isLoading: executionsLoading } = useQuery({
    queryKey: ['flow-executions', flowId, statusFilter],
    queryFn: () => studioApi.getFlowExecutions(flowId, 50, statusFilter || undefined),
    refetchInterval: pollingEnabled ? 3000 : false  // Poll every 3 seconds if enabled
  })

  // Filter executions by search term
  const filteredExecutions = executions?.filter((exec: any) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      exec.id.toLowerCase().includes(search) ||
      exec.status.toLowerCase().includes(search) ||
      (exec.context_id && exec.context_id.toLowerCase().includes(search)) ||
      (exec.error_message && exec.error_message.toLowerCase().includes(search))
    )
  }) || []

  // Fetch selected execution details
  const { data: execution, isLoading: executionLoading } = useQuery({
    queryKey: ['execution-details', selectedExecutionId],
    queryFn: () => selectedExecutionId ? studioApi.getExecution(selectedExecutionId) : null,
    enabled: !!selectedExecutionId,
    refetchInterval: pollingEnabled && selectedExecutionId ? 2000 : false  // Poll every 2 seconds
  })

  // Auto-select first execution if none selected
  useEffect(() => {
    if (!selectedExecutionId && executions && executions.length > 0) {
      setSelectedExecutionId(executions[0].id)
    }
  }, [executions, selectedExecutionId])

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (execId: string) => studioApi.retryExecution(execId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flow-executions', flowId] })
      queryClient.invalidateQueries({ queryKey: ['execution-details'] })
      // Select the new execution
      if (data.new_execution_id) {
        setSelectedExecutionId(data.new_execution_id)
      }
    }
  })

  // Stop polling when execution is completed or failed
  useEffect(() => {
    if (execution && (execution.status === 'completed' || execution.status === 'failed')) {
      setPollingEnabled(false)
    }
  }, [execution])

  const handleRetry = () => {
    if (execution && execution.status === 'failed') {
      retryMutation.mutate(execution.id)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getNodeStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      case 'running':
        return 'text-blue-600 animate-pulse'
      case 'pending':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-2 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Flow Execution Monitor</h2>
            <p className="text-sm text-gray-600 mt-1">Real-time execution status and history</p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={pollingEnabled}
                onChange={(e) => setPollingEnabled(e.target.checked)}
                className="mr-2"
              />
              Auto-refresh
            </label>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Executions List */}
          <div className="w-80 border-r border-gray-200 overflow-y-auto flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Execution History</h3>
              
              {/* Search and Filter */}
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  placeholder="Search executions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="running">Running</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {executionsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading...</p>
                </div>
              ) : filteredExecutions && filteredExecutions.length > 0 ? (
                <div className="space-y-2">
                  {filteredExecutions.map((exec: any) => (
                    <div
                      key={exec.id}
                      onClick={() => setSelectedExecutionId(exec.id)}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedExecutionId === exec.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(exec.status)}`}>
                          {exec.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {exec.created_at ? new Date(exec.created_at).toLocaleTimeString() : 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        ID: {exec.id.substring(0, 8)}...
                      </p>
                      {exec.duration_seconds && (
                        <p className="text-xs text-gray-500 mt-1">
                          Duration: {formatDuration(exec.duration_seconds)}
                        </p>
                      )}
                      {exec.summary && (
                        <p className="text-xs text-gray-500 mt-1">
                          Nodes: {exec.summary.completed_nodes}/{exec.summary.total_nodes} completed
                          {exec.summary.failed_nodes > 0 && `, ${exec.summary.failed_nodes} failed`}
                        </p>
                      )}
                      {exec.error_message && (
                        <p className="text-xs text-red-600 mt-1 truncate" title={exec.error_message}>
                          Error: {exec.error_message.substring(0, 50)}...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-600">
                    {searchTerm || statusFilter ? 'No executions match filters' : 'No executions yet'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Execution Details */}
          <div className="flex-1 overflow-y-auto p-6">
            {executionLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading execution details...</p>
              </div>
            ) : execution ? (
              <div className="space-y-6">
                {/* Execution Overview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Status</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-block px-3 py-1 text-sm rounded ${getStatusColor(execution.status)}`}>
                          {execution.status}
                        </span>
                        {execution.status === 'failed' && (
                          <button
                            onClick={handleRetry}
                            disabled={retryMutation.isPending}
                            className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            {retryMutation.isPending ? 'Retrying...' : 'Retry'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Duration</p>
                      <p className="text-sm text-gray-900 mt-1">
                        {formatDuration(execution.duration_seconds)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Started</p>
                      <p className="text-sm text-gray-900 mt-1">
                        {execution.started_at ? new Date(execution.started_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Completed</p>
                      <p className="text-sm text-gray-900 mt-1">
                        {execution.completed_at ? new Date(execution.completed_at).toLocaleString() : 'In Progress...'}
                      </p>
                    </div>
                    {execution.current_node_id && (
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-gray-700">Current Node</p>
                        <p className="text-sm text-gray-900 mt-1 font-mono">
                          {execution.current_node_id}
                        </p>
                      </div>
                    )}
                    {execution.error_message && (
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-red-700">Error</p>
                        <p className="text-sm text-red-600 mt-1">{execution.error_message}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Node Executions */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    Node Executions ({execution.node_executions?.length || 0})
                  </h3>
                  {execution.node_executions && execution.node_executions.length > 0 ? (
                    <div className="space-y-3">
                      {execution.node_executions.map((nodeExec: any, index: number) => (
                        <div key={nodeExec.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">
                                Node {index + 1}: {nodeExec.node_id}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(nodeExec.status)}`}>
                                {nodeExec.status}
                              </span>
                            </div>
                            {nodeExec.duration_ms && (
                              <span className="text-xs text-gray-500">
                                {nodeExec.duration_ms}ms
                              </span>
                            )}
                          </div>
                          {nodeExec.skill_used && (
                            <p className="text-xs text-gray-600 mb-2">
                              Skill: <span className="font-mono">{nodeExec.skill_used}</span>
                            </p>
                          )}
                          {nodeExec.error_message && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                              <p className="text-xs text-red-800 font-medium">Error:</p>
                              <p className="text-xs text-red-600 mt-1">{nodeExec.error_message}</p>
                            </div>
                          )}
                          {nodeExec.output_data && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                                View Output
                              </summary>
                              <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                                {JSON.stringify(nodeExec.output_data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No node executions yet</p>
                    </div>
                  )}
                </div>

                {/* Business Rules Applied */}
                {execution.execution_data?.business_rules && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Business Rules Applied</h3>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-400">
                      {execution.execution_data.business_rules.executed && execution.execution_data.business_rules.executed.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-blue-900 mb-2">
                            Automatic Rules ({execution.execution_data.business_rules.executed.length})
                          </p>
                          <ul className="space-y-1">
                            {execution.execution_data.business_rules.executed.map((rule: any, idx: number) => (
                              <li key={idx} className="text-xs text-blue-800">
                                <span className="font-medium">{rule.rule_name}</span>
                                {rule.result && (
                                  <span className="ml-2 text-blue-600">
                                    → {rule.result.action}: {rule.result.message || 'Executed'}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {execution.execution_data.business_rules.suggested && execution.execution_data.business_rules.suggested.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-blue-900 mb-2">
                            Suggested Rules ({execution.execution_data.business_rules.suggested.length})
                          </p>
                          <ul className="space-y-1">
                            {execution.execution_data.business_rules.suggested.map((rule: any, idx: number) => (
                              <li key={idx} className="text-xs text-blue-800">
                                <span className="font-medium">{rule.rule_name}</span>
                                {rule.action && (
                                  <span className="ml-2 text-blue-600">
                                    → {rule.action.type}: {String(rule.action.value)}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Execution Result */}
                {execution.result && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Execution Result</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-sm overflow-x-auto">
                        {JSON.stringify(execution.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">Select an execution to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
