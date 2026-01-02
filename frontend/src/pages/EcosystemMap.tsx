import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../lib/analytics'
import { authApi } from '../lib/auth'
import { tenantsApi } from '../lib/tenants'
import { securityIncidentsApi } from '../lib/securityIncidents'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip, MaterialInput } from '../components/material'

interface Node {
  id: string
  label: string
  type: 'customer' | 'vendor' | 'llm_provider' | 'agent' | 'system'
  metadata: Record<string, any>
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface Link {
  source: string | Node
  target: string | Node
  type: string
  metadata: Record<string, any>
}

// Reserved colors for each entity type - always consistent
const NODE_COLORS: Record<string, string> = {
  customer: '#3b82f6',      // Blue - Tenant/Customer
  vendor: '#10b981',        // Green - Vendors (always same color)
  llm_provider: '#f59e0b',  // Orange - LLM Providers
  agent: '#8b5cf6',         // Purple - Agents/Bots
  system: '#ef4444'         // Red - Systems
}

const NODE_SIZES: Record<string, number> = {
  customer: 12,
  vendor: 10,
  llm_provider: 8,
  agent: 8,
  system: 6
}

// Reserved icons for each entity type - always consistent
const getIconPath = (type: string): string => {
  // Using SVG path data for common icons (24x24 viewBox)
  switch (type) {
    case 'customer':
      // Building2 icon - Tenant/Customer
      return 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z M6 12h12 M6 12v10 M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2V12ZM20 12v10h2a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2ZM10 6h4 M10 6V4 M10 6h4v2'
    case 'vendor':
      // Building icon - Vendors
      return 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z M6 12h12 M6 12v10 M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2V12ZM20 12v10h2a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2ZM10 6h4 M10 6V4 M10 6h4v2'
    case 'agent':
      // Bot icon - Agents/Bots
      return 'M12 8V4H8 M12 8c0 1.657-1.343 3-3 3S6 9.657 6 8 M12 8c0-1.657 1.343-3 3-3s3 1.343 3 3 M6 12h12 M6 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 16h12 M6 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM18 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'
    case 'llm_provider':
      // Cpu icon - LLM Providers
      return 'M9 2v2 M15 2v2 M9 22v-2 M15 22v-2 M22 9h-2 M22 15h-2 M2 9h2 M2 15h2 M18 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z M12 9v6 M9 12h6'
    case 'system':
      // Server icon - Systems
      return 'M6 2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z M6 10h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z M6 18h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z'
    default:
      // Circle as fallback
      return 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z'
  }
}

export default function EcosystemMap() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [tenantFeatures, setTenantFeatures] = useState<Record<string, boolean>>({})
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [focusedNode, setFocusedNode] = useState<Node | null>(null) // Node to focus on (shows only its connections)
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [hoveredNodePosition, setHoveredNodePosition] = useState<{ x: number; y: number } | null>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [loadStep, setLoadStep] = useState(5) // Progressive loading: 1=customer, 2=vendors, 3=agents, 4=llm, 5=systems (default: load all entities)
  const [showDetailsPanel, setShowDetailsPanel] = useState(false) // Hide details panel by default for full page view
  const [filterBy, setFilterBy] = useState<string>('')
  const [filterValue, setFilterValue] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('')
  const [centerBy, setCenterBy] = useState<string>('all') // Entity type to center visualization on: 'all', 'customer', 'vendor', 'agent', 'llm_provider', 'system' - default to 'all'
  const [viewDimension, setViewDimension] = useState<'vendor' | 'llm' | 'agent'>('vendor') // Dimension to visualize by
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set()) // Track which nodes are expanded
  const [showViewDropdown, setShowViewDropdown] = useState(false)
  const [showCenterDropdown, setShowCenterDropdown] = useState(false)
  // Settings panel is always visible - no state needed
  const [isFullscreen, setIsFullscreen] = useState(false) // Fullscreen mode

  // Debounce search query to avoid excessive re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery])
  const [isControlsExpanded, setIsControlsExpanded] = useState<boolean>(true) // Controls expanded by default for better usability
  const [isHelpExpanded, setIsHelpExpanded] = useState<boolean>(false) // Help collapsed by default to save space
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null)
  const selectedNodeRef = useRef<Node | null>(null)
  const hoveredNodeRef = useRef<Node | null>(null)
  const focusedNodeRef = useRef<Node | null>(null)
  const nodesRef = useRef<Node[]>([])
  const linksRef = useRef<Link[]>([])
  const treeStructureRef = useRef<Map<string, { parent: string | null; children: string[]; level: number }>>(new Map())
  const simulationRunningRef = useRef(false)
  const widthRef = useRef<number>(1200)
  const heightRef = useRef<number>(800)
  const lastHoverUpdateRef = useRef<number>(0)
  const hoverUpdatePendingRef = useRef<boolean>(false)
  const lastEcosystemHashRef = useRef<string>('') // Track ecosystem data to prevent unnecessary restarts
  
  // Pan and zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [draggedNode, setDraggedNode] = useState<Node | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const draggedNodeRef = useRef<Node | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const connectedNodesRef = useRef<Set<string>>(new Set()) // Track connected nodes to move together
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map()) // Store initial positions
  const panZoomRef = useRef<SVGGElement | null>(null)
  const dragStartMousePosRef = useRef<{ x: number; y: number } | null>(null) // Track initial mouse position for drag threshold
  const isDragActiveRef = useRef<boolean>(false) // Track if drag has actually started (moved beyond threshold)
  
  // Keep refs in sync with state
  useEffect(() => {
    selectedNodeRef.current = selectedNode
  }, [selectedNode])

  useEffect(() => {
    hoveredNodeRef.current = hoveredNode
  }, [hoveredNode])

  useEffect(() => {
    focusedNodeRef.current = focusedNode
    
    // When focusedNode changes, reset pan/zoom
    // Simulation restart will be handled by the main effect
    if (focusedNode) {
      setPan({ x: 0, y: 0 })
      setZoom(1)
    }
  }, [focusedNode])

  // Removed redundant hover position update effect - position is updated in render() function

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  useEffect(() => {
    if (user?.tenant_id) {
      tenantsApi.getMyTenantFeatures().then((features) => {
        setTenantFeatures(features || {})
      }).catch(() => {})
    }
  }, [user])

  const { data: ecosystem, isLoading, error, refetch } = useQuery({
    queryKey: ['ecosystem-map', loadStep, filterBy, filterValue],
    queryFn: () => analyticsApi.getEcosystemMap(loadStep, filterBy || undefined, filterValue || undefined),
    enabled: !!user,
    staleTime: 300000, // Consider data fresh for 5 minutes
    refetchInterval: false, // Disable auto-refresh - user can manually refresh
    // Prevent unnecessary refetches when component re-renders
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  // Fetch CVE trackings for all vendors to check for active matches
  const vendorIds = useMemo(() => {
    if (!ecosystem?.nodes) return []
    return ecosystem.nodes
      .filter((n: Node) => n.type === 'vendor')
      .map((n: Node) => {
        // Extract vendor ID from node ID (format: "vendor_{uuid}" or just "{uuid}")
        const vendorId = n.id.startsWith('vendor_') ? n.id.replace('vendor_', '') : n.id
        return vendorId
      })
  }, [ecosystem?.nodes])

  // Create a map from node ID to vendor ID for lookup
  const nodeIdToVendorId = useMemo(() => {
    if (!ecosystem?.nodes) return {}
    const map: Record<string, string> = {}
    ecosystem.nodes
      .filter((n: Node) => n.type === 'vendor')
      .forEach((n: Node) => {
        const vendorId = n.id.startsWith('vendor_') ? n.id.replace('vendor_', '') : n.id
        map[n.id] = vendorId
      })
    return map
  }, [ecosystem?.nodes])

  const { data: vendorCVEStatus } = useQuery({
    queryKey: ['vendor-cve-status', vendorIds.join(',')],
    queryFn: async () => {
      const statusMap: Record<string, { hasActiveCVE: boolean; cveCount: number }> = {}
      if (vendorIds.length === 0) return statusMap
      
      await Promise.all(
        vendorIds.map(async (vendorId: string) => {
          try {
            // Get all trackings, then filter for active ones
            const trackings = await securityIncidentsApi.getVendorTrackings(vendorId)
            const activeTrackings = trackings.filter(t => t.status === 'active')
            statusMap[vendorId] = {
              hasActiveCVE: activeTrackings.length > 0,
              cveCount: activeTrackings.length
            }
          } catch (error) {
            console.error(`Error fetching CVE trackings for vendor ${vendorId}:`, error)
            statusMap[vendorId] = { hasActiveCVE: false, cveCount: 0 }
          }
        })
      )
      return statusMap
    },
    enabled: vendorIds.length > 0 && !!user && tenantFeatures.cve_tracking === true,
  })

  // Memoize ecosystem data to prevent reference changes, and enrich with CVE status
  const memoizedEcosystem = useMemo(() => {
    if (!ecosystem) return null
    
    // Enrich vendor nodes with CVE status
    const enrichedNodes = ecosystem.nodes.map((node: Node) => {
      if (node.type === 'vendor') {
        // Try to get vendor ID from metadata first, then from node ID
        const vendorId = node.metadata?.vendor_id || nodeIdToVendorId[node.id] || (node.id.startsWith('vendor_') ? node.id.replace('vendor_', '') : node.id)
        const cveStatus = vendorCVEStatus?.[vendorId]
        return {
          ...node,
          metadata: {
            ...node.metadata,
            has_active_cve_matches: cveStatus?.hasActiveCVE || false,
            active_cve_count: cveStatus?.cveCount || 0
          }
        }
      }
      return node
    })
    
    // Create a stable reference - only change if actual data changes
    return {
      nodes: enrichedNodes,
      links: ecosystem.links
    }
  }, [ecosystem?.nodes?.length, ecosystem?.links?.length, JSON.stringify(ecosystem?.nodes?.map(n => n.id).sort()), vendorCVEStatus])

  useEffect(() => {
    if (!memoizedEcosystem) {
      // No ecosystem data yet - wait for it
      return
    }
    
    if (!svgRef.current) {
      // SVG not ready yet - wait a bit and retry
      const timer = setTimeout(() => {
        if (svgRef.current && memoizedEcosystem) {
          // Force re-trigger by updating a dependency
          setPan(prev => ({ ...prev }))
        }
      }, 200)
      return () => clearTimeout(timer)
    }
    
    // Container ref is optional - use SVG dimensions as fallback
    // Don't block rendering if containerRef isn't set yet
    const ecosystem = memoizedEcosystem
    
    // Always restart simulation when focusedNode changes to ensure proper centering
    // Check if focusedNode changed
    const currentFocusedId = focusedNode ? (typeof focusedNode === 'string' ? focusedNode : focusedNode.id) : null
    const previousFocusedId = focusedNodeRef.current ? (typeof focusedNodeRef.current === 'string' ? focusedNodeRef.current : focusedNodeRef.current.id) : null
    const focusedNodeChanged = currentFocusedId !== previousFocusedId
    
    // Create a hash of ecosystem data to detect actual changes
    const ecosystemHash = JSON.stringify({
      nodeCount: ecosystem.nodes.length,
      linkCount: ecosystem.links.length,
      nodeIds: ecosystem.nodes.map(n => n.id).sort().join(','),
      searchQuery: debouncedSearchQuery,
      centerBy
    })
    
    // Don't restart simulation if data hasn't changed significantly
    // BUT always restart if:
    // 1. focusedNode changed (to ensure proper centering)
    // 2. No nodes are currently rendered (initial load)
    // 3. pan-zoom-group is empty (diagram not rendered yet)
    // 4. Data hash changed significantly
    const hasNoNodes = nodesRef.current.length === 0
    
    // Stop current simulation if running (will be restarted below)
    if (simulationRunningRef.current) {
      simulationRunningRef.current = false
    }

    const svg = svgRef.current
    if (!svg) return // SVG not ready yet
    
    // Check if pan-zoom-group exists and has content
    const panZoomGroup = svg.querySelector('#pan-zoom-group')
    const hasNoRenderedContent = !panZoomGroup || panZoomGroup.children.length === 0
    
    // Always restart if there's no rendered content (blank screen)
    if (hasNoRenderedContent) {
      // Force restart by clearing hash and continuing
      lastEcosystemHashRef.current = ''
    } else if (!focusedNodeChanged && !hasNoNodes && simulationRunningRef.current && nodesRef.current.length > 0) {
      // Check if ecosystem data actually changed
      if (ecosystemHash === lastEcosystemHashRef.current) {
        // Data hasn't changed at all - don't restart, don't re-render
        return
      }
      
      // Only restart if node count changed significantly (more than 5 nodes)
      const nodeCountDiff = Math.abs(ecosystem.nodes.length - nodesRef.current.length)
      if (nodeCountDiff <= 5) {
        // Minor change - update hash but don't restart simulation
        lastEcosystemHashRef.current = ecosystemHash
        return
      }
    }
    
    // Update hash
    lastEcosystemHashRef.current = ecosystemHash
    // Use full available space - calculate from container or viewport
    const container = containerRef.current
    const width = container ? container.clientWidth : (svg.clientWidth || window.innerWidth - 100)
    const height = container ? container.clientHeight : (svg.clientHeight || window.innerHeight - 200)
    // Store width and height in refs for use in center button
    widthRef.current = width
    heightRef.current = height
    
    // Update SVG dimensions to match calculated size
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))

    // Clear previous content
    svg.innerHTML = ''
    
    // Check if we have any nodes to display
    if (ecosystem.nodes.length === 0) {
      // Show empty state message
      const emptyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      emptyGroup.setAttribute('id', 'empty-state')
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', String(width / 2))
      text.setAttribute('y', String(height / 2))
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('dominant-baseline', 'middle')
      text.setAttribute('font-size', '18')
      text.setAttribute('fill', '#6b7280')
      text.setAttribute('font-weight', '500')
      text.textContent = 'No ecosystem data available'
      emptyGroup.appendChild(text)
      
      const subtext = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      subtext.setAttribute('x', String(width / 2))
      subtext.setAttribute('y', String(height / 2 + 30))
      subtext.setAttribute('text-anchor', 'middle')
      subtext.setAttribute('dominant-baseline', 'middle')
      subtext.setAttribute('font-size', '14')
      subtext.setAttribute('fill', '#9ca3af')
      subtext.textContent = 'Add agents, vendors, or connections to see them here'
      emptyGroup.appendChild(subtext)
      
      svg.appendChild(emptyGroup)
      nodesRef.current = []
      linksRef.current = []
      simulationRunningRef.current = false
      return
    }

    // Preserve positions from previous run if available
    const existingNodesMap = new Map(nodesRef.current.map(n => [n.id, n]))

    // Apply search filter if provided (use debounced query)
    let filteredNodes = ecosystem.nodes
    if (debouncedSearchQuery) {
      filteredNodes = ecosystem.nodes.filter(node =>
        node.label.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        node.type.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      )
    }
    
    // Apply focus filter if a node is focused (show only focused node and its connections as a tree)
    let focusFilteredNodes: any[] = filteredNodes
    let focusFilteredLinks: Link[] = ecosystem.links
    let treeStructure: Map<string, { parent: string | null; children: string[]; level: number }> = new Map()
    
    if (focusedNode) {
      const focusedNodeId = typeof focusedNode === 'string' ? focusedNode : focusedNode.id
      
      // Show ALL descendants (children, grandchildren, etc.) - traverse all levels
      // This answers: Which Agents use this LLM? Which Vendors provide it? Which Systems connect to it?
      // And recursively: What do those agents connect to? What systems do they use?
      const connectedNodeIds = new Set<string>([focusedNodeId])
      const treeLinks: Link[] = []
      
      // Initialize tree structure for root
      treeStructure.set(focusedNodeId, { parent: null, children: [], level: 0 })
      
      // Build adjacency list for efficient traversal (undirected for finding all connections)
      const adjacencyList = new Map<string, Array<{ target: string; link: Link }>>()
      ecosystem.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : String(link.source)
        const targetId = typeof link.target === 'string' ? link.target : String(link.target)
        
        // Build undirected adjacency list
        if (!adjacencyList.has(sourceId)) {
          adjacencyList.set(sourceId, [])
        }
        if (!adjacencyList.has(targetId)) {
          adjacencyList.set(targetId, [])
        }
        adjacencyList.get(sourceId)!.push({ target: targetId, link })
        adjacencyList.get(targetId)!.push({ target: sourceId, link })
      })
      
      // BFS to traverse ALL levels of descendants (prevent cycles by tracking parent)
      const visited = new Set<string>([focusedNodeId])
      const queue: Array<{ nodeId: string; parent: string | null; level: number }> = [
        { nodeId: focusedNodeId, parent: null, level: 0 }
      ]
      
      while (queue.length > 0) {
        const { nodeId, parent, level } = queue.shift()!
        
        const neighbors = adjacencyList.get(nodeId) || []
        for (const { target, link } of neighbors) {
          // Prevent cycles: don't add if already visited OR if it's the direct parent
          if (!visited.has(target) && target !== parent) {
            visited.add(target)
            connectedNodeIds.add(target)
            
            // Add to tree structure
            if (!treeStructure.has(target)) {
              treeStructure.set(target, { parent: nodeId, children: [], level: level + 1 })
            }
            
            // Add child to parent's children list (prevent duplicates)
            if (nodeId && treeStructure.has(nodeId)) {
              const parentTree = treeStructure.get(nodeId)!
              if (!parentTree.children.includes(target)) {
                parentTree.children.push(target)
              }
            }
            
            // Add link to tree - ensure correct direction (parent -> child)
            const linkSourceId = typeof link.source === 'string' ? link.source : String(link.source)
            const linkTargetId = typeof link.target === 'string' ? link.target : String(link.target)
            
            if (linkSourceId === nodeId && linkTargetId === target) {
              treeLinks.push(link)
            } else if (linkSourceId === target && linkTargetId === nodeId) {
              // Reverse the link direction to match tree structure
              treeLinks.push({
                ...link,
                source: nodeId,
                target: target
              })
            }
            
            // Continue traversal to next level
            queue.push({ nodeId: target, parent: nodeId, level: level + 1 })
          }
        }
      }
      
      // Filter nodes to include focused node and ALL its descendants (all levels)
      focusFilteredNodes = filteredNodes.filter((node: any) => connectedNodeIds.has(node.id))
      
      // Show ALL links between nodes in the connected set (all descendants)
      // This includes parent->child links AND links between siblings/other descendants
      // But only if both nodes are in the connected set (prevents cycles back to unconnected nodes)
      focusFilteredLinks = ecosystem.links.filter((link: Link) => {
        const sourceId = typeof link.source === 'string' ? link.source : String(link.source)
        const targetId = typeof link.target === 'string' ? link.target : String(link.target)
        // Include link if both nodes are in the connected set (part of the tree)
        return connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)
      }) as Link[]
    }
    
    // Filter out orphaned nodes (nodes with no connections) unless they're explicitly selected
    // This removes "background" error nodes - do this AFTER focus filtering
    const nodeIdsWithConnections = new Set<string>()
    const linksToUse = focusedNode ? focusFilteredLinks : ecosystem.links
    linksToUse.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id
      nodeIdsWithConnections.add(sourceId)
      nodeIdsWithConnections.add(targetId)
    })
    
    // Keep nodes that have connections OR are selected/hovered/focused
    const selectedNodeId = selectedNode?.id
    const hoveredNodeId = hoveredNode?.id
    const focusedNodeId = focusedNode ? (typeof focusedNode === 'string' ? focusedNode : focusedNode.id) : null
    
    // Also filter out nodes with generic/error names
    const errorNodeNames = ['dfdf', 'df', '(Unknown)', 'Unknown', '']
    
    focusFilteredNodes = focusFilteredNodes.filter((node: any) => {
      // Always keep customer/tenant node even if it has no connections (for empty state visibility)
      if (node.type === 'customer' || node.type === 'tenant') return true
      
      // Filter out error/generic nodes unless they're explicitly selected
      if (errorNodeNames.includes(node.label) && node.id !== selectedNodeId && node.id !== hoveredNodeId && node.id !== focusedNodeId) {
        return false
      }
      // Always keep nodes with connections
      if (nodeIdsWithConnections.has(node.id)) return true
      // Always keep selected/hovered/focused nodes
      if (node.id === selectedNodeId || node.id === hoveredNodeId || node.id === focusedNodeId) return true
      // Filter out orphaned nodes (no connections) - these are likely errors
      return false
    })
    
    // Deduplicate nodes by ID - keep only the first occurrence
    const seenNodeIds = new Set<string>()
    const uniqueFilteredNodes = focusFilteredNodes.filter((node: any) => {
      if (seenNodeIds.has(node.id)) {
        console.warn(`Duplicate node detected and removed: ${node.id} (${node.label})`)
        return false
      }
      seenNodeIds.add(node.id)
      return true
    })
    
    // Create nodes and links with positions - spread them out more initially
    const nodeCount = uniqueFilteredNodes.length
    const spreadRadius = Math.min(width, height) * 0.4 // Use 40% of available space
    const angleStep = nodeCount > 0 ? (2 * Math.PI) / nodeCount : 0
    
    const nodes: Node[] = uniqueFilteredNodes.map((node: any, index: number) => {
      const existing = existingNodesMap.get(node.id)
      if (existing && existing.x && existing.y) {
        // Preserve existing position if available
        return {
          ...node,
          label: node.label || node.id,
          metadata: node.metadata || {},
          x: existing.x,
          y: existing.y,
          vx: existing.vx ?? 0,
          vy: existing.vy ?? 0
        }
      }
      // Spread nodes in a circle for better initial separation
      const angle = index * angleStep
      const radius = spreadRadius * (0.5 + Math.random() * 0.5) // Vary radius slightly
      return {
        ...node,
        label: node.label || node.id,
        metadata: node.metadata || {},
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0
      }
    })
    
    // Filter links to only include filtered nodes (or use focus-filtered links)
    const filteredNodeIds = new Set(nodes.map(n => n.id))
    const filteredLinks = focusedNode 
      ? focusFilteredLinks.filter((link: Link) => {
          // Handle both string IDs and object references
          const sourceId = typeof link.source === 'string' 
            ? link.source 
            : (link.source as any)?.id || String(link.source)
          const targetId = typeof link.target === 'string' 
            ? link.target 
            : (link.target as any)?.id || String(link.target)
          return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId)
        })
      : ecosystem.links.filter((link: Link) => {
          // Handle both string IDs and object references
          const sourceId = typeof link.source === 'string' 
            ? link.source 
            : (link.source as any)?.id || String(link.source)
          const targetId = typeof link.target === 'string' 
            ? link.target 
            : (link.target as any)?.id || String(link.target)
          return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId)
        })

    const links: Link[] = filteredLinks.map((link: Link) => {
      // Handle both string IDs and object references
      const sourceId = typeof link.source === 'string' 
        ? link.source 
        : (link.source as any)?.id || String(link.source)
      const targetId = typeof link.target === 'string' 
        ? link.target 
        : (link.target as any)?.id || String(link.target)
      
      const sourceNode = nodes.find(n => n.id === sourceId)
      const targetNode = nodes.find(n => n.id === targetId)
      
      return {
        ...link,
        source: sourceNode || sourceId, // Keep ID if node not found
        target: targetNode || targetId, // Keep ID if node not found
        metadata: link.metadata || {}
      }
    })
    
    // Store references
    nodesRef.current = nodes
    linksRef.current = links
    
    // If no nodes after filtering, show empty state message
    if (nodes.length === 0 && svgRef.current) {
      const existingEmpty = svgRef.current.querySelector('#empty-state')
      if (existingEmpty) existingEmpty.remove()
      
      const emptyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      emptyGroup.setAttribute('id', 'empty-state')
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', String(width / 2))
      text.setAttribute('y', String(height / 2))
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('dominant-baseline', 'middle')
      text.setAttribute('font-size', '18')
      text.setAttribute('fill', '#6b7280')
      text.setAttribute('font-weight', '500')
      text.textContent = 'No nodes to display'
      emptyGroup.appendChild(text)
      
      const subtext = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      subtext.setAttribute('x', String(width / 2))
      subtext.setAttribute('y', String(height / 2 + 30))
      subtext.setAttribute('text-anchor', 'middle')
      subtext.setAttribute('dominant-baseline', 'middle')
      subtext.setAttribute('font-size', '14')
      subtext.setAttribute('fill', '#9ca3af')
      subtext.textContent = 'Try adjusting filters or load more entity types'
      emptyGroup.appendChild(subtext)
      
      svgRef.current.appendChild(emptyGroup)
      simulationRunningRef.current = false
      return
    }
    
    // Remove empty state if nodes exist
    if (nodes.length > 0 && svgRef.current) {
      const existingEmpty = svgRef.current.querySelector('#empty-state')
      if (existingEmpty) existingEmpty.remove()
    }
    treeStructureRef.current = treeStructure

    // Build proper hierarchy based on relationships: Vendor -> Agents -> LLM -> Systems
    // Build adjacency map for efficient relationship lookup
    const adjacencyMap = new Map<string, Array<{ target: string; link: Link }>>()
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id || String(link.source)
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id || String(link.target)
      
      if (!adjacencyMap.has(sourceId)) {
        adjacencyMap.set(sourceId, [])
      }
      adjacencyMap.get(sourceId)!.push({ target: targetId, link })
    })
    
    // Build hierarchy tree based on centerBy selection
    // Hierarchy order: customer -> vendor -> agent -> llm_provider -> system
    const hierarchyOrder: string[] = ['customer', 'vendor', 'agent', 'llm_provider', 'system']
    // Safety check: ensure hierarchyOrder is an array
    if (!Array.isArray(hierarchyOrder)) {
      console.error('hierarchyOrder is not an array:', hierarchyOrder)
      return
    }
    const hierarchyTree = new Map<string, { level: number; parent: string | null; children: string[] }>()
    
    // Determine root level based on centerBy
    let rootLevel = 0
    if (centerBy !== 'all' && Array.isArray(hierarchyOrder)) {
      rootLevel = hierarchyOrder.indexOf(centerBy)
      if (rootLevel === -1) rootLevel = 0
    }
    
    // Build tree structure
    const nodesByType = new Map<string, Node[]>()
    if (Array.isArray(hierarchyOrder)) {
      hierarchyOrder.forEach(type => {
        nodesByType.set(type, nodes.filter(n => n.type === type))
      })
    }
    
    // If centerBy is 'all', show full hierarchy starting from (All)
    // Otherwise, reorganize tree with selected type as root
    if (centerBy === 'all') {
      // Full hierarchy: (All) -> Customer/Vendor -> Agents -> LLM -> Systems
      // This will be handled in render function
    } else {
      // Reorganize tree with centerBy type as root
      const centerNodes = nodesByType.get(centerBy) || []
      centerNodes.forEach(node => {
        if (!hierarchyTree.has(node.id)) {
          hierarchyTree.set(node.id, { level: 0, parent: null, children: [] })
        }
        
        // Find children (next level in hierarchy)
        if (!Array.isArray(hierarchyOrder)) {
          return
        }
        const currentLevel = hierarchyOrder.indexOf(centerBy)
        if (currentLevel >= 0 && currentLevel < hierarchyOrder.length - 1) {
          const nextType = hierarchyOrder[currentLevel + 1]
          const children = adjacencyMap.get(node.id) || []
          children.forEach(({ target }) => {
            const targetNode = nodes.find(n => n.id === target)
            if (targetNode && targetNode.type === nextType) {
              if (!hierarchyTree.has(target)) {
                hierarchyTree.set(target, { level: 1, parent: node.id, children: [] })
              }
              const parentTree = hierarchyTree.get(node.id)!
              if (!parentTree.children.includes(target)) {
                parentTree.children.push(target)
              }
            }
          })
        }
      })
    }
    
    // Store hierarchy info for rendering
    // Safety check: ensure hierarchyOrder is an array
    if (Array.isArray(hierarchyOrder)) {
      nodes.forEach(node => {
        const level = hierarchyOrder.indexOf(node.type)
        const nodeAny = node as any
        nodeAny.hierarchyLevel = level >= 0 ? level : -1
        nodeAny.centerBy = centerBy
            })
          }
    
    // Skip the old centerBy logic - we're always using tree layout now
    if (false) {
      // Center nodes by selected entity type
      const centerNodes = nodes.filter(n => n.type === centerBy)
      if (centerNodes.length > 0) {
        // If multiple nodes of this type, arrange them in a circle around center
        if (centerNodes.length === 1) {
          // Single node: place at center
          centerNodes[0].x = width / 2
          centerNodes[0].y = height / 2
          centerNodes[0].vx = 0
          centerNodes[0].vy = 0
        } else {
          // Multiple nodes: arrange in a circle around center
          const radius = Math.min(width, height) * 0.15
          const angleStep = (2 * Math.PI) / centerNodes.length
          centerNodes.forEach((node, index) => {
            const angle = index * angleStep
            node.x = width / 2 + radius * Math.cos(angle)
            node.y = height / 2 + radius * Math.sin(angle)
            node.vx = 0
            node.vy = 0
          })
        }
      } else {
        // Fallback: center vendor if selected type not found, otherwise customer
        const vendorNode = nodes.find(n => n.type === 'vendor')
        if (vendorNode) {
          vendorNode.x = width / 2
          vendorNode.y = height / 2
          vendorNode.vx = 0
          vendorNode.vy = 0
        } else {
          // Last resort: center customer
          const customerNode = nodes.find(n => n.type === 'customer')
          if (customerNode) {
            customerNode.x = width / 2
            customerNode.y = height / 2
            customerNode.vx = 0
            customerNode.vy = 0
          }
        }
      }
    }

    // Simple force simulation - allow more time for proper separation
    const alpha = 1
    const alphaDecay = 0.15 // Slower decay to allow more time for separation
    let currentAlpha = alpha
    let tickCount = 0
    const MAX_TICKS = 50 // Increased to allow more time for nodes to separate
    let animationFrameId: number | null = null
    
    // Mark simulation as running
    simulationRunningRef.current = true

    const tick = () => {
      tickCount++
      
      // Check if simulation should continue
      if (!simulationRunningRef.current) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
        return // Stop if simulation was stopped
      }
      
      // Apply forces - use filtered nodes for simulation
      const currentNodes = nodesRef.current
      // Filter nodes to only those in the hierarchy (will be set in render function)
      // For now, use all nodes but we'll filter in render
      
      // Skip force simulation for dragged node and connected nodes - they're being manually positioned
      const currentDragged = draggedNodeRef.current
      const connectedNodeIds = connectedNodesRef.current
      if (currentDragged) {
        const dragged = currentNodes.find(n => n.id === currentDragged.id)
        if (dragged) {
          // Keep dragged node fixed (forces won't affect it)
          dragged.vx = 0
          dragged.vy = 0
        }
        
        // Keep all connected nodes fixed during drag
        connectedNodeIds.forEach(connectedId => {
          const connectedNode = currentNodes.find(n => n.id === connectedId)
          if (connectedNode) {
            connectedNode.vx = 0
            connectedNode.vy = 0
          }
        })
      }
      
      // Pre-calculate centered nodes to avoid filtering multiple times - always use vendor if centerBy is 'all'
      const effectiveCenterBy = centerBy === 'all' ? 'vendor' : centerBy
      const centerNodes = currentNodes.filter(n => n.type === effectiveCenterBy)
      const centerNodesCount = centerNodes.length
      
      for (let i = 0; i < currentNodes.length; i++) {
        const node = currentNodes[i]
        // In focus mode, keep nodes in tree structure (fixed positions)
        const currentTreeStructure = treeStructureRef.current
        if (focusedNode && currentTreeStructure.size > 0) {
          const focusedId = typeof focusedNode === 'string' ? focusedNode : focusedNode.id
          const treeInfo = currentTreeStructure.get(node.id)
          
          if (node.id === focusedId) {
            // Keep focused node (root) on left side, centered vertically
            node.x = width * 0.15
            node.y = height / 2
            node.vx = 0
            node.vy = 0
            continue
          } else if (treeInfo) {
            // Keep tree nodes at their assigned horizontal positions
            const maxLevel = Math.max(...Array.from(currentTreeStructure.values()).map(t => t.level), 1)
            const levelWidth = maxLevel > 0 ? (width * 0.7) / maxLevel : width * 0.7
            const targetX = width * 0.15 + (treeInfo.level * levelWidth)
            
            // Find siblings at same level
            const siblings = currentNodes.filter(n => {
              const sibTree = currentTreeStructure.get(n.id)
              return sibTree && sibTree.level === treeInfo.level && n.id !== node.id
            })
            const allAtLevel = [node, ...siblings]
            const verticalSpacing = Math.min(height / Math.max(allAtLevel.length + 1, 2), 120)
            const startY = (height - (allAtLevel.length - 1) * verticalSpacing) / 2
            const index = allAtLevel.indexOf(node)
            const targetY = startY + index * verticalSpacing
            
            // Smoothly move to target position
            const dx = targetX - (node.x || 0)
            const dy = targetY - (node.y || 0)
            node.x = (node.x || 0) + dx * 0.2
            node.y = (node.y || 0) + dy * 0.2
            node.vx = 0
            node.vy = 0
            continue
          }
        }
        
        // Keep centered entity type fixed - always center vendors
        const effectiveCenterBy = centerBy === 'all' ? 'vendor' : centerBy
        if (node.type === effectiveCenterBy) {
          if (centerNodesCount === 1) {
            // Single centered node: keep at center
            const targetX = width / 2
            const targetY = height / 2
            const dx = targetX - (node.x || 0)
            const dy = targetY - (node.y || 0)
            node.x = targetX
            node.y = targetY
            node.vx = 0
            node.vy = 0
          } else {
            // Multiple centered nodes: keep in circular arrangement
            const index = centerNodes.indexOf(node)
            const radius = Math.min(width, height) * 0.15
            const angleStep = (2 * Math.PI) / centerNodesCount
            const angle = index * angleStep
            const targetX = width / 2 + radius * Math.cos(angle)
            const targetY = height / 2 + radius * Math.sin(angle)
            const dx = targetX - (node.x || 0)
            const dy = targetY - (node.y || 0)
            // Smoothly move to target position
            node.x = (node.x || 0) + dx * 0.2
            node.y = (node.y || 0) + dy * 0.2
            node.vx = 0
            node.vy = 0
          }
          continue
        }

        // Repulsion between nodes - strong forces to prevent overlaps
        for (let j = i + 1; j < currentNodes.length; j++) {
          const other = currentNodes[j]
          const dx = (node.x || 0) - (other.x || 0)
          const dy = (node.y || 0) - (other.y || 0)
          const distanceSquared = dx * dx + dy * dy
          const distance = Math.sqrt(distanceSquared) || 0.1 // Avoid division by zero
          
          // Get node sizes to calculate minimum distance - increased significantly
          const nodeSize = NODE_SIZES[node.type] || 15
          const otherSize = NODE_SIZES[other.type] || 15
          // Increased minimum distance: node sizes + label space (250px) + padding (200px) - much stronger separation
          const minDistance = nodeSize + otherSize + 450
          
          if (distance < minDistance) {
            // Very strong repulsion when too close - constant force regardless of alpha
            const overlap = minDistance - distance
            // Use a much stronger force multiplier that doesn't decay with alpha
            const force = overlap * 5.0 // Increased to 5.0 for much stronger separation
            const fx = (dx / distance) * force
            const fy = (dy / distance) * force
            node.vx = (node.vx || 0) + fx
            node.vy = (node.vy || 0) + fy
            other.vx = (other.vx || 0) - fx
            other.vy = (other.vy || 0) - fy
          } else if (distance < 500) {
            // Normal repulsion for nearby nodes - increased range and strength
            const force = (currentAlpha * 400) / distanceSquared
            const fx = (dx / distance) * force * 0.4
            const fy = (dy / distance) * force * 0.4
            node.vx = (node.vx || 0) + fx
            node.vy = (node.vy || 0) + fy
            other.vx = (other.vx || 0) - fx
            other.vy = (other.vy || 0) - fy
          }
        }

        // Attraction from links - maintain consistent edge length (symmetric)
        // Use a global ideal distance for all edges to ensure symmetry
        const GLOBAL_IDEAL_EDGE_LENGTH = 280 // Consistent distance for all edges
        linksRef.current.forEach(link => {
          const source = typeof link.source === 'string' 
            ? nodesRef.current.find(n => n.id === link.source)
            : link.source
          const target = typeof link.target === 'string'
            ? nodesRef.current.find(n => n.id === link.target)
            : link.target

          if (source === node && target) {
            const dx = (target.x || 0) - (node.x || 0)
            const dy = (target.y || 0) - (node.y || 0)
            const distance = Math.sqrt(dx * dx + dy * dy) || 1
            // Use global ideal distance for symmetric layout
            const idealDistance = GLOBAL_IDEAL_EDGE_LENGTH
            // Stronger attraction to maintain consistent edge length
            const force = (distance - idealDistance) * currentAlpha * 0.015
            node.vx = (node.vx || 0) + (dx / distance) * force
            node.vy = (node.vy || 0) + (dy / distance) * force
          }
        })

        // Apply velocity with moderate damping to allow separation
        const currentVx = node.vx || 0
        const currentVy = node.vy || 0
        
        // Moderate damping to allow nodes to separate properly
        const dampingFactor = 0.7 // Reduced damping to allow more movement for separation
        
        node.x = (node.x || 0) + currentVx
        node.y = (node.y || 0) + currentVy
        node.vx = currentVx * dampingFactor
        node.vy = currentVy * dampingFactor
        
        // Stop node if velocity is very small (prevent micro-movements)
        if (Math.abs(node.vx || 0) < 0.05 && Math.abs(node.vy || 0) < 0.05) {
          node.vx = 0
          node.vy = 0
        }

        // Keep nodes in bounds with padding
        const padding = 200 // Increased padding to prevent edge overlaps
        node.x = Math.max(padding, Math.min(width - padding, node.x || width / 2))
        node.y = Math.max(padding, Math.min(height - padding, node.y || height / 2))
      }

      // Render every frame for smooth animation
      render()
      
      tickCount++
      
      // Final overlap resolution pass before stopping
      if (currentAlpha <= 0.01 || tickCount >= MAX_TICKS) {
        // Do one final pass to resolve any remaining overlaps
        let hasOverlaps = false
        for (let i = 0; i < currentNodes.length; i++) {
          const node = currentNodes[i]
          const nodeSize = NODE_SIZES[node.type] || 15
          
          for (let j = i + 1; j < currentNodes.length; j++) {
            const other = currentNodes[j]
            const otherSize = NODE_SIZES[other.type] || 15
            const dx = (node.x || 0) - (other.x || 0)
            const dy = (node.y || 0) - (other.y || 0)
            const distance = Math.sqrt(dx * dx + dy * dy) || 0.1
            const minDistance = nodeSize + otherSize + 450
            
            if (distance < minDistance) {
              hasOverlaps = true
              // Force separation
              const overlap = minDistance - distance
              const separation = (overlap / distance) * 1.5
              const moveX = (dx / distance) * separation
              const moveY = (dy / distance) * separation
              node.x = (node.x || 0) + moveX
              node.y = (node.y || 0) + moveY
              other.x = (other.x || 0) - moveX
              other.y = (other.y || 0) - moveY
            }
          }
        }
        
        // If overlaps were resolved, render one more time
        if (hasOverlaps) {
          render()
        }
        
        // Simulation has stabilized - stop completely
        simulationRunningRef.current = false
        
        // Final render
        render()
        
        // Zero out all velocities to ensure complete stop
        currentNodes.forEach(n => {
          n.vx = 0
          n.vy = 0
        })
        
        // Fit diagram to viewport - use available space efficiently
        if (currentNodes.length > 0) {
          // Calculate bounding box of all nodes with padding for labels
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          currentNodes.forEach(node => {
            const x = node.x || 0
            const y = node.y || 0
            const nodeSize = NODE_SIZES[node.type] || 15
            // Add padding for labels and visual spacing
            const padding = nodeSize + 80
            minX = Math.min(minX, x - padding)
            minY = Math.min(minY, y - padding)
            maxX = Math.max(maxX, x + padding)
            maxY = Math.max(maxY, y + padding)
          })
          
          // Calculate dimensions of the diagram
          const diagramWidth = maxX - minX
          const diagramHeight = maxY - minY
          const diagramCenterX = (minX + maxX) / 2
          const diagramCenterY = (minY + maxY) / 2
          
          // Calculate viewport dimensions (account for padding)
          const viewportPadding = 100 // Padding around edges
          const viewportWidth = width - (viewportPadding * 2)
          const viewportHeight = height - (viewportPadding * 2)
          
          // Calculate zoom to fit diagram in viewport
          const scaleX = viewportWidth / diagramWidth
          const scaleY = viewportHeight / diagramHeight
          const fitZoom = Math.min(scaleX, scaleY, 1.0) // Don't zoom in beyond 1.0
          
          // Calculate viewport center
          const viewportCenterX = width / 2
          const viewportCenterY = height / 2
          
          // Calculate pan to center the diagram
          // Transform: translate(pan.x, pan.y) scale(zoom)
          // To center: pan.x + diagramCenterX * zoom = viewportCenterX
          const newPanX = viewportCenterX - diagramCenterX * fitZoom
          const newPanY = viewportCenterY - diagramCenterY * fitZoom
          
          // Update zoom and pan to fit diagram
          setZoom(fitZoom)
          setPan({ x: newPanX, y: newPanY })
        }
        
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
        return
      }
      
      // Continue simulation
      currentAlpha *= (1 - alphaDecay)
      animationFrameId = requestAnimationFrame(tick)
    }

    const render = () => {
      // Use refs for current nodes and links
      const currentNodes = nodesRef.current
      const currentLinks = linksRef.current
      
      // Get SVG element
      const svg = svgRef.current
      if (!svg) return // SVG not ready yet
      
      // Get or create pan-zoom group
      let g = svg.querySelector('#pan-zoom-group') as SVGGElement
      if (!g) {
        svg.innerHTML = ''
        
        // Add SVG filters for glow effects
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
        filter.setAttribute('id', 'glow')
        filter.setAttribute('x', '-50%')
        filter.setAttribute('y', '-50%')
        filter.setAttribute('width', '200%')
        filter.setAttribute('height', '200%')
        
        const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur')
        feGaussianBlur.setAttribute('stdDeviation', '3')
        feGaussianBlur.setAttribute('result', 'coloredBlur')
        
        const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge')
        const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode')
        feMergeNode1.setAttribute('in', 'coloredBlur')
        const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode')
        feMergeNode2.setAttribute('in', 'SourceGraphic')
        
        feMerge.appendChild(feMergeNode1)
        feMerge.appendChild(feMergeNode2)
        filter.appendChild(feGaussianBlur)
        filter.appendChild(feMerge)
        defs.appendChild(filter)
        
        // Add style element for smooth transitions
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
        style.textContent = `
          .node-group {
            transition: transform 0.3s ease-out;
          }
          .node-group.dragging {
            transition: none;
          }
          #pan-zoom-group {
            transition: transform 0.3s ease-out;
          }
        `
        defs.appendChild(style)
        svg.appendChild(defs)
        
        g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        g.setAttribute('id', 'pan-zoom-group')
        svg.appendChild(g)
      }
      
      // Update transform with smooth transition
      g.setAttribute('transform', `translate(${pan.x}, ${pan.y}) scale(${zoom})`)
      g.setAttribute('style', 'transition: transform 0.3s ease-out;')
      
      // Clear only the group content (not the group itself)
      g.innerHTML = ''

      // Build proper hierarchy based on view dimension
      // Default hierarchy order
      const baseHierarchyOrder = ['customer', 'vendor', 'agent', 'llm_provider', 'system']
      
      // Define hierarchy based on view dimension
      let hierarchyOrder: string[] = []
      if (viewDimension === 'vendor') {
        hierarchyOrder = ['customer', 'vendor', 'agent', 'llm_provider', 'system']
      } else if (viewDimension === 'llm') {
        hierarchyOrder = ['customer', 'llm_provider', 'agent', 'vendor', 'system']
      } else if (viewDimension === 'agent') {
        hierarchyOrder = ['customer', 'agent', 'vendor', 'llm_provider', 'system']
      } else {
        hierarchyOrder = baseHierarchyOrder
      }
      const typeLabels: Record<string, string> = {
        customer: 'Customer',
        vendor: 'Vendor',
        agent: 'Agent',
        llm_provider: 'LLM Provider',
        system: 'System'
      }
      
      // Build adjacency map for relationships (both directions for reverse traversal)
      const adjacencyMap = new Map<string, Array<{ target: string; link: Link }>>()
      const reverseAdjacencyMap = new Map<string, Array<{ source: string; link: Link }>>() // For reverse traversal
      currentLinks.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id || String(link.source)
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id || String(link.target)
        
        // Forward: source -> target
        if (!adjacencyMap.has(sourceId)) {
          adjacencyMap.set(sourceId, [])
        }
        adjacencyMap.get(sourceId)!.push({ target: targetId, link })
        
        // Reverse: target -> source (for LLM view: LLM -> Agent -> Vendor)
        if (!reverseAdjacencyMap.has(targetId)) {
          reverseAdjacencyMap.set(targetId, [])
        }
        reverseAdjacencyMap.get(targetId)!.push({ source: sourceId, link })
      })
      
      // Group nodes by type
      const nodesByType = new Map<string, Node[]>()
      hierarchyOrder.forEach(type => {
        nodesByType.set(type, currentNodes.filter(n => n.type === type))
      })
      
      // Build hierarchy tree based on ACTUAL link relationships, not type ordering
      const buildHierarchyTree = (centerType: string, dimension: 'vendor' | 'llm' | 'agent') => {
        const tree = new Map<string, { level: number; parent: string | null; children: string[]; x?: number; y?: number }>()
        
        if (centerType === 'all') {
          // For 'all', always start from customer/tenant node as root
          const customerNodes = nodesByType.get('customer') || []
          customerNodes.forEach(node => {
            tree.set(node.id, { level: 0, parent: null, children: [] })
            buildChildrenFromLinks(node.id, 0, tree, new Set())
          })
          return tree
        }
        
        // For specific centerType, start from those nodes
        const centerNodes = nodesByType.get(centerType) || []
        centerNodes.forEach(node => {
          tree.set(node.id, { level: 0, parent: null, children: [] })
          buildChildrenFromLinks(node.id, 0, tree, new Set())
        })
        
        return tree
      }
      
      // Build children based on ACTUAL link relationships from adjacency map
      // Supports both forward and reverse traversal based on viewDimension
      // Always traverses to customer/tenant nodes when reaching vendors
      const buildChildrenFromLinks = (
        parentId: string,
        parentLevel: number,
        tree: Map<string, { level: number; parent: string | null; children: string[] }>,
        visited: Set<string>
      ) => {
        // Prevent infinite loops
        if (visited.has(parentId)) return
        visited.add(parentId)
        
        const parentNode = currentNodes.find(n => n.id === parentId)
        if (!parentNode) return
        
        // Determine traversal direction based on viewDimension
        // For LLM view: traverse backwards (LLM -> Agent -> Vendor)
        // For Vendor/Agent view: traverse forwards (Vendor -> Agent -> LLM)
        const useReverseTraversal = viewDimension === 'llm'
        
        if (useReverseTraversal) {
          // Reverse traversal: find parents (sources that point to this node)
          const incomingLinks = reverseAdjacencyMap.get(parentId) || []
          incomingLinks.forEach(({ source }) => {
            const childNode = currentNodes.find(n => n.id === source)
            if (!childNode) return
            
            // Only add if not already in tree (avoid duplicates)
            if (!tree.has(source)) {
              tree.set(source, { level: parentLevel + 1, parent: parentId, children: [] })
              const parentTree = tree.get(parentId)!
              if (!parentTree.children.includes(source)) {
                parentTree.children.push(source)
              }
              // Recursively build children
              buildChildrenFromLinks(source, parentLevel + 1, tree, new Set(visited))
        }
          })
          
          // Special case: If current node is a vendor, also check for outgoing links to customer/tenant
          // This ensures we traverse all the way to the tenant node
          if (parentNode.type === 'vendor') {
            const outgoingLinks = adjacencyMap.get(parentId) || []
            outgoingLinks.forEach(({ target }) => {
              const targetNode = currentNodes.find(n => n.id === target)
              if (!targetNode) return
              
              // Only add customer/tenant nodes
              if (targetNode.type === 'customer') {
                // Only add if not already in tree (avoid duplicates)
                if (!tree.has(target)) {
                  tree.set(target, { level: parentLevel + 1, parent: parentId, children: [] })
                  const parentTree = tree.get(parentId)!
                  if (!parentTree.children.includes(target)) {
                    parentTree.children.push(target)
                  }
                  // Don't recurse from customer/tenant (it's the final destination)
                }
              }
            })
          }
        } else {
          // Forward traversal: find children (targets from this node)
          const outgoingLinks = adjacencyMap.get(parentId) || []
          outgoingLinks.forEach(({ target }) => {
            const childNode = currentNodes.find(n => n.id === target)
            if (!childNode) return
            
            // Only add if not already in tree (avoid duplicates)
            if (!tree.has(target)) {
              tree.set(target, { level: parentLevel + 1, parent: parentId, children: [] })
              const parentTree = tree.get(parentId)!
              if (!parentTree.children.includes(target)) {
                parentTree.children.push(target)
              }
              // Recursively build children
              buildChildrenFromLinks(target, parentLevel + 1, tree, new Set(visited))
        }
          })
          
          // Special case: If current node is a vendor, also check for outgoing links to customer/tenant
          // This ensures we traverse all the way to the tenant node in forward traversal
          if (parentNode.type === 'vendor') {
            const outgoingLinks = adjacencyMap.get(parentId) || []
            outgoingLinks.forEach(({ target }) => {
              const targetNode = currentNodes.find(n => n.id === target)
              if (!targetNode) return
              
              // Only add customer/tenant nodes
              if (targetNode.type === 'customer') {
                // Only add if not already in tree (avoid duplicates)
                if (!tree.has(target)) {
                  tree.set(target, { level: parentLevel + 1, parent: parentId, children: [] })
                  const parentTree = tree.get(parentId)!
                  if (!parentTree.children.includes(target)) {
                    parentTree.children.push(target)
                  }
                  // Don't recurse from customer/tenant (it's the final destination)
                }
              }
            })
          }
          
          // Special case: If we're starting from LLM and using forward traversal (agent/vendor view),
          // we need to check reverse links to find agents that use this LLM
          // This is needed because links are stored as Agent -> LLM (agents use LLMs)
          if (parentNode.type === 'llm_provider' && (viewDimension === 'agent' || viewDimension === 'vendor')) {
            // Check reverse links to find agents that use this LLM
            const incomingLinks = reverseAdjacencyMap.get(parentId) || []
            incomingLinks.forEach(({ source }) => {
              const sourceNode = currentNodes.find(n => n.id === source)
              if (!sourceNode) return
              
              // Only add agent nodes
              if (sourceNode.type === 'agent') {
                // Only add if not already in tree (avoid duplicates)
                if (!tree.has(source)) {
                  tree.set(source, { level: parentLevel + 1, parent: parentId, children: [] })
                  const parentTree = tree.get(parentId)!
                  if (!parentTree.children.includes(source)) {
                    parentTree.children.push(source)
                  }
                  // Recursively build children from agent (will continue to vendors, then tenant)
                  buildChildrenFromLinks(source, parentLevel + 1, tree, new Set(visited))
                }
              }
            })
          }
        }
      }
      
      const hierarchyTree = buildHierarchyTree(centerBy, viewDimension)
      
      // Filter nodes to only show those in the hierarchy tree (connected nodes)
      // Also filter out orphan nodes (nodes with no connections)
      const connectedNodeIds = new Set<string>()
      const nodesWithLinks = new Set<string>()
      
      // First, identify all nodes that have at least one link
      currentLinks.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id || String(link.source)
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id || String(link.target)
        nodesWithLinks.add(sourceId)
        nodesWithLinks.add(targetId)
      })
      
      if (centerBy === 'all') {
        // For 'all', include all nodes that have connections (exclude orphans)
        // Always include customer/tenant nodes as they are the root
        currentLinks.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id || String(link.source)
          const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id || String(link.target)
          connectedNodeIds.add(sourceId)
          connectedNodeIds.add(targetId)
        })
        // Always include customer nodes as root
        const customerNodes = nodesByType.get('customer') || []
        customerNodes.forEach(node => connectedNodeIds.add(node.id))
      } else {
        // For specific centerBy, only include nodes in the hierarchy tree
        hierarchyTree.forEach((treeInfo, nodeId) => {
          connectedNodeIds.add(nodeId)
          // Add all children recursively
          const addChildren = (id: string) => {
            const info = hierarchyTree.get(id)
            if (info) {
              info.children.forEach(childId => {
                connectedNodeIds.add(childId)
                addChildren(childId)
              })
            }
          }
          addChildren(nodeId)
        })
      }
      
      // Filter nodes: only show connected ones AND exclude orphan nodes
      // Always include customer nodes when they're in the hierarchy tree (connected to vendors)
      const filteredNodes = currentNodes.filter(node => {
        const isConnected = connectedNodeIds.has(node.id)
        const hasLinks = nodesWithLinks.has(node.id)
        const isInTree = hierarchyTree.has(node.id)
        // Include if: (1) in connected set AND (2) has links OR is customer/tenant in tree
        return isConnected && (hasLinks || (node.type === 'customer' && isInTree))
      })
      
      // Calculate level positions - horizontal layout (left to right)
      const maxLevel = centerBy === 'all' ? hierarchyOrder.length : Math.max(...Array.from(hierarchyTree.values()).map(t => t.level), 0)
      const levelWidth = maxLevel > 0 ? (width * 0.85) / (maxLevel + 1) : width * 0.85
      const rootX = width * 0.08
      const rootY = height / 2
      
      // Draw hierarchy using the actual tree structure built from links
      const drawHierarchyFromTree = (
        nodeId: string,
        level: number,
        parentX: number,
        parentY: number,
        tree: Map<string, { level: number; parent: string | null; children: string[] }>
      ) => {
        const node = currentNodes.find(n => n.id === nodeId)
        if (!node) return
        
        const treeInfo = tree.get(nodeId)
        if (!treeInfo) return
        
        const levelX = rootX + level * levelWidth
        const nodeY = parentY // Will be adjusted for multiple children
        
        node.x = levelX
        node.y = nodeY
        
        // Draw connection from parent if not root
        if (treeInfo.parent) {
          const parentNode = currentNodes.find(n => n.id === treeInfo.parent)
          if (parentNode && parentNode.x !== undefined && parentNode.y !== undefined) {
            const parentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
            const midX = ((parentNode.x || 0) + levelX) / 2
            const pathData = `M ${parentNode.x || 0} ${parentNode.y || 0} Q ${midX} ${nodeY} ${levelX} ${nodeY}`
            parentPath.setAttribute('d', pathData)
            parentPath.setAttribute('fill', 'none')
            parentPath.setAttribute('stroke', '#93c5fd')
            parentPath.setAttribute('stroke-width', '1')
            parentPath.setAttribute('opacity', '0.6')
            g.appendChild(parentPath)
          }
        }
        
        // Check if expanded
        const isExpanded = expandedNodes.size === 0 || expandedNodes.has(nodeId)
        if (isExpanded && treeInfo.children.length > 0) {
          // Position children with better spacing to prevent overlaps
          const children = treeInfo.children.map(id => currentNodes.find(n => n.id === id)).filter(Boolean) as Node[]
          
          // Calculate spacing based on maximum node size + label height at this level
          // Account for largest node size (40px for customer) + label height (~50px) + padding
          const maxNodeSize = Math.max(...children.map(n => (NODE_SIZES[n.type] || 15) * 2))
          const labelHeight = 50 // Approximate label height (increased)
          const padding = 40 // Extra padding between nodes (increased)
          const minSpacing = maxNodeSize + labelHeight + padding
          
          // Increased spacing: at least 180px between nodes to prevent overlaps
          const childSpacing = Math.max(minSpacing, Math.min(180, height / Math.max(children.length + 1, 2)))
          const totalChildHeight = (children.length - 1) * childSpacing
          const childStartY = nodeY - totalChildHeight / 2
          
          children.forEach((childNode, childIndex) => {
            const childY = childStartY + childIndex * childSpacing
            drawHierarchyFromTree(childNode.id, level + 1, levelX, childY, tree)
          })
        }
      }
      
      // Draw root node
      if (centerBy === 'all') {
        // Draw tenant/customer node as root (always at level 0)
        const rootNodes = Array.from(hierarchyTree.entries())
          .filter(([_, info]) => info.level === 0)
          .map(([id, _]) => id)
        
        if (rootNodes.length > 0) {
          // For tenant root, typically there's only one, but handle multiple if needed
          const rootSpacing = Math.max(150, Math.min(150, height / Math.max(rootNodes.length + 1, 2)))
          const totalRootHeight = (rootNodes.length - 1) * rootSpacing
          const rootStartY = rootY - totalRootHeight / 2
          
          rootNodes.forEach((rootId, index) => {
            const rootYPos = rootStartY + index * rootSpacing
            const rootNode = currentNodes.find(n => n.id === rootId)
            if (!rootNode) return
            
            // Draw tenant/customer node at root level (level 0)
            drawHierarchyFromTree(rootId, 0, rootX, rootYPos, hierarchyTree)
          })
        }
      } else {
        // Reorganized tree with centerBy as root (left to right layout)
        const centerNodes = nodesByType.get(centerBy) || []
        const centerLevel = Array.isArray(hierarchyOrder) ? hierarchyOrder.indexOf(centerBy) : -1
        
        // Position center nodes at root level (left side, vertically centered) with better spacing
        const centerNodeSpacing = Math.max(150, Math.min(150, height / Math.max(centerNodes.length + 1, 2)))
        const totalCenterHeight = (centerNodes.length - 1) * centerNodeSpacing
        const centerStartY = rootY - totalCenterHeight / 2
        
        centerNodes.forEach((node, index) => {
          const nodeY = centerStartY + index * centerNodeSpacing
          node.x = rootX
          node.y = nodeY
          
          // Node will be rendered in the main node rendering loop below
          // No need to draw it here to avoid duplicates
          
          // Build and position children recursively (left to right) with expand/collapse
          // Use the hierarchy tree which is built from actual links
          const positionChildren = (parentId: string, parentLevel: number, parentX: number, parentY: number) => {
            const treeInfo = hierarchyTree.get(parentId)
            if (!treeInfo) return
            
            // Check if parent is expanded (default to true if not in set)
            const isExpanded = expandedNodes.size === 0 || expandedNodes.has(parentId)
            if (!isExpanded) return // Don't show children if collapsed
            
            const children = treeInfo.children
            if (children.length === 0) return
            
            const childNodes = children.map(id => currentNodes.find(n => n.id === id)).filter(Boolean) as Node[]
            
            // Position children to the right of parent with better spacing
            const childLevelX = rootX + (parentLevel + 1) * levelWidth
            
            // Calculate spacing based on maximum node size + label height + CVE badges at this level
            // Account for largest node size (40px for customer) + label height (~50px) + CVE badge (~30px) + padding
            const maxNodeSize = Math.max(...childNodes.map(n => (NODE_SIZES[n.type] || 15) * 2))
            const labelHeight = 50 // Approximate label height
            const cveBadgeHeight = 30 // Space for CVE badge below node
            const padding = 50 // Extra padding between nodes (increased to prevent overlap)
            const minSpacing = maxNodeSize + labelHeight + cveBadgeHeight + padding
            
            // Increased spacing: at least 180px between nodes to prevent overlaps
            const childSpacing = Math.max(minSpacing, Math.min(180, height / Math.max(childNodes.length + 1, 2)))
            const totalChildHeight = (childNodes.length - 1) * childSpacing
            const childStartY = parentY - totalChildHeight / 2
            
            childNodes.forEach((childNode, childIndex) => {
              const childY = childStartY + childIndex * childSpacing
              childNode.x = childLevelX
              childNode.y = childY
              
              // Draw connection from parent to child (horizontal, left to right)
              const childPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
              const midX = (parentX + childLevelX) / 2
              const pathData = `M ${parentX} ${parentY} Q ${midX} ${childY} ${childLevelX} ${childY}`
              childPath.setAttribute('d', pathData)
              childPath.setAttribute('fill', 'none')
              childPath.setAttribute('stroke', '#93c5fd')
              childPath.setAttribute('stroke-width', '1')
              childPath.setAttribute('opacity', '0.6')
              g.appendChild(childPath)
              
              // Recursively position grandchildren (continuing left to right)
              positionChildren(childNode.id, parentLevel + 1, childLevelX, childY)
            })
          }
          
          positionChildren(node.id, 0, rootX, nodeY)
      })
      }

      // Skip drawing regular links - the hierarchical tree already shows all connections
      // This prevents duplicate lines and keeps the diagram clean

      // Track label positions for collision detection
      const labelPositions: Array<{x: number, y: number, width: number, height: number}> = []

      // Draw individual nodes in hierarchical layout (only connected nodes)
      filteredNodes.forEach(node => {
        // Use refs to get latest values
        const isSelected = selectedNodeRef.current?.id === node.id
        const isHovered = hoveredNodeRef.current?.id === node.id
        const currentFocused = focusedNodeRef.current
        const isFocused = currentFocused && (typeof currentFocused === 'string' ? currentFocused : currentFocused.id) === node.id
        const size = isFocused ? (NODE_SIZES[node.type] || 15) * 1.3 : (NODE_SIZES[node.type] || 15)
        
        // Check for security incidents/breaches/CVE matches for vendor nodes
        const hasBreaches = node.type === 'vendor' && node.metadata?.has_active_breaches === true
        const hasCriticalIncidents = node.type === 'vendor' && node.metadata?.has_critical_incidents === true
        // Check both enriched CVE status (from frontend query) and metadata from backend
        const hasActiveCVE = node.type === 'vendor' && (
          node.metadata?.has_active_cve_matches === true || 
          (node.metadata?.active_cve_count && node.metadata.active_cve_count > 0)
        )
        const securityStatus = node.type === 'vendor' ? node.metadata?.security_status : null
        
        // Determine color based on node type and CVE status
        // If vendor has active CVE matches, use RED color instead of green
        let color = NODE_COLORS[node.type] || '#6b7280'
        if (node.type === 'vendor' && hasActiveCVE) {
          color = '#ef4444' // Red for vendors with active CVE matches
        }
        
        // Determine stroke color based on security status
        let strokeColor = isFocused ? '#3b82f6' : isSelected || isHovered ? '#000' : '#fff'
        let strokeWidth = isFocused ? '4' : isSelected ? '3' : isHovered ? '2' : '1'
        
        // Add red border/glow for vendors with breaches, critical incidents, or active CVE matches
        if (hasBreaches || hasCriticalIncidents || hasActiveCVE) {
          strokeColor = '#ef4444' // Red for security alerts
          strokeWidth = isFocused ? '5' : '4' // Thicker border for security alerts
        } else if (securityStatus === 'monitoring' || securityStatus === 'at_risk') {
          strokeColor = '#f59e0b' // Orange for monitoring/at risk
          strokeWidth = isFocused ? '4' : '3'
        }

        // Add risk indicator on top of node (for vendors with active CVE matches)
        // Position it higher to avoid overlap with node
        if (node.type === 'vendor' && hasActiveCVE) {
          const riskIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          riskIndicator.setAttribute('transform', `translate(${node.x || 0}, ${(node.y || 0) - size - 20})`)
          riskIndicator.setAttribute('pointer-events', 'none')
          
          // Risk badge background
          const riskBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          riskBg.setAttribute('x', '-22')
          riskBg.setAttribute('y', '-8')
          riskBg.setAttribute('width', '44')
          riskBg.setAttribute('height', '16')
          riskBg.setAttribute('rx', '8')
          riskBg.setAttribute('fill', '#ef4444')
          riskBg.setAttribute('stroke', '#fff')
          riskBg.setAttribute('stroke-width', '1.5')
          riskIndicator.appendChild(riskBg)
          
          // Risk text
          const riskText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          riskText.setAttribute('x', '0')
          riskText.setAttribute('y', '2')
          riskText.setAttribute('text-anchor', 'middle')
          riskText.setAttribute('dominant-baseline', 'middle')
          riskText.setAttribute('fill', '#fff')
          riskText.setAttribute('font-size', '10')
          riskText.setAttribute('font-weight', 'bold')
          riskText.textContent = 'RISK'
          riskIndicator.appendChild(riskText)
          
          g.appendChild(riskIndicator)
        }
        
        // Create node group - simple colored circle only, no icons
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        nodeGroup.setAttribute('transform', `translate(${node.x || 0}, ${node.y || 0})`)
        nodeGroup.setAttribute('cursor', draggedNodeRef.current?.id === node.id ? 'grabbing' : 'pointer')
        nodeGroup.setAttribute('data-node-id', node.id)
        nodeGroup.setAttribute('pointer-events', 'all')
        // Add class for styling and transitions
        const isDragging = draggedNodeRef.current?.id === node.id
        nodeGroup.setAttribute('class', `node-group ${isDragging ? 'dragging' : ''} ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} ${hasBreaches || hasCriticalIncidents ? 'has-breaches' : ''}`)
        
        // Add glow effect for vendors with breaches/critical incidents
        if (hasBreaches || hasCriticalIncidents) {
          const glowCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
          glowCircle.setAttribute('cx', '0')
          glowCircle.setAttribute('cy', '0')
          glowCircle.setAttribute('r', String(size + 3))
          glowCircle.setAttribute('fill', 'none')
          glowCircle.setAttribute('stroke', '#ef4444')
          glowCircle.setAttribute('stroke-width', '3')
          glowCircle.setAttribute('opacity', '0.5')
          glowCircle.setAttribute('filter', 'url(#glow)')
          nodeGroup.appendChild(glowCircle)
        }
        
        // Add larger invisible hit area for easier clicking (much larger for tiny dots)
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        hitArea.setAttribute('cx', '0')
        hitArea.setAttribute('cy', '0')
        hitArea.setAttribute('r', String(Math.max(size + 8, 15))) // Larger hit area for tiny dots
        hitArea.setAttribute('fill', 'transparent')
        hitArea.setAttribute('pointer-events', 'all')
        nodeGroup.appendChild(hitArea)
        
        // Main colored circle - this is the visible node
        const nodeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        nodeCircle.setAttribute('cx', '0')
        nodeCircle.setAttribute('cy', '0')
        nodeCircle.setAttribute('r', String(size))
        nodeCircle.setAttribute('fill', color)
        nodeCircle.setAttribute('stroke', strokeColor)
        nodeCircle.setAttribute('stroke-width', strokeWidth)
        nodeCircle.setAttribute('opacity', isHovered || isSelected ? '1' : '0.9')
        nodeCircle.setAttribute('pointer-events', 'all')
        nodeGroup.appendChild(nodeCircle)
        
        // Store reference for event handlers
        const nodeElement = nodeGroup
        // Make the entire group clickable
        nodeGroup.setAttribute('pointer-events', 'all')
        nodeElement.addEventListener('click', (e) => {
          // Prevent pan when clicking on nodes
          e.stopPropagation()
          e.preventDefault()
          
          // Toggle expand/collapse on Ctrl+click or Meta+click
          if (e.ctrlKey || e.metaKey) {
            const newExpanded = new Set(expandedNodes)
            if (newExpanded.has(node.id)) {
              newExpanded.delete(node.id)
            } else {
              newExpanded.add(node.id)
            }
            setExpandedNodes(newExpanded)
            simulationRunningRef.current = false
            return
          }
          
          // Single click: Select node and show details
          setSelectedNode(node)
          setShowDetailsPanel(true)
        })
        nodeElement.addEventListener('contextmenu', (e) => {
          // Right-click to show context menu
          e.preventDefault()
          e.stopPropagation()
          
          // Get mouse position relative to container
          const rect = containerRef.current?.getBoundingClientRect()
          if (rect) {
            setContextMenu({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
              node: node
            })
          }
        })
        nodeElement.addEventListener('mouseenter', (e: MouseEvent) => {
          // Only update if node position is valid
          if (node.x !== undefined && node.y !== undefined) {
            setHoveredNode(node)
            // Use mouse position for tooltip - more accurate and follows cursor
            const rect = containerRef.current?.getBoundingClientRect()
            if (rect) {
              // Calculate position relative to container
              const mouseX = e.clientX - rect.left
              const mouseY = e.clientY - rect.top
              setMousePosition({ x: mouseX, y: mouseY })
              
              // Also calculate node position relative to container for fallback
              if (svgRef.current) {
              const svgRect = svgRef.current.getBoundingClientRect()
                // Node position in SVG coordinates, transformed to screen coordinates
                const nodeX = (node.x || 0) * zoom + pan.x + (svgRect.left - rect.left)
                const nodeY = (node.y || 0) * zoom + pan.y + (svgRect.top - rect.top)
              setHoveredNodePosition({ x: nodeX, y: nodeY })
            } else {
              setHoveredNodePosition({ x: node.x || 0, y: node.y || 0 })
              }
            } else {
              setMousePosition({ x: e.clientX, y: e.clientY })
              setHoveredNodePosition({ x: node.x || 0, y: node.y || 0 })
            }
          }
        })
        
        // Track mouse movement while hovering over node
        nodeElement.addEventListener('mousemove', (e: MouseEvent) => {
          if (hoveredNodeRef.current?.id === node.id) {
            const rect = containerRef.current?.getBoundingClientRect()
            if (rect) {
              const mouseX = e.clientX - rect.left
              const mouseY = e.clientY - rect.top
              setMousePosition({ x: mouseX, y: mouseY })
            } else {
              setMousePosition({ x: e.clientX, y: e.clientY })
            }
          }
        })
        nodeElement.addEventListener('mouseleave', () => {
          // Don't clear hover if we're dragging
          if (!draggedNode || draggedNode.id !== node.id) {
            setHoveredNode(null)
            setHoveredNodePosition(null)
            setMousePosition(null)
          }
        })
        
        // Add drag functionality - improved to prevent conflicts
        const handleMouseDown = (e: MouseEvent) => {
          // Only start drag on left mouse button
          if (e.button !== 0) return
          
          e.stopPropagation() // Prevent pan
          e.preventDefault() // Prevent default behavior
          
          // Get SVG coordinates - need to account for pan/zoom transform
          const svg = svgRef.current
          if (!svg) return
          
          // Get the pan-zoom group to transform coordinates correctly
          const panZoomGroup = svg.querySelector('#pan-zoom-group') as SVGGElement
          if (!panZoomGroup) return
          
          const svgPoint = svg.createSVGPoint()
          svgPoint.x = e.clientX
          svgPoint.y = e.clientY
          
          // Transform to SVG coordinate space (accounts for viewBox, but not pan/zoom)
          const svgCTM = svg.getScreenCTM()
          if (svgCTM) {
            const svgCoords = svgPoint.matrixTransform(svgCTM.inverse())
            
            // Store initial mouse position for drag threshold check
            dragStartMousePosRef.current = { x: e.clientX, y: e.clientY }
            isDragActiveRef.current = false // Not dragging yet - waiting for threshold
            
            // Now account for pan/zoom transform
            const nodeStartX = node.x || 0
            const nodeStartY = node.y || 0
            
            // Calculate offset from node center (in SVG coordinate space, before pan/zoom)
            const offsetX = (svgCoords.x - pan.x) / zoom - nodeStartX
            const offsetY = (svgCoords.y - pan.y) / zoom - nodeStartY
            
            // Store in refs for reliable access
            draggedNodeRef.current = node
            dragOffsetRef.current = { x: offsetX, y: offsetY }
            setDraggedNode(node)
            setDragOffset({ x: offsetX, y: offsetY })
            // Don't set isDragging yet - wait for mouse to move beyond threshold
            // Connected nodes will be set up in handleMouseMove when drag actually starts
          }
        }
        
        // Add global mouse move and up handlers (attached to window to work even if mouse leaves node)
        const handleMouseMove = (e: MouseEvent) => {
          const currentDragged = draggedNodeRef.current
          if (!currentDragged || currentDragged.id !== node.id) return
          
          // Check drag threshold - only start dragging if mouse moved more than 5 pixels
          if (!isDragActiveRef.current && dragStartMousePosRef.current) {
            const dx = e.clientX - dragStartMousePosRef.current.x
            const dy = e.clientY - dragStartMousePosRef.current.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            // If mouse hasn't moved enough, don't start dragging yet
            if (distance < 5) {
              return
            }
            
            // Mouse moved beyond threshold - start dragging
            isDragActiveRef.current = true
            setIsDragging(true)
            
            // Now initialize drag state (find connected nodes, etc.)
            const currentLinks = linksRef.current
            const currentNodes = nodesRef.current
            
            // Build adjacency list (undirected)
            const adjacencyList = new Map<string, Set<string>>()
            currentLinks.forEach(link => {
              const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id
              const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id
              
              if (!adjacencyList.has(sourceId)) {
                adjacencyList.set(sourceId, new Set())
              }
              if (!adjacencyList.has(targetId)) {
                adjacencyList.set(targetId, new Set())
              }
              adjacencyList.get(sourceId)!.add(targetId)
              adjacencyList.get(targetId)!.add(sourceId)
            })
            
            // BFS to find all connected nodes
            const connectedNodeIds = new Set<string>([node.id])
            const queue = [node.id]
            const visited = new Set<string>([node.id])
            
            while (queue.length > 0) {
              const currentNodeId = queue.shift()!
              const neighbors = adjacencyList.get(currentNodeId) || new Set()
              
              neighbors.forEach(neighborId => {
                if (!visited.has(neighborId)) {
                  visited.add(neighborId)
                  connectedNodeIds.add(neighborId)
                  queue.push(neighborId)
                }
              })
            }
            
            // Store connected nodes and their initial positions
            connectedNodesRef.current = connectedNodeIds
            dragStartPositionsRef.current.clear()
            connectedNodeIds.forEach(nodeId => {
              const connectedNode = currentNodes.find(n => n.id === nodeId)
              if (connectedNode) {
                dragStartPositionsRef.current.set(nodeId, {
                  x: connectedNode.x || 0,
                  y: connectedNode.y || 0
                })
              }
            })
          }
          
          // Only move nodes if drag is actually active
          if (!isDragActiveRef.current) return
          
          const svg = svgRef.current
          if (!svg) return
          
          const svgPoint = svg.createSVGPoint()
          svgPoint.x = e.clientX
          svgPoint.y = e.clientY
          
          const svgCTM = svg.getScreenCTM()
          if (svgCTM) {
            // Transform to SVG coordinate space
            const svgCoords = svgPoint.matrixTransform(svgCTM.inverse())
            
            // Account for pan/zoom and apply offset
            const currentOffset = dragOffsetRef.current
            const newX = (svgCoords.x - pan.x) / zoom - currentOffset.x
            const newY = (svgCoords.y - pan.y) / zoom - currentOffset.y
            
            // Keep node in bounds
            const width = widthRef.current
            const height = heightRef.current
            const boundedX = Math.max(50, Math.min(width - 50, newX))
            const boundedY = Math.max(50, Math.min(height - 50, newY))
            
            // Calculate delta movement
            const startPos = dragStartPositionsRef.current.get(node.id)
            if (startPos) {
              const deltaX = boundedX - startPos.x
              const deltaY = boundedY - startPos.y
              
              // Move dragged node
              node.x = boundedX
              node.y = boundedY
              
              // Move all connected nodes by the same delta
              const currentNodes = nodesRef.current
              const connectedNodeIds = connectedNodesRef.current
              
              connectedNodeIds.forEach(connectedNodeId => {
                if (connectedNodeId !== node.id) {
                  const connectedNode = currentNodes.find(n => n.id === connectedNodeId)
                  if (connectedNode) {
                    const connectedStartPos = dragStartPositionsRef.current.get(connectedNodeId)
                    if (connectedStartPos) {
                      const newConnectedX = connectedStartPos.x + deltaX
                      const newConnectedY = connectedStartPos.y + deltaY
                      
                      // Keep connected nodes in bounds
                      connectedNode.x = Math.max(50, Math.min(width - 50, newConnectedX))
                      connectedNode.y = Math.max(50, Math.min(height - 50, newConnectedY))
                      
                      // Stop velocity for connected nodes
                      connectedNode.vx = 0
                      connectedNode.vy = 0
                    }
                  }
                }
              })
            } else {
              // Fallback if start position not found
              node.x = boundedX
              node.y = boundedY
            }
            
            // Update node group position (disable transitions during drag)
            nodeElement.setAttribute('transform', `translate(${node.x}, ${node.y})`)
            nodeElement.classList.add('dragging')
            
            // Stop velocity
            node.vx = 0
            node.vy = 0
            
            // Update all connected node visual positions immediately
            const currentNodes = nodesRef.current
            const connectedNodeIds = connectedNodesRef.current
            const svg = svgRef.current
            if (svg) {
              connectedNodeIds.forEach(connectedNodeId => {
                if (connectedNodeId !== node.id) {
                  const connectedNode = currentNodes.find(n => n.id === connectedNodeId)
                  if (connectedNode) {
                    const connectedElement = svg.querySelector(`[data-node-id="${connectedNodeId}"]`) as SVGGElement
                    if (connectedElement) {
                      connectedElement.setAttribute('transform', `translate(${connectedNode.x || 0}, ${connectedNode.y || 0})`)
                      connectedElement.classList.add('dragging')
                    }
                  }
                }
              })
            }
          }
        }
        
        const handleMouseUp = () => {
          const currentDragged = draggedNodeRef.current
          if (currentDragged && currentDragged.id === node.id) {
            // If drag never started (just a click), don't do anything
            if (!isDragActiveRef.current) {
              draggedNodeRef.current = null
              dragStartMousePosRef.current = null
              isDragActiveRef.current = false
              window.removeEventListener('mousemove', handleMouseMove)
              window.removeEventListener('mouseup', handleMouseUp)
              return
            }
            
            draggedNodeRef.current = null
            setDraggedNode(null)
            setIsDragging(false)
            dragStartMousePosRef.current = null
            isDragActiveRef.current = false
            nodeElement.setAttribute('cursor', 'pointer')
            // Re-enable transitions after drag ends
            nodeElement.classList.remove('dragging')
            
            // Clear connected nodes tracking
            connectedNodesRef.current.clear()
            dragStartPositionsRef.current.clear()
            
            // Remove global listeners
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
          }
        }
        
        // Add mousedown listener
        nodeElement.addEventListener('mousedown', (e) => {
          handleMouseDown(e)
          // Add global listeners when drag starts
          window.addEventListener('mousemove', handleMouseMove)
          window.addEventListener('mouseup', handleMouseUp)
        })
        
        g.appendChild(nodeElement)

        // Always show node labels in hierarchical layout
        const nodeX = node.x || 0
        const nodeY = node.y || 0
        
        // Expand/collapse indicator removed - using simple colored circles only
        
        // Simple label next to node (right side)
        const displayLabel = node.label.length > 20 
          ? node.label.substring(0, 20) + '...' 
          : node.label
        
        // Position label further right and adjust Y to account for badges
        const labelX = nodeX + size + 15 // More space from node
        const labelY = nodeY
        
        // Add text label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', String(labelX))
        text.setAttribute('y', String(labelY + 5))
        text.setAttribute('text-anchor', 'start')
        text.setAttribute('dominant-baseline', 'middle')
        text.setAttribute('fill', '#374151')
        text.setAttribute('font-size', '12')
        text.setAttribute('font-weight', '500')
        text.setAttribute('pointer-events', 'none')
        text.textContent = displayLabel
        g.appendChild(text)
        
        // Add CVE count below node (for vendors with active CVE matches)
        // Position it lower to avoid overlap with node and label
        if (node.type === 'vendor' && hasActiveCVE) {
          const cveCount = node.metadata?.active_cve_count || 0
          const cveLabelX = nodeX
          const cveLabelY = nodeY + size + 20
          
          // CVE count background
          const cveBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          cveBg.setAttribute('x', String(cveLabelX - 30))
          cveBg.setAttribute('y', String(cveLabelY - 8))
          cveBg.setAttribute('width', '60')
          cveBg.setAttribute('height', '16')
          cveBg.setAttribute('rx', '8')
          cveBg.setAttribute('fill', '#ef4444')
          cveBg.setAttribute('stroke', '#fff')
          cveBg.setAttribute('stroke-width', '1.5')
          cveBg.setAttribute('pointer-events', 'none')
          g.appendChild(cveBg)
          
          // CVE count text
          const cveText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          cveText.setAttribute('x', String(cveLabelX))
          cveText.setAttribute('y', String(cveLabelY + 2))
          cveText.setAttribute('text-anchor', 'middle')
          cveText.setAttribute('dominant-baseline', 'middle')
          cveText.setAttribute('fill', '#fff')
          cveText.setAttribute('font-size', '10')
          cveText.setAttribute('font-weight', 'bold')
          cveText.setAttribute('pointer-events', 'none')
          cveText.textContent = `${cveCount} CVE${cveCount !== 1 ? 's' : ''}`
          g.appendChild(cveText)
        }
        
        // Add security badge for vendors with breaches/critical incidents/CVE matches (after text label)
        if (node.type === 'vendor' && (hasBreaches || hasCriticalIncidents || hasActiveCVE)) {
          // Estimate text width (approximate: 7px per character for font-size 12)
          const estimatedTextWidth = displayLabel.length * 7
          const badgeX = labelX + estimatedTextWidth + 8
          const badgeY = labelY + 5
          
          const badgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          badgeGroup.setAttribute('transform', `translate(${badgeX}, ${badgeY})`)
          
          const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
          badgeBg.setAttribute('cx', '0')
          badgeBg.setAttribute('cy', '0')
          badgeBg.setAttribute('r', '8')
          badgeBg.setAttribute('fill', '#ef4444')
          badgeBg.setAttribute('stroke', '#fff')
          badgeBg.setAttribute('stroke-width', '1.5')
          badgeGroup.appendChild(badgeBg)
          
          const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          badgeText.setAttribute('x', '0')
          badgeText.setAttribute('y', '0')
          badgeText.setAttribute('text-anchor', 'middle')
          badgeText.setAttribute('dominant-baseline', 'middle')
          badgeText.setAttribute('fill', '#fff')
          badgeText.setAttribute('font-size', '10')
          badgeText.setAttribute('font-weight', 'bold')
          badgeText.setAttribute('pointer-events', 'none')
          badgeText.textContent = hasBreaches ? '!' : '⚠'
          badgeGroup.appendChild(badgeText)
          
          g.appendChild(badgeGroup)
        }
      })
    }

    // Stop any existing simulation before starting a new one
    if (simulationRunningRef.current) {
      simulationRunningRef.current = false
    }
    
    // Start simulation
    simulationRunningRef.current = true
    tickCount = 0
    
    // Call render immediately to show content right away
    // The render function is defined above in this useEffect scope
    render()
    
    // Then start the animation loop
    animationFrameId = requestAnimationFrame(tick)
    
    // Cleanup function - properly stop simulation
    return () => {
      simulationRunningRef.current = false
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
    }
  }, [memoizedEcosystem, debouncedSearchQuery, centerBy, focusedNode, viewDimension, expandedNodes, isFullscreen]) // Re-run when ecosystem data, search, center type, focus, view dimension, expanded nodes, or fullscreen state change
  
  // Separate effect to update transform when pan/zoom changes (without restarting simulation)
  useEffect(() => {
    if (!svgRef.current) return
    
    const svg = svgRef.current
    const g = svg.querySelector('#pan-zoom-group') as SVGGElement
    if (g) {
      // Update transform immediately - no need for RAF since we're not restarting simulation
      g.setAttribute('transform', `translate(${pan.x}, ${pan.y}) scale(${zoom})`)
    }
  }, [pan, zoom])

  // Refs for pan and zoom to use in wheel handler without re-registering listener
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  
  useEffect(() => {
    panRef.current = pan
  }, [pan])
  
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  // Add non-passive wheel event listener to allow preventDefault
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const handleWheel = (e: WheelEvent) => {
      // Only zoom if directly over SVG visualization, not over control panels
      const target = e.target as HTMLElement | SVGElement
      
      // Don't zoom if over floating panels, buttons, or other controls
      if (target.closest && target.closest('.absolute') && target.closest('svg') !== svg) {
        return // Allow normal page scrolling
      }
      
      // Only zoom if directly over SVG or its direct children (within the pan-zoom-group)
      const svgElement = target.closest ? target.closest('svg') : null
      if (svgElement !== svg) {
        return // Allow normal page scrolling
      }
      
      e.preventDefault()
      e.stopPropagation()
      
      // Use current values from refs
      const currentZoom = zoomRef.current
      const currentPan = panRef.current
      
      // Use smaller increments for smoother zoom
      const zoomSpeed = 0.05
      const delta = e.deltaY > 0 ? (1 - zoomSpeed) : (1 + zoomSpeed)
      const newZoom = Math.max(0.3, Math.min(1.5, currentZoom * delta))
      
      // Only update if zoom actually changed significantly
      if (Math.abs(newZoom - currentZoom) < 0.01) {
        return
      }
      
      // Zoom towards mouse position
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect && svgRef.current) {
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        
        // Calculate zoom point in graph coordinates (accounting for current pan)
        const graphX = (mouseX - currentPan.x) / currentZoom
        const graphY = (mouseY - currentPan.y) / currentZoom
        
        // Adjust pan to zoom towards mouse position
        setPan({
          x: mouseX - graphX * newZoom,
          y: mouseY - graphY * newZoom
        })
      }
      
      setZoom(newZoom)
    }

    // Add event listener with { passive: false } to allow preventDefault
    svg.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      svg.removeEventListener('wheel', handleWheel)
    }
  }, []) // Empty deps - listener registered once, uses refs for current values

  // Effect to recalculate SVG dimensions when entering/exiting fullscreen
  useEffect(() => {
    // Handle body overflow when in fullscreen
    if (isFullscreen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    
    if (!svgRef.current) return
    
    // Immediate update for better responsiveness
    const updateDimensions = () => {
      const svg = svgRef.current
      if (!svg) return
      
      const container = containerRef.current
      // In fullscreen, use full viewport dimensions
      const width = isFullscreen 
        ? window.innerWidth 
        : (container ? container.clientWidth : (svg.clientWidth || window.innerWidth - 100))
      const height = isFullscreen 
        ? window.innerHeight 
        : (container ? container.clientHeight : (svg.clientHeight || window.innerHeight - 200))
      
      // Update refs
      widthRef.current = width
      heightRef.current = height
      
      // Update SVG dimensions
      svg.setAttribute('width', String(width))
      svg.setAttribute('height', String(height))
      
      // Check if pan-zoom-group exists and has content
      const panZoomGroup = svg.querySelector('#pan-zoom-group') as SVGGElement
      if (!panZoomGroup || panZoomGroup.children.length === 0) {
        // If group is missing or empty, force a complete re-render
        // by clearing the hash so the main effect will re-run
        lastEcosystemHashRef.current = ''
      }
      
      // Force restart simulation to recalculate layout with new dimensions
      simulationRunningRef.current = false
    }
    
    // Update immediately
    updateDimensions()
    
    // Also update after a short delay to catch any layout changes and ensure re-render
    const timer = setTimeout(() => {
      updateDimensions()
      // Force simulation restart after dimensions are updated
      if (memoizedEcosystem && svgRef.current) {
        // Clear hash to force re-render if exiting fullscreen
        if (!isFullscreen) {
          lastEcosystemHashRef.current = ''
        }
        simulationRunningRef.current = false
      }
    }, 50)
    
    return () => {
      clearTimeout(timer)
      // Restore body overflow when component unmounts or exits fullscreen
      if (!isFullscreen) {
        document.body.style.overflow = ''
      }
    }
  }, [isFullscreen, memoizedEcosystem])
  
  // Note: Selection/hover updates are handled via refs in the render function
  // The render function runs continuously via requestAnimationFrame, so it will
  // pick up the latest values from the refs automatically

  if (!user) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  const allowedRoles = ['tenant_admin', 'platform_admin', 'security_reviewer', 'compliance_reviewer']
  if (!allowedRoles.includes(user?.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-subheading text-red-500 font-medium mb-2">Access Denied</div>
          <div className="text-body text-gray-600">This visualization is for administrators and reviewers only.</div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading ecosystem map...</div>
        </div>
      </Layout>
    )
  }

  if (error || !ecosystem) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500">Error loading ecosystem map</div>
        </div>
      </Layout>
    )
  }

  // Render without Layout in fullscreen mode
  const content = (
    <div className={`${isFullscreen ? 'fixed inset-0 z-[9999] bg-white' : 'flex-1 flex flex-col min-h-0 overflow-hidden -mx-6 -my-8'}`} style={isFullscreen ? { height: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } : { height: 'calc(100vh - 48px)' }}>
        {/* Header with Filters and Progressive Loading */}
        {!isFullscreen && (
        <MaterialCard elevation={1} className="mb-4 flex-shrink-0 border-none">
          <div className="p-6 space-y-6">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="unified-page-title">Ecosystem Map</h1>
                {focusedNode && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-md">
                    <span className="text-xs font-medium text-primary-700">
                      Showing by selected LLM:
                    </span>
                    <span className="text-xs font-semibold text-primary-900">
                      {typeof focusedNode === 'string' ? focusedNode : focusedNode.label}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <MaterialButton
                  variant="text"
                  size="small"
                  onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                  startIcon={
                    <svg 
                      className="w-4 h-4"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  }
                  className="text-gray-600"
                >
                  {isControlsExpanded ? 'Hide Filters' : 'Show Filters'}
                </MaterialButton>
                {focusedNode && (
                  <MaterialButton
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setFocusedNode(null)
                      setSelectedNode(null)
                    }}
                    startIcon={<span className="text-lg">←</span>}
                  >
                    Back to Full View
                  </MaterialButton>
                )}
                <MaterialButton
                  variant="outlined"
                  size="small"
                  onClick={() => refetch()}
                >
                  🔄 Refresh
                </MaterialButton>
              </div>
            </div>
          
          {isControlsExpanded && (
            <>
              {/* Description and Help */}
              <div className="space-y-3">
                <p className="unified-page-subtitle">
                  {focusedNode 
                    ? `Focusing on: ${typeof focusedNode === 'string' ? focusedNode : focusedNode.label} - Showing connected entities only`
                    : 'Interactive visualization of your AI agent landscape. Use the controls at the top of the visualization to load progressively and center the view. Click any node to focus on it.'}
                </p>
                <MaterialButton
                  variant="text"
                  size="small"
                  onClick={() => setIsHelpExpanded(!isHelpExpanded)}
                  startIcon={
                    <svg 
                      className={`w-3 h-3 transition-transform ${isHelpExpanded ? 'rotate-90' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  }
                  className="text-blue-600"
                >
                  {isHelpExpanded ? 'Hide Help' : 'Show Help'}
                </MaterialButton>
                {isHelpExpanded && (
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-sm">
                    <p className="font-semibold text-primary-900 mb-2">What is this data?</p>
                    <ul className="list-disc list-inside text-primary-800 space-y-1">
                      <li><span className="font-medium">Nodes:</span> Entities (Vendors, Agents, LLM Providers, Systems)</li>
                      <li><span className="font-medium">Lines:</span> Relationships (e.g., "Agent uses LLM", "Vendor provides service")</li>
                      <li><span className="font-medium">Colors:</span> Blue=Tenant, Green=Vendor, Orange=LLM Provider, Purple=Agent, Red=System</li>
                      <li><span className="font-medium">Click a node</span> to see its direct connections</li>
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Search and Filter - Material Design */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MaterialInput
                  label="Search"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="w-full">
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">
                    Filter By
                  </label>
                  <select
                    value={filterBy}
                    onChange={(e) => {
                      setFilterBy(e.target.value)
                      setFilterValue('')
                    }}
                    className="unified-select w-full h-10"
                  >
                    <option value="">All</option>
                    <option value="agent">Agent</option>
                    <option value="vendor">Vendor</option>
                    <option value="llm_vendor">LLM Vendor</option>
                    <option value="llm_type">LLM Type</option>
                    <option value="department">Department</option>
                    <option value="category">Category</option>
                  </select>
                </div>
                <MaterialInput
                  label="Filter Value"
                  placeholder="Enter filter value..."
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  disabled={!filterBy}
                />
              </div>
              
              {(filterBy || filterValue || searchQuery) && (
                <div className="flex justify-end">
                  <MaterialButton
                    variant="text"
                    size="small"
                    onClick={() => {
                      setFilterBy('')
                      setFilterValue('')
                      setSearchQuery('')
                    }}
                    className="text-gray-600"
                  >
                    Clear Filters
                  </MaterialButton>
                </div>
              )}
            
              {/* Legend - Harmonized */}
              <div className="flex items-center gap-6 flex-wrap pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-xs font-normal text-gray-600">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.customer }}></div>
                  <span>Tenant</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-normal text-gray-600">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.vendor }}></div>
                  <span>Vendors</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-normal text-gray-600">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.agent }}></div>
                  <span>Agents/Bots</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-normal text-gray-600">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.llm_provider }}></div>
                  <span>LLM Providers</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-normal text-gray-600">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.system }}></div>
                  <span>Systems</span>
                </div>
              </div>
            </>
          )}
          </div>
        </MaterialCard>
        )}

        {/* Main Content Area - Side by Side */}
        <div className={`flex ${isFullscreen ? 'gap-0 relative' : 'gap-4'} flex-1 min-h-0 overflow-hidden`}>
          {/* Visualization */}
          <MaterialCard 
            elevation={1}
            className="flex-1 p-0 overflow-hidden relative border-none" 
            style={{ 
              height: '100%', 
              minHeight: 0,
              ...(isFullscreen && selectedNode && showDetailsPanel ? { width: 'calc(100% - 320px)' } : {})
            }}
            onClick={(e) => {
              // Close context menu if clicking outside
              // @ts-ignore - target comparison
              if (contextMenu && e.target === e.currentTarget) {
                setContextMenu(null)
              }
            }}
          >
            <div ref={containerRef} className="w-full h-full">
            {/* Floating Panel - Always Visible */}
            {!isFullscreen && (
            <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
              {/* Expanded State - All Controls (Always Visible) */}
              <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-md-elevation-2 p-2">
                  <div className="flex items-center gap-2">
                    {/* Settings Always Visible - Close Button Disabled */}
                    <button
                      onClick={() => {
                        // Settings panel is always visible - do nothing
                        setShowViewDropdown(false)
                        setShowCenterDropdown(false)
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-400 cursor-not-allowed transition-all"
                      title="Settings always visible"
                      disabled
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    
                    {/* Progressive Loading Checkboxes - Icon Only */}
                    <div className="flex items-center gap-1.5">
                      {[
                        { step: 2, label: 'Vendors', short: 'V' },
                        { step: 3, label: 'Agents', short: 'A' },
                        { step: 4, label: 'LLM', short: 'L' },
                        { step: 5, label: 'Systems', short: 'S' }
                      ].map(({ step, label, short }) => (
                        <button
                          key={step}
                          onClick={() => {
                            if (loadStep >= step) {
                              // If checked, uncheck by setting to step - 1
                              setLoadStep(Math.max(1, step - 1))
                            } else {
                              // If unchecked, check by setting to this step
                              setLoadStep(step)
                            }
                          }}
                          className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-all ${
                            loadStep >= step
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title={label}
                        >
                          {short}
                        </button>
                      ))}
                    </div>
                    
                    {/* Divider */}
                    <div className="w-px h-6 bg-gray-200"></div>
                    
                    {/* View Dimension Control - Icon Only */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowViewDropdown(!showViewDropdown)
                          setShowCenterDropdown(false)
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-600 transition-all"
                        title={`View By: ${viewDimension.charAt(0).toUpperCase() + viewDimension.slice(1)}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                      {showViewDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-20" 
                            onClick={() => setShowViewDropdown(false)}
                          />
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-[100px] z-30">
                            <select
                              value={viewDimension}
                              onChange={(e) => {
                                setViewDimension(e.target.value as 'vendor' | 'llm' | 'agent')
                                setExpandedNodes(new Set())
                                simulationRunningRef.current = false
                                setShowViewDropdown(false)
                              }}
                              className="w-full text-xs font-normal text-gray-700 border-none bg-transparent px-2 py-1 hover:bg-gray-50 focus:outline-none cursor-pointer"
                              autoFocus
                            >
                              <option value="vendor">Vendor</option>
                              <option value="llm">LLM</option>
                              <option value="agent">Agent</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Divider */}
                    <div className="w-px h-6 bg-gray-200"></div>
                    
                    {/* Center By Control - Icon Only */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowCenterDropdown(!showCenterDropdown)
                          setShowViewDropdown(false)
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-600 transition-all"
                        title={`Center: ${centerBy === 'all' ? 'All' : centerBy.charAt(0).toUpperCase() + centerBy.slice(1)}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                      </button>
                      {showCenterDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-20" 
                            onClick={() => setShowCenterDropdown(false)}
                          />
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-[120px] z-30">
                            <select
                              value={centerBy}
                              onChange={(e) => {
                                setCenterBy(e.target.value)
                                simulationRunningRef.current = false
                                setShowCenterDropdown(false)
                              }}
                              className="w-full text-xs font-normal text-gray-700 border-none bg-transparent px-2 py-1 hover:bg-gray-50 focus:outline-none cursor-pointer"
                              autoFocus
                            >
                              <option value="all">(All)</option>
                              <option value="vendor">Vendor</option>
                              <option value="agent">Agent</option>
                              <option value="llm_provider">LLM Provider</option>
                              <option value="system">System</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
            </div>
            )}
            
            {/* Zoom and Pan Controls */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              {/* Fullscreen Toggle Button */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-md shadow-lg p-3 flex items-center gap-2 hover:bg-white hover:border-primary-200 transition-all group"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <>
                    <svg className="w-5 h-5 text-gray-600 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 tracking-tight">Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-gray-600 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 tracking-tight">Fullscreen</span>
                  </>
                )}
              </button>
              
              {/* Center/Reset View Button */}
              <button
                onClick={() => {
                  // Reset pan and zoom to keep visualization centered
                  setPan({ x: 0, y: 0 })
                  setZoom(1)
                  // Clear focused node to show full view
                  setFocusedNode(null)
                  setSelectedNode(null)
                  
                  // Stop current simulation and let main useEffect re-center nodes properly
                  simulationRunningRef.current = false
                  
                  // The main useEffect will detect focusedNode change and restart simulation
                  // It will use centerBy logic to properly center nodes without stretching
                }}
                className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-md shadow-lg p-3 flex items-center gap-2 hover:bg-white hover:border-primary-200 transition-all group"
                title="Reset view (center and zoom to fit)"
              >
                <svg className="w-5 h-5 text-gray-600 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 tracking-tight">Reset View</span>
              </button>
            </div>
            
            <svg
              ref={svgRef}
              className="w-full h-full"
              style={{ 
                height: '100%',
                width: '100%',
                display: 'block',
                cursor: draggedNodeRef.current ? 'grabbing' : isDragging ? 'grabbing' : 'default',
                userSelect: 'none' // Prevent text selection during drag
              }}
              onMouseDown={(e) => {
                // Don't start pan if a node is being dragged
                if (draggedNodeRef.current) return
                
                // Only handle events within the SVG visualization area
                const target = e.target as HTMLElement | SVGElement
                
                // Check if clicking on any node element (circle, path, text, or group with data-node-id)
                const nodeGroup = target.closest ? target.closest('g[data-node-id]') : null
                if (nodeGroup) {
                  return // Let node drag handle it
                }
                
                // Check if clicking directly on node elements (circle for nodes, path for icons, text for labels)
                if (target.tagName === 'circle' || target.tagName === 'path' || target.tagName === 'text') {
                  // Check if it's within a node group
                  const parentGroup = (target as SVGElement).parentElement
                  if (parentGroup && (parentGroup.getAttribute('data-node-id') || parentGroup.classList.contains('node-group'))) {
                    return // Let node handle the drag
                  }
                }
                
                // Don't handle if clicking on control panels, buttons, or other UI elements
                if (target.closest && target.closest('.absolute') && target.closest('svg') !== svgRef.current) {
                  return // Let the event bubble normally
                }
                
                // Close context menu if clicking outside
                if (contextMenu) {
                  setContextMenu(null)
                }
                
                // Only drag if clicking directly on SVG background or group elements (not on nodes or circles)
                if (target.tagName === 'svg' || (target.tagName === 'g' && target.id === 'pan-zoom-group')) {
                  setIsDragging(true)
                  setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
              onMouseMove={(e) => {
                // Don't handle pan if a node is being dragged
                if (draggedNodeRef.current) return
                
                // Only handle if dragging and event is within SVG
                if (!isDragging) return
                
                const target = e.target as HTMLElement
                if (target.closest('svg') !== svgRef.current) {
                  return
                }
                
                e.preventDefault()
                e.stopPropagation()
                setPan({
                  x: e.clientX - dragStart.x,
                  y: e.clientY - dragStart.y
                })
              }}
              onMouseUp={(e) => {
                if (isDragging) {
                  e.preventDefault()
                  e.stopPropagation()
                }
                setIsDragging(false)
              }}
              onMouseLeave={(e) => {
                if (isDragging) {
                  e.preventDefault()
                  e.stopPropagation()
                }
                setIsDragging(false)
              }}
            />
            
            {/* Hover Tooltip Panel - Only shows on hover, disappears when mouse moves */}
            {hoveredNode && !selectedNode && (mousePosition || hoveredNodePosition) && containerRef.current && (
              <div
                className="absolute bg-white/95 backdrop-blur-sm border border-gray-100 rounded-md shadow-xl p-4 z-50 transition-opacity duration-200 pointer-events-none"
                style={{
                  // Use mouse position if available (follows cursor), otherwise use node position
                  left: mousePosition 
                    ? `${Math.min(mousePosition.x + 15, containerRef.current.clientWidth - 300)}px`
                    : hoveredNodePosition
                    ? `${Math.min(hoveredNodePosition.x + 30, containerRef.current.clientWidth - 300)}px`
                    : '0px',
                  top: mousePosition
                    ? `${Math.min(mousePosition.y + 15, containerRef.current.clientHeight - 250)}px`
                    : hoveredNodePosition
                    ? `${Math.min(hoveredNodePosition.y, containerRef.current.clientHeight - 250)}px`
                    : '0px',
                  maxWidth: '280px',
                  transform: 'none',
                }}
              >
                <div className="space-y-3 pointer-events-none">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                    <div
                      className="w-3.5 h-3.5 rounded-full shadow-sm"
                      style={{ 
                        backgroundColor: NODE_COLORS[hoveredNode.type] || '#6b7280'
                      }}
                    ></div>
                    <div className="font-semibold text-gray-900 text-sm leading-tight">{hoveredNode.label}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MaterialChip
                      label={hoveredNode.type.replace(/_/g, ' ')}
                      size="small"
                      color={
                        hoveredNode.type === 'vendor' ? 'success' :
                        hoveredNode.type === 'agent' ? 'primary' :
                        hoveredNode.type === 'llm_provider' ? 'warning' :
                        'secondary'
                      }
                      variant="outlined"
                      className="h-5 text-xs font-bold tracking-tight"
                    />
                    {hoveredNode.type === 'vendor' && hoveredNode.metadata?.is_cleared !== undefined && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        hoveredNode.metadata.is_cleared === true ? 'bg-success-50 text-success-700' :
                        hoveredNode.metadata.is_cleared === false ? 'bg-error-50 text-error-700' :
                        'bg-warning-50 text-warning-700'
                      }`}>
                        {hoveredNode.metadata.is_cleared === true ? 'CLEARED' : 
                         hoveredNode.metadata.is_cleared === false ? 'DENIED' : 'PENDING'}
                      </span>
                    )}
                  </div>
                  
                  {hoveredNode.type === 'vendor' && hoveredNode.metadata?.assessment_count !== undefined && hoveredNode.metadata.assessment_count > 0 && (
                    <div className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <span className="text-gray-900 font-bold">{hoveredNode.metadata.assessment_count}</span> assessments
                      {hoveredNode.metadata.latest_risk_score !== null && hoveredNode.metadata.latest_risk_score !== undefined && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          Risk: <span className={`font-bold ${
                            hoveredNode.metadata.latest_risk_level === 'high' ? 'text-red-600' :
                            hoveredNode.metadata.latest_risk_level === 'medium' ? 'text-warning-600' :
                            'text-green-600'
                          }`}>{hoveredNode.metadata.latest_risk_score.toFixed(1)}</span>
                        </>
                      )}
                    </div>
                  )}
                  
                  {(() => {
                    const excludedFields = new Set([
                      'assessments', 'assessment_count', 'is_cleared', 'latest_risk_score',
                      'latest_risk_level', 'breach_count', 'cve_count', 'has_active_breaches',
                      'has_critical_incidents', 'security_status', 'latest_incident_date',
                      'security_incidents', 'contact_email', 'website', 'agent_id',
                      'vendor_id', 'type', 'id'
                    ])
                    
                    const remainingMetadata = Object.entries(hoveredNode.metadata).filter(
                      ([key]) => !excludedFields.has(key)
                    )
                    
                    if (remainingMetadata.length === 0) return null
                    
                    return (
                      <div className="space-y-2 pt-1">
                        {remainingMetadata.slice(0, 2).map(([key, value]) => (
                          <div key={key}>
                            <div className="text-xs font-medium text-gray-700 tracking-tight mb-0.5">
                              {key.replace(/_/g, ' ')}
                            </div>
                            <div className="text-xs font-medium text-gray-700 line-clamp-2">
                              {typeof value === 'object' ? '...' : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50 pointer-events-auto">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (hoveredNode) {
                        setSelectedNode(hoveredNode)
                        setShowDetailsPanel(true)
                        setHoveredNode(null)
                        setHoveredNodePosition(null)
                        setMousePosition(null)
                      }
                    }}
                    className="w-full py-1.5 text-center text-xs font-bold text-blue-600 hover:text-blue-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                  >
                    View Full Details
                  </button>
                </div>
              </div>
            )}
            
            {/* Right-Click Context Menu */}
            {contextMenu && (
              <div
                className="absolute bg-white/95 backdrop-blur-sm border border-gray-200 rounded-md shadow-2xl z-50 py-2 min-w-[220px]"
                style={{
                  left: `${contextMenu.x}px`,
                  top: `${contextMenu.y}px`,
                }}
                onMouseLeave={() => setContextMenu(null)}
              >
                <div className="px-4 py-2 text-xs font-semibold text-gray-900 border-b border-gray-50 mb-1">
                  {contextMenu.node.label}
                </div>
                <div className="py-1">
                  <div className="px-4 py-1 text-xs font-medium text-gray-700 tracking-tight">Show Connections By</div>
                  {['vendor', 'agent', 'llm_provider', 'system'].map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setCenterBy(type)
                        setContextMenu(null)
                        simulationRunningRef.current = false
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-blue-600 flex items-center gap-3 transition-colors"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shadow-sm"
                        style={{ backgroundColor: NODE_COLORS[type] || '#6b7280' }}
                      ></div>
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                      {centerBy === type && (
                        <span className="ml-auto text-blue-600 font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="py-1 border-t border-gray-50">
                  <div className="px-4 py-1 text-xs font-medium text-gray-700 tracking-tight">Filter To Only</div>
                  {['vendor', 'agent', 'llm_provider', 'system'].map((type) => (
                    <button
                      key={`group-${type}`}
                      onClick={() => {
                        setFilterBy(type)
                        setFilterValue('')
                        setContextMenu(null)
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-blue-600 flex items-center gap-3 transition-colors"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shadow-sm"
                        style={{ backgroundColor: NODE_COLORS[type] || '#6b7280' }}
                      ></div>
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-50 pt-1">
                  <button
                    onClick={() => {
                      const w = widthRef.current
                      const h = heightRef.current
                      const nodeX = contextMenu.node.x || w / 2
                      const nodeY = contextMenu.node.y || h / 2
                      setPan({
                        x: (w / 2) - (nodeX * zoom),
                        y: (h / 2) - (nodeY * zoom)
                      })
                      setFocusedNode(contextMenu.node)
                      setSelectedNode(contextMenu.node)
                      setShowDetailsPanel(true)
                      setContextMenu(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm font-bold text-blue-600 hover:bg-primary-50 transition-colors"
                  >
                    Center This Entity
                  </button>
                </div>
              </div>
            )}
            </div>
          </MaterialCard>

          {/* Node Details Panel - Fixed Sidebar */}
          {selectedNode && showDetailsPanel && (
            <MaterialCard 
              elevation={2} 
              className={`w-80 flex-shrink-0 border-none p-0 ${isFullscreen ? 'absolute right-0 top-0 bottom-0 z-50' : ''}`} 
              style={isFullscreen ? { 
                maxHeight: '100vh',
                height: '100vh',
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0
              } : { maxHeight: 'calc(100vh - 120px)' }}
            >
              <div className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6 flex-shrink-0">
                  <h2 className="unified-page-title">Entity Insight</h2>
                  <button
                    onClick={() => {
                      setShowDetailsPanel(false)
                      setSelectedNode(null)
                    }}
                    className="text-gray-600 hover:text-gray-900 p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-5 flex-1 overflow-hidden flex flex-col">
                  {/* Entity Name */}
                  <div className="flex-shrink-0">
                    <div className="text-sm font-medium text-gray-600 mb-1.5">Entity Name</div>
                    <div className="unified-page-title text-lg">{selectedNode.label}</div>
                  </div>
                  
                  {/* Classification */}
                  <div className="flex-shrink-0">
                    <div className="text-sm font-medium text-gray-600 mb-2">Classification</div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[selectedNode.type] || '#6b7280' }}></div>
                      <span className="text-sm font-normal text-gray-700 capitalize tracking-tight">
                        {selectedNode.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Key Information - Priority for Vendors */}
                  {selectedNode.type === 'vendor' && selectedNode.metadata && (
                    <div className="flex-shrink-0 space-y-3 pt-4 border-t border-gray-200">
                      {selectedNode.metadata.has_active_cve_matches && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="text-xs font-semibold text-red-700 mb-1">Security Alert</div>
                          <div className="text-sm font-medium text-red-900">Active CVE Matches</div>
                        </div>
                      )}
                      {selectedNode.metadata.latest_risk_level && (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600">Risk Level</span>
                            <span className={`text-xs font-semibold ${
                              selectedNode.metadata.latest_risk_level === 'high' ? 'text-red-600' :
                              selectedNode.metadata.latest_risk_level === 'medium' ? 'text-amber-600' :
                              'text-green-600'
                            }`}>
                              {selectedNode.metadata.latest_risk_level.toUpperCase()}
                            </span>
                          </div>
                          {selectedNode.metadata.latest_risk_score !== undefined && (
                            <div className="text-xs font-medium text-gray-700">
                              Score: {selectedNode.metadata.latest_risk_score.toFixed(1)}/10.0
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Top Connections - Limited to 5 most important */}
                  {linksRef.current && linksRef.current.length > 0 && (() => {
                    const connections = linksRef.current
                      .filter((link: Link) => {
                        const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id
                        const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id
                        return sourceId === selectedNode.id || targetId === selectedNode.id
                      })
                      .slice(0, 5) // Limit to top 5 connections
                    
                    if (connections.length === 0) return null
                    
                    return (
                      <div className="flex-1 flex flex-col min-h-0 pt-4 border-t border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-3 flex-shrink-0">Key Connections</div>
                        <div className="space-y-2 flex-1 overflow-hidden">
                          {connections.map((link: Link, idx: number) => {
                            const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id
                            const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id
                            const otherNodeId = sourceId === selectedNode.id ? targetId : sourceId
                            const otherNode = nodesRef.current.find(n => n.id === otherNodeId)
                            const relationshipType = link.type || link.metadata?.type || link.metadata?.relationship_type || 'connected'
                            
                            return (
                              <div key={idx} className="p-2.5 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 transition-colors flex-shrink-0">
                                <div className="text-xs font-medium text-blue-700 mb-0.5">{relationshipType.replace(/_/g, ' ')}</div>
                                <div className="text-sm font-normal text-gray-900 truncate">
                                  {otherNode ? otherNode.label : otherNodeId}
                                </div>
                              </div>
                            )
                          })}
                          {linksRef.current.filter((link: Link) => {
                            const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id
                            const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id
                            return sourceId === selectedNode.id || targetId === selectedNode.id
                          }).length > 5 && (
                            <div className="text-xs font-medium text-gray-500 pt-1">
                              +{linksRef.current.filter((link: Link) => {
                                const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id
                                const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id
                                return sourceId === selectedNode.id || targetId === selectedNode.id
                              }).length - 5} more connections
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                  
                  {/* Action Buttons */}
                  <div className="flex-shrink-0 pt-4 border-t border-gray-200 space-y-2">
                    {selectedNode.type === 'agent' && selectedNode.metadata.agent_id && (
                      <MaterialButton
                        fullWidth
                        onClick={() => navigate(`/agents/${selectedNode.metadata.agent_id}`)}
                        className="shadow-md-elevation-2"
                      >
                        View Agent Profile
                      </MaterialButton>
                    )}
                    
                    {selectedNode.type === 'vendor' && selectedNode.metadata.vendor_id && (
                      <MaterialButton
                        fullWidth
                        variant="outlined"
                        onClick={() => {
                          // Use trust_center_slug if available, otherwise use vendor_id (backend accepts both)
                          const identifier = selectedNode.metadata.trust_center_slug || selectedNode.metadata.vendor_id
                          navigate(`/trust-center/${identifier}`)
                        }}
                      >
                        Open Vendor Control
                      </MaterialButton>
                    )}
                  </div>
                </div>
              </div>
            </MaterialCard>
          )}
        </div>
      </div>
  )

  // Wrap with Layout only if not in fullscreen mode
  if (isFullscreen) {
    return content
  }

  return (
    <Layout user={user}>
      {content}
    </Layout>
  )
}

