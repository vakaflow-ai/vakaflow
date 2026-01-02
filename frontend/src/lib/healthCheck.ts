import api from './api'

export interface BackendHealth {
  status: 'healthy' | 'unhealthy' | 'unknown'
  message: string
  details?: any
}

/**
 * Check if backend is running and accessible
 */
export async function checkBackendHealth(): Promise<BackendHealth> {
  try {
    // Try health endpoint first (faster)
    const response = await api.get('/health', { timeout: 5000 })
    if (response.data?.status === 'healthy' || response.data?.status === 'running') {
      return {
        status: 'healthy',
        message: 'Backend is running and healthy',
        details: response.data
      }
    }
    return {
      status: 'unhealthy',
      message: 'Backend responded but status is not healthy',
      details: response.data
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return {
        status: 'unhealthy',
        message: 'Backend is not responding (timeout). Please check if the backend server is running on port 8000.',
        details: { error: 'timeout' }
      }
    }
    if (error.code === 'ERR_NETWORK' || !error.response) {
      return {
        status: 'unhealthy',
        message: 'Cannot connect to backend server. Please ensure the backend is running at http://localhost:8000',
        details: { error: 'network_error' }
      }
    }
    // If we get a response (even error), backend is running
    return {
      status: 'healthy',
      message: 'Backend is running (health endpoint may have issues)',
      details: { statusCode: error.response?.status }
    }
  }
}

/**
 * Quick check - just test if backend is reachable
 */
export async function isBackendReachable(): Promise<boolean> {
  try {
    await api.get('/health', { timeout: 3000 })
    return true
  } catch {
    return false
  }
}
