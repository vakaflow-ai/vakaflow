import api from './api'

export interface WorkflowPerformanceMetrics {
  workflows: Array<{
    workflow_id: string
    workflow_name: string
    total_requests: number
    approved: number
    rejected: number
    pending: number
    approval_rate: number
    avg_completion_time_hours?: number
  }>
  period: {
    start_date: string
    end_date: string
  }
}

export interface AssessmentMetrics {
  total: number
  completed: number
  in_progress: number
  pending: number
  overdue: number
  completion_rate: number
  avg_completion_time_hours?: number
  by_entity_type: Record<string, {
    total: number
    completed: number
    in_progress: number
    pending: number
    overdue: number
  }>
  period: {
    start_date: string
    end_date: string
  }
}

export interface WorkflowBottlenecks {
  bottlenecks: Array<{
    workflow_id: string
    workflow_name: string
    stuck_requests: number
    issue: string
  }>
  total_bottlenecks: number
}

export interface WorkflowSummary {
  active_workflows: number
  total_requests: number
  pending_requests: number
  total_assessments: number
  pending_assessments: number
}

export const workflowAnalyticsApi = {
  getPerformance: async (
    startDate?: string,
    endDate?: string,
    entityType?: string
  ): Promise<WorkflowPerformanceMetrics> => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (entityType) params.append('entity_type', entityType)
    const response = await api.get(`/workflow-analytics/performance?${params.toString()}`)
    return response.data
  },

  getAssessmentMetrics: async (
    startDate?: string,
    endDate?: string,
    entityType?: string
  ): Promise<AssessmentMetrics> => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (entityType) params.append('entity_type', entityType)
    const response = await api.get(`/workflow-analytics/assessments?${params.toString()}`)
    return response.data
  },

  getBottlenecks: async (workflowId?: string): Promise<WorkflowBottlenecks> => {
    const params = new URLSearchParams()
    if (workflowId) params.append('workflow_id', workflowId)
    const response = await api.get(`/workflow-analytics/bottlenecks?${params.toString()}`)
    return response.data
  },

  getSummary: async (): Promise<WorkflowSummary> => {
    const response = await api.get('/workflow-analytics/summary')
    return response.data
  }
}
