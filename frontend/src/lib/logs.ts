import api from './api'

export interface LogEntry {
  timestamp: string
  level: string
  logger: string
  message: string
  module?: string
  function?: string
  line?: number
}

export interface LogListResponse {
  logs: LogEntry[]
  total: number
  limit: number
  offset: number
}

export interface LogFileInfo {
  filename: string
  filepath?: string  // Full path to the log file
  size_bytes: number
  size_mb: number
  modified: string
  age_days: number
}

export interface LogStatsResponse {
  files: LogFileInfo[]
  total_files: number
  total_size_bytes: number
  total_size_mb: number
}

export interface ClearLogsOptions {
  older_than_days?: number
  include_rotated?: boolean
  log_type?: 'application' | 'errors' | null
}

export interface ClearLogsResponse {
  message: string
  deleted_files: string[]
  deleted_count: number
  size_freed_mb: number
  options: ClearLogsOptions
}

export const logsApi = {
  list: async (
    level?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<LogListResponse> => {
    const params: any = { limit, offset }
    if (level) params.level = level
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    
    const response = await api.get('/logs', { params })
    return response.data
  },
  
  getStats: async (): Promise<LogStatsResponse> => {
    const response = await api.get('/logs/stats')
    return response.data
  },
  
  clear: async (options?: ClearLogsOptions): Promise<ClearLogsResponse> => {
    if (options) {
      // Use request body for new enhanced API
      const response = await api.delete('/logs', { data: options })
      return response.data
    } else {
      // Backward compatibility: use query params
      const response = await api.delete('/logs')
      return response.data
    }
  },
}

