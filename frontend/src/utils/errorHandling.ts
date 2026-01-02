/**
 * Error handling utilities
 * Provides consistent error handling patterns across the application
 * 
 * @module utils/errorHandling
 */

export interface ApiError {
  message: string
  statusCode?: number
  details?: any
}

/**
 * Extract user-friendly error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { detail?: string }; status?: number } }
    if (apiError.response?.data?.detail) {
      return apiError.response.data.detail
    }
    if (apiError.response?.status) {
      return `Server error (${apiError.response.status})`
    }
  }
  
  return 'An unexpected error occurred'
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: string }).message.toLowerCase()
    return message.includes('network') || 
           message.includes('fetch') || 
           message.includes('timeout')
  }
  return false
}

/**
 * Check if error is a client error (4xx)
 */
export function isClientError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: number } }).response?.status
    return status !== undefined && status >= 400 && status < 500
  }
  return false
}

/**
 * Check if error is a server error (5xx)
 */
export function isServerError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: number } }).response?.status
    return status !== undefined && status >= 500
  }
  return false
}

/**
 * Get appropriate error message based on error type
 */
export function getErrorDisplayMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.'
  }
  
  if (isServerError(error)) {
    return 'Server error. Please try again later or contact support if the problem persists.'
  }
  
  if (isClientError(error)) {
    return getErrorMessage(error)
  }
  
  return getErrorMessage(error)
}
