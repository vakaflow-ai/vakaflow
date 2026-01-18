/**
 * Diagram Data Structures for Architecture, Mermaid, and Visualization Fields
 */

export interface DiagramNode {
  id: string
  label: string
  type: 'agent' | 'system' | 'database' | 'api' | 'service' | 'user' | 'gateway' | 'storage' | 'network' | 'custom'
  icon?: string
  position?: { x: number; y: number }
  metadata?: Record<string, any>
  style?: {
    fill?: string
    stroke?: string
    strokeWidth?: number
    color?: string
  }
}

export interface DiagramConnection {
  id: string
  source: string // node id
  target: string // node id
  label?: string
  direction: 'inbound' | 'outbound' | 'bidirectional'
  transition?: {
    type: string // 'data_flow' | 'api_call' | 'event' | 'sync' | 'async' | 'custom'
    condition?: string
    metadata?: Record<string, any>
  }
  style?: {
    stroke?: string
    strokeWidth?: number
    strokeDasharray?: string
  }
}

export interface DiagramLayout {
  direction: 'LR' | 'TB' | 'RL' | 'BT' // Left-Right, Top-Bottom, Right-Left, Bottom-Top
  theme?: 'default' | 'dark' | 'neutral' | 'forest' | 'base'
  spacing?: number
}

export interface DiagramData {
  type: 'architecture' | 'mermaid' | 'visualization'
  nodes: DiagramNode[]
  connections: DiagramConnection[]
  layout?: DiagramLayout
  // For manual Mermaid: raw code (optional, for backward compatibility)
  mermaid_code?: string
  // Metadata
  metadata?: {
    generated?: boolean
    generated_from?: string[] // field names that were used for generation
    last_updated?: string
    version?: string
  }
}

export interface DiagramFieldConfig {
  // Auto-generation settings
  auto_generate?: boolean
  depends_on?: string[] // Field names to use for auto-generation
  generation_rules?: {
    include_nodes?: string[] // ['agent', 'connections', 'integrations', 'deployment']
    include_transitions?: boolean
    layout?: 'LR' | 'TB' | 'RL' | 'BT'
    theme?: string
    show_labels?: boolean
  }
  // Manual editing settings
  allow_manual_edit?: boolean
  allow_mermaid_edit?: boolean // Allow raw Mermaid code editing
  // Visualization type specific
  visualization_type?: 'flowchart' | 'sequence' | 'state' | 'er' | 'gantt' | 'pie' | 'custom'
}

/**
 * Convert DiagramData to Mermaid syntax
 */
export function diagramDataToMermaid(data: DiagramData): string {
  if (data.mermaid_code) {
    return data.mermaid_code
  }

  const layout = data.layout || { direction: 'LR' }
  const direction = layout.direction || 'LR'
  const lines: string[] = [`graph ${direction}`]

  // Helper to sanitize node IDs
  const sanitizeId = (id: string): string => {
    return id.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, 'N$&').toUpperCase()
  }

  // Helper to escape labels
  const escapeLabel = (text: string): string => {
    return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  }

  // Add nodes
  data.nodes.forEach(node => {
    const nodeId = sanitizeId(node.id)
    const icon = node.icon || getDefaultIcon(node.type)
    const label = `${icon} ${escapeLabel(node.label)}`
    lines.push(`    ${nodeId}["${label}"]`)
    
    // Add styling if provided
    if (node.style) {
      const styleParts: string[] = []
      if (node.style.fill) styleParts.push(`fill:${node.style.fill}`)
      if (node.style.stroke) styleParts.push(`stroke:${node.style.stroke}`)
      if (node.style.strokeWidth) styleParts.push(`stroke-width:${node.style.strokeWidth}px`)
      if (node.style.color) styleParts.push(`color:${node.style.color}`)
      if (styleParts.length > 0) {
        lines.push(`    style ${nodeId} ${styleParts.join(',')}`)
      }
    }
  })

  // Add connections
  data.connections.forEach(conn => {
    const sourceId = sanitizeId(conn.source)
    const targetId = sanitizeId(conn.target)
    const label = conn.label ? `|"${escapeLabel(conn.label)}"|` : ''
    
    let edge = ''
    if (conn.direction === 'bidirectional') {
      edge = `    ${sourceId} <-->${label} ${targetId}`
    } else if (conn.direction === 'inbound') {
      edge = `    ${targetId} -->${label} ${sourceId}`
    } else {
      edge = `    ${sourceId} -->${label} ${targetId}`
    }
    lines.push(edge)
  })

  return lines.join('\n')
}

/**
 * Get default icon for node type
 */
function getDefaultIcon(type: string): string {
  const iconMap: Record<string, string> = {
    agent: '🤖',
    system: '💻',
    database: '🗄️',
    api: '🔌',
    service: '⚙️',
    user: '👤',
    gateway: '🚪',
    storage: '📁',
    network: '🌐',
  }
  return iconMap[type] || '🔗'
}

/**
 * Generate diagram from agent data
 */
export function generateDiagramFromAgentData(
  agentData: any,
  config: DiagramFieldConfig
): DiagramData {
  const nodes: DiagramNode[] = []
  const connections: DiagramConnection[] = []
  
  // Add agent node
  if (config.generation_rules?.include_nodes?.includes('agent')) {
    nodes.push({
      id: 'agent',
      label: agentData.name || 'Agent',
      type: 'agent',
      icon: '🤖',
      metadata: {
        agent_id: agentData.id,
        agent_type: agentData.type,
        agent_category: agentData.category,
      }
    })
  }

  // Add connections
  if (config.generation_rules?.include_nodes?.includes('connections')) {
    const agentConnections = agentData.connections || agentData.agent_connections || []
    agentConnections.forEach((conn: any, idx: number) => {
      const entityName = conn.destination_system || conn.app_name || conn.name || `System ${idx + 1}`
      const nodeId = `system_${idx}`
      
      // Add system node
      nodes.push({
        id: nodeId,
        label: entityName,
        type: 'system',
        icon: getSystemIcon(entityName),
        metadata: {
          connection_id: conn.id,
          app_name: conn.app_name,
        }
      })

      // Add connection
      connections.push({
        id: `conn_${idx}`,
        source: 'agent',
        target: nodeId,
        label: conn.name || '',
        direction: conn.data_flow_direction || 'bidirectional',
        transition: config.generation_rules?.include_transitions ? {
          type: 'data_flow',
          metadata: {
            data_types: conn.data_types_exchanged || [],
          }
        } : undefined,
      })
    })
  }

  // Add integrations
  if (config.generation_rules?.include_nodes?.includes('integrations')) {
    const integrations = agentData.integrations || agentData.agent_metadata?.integrations || []
    integrations.forEach((integration: any, idx: number) => {
      const nodeId = `integration_${idx}`
      nodes.push({
        id: nodeId,
        label: integration.name || integration.type || `Integration ${idx + 1}`,
        type: 'api',
        icon: '🔌',
      })
      connections.push({
        id: `conn_integration_${idx}`,
        source: 'agent',
        target: nodeId,
        direction: 'bidirectional',
      })
    })
  }

  return {
    type: 'architecture',
    nodes,
    connections,
    layout: {
      direction: config.generation_rules?.layout || 'LR',
      theme: (config.generation_rules?.theme as 'default' | 'neutral' | 'base' | 'dark' | 'forest' | undefined) || 'default',
    },
    metadata: {
      generated: true,
      generated_from: config.depends_on || [],
      last_updated: new Date().toISOString(),
    }
  }
}

/**
 * Get icon for system based on name
 */
function getSystemIcon(systemName: string): string {
  const name = systemName.toLowerCase()
  if (name.includes('sap')) return '📊'
  if (name.includes('database') || name.includes('db')) return '🗄️'
  if (name.includes('api') || name.includes('gateway')) return '🔌'
  if (name.includes('storage') || name.includes('s3')) return '📁'
  if (name.includes('email') || name.includes('smtp')) return '📧'
  if (name.includes('cloud') || name.includes('aws') || name.includes('azure')) return '☁️'
  if (name.includes('security') || name.includes('firewall')) return '🛡️'
  return '💻'
}

