import React, { useMemo, useCallback, memo, useState, useRef, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

export interface EcosystemNode {
  id: string
  name: string
  type: 'vendor' | 'tenant' | 'agent' | 'connection' | 'other'
  attributes?: {
    [key: string]: any
  }
  [key: string]: any
}

export interface EcosystemLink {
  source: string | EcosystemNode
  target: string | EcosystemNode
  type?: string
  attributes?: {
    [key: string]: any
  }
}

export interface EcosystemMapProps {
  nodes: EcosystemNode[]
  links: EcosystemLink[]
  onNodeClick?: (node: EcosystemNode) => void
  onNodeHover?: (node: EcosystemNode | null) => void
  onLinkClick?: (link: EcosystemLink) => void
  height?: number
  width?: number
  showFilters?: boolean
  onRefresh?: () => void
}

// Node type colors matching the image
const NODE_COLORS: Record<string, string> = {
  vendor: '#f59e0b',      // orange
  tenant: '#8b5cf6',      // purple
  agent: '#3b82f6',       // blue
  connection: '#ef4444',  // red
  other: '#6b7280'        // gray
}

const EcosystemMap: React.FC<EcosystemMapProps> = ({
  nodes: initialNodes,
  links: initialLinks,
  onNodeClick,
  onNodeHover,
  onLinkClick,
  height = 600,
  width = 1000,
  showFilters = true,
  onRefresh
}) => {
  const [loadFilters, setLoadFilters] = useState({
    C: true,  // Connections
    V: true,  // Vendors
    A: true,  // Agents
    L: true,  // Links/Relationships
    S: true   // Services/Other
  })
  const [centerType, setCenterType] = useState<string>('vendor')
  const [hoveredNode, setHoveredNode] = useState<EcosystemNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<EcosystemNode | null>(null)
  const graphRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width, height })

  // Update dimensions on resize - debounced to avoid excessive updates
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const updateDimensions = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.offsetWidth || width,
            height: containerRef.current.offsetHeight || height
          })
        }
      }, 150)
    }

    updateDimensions()
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }
    return () => {
      resizeObserver.disconnect()
      clearTimeout(timeoutId)
    }
  }, [width, height])

  // Filter nodes and links based on load filters - memoized to avoid recalculation
  const { filteredNodes, filteredLinks } = useMemo(() => {
    const nodeTypeMap: Record<string, string> = {
      vendor: 'V',
      tenant: 'S',
      agent: 'A',
      connection: 'C',
      other: 'S'
    }

    const filteredNodes = initialNodes.filter(node => {
      const filterKey = nodeTypeMap[node.type] || 'S'
      return loadFilters[filterKey as keyof typeof loadFilters]
    })

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredLinks = initialLinks.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId)
    })

    return { filteredNodes, filteredLinks }
  }, [initialNodes, initialLinks, loadFilters])

  // Center graph on selected type - memoized
  const centeredGraphData = useMemo(() => {
    if (!centerType || filteredNodes.length === 0) {
      return { nodes: filteredNodes, links: filteredLinks }
    }

    // Find center node of the selected type
    const centerNode = filteredNodes.find(n => n.type === centerType)
    if (!centerNode) {
      return { nodes: filteredNodes, links: filteredLinks }
    }

    // Set center node position
    const nodesWithCenter = filteredNodes.map(node => ({
      ...node,
      fx: node.id === centerNode.id ? dimensions.width / 2 : undefined,
      fy: node.id === centerNode.id ? dimensions.height / 2 : undefined
    }))

    return { nodes: nodesWithCenter, links: filteredLinks }
  }, [filteredNodes, filteredLinks, centerType, dimensions])

  // Handle node click
  const handleNodeClick = useCallback((node: EcosystemNode) => {
    setSelectedNode(node)
    onNodeClick?.(node)
  }, [onNodeClick])

  // Handle node hover
  const handleNodeHover = useCallback((node: EcosystemNode | null) => {
    setHoveredNode(node)
    onNodeHover?.(node)
  }, [onNodeHover])

  // Reset view - memoized to prevent recreation
  const handleResetView = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 20)
      graphRef.current.centerAt(0, 0, 1000)
    }
    setSelectedNode(null)
    setHoveredNode(null)
  }, [])

  // Refresh data - memoized
  const handleRefresh = useCallback(() => {
    onRefresh?.()
    handleResetView()
  }, [onRefresh, handleResetView])

  // Node color function - memoized
  const getNodeColor = useCallback((node: EcosystemNode) => {
    if (selectedNode?.id === node.id) return '#10b981' // green for selected
    if (hoveredNode?.id === node.id) return '#fbbf24' // amber for hovered
    return NODE_COLORS[node.type] || NODE_COLORS.other
  }, [selectedNode, hoveredNode])

  // Node size function - memoized
  const getNodeSize = useCallback((node: EcosystemNode) => {
    const baseSize = 8
    if (selectedNode?.id === node.id) return baseSize * 1.5
    if (hoveredNode?.id === node.id) return baseSize * 1.3
    return baseSize
  }, [selectedNode, hoveredNode])

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Controls */}
      {showFilters && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-6">
            {/* Load Filters */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Load:</span>
              {(['C', 'V', 'A', 'L', 'S'] as const).map(key => (
                <label key={key} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loadFilters[key]}
                    onChange={(e) => {
                      setLoadFilters(prev => ({ ...prev, [key]: e.target.checked }))
                    }}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{key}</span>
                </label>
              ))}
            </div>

            {/* Center Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Center:</label>
              <select
                value={centerType}
                onChange={(e) => setCenterType(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="vendor">Vendor</option>
                <option value="tenant">Tenant</option>
                <option value="agent">Agent</option>
                <option value="connection">Connection</option>
                <option value="">None</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetView}
              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset View
            </button>
            {onRefresh && (
              <button
                onClick={handleRefresh}
                className="px-4 py-1.5 text-sm text-white bg-purple-600 rounded hover:bg-purple-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            )}
          </div>
        </div>
      )}

      {/* Visualization Area */}
      <div
        ref={containerRef}
        className="flex-1 relative border border-gray-300"
        style={{ minHeight: height }}
      >
        {centeredGraphData.nodes.length > 0 ? (
          <ForceGraph2D
            {...({
            ref: graphRef,
            graphData: centeredGraphData,
            nodeLabel: (node: any) => {
              const n = node as EcosystemNode
              return `${n.name}\nType: ${n.type}\n${n.attributes ? Object.entries(n.attributes).map(([k, v]) => `${k}: ${v}`).join('\n') : ''}`
            },
            nodeColor: getNodeColor,
            nodeVal: getNodeSize,
            linkColor: () => '#94a3b8',
            linkWidth: 1,
            onNodeClick: handleNodeClick,
            onNodeHover: handleNodeHover,
            onLinkClick: onLinkClick,
            cooldownTicks: 100,
            onEngineStop: () => {
              // Graph has stabilized - no need to keep animating
            },
            enableZoomInteraction: true,
            enablePanInteraction: true,
            width: dimensions.width,
            height: dimensions.height,
            d3Force: {
              link: { distance: 80 },
              charge: { strength: -300 },
              center: { strength: 0.1 }
            }
          } as any)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">No nodes to display</p>
              <p className="text-sm">Adjust filters to show nodes</p>
            </div>
          </div>
        )}

        {/* Node Info Panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-xs z-10">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-sm">{selectedNode.name}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-600 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Type:</strong> {selectedNode.type}</p>
              {selectedNode.attributes && Object.entries(selectedNode.attributes).map(([key, value]) => (
                <p key={key}><strong>{key}:</strong> {String(value)}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(EcosystemMap)
