import { useState, useEffect } from 'react'
import { StudioAgent, AgenticFlowCreate } from '../lib/studio'
import SkillInputForm from './SkillInputForm'
import CustomAttributesEditor from './CustomAttributesEditor'
import AgenticNodeConfig, { AgenticNodeConfig as AgenticNodeConfigType } from './AgenticNodeConfig'

interface FlowBuilderProps {
  agents: StudioAgent[]
  onSave: (flow: AgenticFlowCreate) => Promise<void>
  onCancel: () => void
  initialFlow?: AgenticFlowCreate
}

export default function FlowBuilder({ agents, onSave, onCancel, initialFlow }: FlowBuilderProps) {
  const [flowName, setFlowName] = useState(initialFlow?.name || '')
  const [flowDescription, setFlowDescription] = useState(initialFlow?.description || '')
  const [flowCategory, setFlowCategory] = useState(initialFlow?.category || '')
  const [nodes, setNodes] = useState<Array<{
    id: string
    name?: string  // Business-friendly name
    type: string
    agent_id?: string
    skill?: string
    input?: Record<string, any>
    customAttributes?: Record<string, any>  // Custom user-defined attributes
    agenticConfig?: AgenticNodeConfigType  // Email, push, collect configuration
    position?: { x: number; y: number }
  }>>(() => {
    // Ensure we load name and customAttributes from initial flow
    if (initialFlow?.flow_definition.nodes) {
      return initialFlow.flow_definition.nodes.map(node => ({
        ...node,
        name: node.name || undefined,
        customAttributes: node.customAttributes || (node as any).custom_attributes || {},
        agenticConfig: node.agenticConfig || (node as any).agentic_config || {}
      }))
    }
    return []
  })
  const [edges, setEdges] = useState<Array<{
    from: string
    to: string
    condition?: any
  }>>(initialFlow?.flow_definition.edges || [])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showAddNode, setShowAddNode] = useState(false)

  const addNode = () => {
    const newNodeId = `node_${Date.now()}`
    const newNode = {
      id: newNodeId,
      name: `Node ${nodes.length + 1}`,  // Default friendly name
      type: 'agent',
      position: { x: 100 + nodes.length * 200, y: 100 },
      customAttributes: {}
    }
    setNodes([...nodes, newNode])
    setSelectedNode(newNodeId)
    setShowAddNode(true)
  }

  // Generate friendly name for node
  const getNodeDisplayName = (node: typeof nodes[0]) => {
    if (node.name) return node.name
    if (node.agent_id && node.skill) {
      const agent = agents.find(a => a.id === node.agent_id)
      return agent ? `${agent.name} - ${node.skill}` : node.id
    }
    return node.id
  }

  const removeNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId))
    setEdges(edges.filter(e => e.from !== nodeId && e.to !== nodeId))
    if (selectedNode === nodeId) {
      setSelectedNode(null)
    }
  }

  const updateNode = (nodeId: string, updates: Partial<typeof nodes[0]>) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n))
  }

  const addEdge = (from: string, to: string) => {
    if (from === to) return
    if (edges.some(e => e.from === from && e.to === to)) return
    setEdges([...edges, { from, to }])
  }

  const removeEdge = (from: string, to: string) => {
    setEdges(edges.filter(e => !(e.from === from && e.to === to)))
  }

  const handleSave = async () => {
    if (!flowName.trim()) {
      alert('Please enter a flow name')
      return
    }

    if (nodes.length === 0) {
      alert('Please add at least one node to the flow')
      return
    }

    // Ensure all node properties are included (name, customAttributes, agenticConfig, mcp_connection_id)
    const nodesWithAllProps = nodes.map(node => ({
      id: node.id,
      name: node.name || undefined,  // Include friendly name (undefined if not set)
      type: node.type,
      agent_id: node.agent_id,
      skill: node.skill,
      input: node.input || {},
      customAttributes: node.customAttributes || {},  // Include custom attributes
      agenticConfig: node.agenticConfig || {},  // Include agentic configuration
      position: node.position || { x: 0, y: 0 },
      mcp_connection_id: (node as any).mcp_connection_id || undefined
    }))

    const flow: AgenticFlowCreate = {
      name: flowName,
      description: flowDescription || undefined,
      category: flowCategory || undefined,
      flow_definition: {
        nodes: nodesWithAllProps,  // Use nodes with all properties
        edges
      },
      tags: [],
      is_template: false
    }

    await onSave(flow)
  }

  const selectedNodeData = nodes.find(n => n.id === selectedNode)
  const selectedAgent = selectedNodeData?.agent_id 
    ? agents.find(a => a.id === selectedNodeData.agent_id)
    : null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-2 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            {initialFlow ? 'Edit Flow' : 'Create New Flow'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-600 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Flow Details */}
          <div className="w-80 border-r border-gray-200 p-6 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flow Name *
                </label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., TPRM Review Flow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe what this flow does..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={flowCategory}
                  onChange={(e) => setFlowCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., tprm, assessment, i18n"
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Nodes ({nodes.length})</h3>
                  <button
                    onClick={addNode}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    + Add Node
                  </button>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {nodes.map((node) => (
                    <div
                      key={node.id}
                      className={`p-2 border rounded cursor-pointer transition-colors ${
                        selectedNode === node.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedNode(node.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {getNodeDisplayName(node)}
                          </p>
                          {node.skill && (
                            <p className="text-xs text-gray-500 truncate">{node.skill}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeNode(node.id)
                          }}
                          className="flex-shrink-0 text-red-600 hover:text-red-800"
                          title="Remove node"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Center Panel - Flow Canvas */}
          <div className="flex-1 p-6 overflow-auto bg-gray-50">
            {nodes.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 mb-4">No nodes in flow</p>
                  <button
                    onClick={addNode}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add First Node
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative" style={{ minHeight: '400px' }}>
                {/* Simple visual representation */}
                <div className="space-y-4">
                  {nodes.map((node, index) => {
                    const agent = node.agent_id ? agents.find(a => a.id === node.agent_id) : null
                    return (
                      <div key={node.id} className="relative">
                        <div
                          className={`bg-white border-2 rounded-md p-2.5 shadow-sm ${
                            selectedNode === node.id
                              ? 'border-blue-500'
                              : 'border-gray-300'
                          }`}
                          style={{
                            marginLeft: `${(node.position?.x || 0) / 10}px`,
                            marginTop: `${(node.position?.y || 0) / 10}px`
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{getNodeDisplayName(node)}</p>
                              {node.skill && (
                                <p className="text-xs text-gray-500 truncate">{node.skill}</p>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedNode(node.id)}
                              className="flex-shrink-0 text-blue-600 hover:text-blue-800 text-xs px-2 py-1"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                        {index < nodes.length - 1 && (
                          <div className="flex justify-center my-2">
                            <div className="w-0.5 h-8 bg-gray-300"></div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Node Configuration */}
          {selectedNode && selectedNodeData && (
            <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10 flex-shrink-0">
                <h3 className="text-base font-medium text-gray-900">
                  Configure Node
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2">
                <div className="space-y-4">
                {/* Node Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Node Name
                  </label>
                  <input
                    type="text"
                    value={selectedNodeData.name || ''}
                    onChange={(e) => updateNode(selectedNode, { name: e.target.value || undefined })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter a friendly name"
                  />
                  <p className="mt-0.5 text-xs text-gray-500">
                    Business-friendly name (e.g., "TPRM Assessment Step 1")
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Node Type
                  </label>
                  <select
                    value={selectedNodeData.type}
                    onChange={(e) => updateNode(selectedNode, { type: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="agent">Agent</option>
                    <option value="condition">Condition</option>
                    <option value="delay">Delay</option>
                  </select>
                </div>

                        {selectedNodeData.type === 'agent' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Select Agent
                          </label>
                          <select
                            value={selectedNodeData.agent_id || ''}
                            onChange={(e) => {
                              const agentId = e.target.value
                              const agent = agents.find(a => a.id === agentId)
                              updateNode(selectedNode, {
                                agent_id: agentId || undefined,
                                skill: undefined, // Reset skill when agent changes
                                input: undefined // Reset input when agent changes
                              })
                            }}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select an agent...</option>
                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.name} ({agent.agent_type})
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedAgent && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Select Skill
                            </label>
                            <select
                              value={selectedNodeData.skill || ''}
                              onChange={(e) => {
                                const skill = e.target.value
                                updateNode(selectedNode, { 
                                  skill: skill || undefined,
                                  input: {} // Reset input when skill changes
                                })
                              }}
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Select a skill...</option>
                              {selectedAgent.skills.map((skill) => (
                                <option key={skill} value={skill}>
                                  {skill}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {selectedAgent && selectedNodeData.skill && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Configure Input Data
                            </label>
                            <div className="text-xs text-gray-500 mb-2">
                              Attributes load based on relations. When "All Matching" is selected, individual checkboxes are hidden.
                            </div>
                            <SkillInputForm
                              skill={selectedNodeData.skill}
                              agentType={selectedAgent.agent_type}
                              value={selectedNodeData.input || {}}
                              onChange={(inputData) => {
                                updateNode(selectedNode, { input: inputData })
                              }}
                            />
                          </div>
                        )}

                        {/* Agentic Configuration (Email, Push, Collect) */}
                        {selectedNodeData.type === 'agent' && (
                          <div className="border-t border-gray-200 pt-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                              Agentic Configuration
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                              Configure email, data push, and collection
                            </p>
                            <div className="max-h-96 overflow-y-auto">
                              <AgenticNodeConfig
                                value={selectedNodeData.agenticConfig || {}}
                                onChange={(agenticConfig) => {
                                  updateNode(selectedNode, { agenticConfig })
                                }}
                                nodeInputData={selectedNodeData.input}
                              />
                            </div>
                          </div>
                        )}

                        {/* Custom Attributes */}
                        <div className="border-t border-gray-200 pt-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Custom Attributes
                          </label>
                          <CustomAttributesEditor
                            attributes={selectedNodeData.customAttributes || {}}
                            onChange={(customAttributes) => {
                              updateNode(selectedNode, { customAttributes })
                            }}
                          />
                        </div>
                      </>
                    )}

                {selectedNodeData.type === 'condition' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Condition (JSON)
                    </label>
                    <textarea
                      value={JSON.stringify(selectedNodeData.input || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const condition = JSON.parse(e.target.value)
                          updateNode(selectedNode, { input: condition })
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                      rows={6}
                      placeholder='{"type": "equals", "field": "node1.risk_level", "value": "HIGH"}'
                    />
                  </div>
                )}

                {selectedNodeData.type === 'delay' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delay (seconds)
                    </label>
                    <input
                      type="number"
                      value={selectedNodeData.input?.delay_seconds || 0}
                      onChange={(e) => updateNode(selectedNode, {
                        input: { delay_seconds: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {initialFlow ? 'Update Flow' : 'Create Flow'}
          </button>
        </div>
      </div>
    </div>
  )
}
