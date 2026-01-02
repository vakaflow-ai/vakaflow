import { api } from './api'

export interface ClusterNode {
  id: string
  hostname: string
  ip_address: string
  node_type: string
  ssh_username: string
  ssh_port: number
  description?: string
  location?: string
  tags?: string[]
  status: 'healthy' | 'unhealthy' | 'unknown' | 'offline'
  last_health_check?: string
  cpu_usage?: string
  memory_usage?: string
  disk_usage?: string
  uptime?: string
  services_status?: Record<string, string>
  error_count: number
  last_error?: string
  is_active: boolean
  is_monitored: boolean
  is_current_node: boolean
  node_role?: 'primary' | 'secondary'
  created_at: string
  updated_at: string
}

export interface ClusterNodeCreate {
  hostname: string
  ip_address: string
  node_type: string
  ssh_username: string
  ssh_password?: string
  ssh_port?: number
  ssh_key_path?: string
  description?: string
  location?: string
  tags?: string[]
  is_monitored?: boolean
}

export interface ClusterNodeUpdate {
  hostname?: string
  ip_address?: string
  node_type?: string
  ssh_username?: string
  ssh_password?: string
  ssh_port?: number
  ssh_key_path?: string
  description?: string
  location?: string
  tags?: string[]
  is_active?: boolean
  is_monitored?: boolean
  node_role?: 'primary' | 'secondary'
}

export interface HealthCheckResult {
  node_id: string
  hostname: string
  ip_address: string
  status: string
  ssh_connection: {
    success: boolean
    error?: string
    connection_time?: number
  }
  services: Record<string, string>
  resources: {
    cpu_usage?: string
    memory_usage?: string
    disk_usage?: string
    uptime?: string
  }
  error?: string
  checked_at: string
}

export const clusterNodesApi = {
  list: async (nodeType?: string, statusFilter?: string, isActive?: boolean): Promise<ClusterNode[]> => {
    const params: any = {}
    if (nodeType) params.node_type = nodeType
    if (statusFilter) params.status_filter = statusFilter
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get('/cluster-nodes', { params })
    return response.data
  },

  get: async (nodeId: string): Promise<ClusterNode> => {
    const response = await api.get(`/cluster-nodes/${nodeId}`)
    return response.data
  },

  create: async (node: ClusterNodeCreate): Promise<ClusterNode> => {
    const response = await api.post('/cluster-nodes', node)
    return response.data
  },

  update: async (nodeId: string, node: ClusterNodeUpdate): Promise<ClusterNode> => {
    const response = await api.put(`/cluster-nodes/${nodeId}`, node)
    return response.data
  },

  delete: async (nodeId: string): Promise<void> => {
    await api.delete(`/cluster-nodes/${nodeId}`)
  },

  checkHealth: async (nodeId: string): Promise<HealthCheckResult> => {
    const response = await api.post(`/cluster-nodes/${nodeId}/health-check`)
    return response.data
  },

  checkAllHealth: async (): Promise<{
    total_nodes: number
    healthy: number
    unhealthy: number
    offline: number
    unknown: number
    nodes: Array<{ id: string; hostname: string; status: string; error?: string }>
  }> => {
    const response = await api.post('/cluster-nodes/health-check/all')
    return response.data
  },

  testConnection: async (nodeId: string): Promise<{
    success: boolean
    error?: string
    connection_time?: number
  }> => {
    const response = await api.post(`/cluster-nodes/${nodeId}/test-connection`)
    return response.data
  },

  getHealthHistory: async (nodeId: string, limit?: number): Promise<Array<{
    id: string
    status: string
    check_type: string
    check_result: any
    cpu_usage?: string
    memory_usage?: string
    disk_usage?: string
    uptime?: string
    error_message?: string
    checked_at: string
  }>> => {
    const params: any = {}
    if (limit) params.limit = limit
    const response = await api.get(`/cluster-nodes/${nodeId}/health-history`, { params })
    return response.data
  },

  setNodeRole: async (nodeId: string, role: 'primary' | 'secondary'): Promise<ClusterNode> => {
    const response = await api.post(`/cluster-nodes/${nodeId}/set-role?role=${role}`)
    return response.data
  },
}
