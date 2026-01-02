import { useMemo, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

interface EntityGraphVisualizationProps {
  agent: any
  height?: number
}

// Node type colors matching ecosystem visualization
const NODE_COLORS: Record<string, string> = {
  entity: '#3b82f6',      // Blue for main entity
  vendor: '#10b981',      // Green for vendor
  type: '#f59e0b',        // Amber for type
  category: '#8b5cf6',    // Purple for category
  connection: '#ef4444',  // Red for connections
  deployment: '#06b6d4',  // Cyan for deployment
  integration: '#ec4899'  // Pink for integration
}

const NODE_SIZES: Record<string, number> = {
  entity: 20,
  vendor: 15,
  type: 12,
  category: 12,
  connection: 10,
  deployment: 10,
  integration: 10
}

export default function EntityGraphVisualization({ agent, height = 500 }: EntityGraphVisualizationProps) {
  // Build graph data from agent entity and relationships
  const graphData = useMemo(() => {
    const nodes: Array<{ id: string; name: string; type: string; group: number }> = []
    const links: Array<{ source: string; target: string; type: string }> = []

    // Add main entity node (agent)
    if (agent) {
      nodes.push({
        id: 'entity',
        name: agent.name || 'Entity',
        type: 'entity',
        group: 1
      })

      // Add vendor node if exists
      if (agent.vendor_name) {
        nodes.push({
          id: 'vendor',
          name: agent.vendor_name,
          type: 'vendor',
          group: 2
        })
        links.push({
          source: 'entity',
          target: 'vendor',
          type: 'belongs_to'
        })
      }

      // Add type node
      if (agent.type) {
        nodes.push({
          id: 'type',
          name: agent.type,
          type: 'type',
          group: 3
        })
        links.push({
          source: 'entity',
          target: 'type',
          type: 'has_type'
        })
      }

      // Add category node
      if (agent.category) {
        nodes.push({
          id: 'category',
          name: agent.category,
          type: 'category',
          group: 4
        })
        links.push({
          source: 'entity',
          target: 'category',
          type: 'has_category'
        })
      }

      // Add connections from architecture_info
      if (agent.architecture_info?.connections) {
        agent.architecture_info.connections.forEach((conn: any, idx: number) => {
          const connId = `connection_${idx}`
          nodes.push({
            id: connId,
            name: conn.name || conn.destination || `Connection ${idx + 1}`,
            type: 'connection',
            group: 5
          })
          links.push({
            source: 'entity',
            target: connId,
            type: conn.connection_type || 'connects_to'
          })
        })
      }

      // Add deployment model if exists
      if (agent.architecture_info?.deployment_model) {
        nodes.push({
          id: 'deployment',
          name: agent.architecture_info.deployment_model,
          type: 'deployment',
          group: 6
        })
        links.push({
          source: 'entity',
          target: 'deployment',
          type: 'deployed_as'
        })
      }

      // Add integration type if exists
      if (agent.architecture_info?.integration_type) {
        nodes.push({
          id: 'integration',
          name: agent.architecture_info.integration_type,
          type: 'integration',
          group: 7
        })
        links.push({
          source: 'entity',
          target: 'integration',
          type: 'integrated_via'
        })
      }
    }

    return { nodes, links }
  }, [agent])

  // Custom node rendering with labels (similar to ecosystem map)
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = NODE_SIZES[node.type] || 10
    const color = NODE_COLORS[node.type] || '#6b7280'
    const label = node.name || node.id
    const fontSize = 12 / globalScale
    const labelPadding = 8

    // Draw node circle
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false)
    ctx.fill()

    // Draw node border
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1 / globalScale
    ctx.stroke()

    // Draw label background (for better readability)
    ctx.font = `${fontSize}px Sans-Serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const textWidth = ctx.measureText(label).width
    const textHeight = fontSize

    // Position label to the right of node
    const labelX = node.x + size + labelPadding
    const labelY = node.y

    // Draw label background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(
      labelX - 4,
      labelY - textHeight / 2 - 2,
      textWidth + 8,
      textHeight + 4
    )

    // Draw label text
    ctx.fillStyle = '#374151'
    ctx.fillText(label, labelX, labelY)

    // Draw type badge below label (smaller text)
    const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1)
    const typeFontSize = 10 / globalScale
    ctx.font = `${typeFontSize}px Sans-Serif`
    const typeTextWidth = ctx.measureText(typeLabel).width
    const typeY = labelY + textHeight + 4

    // Type badge background
    ctx.fillStyle = color
    ctx.fillRect(
      labelX - 4,
      typeY - typeFontSize / 2 - 2,
      typeTextWidth + 8,
      typeFontSize + 4
    )

    // Type badge text
    ctx.fillStyle = '#fff'
    ctx.fillText(typeLabel, labelX, typeY)
  }, [])

  const getNodeColor = useCallback((node: any) => {
    return NODE_COLORS[node.type] || '#6b7280'
  }, [])

  const getNodeSize = useCallback((node: any) => {
    return NODE_SIZES[node.type] || 10
  }, [])

  if (!agent || graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground p-6">
        <p>No entity data available for visualization</p>
      </div>
    )
  }

  // Calculate link distance based on node sizes and label widths
  const calculateLinkDistance = useCallback((link: any) => {
    const sourceNode = typeof link.source === 'object' ? link.source : graphData.nodes.find(n => n.id === link.source)
    const targetNode = typeof link.target === 'object' ? link.target : graphData.nodes.find(n => n.id === link.target)
    
    if (!sourceNode || !targetNode) return 250
    
    const sourceSize = NODE_SIZES[sourceNode.type] || 10
    const targetSize = NODE_SIZES[targetNode.type] || 10
    const sourceLabelWidth = (sourceNode.name?.length || 10) * 7 // Approximate character width
    const targetLabelWidth = (targetNode.name?.length || 10) * 7
    
    // Base distance + node sizes + label widths + padding
    return sourceSize + targetSize + Math.max(sourceLabelWidth, targetLabelWidth) + 100
  }, [graphData.nodes])

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-white" style={{ height }}>
      <ForceGraph2D
        {...({
        graphData: graphData,
        nodeCanvasObject: nodeCanvasObject,
        nodeColor: getNodeColor,
        nodeVal: getNodeSize,
        linkColor: () => '#94a3b8',
        linkWidth: 1,
        linkLabel: (link: any) => link.type,
        linkDistance: calculateLinkDistance,
        cooldownTicks: 200,
        onEngineStop: () => {
          // Graph has stabilized
        },
        enableZoomInteraction: true,
        enablePanInteraction: true,
        width: 800,
        height: height,
        d3Force: {
          link: { 
            strength: 0.7 // Increase link strength to maintain distances
          },
          charge: { 
            strength: -1000, // Increased repulsion to prevent clustering
            distanceMax: 600 // Limit charge effect range
          },
          center: { 
            strength: 0.03 // Reduced center strength for better spread
          },
          collision: {
            radius: (node: any) => {
              const nodeSize = NODE_SIZES[node.type] || 10
              const labelWidth = (node.name?.length || 10) * 7
              return nodeSize + labelWidth / 2 + 30 // Add padding for labels
            },
            strength: 0.9
          }
        }
      } as any)}
      />
    </div>
  )
}

