import api from './api'

export const exportApi = {
  exportAgents: async (format: 'csv' | 'json' = 'csv') => {
    const response = await api.get('/export/agents', {
      params: { format },
      responseType: 'blob',
    })
    return response.data
  },
  
  exportAuditLogs: async (format: 'csv' | 'json' = 'csv', startDate?: string, endDate?: string) => {
    const response = await api.get('/export/audit-logs', {
      params: { format, start_date: startDate, end_date: endDate },
      responseType: 'blob',
    })
    return response.data
  },
  
  exportComplianceReport: async (format: 'csv' | 'json' = 'csv') => {
    const response = await api.get('/export/reports/compliance', {
      params: { format },
      responseType: 'blob',
    })
    return response.data
  },
}

