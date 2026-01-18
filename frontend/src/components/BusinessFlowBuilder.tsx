import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorsApi, VendorWithDetails } from '../lib/vendors'
import { agentsApi, Agent } from '../lib/agents'
import { studioApi, StudioAgent, AgenticFlowCreate } from '../lib/studio'
import StandardModal from './StandardModal'

interface BusinessFlowBuilderProps {
  onSave: (flow: AgenticFlowCreate) => Promise<void>
  onCancel: () => void
  initialFlow?: AgenticFlowCreate
}

export default function BusinessFlowBuilder({ onSave, onCancel, initialFlow }: BusinessFlowBuilderProps) {
  const [flowName, setFlowName] = useState(initialFlow?.name || '')
  const [flowDescription, setFlowDescription] = useState(initialFlow?.description || '')
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const [selectedSkills, setSelectedSkills] = useState<Array<{ agentId: string; skill: string }>>([])
  const [assessmentType, setAssessmentType] = useState<string>('tprm')
  const [includeRiskAnalysis, setIncludeRiskAnalysis] = useState(true)
  const [riskAnalysisAgentId, setRiskAnalysisAgentId] = useState<string>('')

  // Fetch vendors
  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: () => vendorsApi.list(true)
  })

  // Fetch agents for selected vendor
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents-by-vendor', selectedVendorId],
    queryFn: () => agentsApi.list(1, 100),
    enabled: !!selectedVendorId
  })

  // Fetch agentic agents (for risk analysis)
  const { data: agenticAgents, isLoading: agenticAgentsLoading } = useQuery({
    queryKey: ['studio-agents'],
    queryFn: () => studioApi.getAgents()
  })

  // Filter agents by selected vendor
  const vendorAgents = agentsData?.agents.filter(agent => agent.vendor_id === selectedVendorId) || []

  // Helper to get agent by ID
  const getAgentById = (agentId: string) => {
    return vendorAgents.find(a => a.id === agentId) || agentsData?.agents.find(a => a.id === agentId)
  }

  // Get risk analysis agent (AI GRC Agent)
  const riskAnalysisAgent = agenticAgents?.find(agent => 
    agent.agent_type === 'ai_grc' && agent.skills.includes('realtime_risk_analysis')
  )

  useEffect(() => {
    if (riskAnalysisAgent && !riskAnalysisAgentId) {
      setRiskAnalysisAgentId(riskAnalysisAgent.id)
    }
  }, [riskAnalysisAgent, riskAnalysisAgentId])

  // Get assessment agent
  const assessmentAgent = agenticAgents?.find(agent => 
    agent.agent_type === 'assessment' && agent.skills.includes('assessment')
  )

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendorId(vendorId)
    setSelectedAgentIds([])
    setSelectedSkills([])
  }

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    )
    // Remove skills for unselected agents
    setSelectedSkills(prev => prev.filter(s => s.agentId !== agentId))
  }

  const handleSelectAllAgents = () => {
    if (selectedAgentIds.length === vendorAgents.length) {
      setSelectedAgentIds([])
      setSelectedSkills([])
    } else {
      setSelectedAgentIds(vendorAgents.map(a => a.id))
    }
  }

  const handleSave = async () => {
    if (!flowName.trim()) {
      alert('Please enter a flow name')
      return
    }

    if (!selectedVendorId) {
      alert('Please select a vendor')
      return
    }

    if (selectedAgentIds.length === 0) {
      alert('Please select at least one agent')
      return
    }

    if (!assessmentAgent) {
      alert('Assessment Agent not found. Please ensure it is available in Studio.')
      return
    }

    // Build flow nodes
    const nodes: Array<{
      id: string
      name?: string
      type: string
      agent_id?: string
      skill?: string
      input?: Record<string, any>
      customAttributes?: Record<string, any>
      agenticConfig?: Record<string, any>  // Email, push, collect configuration
      position?: { x: number; y: number }
    }> = []

    const edges: Array<{ from: string; to: string; condition?: any }> = []

    let yPosition = 100
    let lastAssessmentNodeId: string | null = null

    // Create assessment node for each selected agent
    selectedAgentIds.forEach((agentId, index) => {
      const agent = getAgentById(agentId)
      const nodeId = `assessment_${agentId}`
      nodes.push({
        id: nodeId,
        name: agent 
          ? `${assessmentType.toUpperCase()} Assessment - ${agent.name}`
          : `${assessmentType.toUpperCase()} Assessment ${index + 1}`,
        type: 'agent',
        agent_id: assessmentAgent.id,
        skill: 'assessment',
        input: {
          assessment_type: assessmentType,
          agent_id: agentId,
          vendor_id: selectedVendorId
        },
        position: { x: 100, y: yPosition + index * 150 },
        customAttributes: {},
        agenticConfig: {}  // Can be configured later in Flow Builder
      })

      if (lastAssessmentNodeId) {
        edges.push({ from: lastAssessmentNodeId, to: nodeId })
      }
      lastAssessmentNodeId = nodeId
    })

    // Add risk analysis node if enabled
    // Note: realtime_risk_analysis accepts single agent_id, so we create one node per agent
    if (includeRiskAnalysis && riskAnalysisAgent) {
      selectedAgentIds.forEach((agentId, index) => {
        const agent = getAgentById(agentId)
        const riskNodeId = `risk_analysis_${agentId}`
        const assessmentNodeId = `assessment_${agentId}`
        
        nodes.push({
          id: riskNodeId,
          name: agent
            ? `Risk Analysis - ${agent.name}`
            : `Risk Analysis ${index + 1}`,
          type: 'agent',
          agent_id: riskAnalysisAgent.id,
          skill: 'realtime_risk_analysis',
          input: {
            agent_id: agentId
          },
          position: { x: 400, y: yPosition + index * 150 },
          customAttributes: {},
          agenticConfig: {}  // Can be configured later in Flow Builder
        })

        // Connect assessment to risk analysis for same agent
        edges.push({ from: assessmentNodeId, to: riskNodeId })
      })
    }

    const flow: AgenticFlowCreate = {
      name: flowName,
      description: flowDescription || `Assessment flow for vendor with ${selectedAgentIds.length} agent(s)`,
      category: 'assessment',
      flow_definition: {
        nodes,
        edges
      },
      tags: ['business-friendly', 'assessment', assessmentType],
      is_template: false
    }

    await onSave(flow)
  }

  const selectedVendor = vendors?.find(v => v.id === selectedVendorId)

  return (
    <StandardModal
      isOpen={true}
      onClose={onCancel}
      title="Create Assessment Flow"
      subtitle="Configure an assessment flow for vendors and their agents"
      size="lg"
      isSaving={false}
      onSave={handleSave}
      saveButtonText="Save Flow"
      disableSave={!flowName || !selectedVendorId || selectedAgentIds.length === 0}
    >
      <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
          {/* Flow Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Flow Information</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flow Name *
                </label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., TPRM Assessment for Vendor ABC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={1}
                  placeholder="Brief description of this assessment flow..."
                />
              </div>
            </div>
          </div>

          {/* Vendor Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Select Vendor</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor *
              </label>
              {vendorsLoading ? (
                <div className="text-sm text-gray-500">Loading vendors...</div>
              ) : (
                <select
                  value={selectedVendorId}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a vendor...</option>
                  {vendors?.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} ({vendor.agents_count || 0} agents)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedVendor && (
              <div className="p-4 bg-blue-50 border border-blue-400 rounded">
                <p className="text-sm font-medium text-blue-900">{selectedVendor.name}</p>
                {selectedVendor.description && (
                  <p className="text-xs text-blue-600 mt-1">{selectedVendor.description}</p>
                )}
                <p className="text-xs text-blue-600 mt-1">
                  {selectedVendor.agents_count || 0} agent(s) available
                </p>
              </div>
            )}
          </div>

          {/* Agent Selection */}
          {selectedVendorId && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 max-w-full overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Select Agents</h3>
                {vendorAgents.length > 0 && (
                  <button
                    onClick={handleSelectAllAgents}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {selectedAgentIds.length === vendorAgents.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {agentsLoading ? (
                <div className="text-sm text-gray-500">Loading agents...</div>
              ) : vendorAgents.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    No agents found for this vendor. Please select a different vendor or add agents first.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto overflow-x-hidden w-full max-w-full">
                  <div className="divide-y divide-gray-200 min-w-0 w-full max-w-full">
                    {vendorAgents.map((agent) => (
                      <label
                        key={agent.id}
                        className="flex items-start p-2 hover:bg-gray-50 w-full max-w-full overflow-hidden cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgentIds.includes(agent.id)}
                          onChange={() => handleAgentToggle(agent.id)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0"
                        />
                        <div className="ml-3 flex-1 min-w-0 overflow-hidden w-full">
                          <div className="flex items-start justify-between gap-2 w-full min-w-0">
                            <div className="flex-1 min-w-0 overflow-hidden w-full">
                              <p className="text-sm font-medium text-gray-900 truncate" title={agent.name}>{agent.name}</p>
                              {agent.description && (
                                <p className="text-xs text-gray-500 mt-1 truncate" title={agent.description}>{agent.description}</p>
                              )}
                              {agent.risk_score !== undefined && (
                                <p className="text-xs text-gray-600 mt-1 truncate">
                                  Risk: {agent.risk_score}%
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end flex-shrink-0 gap-1 ml-2 w-fit">
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded truncate max-w-[100px]" title={agent.type}>
                                {agent.type}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded truncate max-w-[100px] ${
                                agent.status === 'approved' 
                                  ? 'bg-green-100 text-green-800'
                                  : agent.status === 'in_review'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`} title={agent.status}>
                                {agent.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedAgentIds.length > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded max-w-full overflow-hidden">
                  <p className="text-sm text-green-800 truncate max-w-full" title={`${selectedAgentIds.length} agent(s) selected for assessment`}>
                    <strong>{selectedAgentIds.length}</strong> agent(s) selected for assessment
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Assessment Configuration */}
          {selectedAgentIds.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Assessment Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assessment Type *
                </label>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="tprm">TPRM - Third-Party Risk Management</option>
                  <option value="vendor_qualification">Vendor Qualification</option>
                  <option value="risk_assessment">Risk Assessment</option>
                  <option value="ai_vendor_qualification">AI Vendor Qualification</option>
                  <option value="security_assessment">Security Assessment</option>
                  <option value="compliance_assessment">Compliance Assessment</option>
                  <option value="custom">Custom Assessment</option>
                  <option value="general">General Assessment</option>
                </select>
              </div>
            </div>
          )}

          {/* Risk Analysis Configuration */}
          {selectedAgentIds.length > 0 && assessmentAgent && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Additional Analysis</h3>
              
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="includeRiskAnalysis"
                  checked={includeRiskAnalysis}
                  onChange={(e) => setIncludeRiskAnalysis(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="includeRiskAnalysis" className="ml-2 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Include Real-Time Risk Analysis
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automatically perform risk analysis after assessment
                  </p>
                </label>
              </div>

              {includeRiskAnalysis && !riskAnalysisAgent && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    Risk Analysis Agent (AI GRC) not available. Please ensure it is configured in Studio.
                  </p>
                </div>
              )}

              {includeRiskAnalysis && riskAnalysisAgent && (
                <div className="p-4 bg-blue-50 border border-blue-400 rounded">
                  <p className="text-sm font-medium text-blue-900">
                    Risk Analysis Agent: {riskAnalysisAgent.name}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    This agent will analyze risk for all selected agents after assessment completes
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Flow Preview */}
          {selectedAgentIds.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Flow Preview</h3>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900">Flow Steps:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-2">
                    <li>Assessment Agent performs <strong>{assessmentType}</strong> assessment on {selectedAgentIds.length} agent(s)</li>
                    {includeRiskAnalysis && riskAnalysisAgent && (
                      <li>AI GRC Agent performs real-time risk analysis</li>
                    )}
                  </ol>
                  <p className="text-xs text-gray-500 mt-3">
                    This flow will be saved and can be executed anytime. You can also use it as a template for similar assessments.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
    </StandardModal>
  )
}
