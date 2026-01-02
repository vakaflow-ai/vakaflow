import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Edit2, Save, RotateCcw, Network, Eye, Code } from 'lucide-react'
import { MaterialButton } from './material'
import MermaidDiagram from './MermaidDiagram'
import { 
  DiagramData, 
  DiagramNode, 
  DiagramConnection, 
  DiagramFieldConfig,
  diagramDataToMermaid,
  generateDiagramFromAgentData
} from '../lib/diagramTypes'

interface DiagramFieldInputProps {
  value: any
  onChange: (value: any) => void
  fieldType: 'architecture_diagram' | 'mermaid_diagram' | 'visualization'
  fieldConfig?: DiagramFieldConfig
  agentData?: any // For auto-generation
  placeholder?: string
  disabled?: boolean
  isReadOnly?: boolean
}

export default function DiagramFieldInput({
  value,
  onChange,
  fieldType,
  fieldConfig,
  agentData,
  placeholder = 'Configure diagram...',
  disabled = false,
  isReadOnly = false,
}: DiagramFieldInputProps) {
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editMode, setEditMode] = useState<'visual' | 'mermaid'>('visual')
  const [mermaidCode, setMermaidCode] = useState('')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  // Parse value into DiagramData
  useEffect(() => {
    if (!value) {
      // Try auto-generation if enabled
      if (fieldConfig?.auto_generate && agentData) {
        const generated = generateDiagramFromAgentData(agentData, fieldConfig)
        setDiagramData(generated)
        onChange(generated)
        return
      }
      setDiagramData(null)
      return
    }

    // If value is already DiagramData structure
    if (typeof value === 'object' && value.nodes && value.connections) {
      setDiagramData(value as DiagramData)
      if (value.mermaid_code) {
        setMermaidCode(value.mermaid_code)
      } else {
        setMermaidCode(diagramDataToMermaid(value as DiagramData))
      }
      return
    }

    // If value is Mermaid string (backward compatibility)
    if (typeof value === 'string') {
      setMermaidCode(value)
      // Try to parse or create basic structure
      setDiagramData({
        type: fieldType === 'mermaid_diagram' ? 'mermaid' : 'architecture',
        nodes: [],
        connections: [],
        mermaid_code: value,
      })
      return
    }

    setDiagramData(null)
  }, [value, fieldConfig, agentData, fieldType])

  // Auto-generate on mount if enabled
  useEffect(() => {
    if (fieldConfig?.auto_generate && agentData && !value) {
      const generated = generateDiagramFromAgentData(agentData, fieldConfig)
      setDiagramData(generated)
      onChange(generated)
    }
  }, [fieldConfig?.auto_generate, agentData])

  const handleSave = () => {
    if (editMode === 'mermaid') {
      // Save as Mermaid code
      const data: DiagramData = {
        type: fieldType === 'mermaid_diagram' ? 'mermaid' : 'architecture',
        nodes: diagramData?.nodes || [],
        connections: diagramData?.connections || [],
        mermaid_code: mermaidCode,
      }
      onChange(data)
    } else {
      // Save visual editor data
      onChange(diagramData)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    // Reset to original value
    if (value) {
      if (typeof value === 'object' && value.nodes) {
        setDiagramData(value as DiagramData)
      } else if (typeof value === 'string') {
        setMermaidCode(value)
      }
    }
    setIsEditing(false)
  }

  const handleRegenerate = () => {
    if (fieldConfig?.auto_generate && agentData) {
      const generated = generateDiagramFromAgentData(agentData, fieldConfig)
      setDiagramData(generated)
      onChange(generated)
    }
  }

  const handleAddNode = () => {
    if (!diagramData) {
      setDiagramData({
        type: fieldType === 'mermaid_diagram' ? 'mermaid' : 'architecture',
        nodes: [],
        connections: [],
      })
      return
    }
    const newNode: DiagramNode = {
      id: `node_${Date.now()}`,
      label: 'New Node',
      type: 'custom',
      icon: '🔗',
    }
    setDiagramData({
      ...diagramData,
      nodes: [...diagramData.nodes, newNode],
    })
  }

  const handleRemoveNode = (nodeId: string) => {
    if (!diagramData) return
    setDiagramData({
      ...diagramData,
      nodes: diagramData.nodes.filter(n => n.id !== nodeId),
      connections: diagramData.connections.filter(c => c.source !== nodeId && c.target !== nodeId),
    })
  }

  const handleUpdateNode = (nodeId: string, updates: Partial<DiagramNode>) => {
    if (!diagramData) return
    setDiagramData({
      ...diagramData,
      nodes: diagramData.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
    })
  }

  const handleAddConnection = () => {
    if (!diagramData || diagramData.nodes.length < 2) return
    const newConnection: DiagramConnection = {
      id: `conn_${Date.now()}`,
      source: diagramData.nodes[0].id,
      target: diagramData.nodes[1]?.id || diagramData.nodes[0].id,
      direction: 'bidirectional',
    }
    setDiagramData({
      ...diagramData,
      connections: [...diagramData.connections, newConnection],
    })
  }

  const handleRemoveConnection = (connId: string) => {
    if (!diagramData) return
    setDiagramData({
      ...diagramData,
      connections: diagramData.connections.filter(c => c.id !== connId),
    })
  }

  // Get Mermaid code for display
  const displayMermaid = useMemo(() => {
    if (diagramData?.mermaid_code) {
      return diagramData.mermaid_code
    }
    if (diagramData) {
      return diagramDataToMermaid(diagramData)
    }
    return mermaidCode || ''
  }, [diagramData, mermaidCode])

  if (isReadOnly) {
    return (
      <div className="space-y-2">
        {displayMermaid ? (
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <MermaidDiagram diagram={displayMermaid} id={`diagram-${fieldType}`} />
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-400">
            <Network className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No diagram available</p>
          </div>
        )}
      </div>
    )
  }

  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            {fieldType === 'architecture_diagram' ? 'Architecture Diagram' : 
             fieldType === 'mermaid_diagram' ? 'Mermaid Diagram' : 'Visualization'}
          </label>
          <div className="flex gap-2">
            {fieldConfig?.auto_generate && agentData && (
              <MaterialButton
                type="button"
                variant="outlined"
                size="small"
                onClick={handleRegenerate}
                disabled={disabled}
                title="Regenerate from agent data"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Regenerate
              </MaterialButton>
            )}
            {fieldConfig?.allow_manual_edit !== false && (
              <MaterialButton
                type="button"
                variant="outlined"
                size="small"
                onClick={() => setIsEditing(true)}
                disabled={disabled}
              >
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </MaterialButton>
            )}
          </div>
        </div>
        {displayMermaid ? (
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <MermaidDiagram diagram={displayMermaid} id={`diagram-${fieldType}`} />
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
            <Network className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm mb-2">No diagram configured</p>
            {fieldConfig?.auto_generate && agentData ? (
              <MaterialButton
                type="button"
                variant="outlined"
                size="small"
                onClick={handleRegenerate}
                disabled={disabled}
              >
                Generate Diagram
              </MaterialButton>
            ) : (
              <MaterialButton
                type="button"
                variant="outlined"
                size="small"
                onClick={() => setIsEditing(true)}
                disabled={disabled}
              >
                Create Diagram
              </MaterialButton>
            )}
          </div>
        )}
      </div>
    )
  }

  // Editing mode
  return (
    <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <MaterialButton
            type="button"
            variant={editMode === 'visual' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setEditMode('visual')}
          >
            <Eye className="w-3 h-3 mr-1" />
            Visual Editor
          </MaterialButton>
          {fieldConfig?.allow_mermaid_edit !== false && (
            <MaterialButton
              type="button"
              variant={editMode === 'mermaid' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setEditMode('mermaid')}
            >
              <Code className="w-3 h-3 mr-1" />
              Mermaid Code
            </MaterialButton>
          )}
        </div>
        <div className="flex gap-2">
          <MaterialButton
            type="button"
            variant="outlined"
            size="small"
            onClick={handleCancel}
          >
            Cancel
          </MaterialButton>
          <MaterialButton
            type="button"
            variant="contained"
            size="small"
            onClick={handleSave}
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </MaterialButton>
        </div>
      </div>

      {editMode === 'mermaid' ? (
        <div className="space-y-2">
          <textarea
            value={mermaidCode}
            onChange={(e) => setMermaidCode(e.target.value)}
            className="w-full min-h-[300px] p-3 border border-gray-300 rounded font-mono text-sm"
            placeholder="Enter Mermaid diagram code...&#10;Example:&#10;graph LR&#10;    A[Node A] --> B[Node B]"
          />
          {mermaidCode && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
              <MermaidDiagram diagram={mermaidCode} id={`diagram-preview-${fieldType}`} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Visual Editor */}
          <div className="grid grid-cols-2 gap-4">
            {/* Nodes Panel */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Nodes</h4>
                <MaterialButton
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={handleAddNode}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Node
                </MaterialButton>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {diagramData?.nodes.map(node => (
                  <div
                    key={node.id}
                    className={`p-2 border rounded cursor-pointer transition-colors ${
                      selectedNode === node.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedNode(node.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={node.label}
                          onChange={(e) => handleUpdateNode(node.id, { label: e.target.value })}
                          className="w-full text-sm font-medium border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                          placeholder="Node label"
                        />
                        <select
                          value={node.type}
                          onChange={(e) => handleUpdateNode(node.id, { type: e.target.value as any })}
                          className="w-full text-xs mt-1 border border-gray-200 rounded px-2 py-1"
                        >
                          <option value="agent">Agent</option>
                          <option value="system">System</option>
                          <option value="database">Database</option>
                          <option value="api">API</option>
                          <option value="service">Service</option>
                          <option value="user">User</option>
                          <option value="gateway">Gateway</option>
                          <option value="storage">Storage</option>
                          <option value="network">Network</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      <MaterialButton
                        type="button"
                        variant="text"
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveNode(node.id)
                        }}
                      >
                        <X className="w-3 h-3" />
                      </MaterialButton>
                    </div>
                  </div>
                ))}
                {(!diagramData || diagramData.nodes.length === 0) && (
                  <p className="text-xs text-gray-400 text-center py-4">No nodes. Click "Add Node" to create one.</p>
                )}
              </div>
            </div>

            {/* Connections Panel */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Connections</h4>
                <MaterialButton
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={handleAddConnection}
                  disabled={!diagramData || diagramData.nodes.length < 2}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Connection
                </MaterialButton>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {diagramData?.connections.map(conn => {
                  const sourceNode = diagramData.nodes.find(n => n.id === conn.source)
                  const targetNode = diagramData.nodes.find(n => n.id === conn.target)
                  return (
                    <div
                      key={conn.id}
                      className="p-2 border border-gray-200 rounded"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs">
                          <span className="font-medium">{sourceNode?.label || conn.source}</span>
                          {' → '}
                          <span className="font-medium">{targetNode?.label || conn.target}</span>
                        </div>
                        <MaterialButton
                          type="button"
                          variant="text"
                          size="small"
                          color="error"
                          onClick={() => handleRemoveConnection(conn.id)}
                        >
                          <X className="w-3 h-3" />
                        </MaterialButton>
                      </div>
                      <input
                        type="text"
                        value={conn.label || ''}
                        onChange={(e) => {
                          if (!diagramData) return
                          setDiagramData({
                            ...diagramData,
                            connections: diagramData.connections.map(c =>
                              c.id === conn.id ? { ...c, label: e.target.value } : c
                            ),
                          })
                        }}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                        placeholder="Connection label"
                      />
                      <select
                        value={conn.direction}
                        onChange={(e) => {
                          if (!diagramData) return
                          setDiagramData({
                            ...diagramData,
                            connections: diagramData.connections.map(c =>
                              c.id === conn.id ? { ...c, direction: e.target.value as any } : c
                            ),
                          })
                        }}
                        className="w-full text-xs mt-1 border border-gray-200 rounded px-2 py-1"
                      >
                        <option value="bidirectional">Bidirectional</option>
                        <option value="inbound">Inbound</option>
                        <option value="outbound">Outbound</option>
                      </select>
                    </div>
                  )
                })}
                {(!diagramData || diagramData.connections.length === 0) && (
                  <p className="text-xs text-gray-400 text-center py-4">
                    {diagramData && diagramData.nodes.length < 2
                      ? 'Add at least 2 nodes to create connections'
                      : 'No connections. Click "Add Connection" to create one.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          {diagramData && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
              <MermaidDiagram diagram={diagramDataToMermaid(diagramData)} id={`diagram-preview-${fieldType}`} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

