import axios from 'axios'
import { API_CONFIG } from '../config/appConfig'

export const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors and timeouts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error('Request timeout:', error)
      const timeoutSeconds = error.config?.timeout ? Math.round(error.config.timeout / 1000) : 30
      return Promise.reject(new Error(`Request timed out after ${timeoutSeconds} seconds. This may indicate:\n1. Database connection is slow or hanging\n2. Backend is processing a complex operation\n3. Network connectivity issues\n\nPlease check:\n- Backend logs for errors\n- Database connection status\n- Try again in a moment`))
    }
    if (!error.response) {
      // Network error (no response from server)
      console.error('Network error:', error)
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        return Promise.reject(new Error('Cannot connect to backend server. Please ensure:\n1. Backend is running: http://localhost:8000\n2. Check backend logs for errors\n3. Verify CORS configuration'))
      }
      return Promise.reject(new Error('Network error. Please check if the backend is running at ' + API_CONFIG.baseURL))
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    if (error.response?.status === 503) {
      return Promise.reject(new Error('Service unavailable. The database may not be accessible. Please check backend logs.'))
    }
    return Promise.reject(error)
  }
)

export default api

