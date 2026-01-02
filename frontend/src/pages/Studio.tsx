import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { studioApi, StudioAgent, AgenticFlow, AgenticFlowCreate } from '../lib/studio'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import FlowBuilder from '../components/FlowBuilder'
import BusinessFlowBuilder from '../components/BusinessFlowBuilder'
import AgentExecutionModal from '../components/AgentExecutionModal'
import FlowDetailsModal from '../components/FlowDetailsModal'
import FlowExecutionMonitor from '../components/FlowExecutionMonitor'
import AgentSettingsModal, { AgentUpdate } from '../components/AgentSettingsModal'
import FlowSettingsModal, { FlowUpdate } from '../components/FlowSettingsModal'
import { showToast } from '../utils/toast'

export default function Studio() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [selectedTab, setSelectedTab] = useState<'agents' | 'flows'>('agents')
  const [selectedAgent, setSelectedAgent] = useState<StudioAgent | null>(null)
  const [showFlowBuilder, setShowFlowBuilder] = useState(false)
  const [showBusinessFlowBuilder, setShowBusinessFlowBuilder] = useState(false)
  const [editingFlow, setEditingFlow] = useState<AgenticFlow | null>(null)
  const [showAgentExecution, setShowAgentExecution] = useState(false)
  const [executingAgent, setExecutingAgent] = useState<StudioAgent | null>(null)
  const [showFlowDetails, setShowFlowDetails] = useState(false)
  const [viewingFlow, setViewingFlow] = useState<AgenticFlow | null>(null)
  const [showExecutionMonitor, setShowExecutionMonitor] = useState(false)
  const [monitoringFlowId, setMonitoringFlowId] = useState<string | null>(null)
  const [showAgentSettings, setShowAgentSettings] = useState(false)
  const [editingAgent, setEditingAgent] = useState<StudioAgent | null>(null)
  const [showFlowSettings, setShowFlowSettings] = useState(false)
  const [editingFlowSettings, setEditingFlowSettings] = useState<AgenticFlow | null>(null)
  const queryClient = useQueryClient()

  // Fetch user
  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Fetch agents
  const { data: agents, isLoading: agentsLoading, error: agentsError } = useQuery({
    queryKey: ['studio-agents'],
    queryFn: () => studioApi.getAgents(),
    retry: 1
  })

  // Fetch flows
  const { data: flows, isLoading: flowsLoading, error: flowsError } = useQuery({
    queryKey: ['studio-flows'],
    queryFn: () => studioApi.listFlows(),
    retry: 1
  })

  // Create flow mutation
  const createFlowMutation = useMutation({
    mutationFn: (flowData: AgenticFlowCreate) => studioApi.createFlow(flowData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-flows'] })
      setShowFlowBuilder(false)
      setEditingFlow(null)
    },
    onError: (error: any) => {
      alert(`Failed to create flow: ${error.message || 'Unknown error'}`)
    }
  })

  // Execute flow mutation
  const executeFlowMutation = useMutation({
    mutationFn: ({ flowId, contextId, contextType, triggerData }: {
      flowId: string
      contextId?: string
      contextType?: string
      triggerData?: Record<string, any>
    }) => studioApi.executeFlow(flowId, {
      context_id: contextId,
      context_type: contextType,
      trigger_data: triggerData
    }),
    onSuccess: (data) => {
      showToast.success(`Flow execution started! Execution ID: ${data.execution_id}`)
    },
    onError: (error: any) => {
      showToast.error(`Failed to execute flow: ${error.message || 'Unknown error'}`)
    }
  })

  const handleCreateFlow = async (flowData: AgenticFlowCreate) => {
    await createFlowMutation.mutateAsync(flowData)
  }

  // Execute agent skill mutation
  const executeAgentMutation = useMutation({
    mutationFn: ({ agentId, source, skill, inputData, mcpConnectionId }: {
      agentId: string
      source: string
      skill: string
      inputData: Record<string, any>
      mcpConnectionId?: string
    }) => studioApi.executeAgent(agentId, source, skill, inputData, mcpConnectionId),
    onSuccess: (data) => {
      // Check for TPRM-specific messages
      // API returns: {success: true, result: {...}}
      const result = data?.result || data
      
      // Check if TPRM assessment is required
      if (result.requires_tprm_assessment || result.warning) {
        showToast.warning(
          result.warning || 
          'TPRM assessment not found. Please create an active TPRM assessment in Assessment Management to send questionnaires.'
        )
      } else if (result.error) {
        showToast.error(result.error)
      } else if (result.email_error) {
        showToast.warning(
          `Agent executed successfully, but email was not sent: ${result.email_error}`
        )
      } else if (result.questionnaire_sent && result.email_sent) {
        showToast.success('Agent executed successfully! TPRM questionnaire sent to vendor.')
      } else if (result.questionnaire_sent && !result.email_sent) {
        showToast.warning(
          `Agent executed successfully! Questionnaire created, but email was not sent: ${result.email_error || 'Unknown error'}`
        )
      } else if (result.send_questionnaire && !result.questionnaire_sent) {
        // User requested questionnaire but it wasn't sent (likely no TPRM assessment)
        showToast.warning(
          'Agent executed successfully, but questionnaire was not sent. Please create an active TPRM assessment in Assessment Management.'
        )
      } else {
        showToast.success('Agent executed successfully!')
      }
      setShowAgentExecution(false)
      setExecutingAgent(null)
    },
    onError: (error: any) => {
      showToast.error(`Failed to execute agent: ${error.message || 'Unknown error'}`)
    }
  })

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: ({ agentId, updates }: { agentId: string; updates: AgentUpdate }) => {
      console.log('Mutation: Calling updateAgent with:', { agentId, updates })
      return studioApi.updateAgent(agentId, updates)
    },
    onSuccess: async (data) => {
      console.log('Mutation: Success, received data:', data)
      console.log('Mutation: Response includes owner_id:', data.owner_id, 'department:', data.department, 'organization:', data.organization)
      // Update the editingAgent with the fresh data from response
      if (editingAgent && editingAgent.id === data.id) {
        console.log('Mutation: Updating editingAgent with fresh data from response')
        setEditingAgent(data as StudioAgent)
      }
      // Invalidate and refetch queries to get latest data
      queryClient.invalidateQueries({ queryKey: ['studio-agents'] })
      await queryClient.refetchQueries({ queryKey: ['studio-agents'] })
      console.log('Mutation: Queries refetched successfully')
      // Close modal
      setShowAgentSettings(false)
      setEditingAgent(null)
      showToast.success('Agent settings updated successfully!')
    },
    onError: (error: any) => {
      console.error('Mutation: Error updating agent:', error)
      console.error('Mutation: Error details:', error.response?.data || error.message)
      showToast.error(`Failed to update agent: ${error.message || 'Unknown error'}`)
    }
  })

  const handleUpdateAgent = async (agentId: string, updates: AgentUpdate) => {
    await updateAgentMutation.mutateAsync({ agentId, updates })
  }

  const handleOpenAgentSettings = (agent: StudioAgent) => {
    // Use the agent from the query data if available (fresher data)
    // Otherwise use the passed agent
    const freshAgent = agents?.find(a => a.id === agent.id) || agent
    console.log('Opening agent settings:', { agentId: agent.id, freshAgent })
    setEditingAgent(freshAgent)
    setShowAgentSettings(true)
  }

  // Update flow mutation
  const updateFlowMutation = useMutation({
    mutationFn: ({ flowId, updates }: { flowId: string; updates: FlowUpdate }) =>
      studioApi.updateFlow(flowId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-flows'] })
      setShowFlowSettings(false)
      setEditingFlowSettings(null)
      showToast.success('Flow settings updated successfully!')
    },
    onError: (error: any) => {
      showToast.error(`Failed to update flow: ${error.message || 'Unknown error'}`)
    }
  })

  // Delete flow mutation
  const deleteFlowMutation = useMutation({
    mutationFn: (flowId: string) => studioApi.deleteFlow(flowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-flows'] })
      setShowFlowSettings(false)
      setEditingFlowSettings(null)
      showToast.success('Flow deleted successfully!')
    },
    onError: (error: any) => {
      showToast.error(`Failed to delete flow: ${error.message || 'Unknown error'}`)
    }
  })

  const handleUpdateFlow = async (flowId: string, updates: FlowUpdate) => {
    await updateFlowMutation.mutateAsync({ flowId, updates })
  }

  const handleDeleteFlow = async (flowId: string) => {
    await deleteFlowMutation.mutateAsync(flowId)
  }

  const handleOpenFlowSettings = (flow: AgenticFlow) => {
    setEditingFlowSettings(flow)
    setShowFlowSettings(true)
  }

  const handleExecuteFlow = (flowId: string) => {
    // Flow execution now uses context from flow configuration
    // No prompt needed - context is configured in flow settings
    executeFlowMutation.mutate({
      flowId,
      contextId: undefined, // Will use flow's configured context_id_template
      contextType: undefined, // Will use flow's configured context_type_default
      triggerData: {}
    })
  }

  const handleExecuteAgent = (agent: StudioAgent) => {
    setExecutingAgent(agent)
    setShowAgentExecution(true)
  }

  const handleAgentExecution = async (skill: string, inputData: Record<string, any>) => {
    if (!executingAgent) return
    await executeAgentMutation.mutateAsync({
      agentId: executingAgent.id,
      source: executingAgent.source,
      skill,
      inputData,
      mcpConnectionId: executingAgent.mcp_connection_id || undefined
    })
  }

  // Debug logging
  useEffect(() => {
    console.log('=== Studio Debug Info ===')
    console.log('Agents:', agents)
    console.log('Agents Loading:', agentsLoading)
    console.log('Agents Error:', agentsError)
    console.log('Flows:', flows)
    console.log('Flows Loading:', flowsLoading)
    console.log('Flows Error:', flowsError)
    
    // Test API call directly
    if (!agentsLoading && !agents) {
      console.log('Testing API call...')
      studioApi.getAgents()
        .then(data => console.log('API Response:', data))
        .catch(err => console.error('API Error:', err))
    }
  }, [agents, agentsLoading, agentsError, flows, flowsLoading, flowsError])

  return (
    <Layout user={user}>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1>VAKA Studio</h1>
            <p className="text-body text-gray-600 mt-2">
              Discover and use AI agents to build Agentic AI flows
            </p>
          </div>
          {selectedTab === 'flows' && agents && agents.length > 0 && (
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setEditingFlow(null)
                  setShowBusinessFlowBuilder(true)
                }}
                className="compact-button-primary px-4 py-2"
              >
                + Business Flow
              </button>
              <button
                onClick={() => {
                  setEditingFlow(null)
                  setShowFlowBuilder(true)
                }}
                className="compact-button-primary px-4 py-2"
              >
                + Advanced Flow
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setSelectedTab('agents')}
              className={`py-2 px-1 border-b-2 text-label ${
                selectedTab === 'agents'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Agents ({agents?.length || 0})
            </button>
            <button
              onClick={() => setSelectedTab('flows')}
              className={`py-2 px-1 border-b-2 text-label ${
                selectedTab === 'flows'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Flows ({flows?.length || 0})
            </button>
          </nav>
        </div>

        {/* Agents Tab */}
        {selectedTab === 'agents' && (
          <div>
            {agentsError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
                <p className="text-red-800 font-medium">Error loading agents</p>
                <p className="text-red-600 text-sm mt-1">
                  {agentsError instanceof Error ? agentsError.message : JSON.stringify(agentsError)}
                </p>
                <p className="text-red-500 text-xs mt-2">
                  Check browser console for details. Make sure you're logged in and have admin access.
                </p>
              </div>
            )}
            {agentsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading agents...</p>
              </div>
            ) : agents && agents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-subheading font-medium text-gray-900">
                          {agent.name}
                        </h3>
                        <p className="text-caption text-gray-500 mt-1">
                          {agent.agent_type}
                        </p>
                      </div>
                      <span
                        className={`badge-text px-2 py-1 rounded ${
                          agent.source === 'vaka'
                            ? 'bg-blue-100 text-blue-800'
                            : agent.source === 'external'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {agent.source}
                      </span>
                    </div>
                    {agent.description && (
                      <p className="text-body text-gray-600 mb-4">
                        {agent.description}
                      </p>
                    )}
                    {(agent.owner_name || agent.department || agent.organization) && (
                      <div className="text-caption text-gray-500 mb-2 space-y-1">
                        {agent.owner_name && (
                          <p>Owner: <span className="font-medium">{agent.owner_name}</span></p>
                        )}
                        {agent.department && (
                          <p>Department: <span className="font-medium">{agent.department}</span></p>
                        )}
                        {agent.organization && (
                          <p>Organization: <span className="font-medium">{agent.organization}</span></p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {agent.skills.map((skill) => (
                        <span
                          key={skill}
                          className="badge-text px-2 py-1 bg-gray-100 text-gray-700 rounded"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenAgentSettings(agent)
                        }}
                        className="compact-button-ghost flex-1"
                      >
                        Settings
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleExecuteAgent(agent)
                        }}
                        className="compact-button-primary flex-1"
                      >
                        Execute
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-2">No agents available</p>
                <p className="text-sm text-gray-500">
                  {agentsError 
                    ? "Unable to load agents. Please check your connection and permissions."
                    : "Agentic agents need to be created. Contact your administrator."}
                </p>
                {!agentsError && (
                  <button
                    onClick={() => window.location.href = '/admin'}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Go to Admin Panel
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Flows Tab */}
        {selectedTab === 'flows' && (
          <div>
            {flowsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading flows...</p>
              </div>
            ) : flows && flows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {flows.map((flow) => (
                  <div
                    key={flow.id}
                    className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-subheading font-medium text-gray-900">
                          {flow.name}
                        </h3>
                        {flow.description && (
                          <p className="text-body text-gray-600 mt-1">
                            {flow.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`badge-text px-2 py-1 rounded ${
                          flow.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : flow.status === 'draft'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {flow.status}
                      </span>
                    </div>
                    {flow.category && (
                      <p className="text-body text-gray-500 mb-4">
                        Category: {flow.category}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-body text-gray-600">
                        {flow.flow_definition.nodes.length} nodes
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenFlowSettings(flow)
                          }}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                        >
                          Settings
                        </button>
                        <button
                          onClick={() => {
                            setViewingFlow(flow)
                            setShowFlowDetails(true)
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setEditingFlow(flow)
                            setShowFlowBuilder(true)
                          }}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setMonitoringFlowId(flow.id)
                            setShowExecutionMonitor(true)
                          }}
                          className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                        >
                          Monitor
                        </button>
                        <button
                          onClick={() => handleExecuteFlow(flow.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                          disabled={executeFlowMutation.isPending}
                        >
                          {executeFlowMutation.isPending ? 'Executing...' : 'Execute'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">No flows created yet</p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => {
                      setEditingFlow(null)
                      setShowBusinessFlowBuilder(true)
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Create Business Flow
                  </button>
                  <button
                    onClick={() => {
                      setEditingFlow(null)
                      setShowFlowBuilder(true)
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create Advanced Flow
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Business Flow: Simple form-based flow builder<br />
                  Advanced Flow: Full control with JSON configuration
                </p>
              </div>
            )}
          </div>
        )}

        {/* Business Flow Builder Modal */}
        {showBusinessFlowBuilder && (
          <BusinessFlowBuilder
            onSave={handleCreateFlow}
            onCancel={() => {
              setShowBusinessFlowBuilder(false)
              setEditingFlow(null)
            }}
            initialFlow={editingFlow ? {
              name: editingFlow.name,
              description: editingFlow.description,
              category: editingFlow.category,
              flow_definition: editingFlow.flow_definition,
              tags: editingFlow.tags,
              is_template: editingFlow.is_template
            } : undefined}
          />
        )}

        {/* Advanced Flow Builder Modal */}
        {showFlowBuilder && agents && (
          <FlowBuilder
            agents={agents}
            onSave={handleCreateFlow}
            onCancel={() => {
              setShowFlowBuilder(false)
              setEditingFlow(null)
            }}
            initialFlow={editingFlow ? {
              name: editingFlow.name,
              description: editingFlow.description,
              category: editingFlow.category,
              flow_definition: editingFlow.flow_definition,
              tags: editingFlow.tags,
              is_template: editingFlow.is_template
            } : undefined}
          />
        )}

        {/* Agent Execution Modal */}
        {showAgentExecution && executingAgent && (
          <AgentExecutionModal
            agent={executingAgent}
            onExecute={handleAgentExecution}
            onCancel={() => {
              setShowAgentExecution(false)
              setExecutingAgent(null)
            }}
          />
        )}

        {/* Flow Details Modal */}
        {showFlowDetails && viewingFlow && (
          <FlowDetailsModal
            flow={viewingFlow}
            onClose={() => {
              setShowFlowDetails(false)
              setViewingFlow(null)
            }}
            onEdit={() => {
              setEditingFlow(viewingFlow)
              setShowFlowDetails(false)
              setShowFlowBuilder(true)
            }}
            onExecute={() => {
              setShowFlowDetails(false)
              handleExecuteFlow(viewingFlow.id)
            }}
          />
        )}

        {/* Flow Execution Monitor */}
        {showExecutionMonitor && monitoringFlowId && (
          <FlowExecutionMonitor
            flowId={monitoringFlowId}
            onClose={() => {
              setShowExecutionMonitor(false)
              setMonitoringFlowId(null)
            }}
          />
        )}

        {/* Agent Settings Modal */}
        {showAgentSettings && editingAgent && (
          <AgentSettingsModal
            agent={editingAgent}
            onClose={() => {
              setShowAgentSettings(false)
              setEditingAgent(null)
            }}
            onSave={handleUpdateAgent}
          />
        )}

        {/* Flow Settings Modal */}
        {showFlowSettings && editingFlowSettings && (
          <FlowSettingsModal
            flow={editingFlowSettings}
            onClose={() => {
              setShowFlowSettings(false)
              setEditingFlowSettings(null)
            }}
            onSave={handleUpdateFlow}
            onDelete={handleDeleteFlow}
          />
        )}
      </div>
    </Layout>
  )
}
