/**
 * Application Configuration
 * 
 * Centralized configuration for the application.
 * Values can be overridden via environment variables.
 */

// API Configuration
export const API_CONFIG = {
  baseURL: (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1',
  timeout: 120000, // 120 seconds (increased to handle complex inbox aggregation queries)
  retryAttempts: 3,
}

// Backend URL (for direct asset access, etc.)
export const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:8000'

// Frontend URL
export const FRONTEND_URL = (import.meta as any).env?.VITE_FRONTEND_URL || 'http://localhost:3000'

// Feature Flags (can be controlled via environment or tenant config)
export const FEATURE_FLAGS = {
  enableFormDesigner: true,
  enableMasterDataManagement: true,
  enableRichTextEditor: true,
  enableDragAndDrop: true,
  enableAdvancedAnalytics: (import.meta as any).env?.VITE_ENABLE_ANALYTICS === 'true',
}

// UI Configuration
export const UI_CONFIG = {
  itemsPerPage: 20,
  maxFileUploadSize: 10 * 1024 * 1024, // 10MB
  debounceDelay: 300, // ms
  animationDuration: 200, // ms
}

// Form Configuration
export const FORM_CONFIG = {
  maxSteps: 50, // Maximum number of steps allowed
  minSteps: 1, // Minimum number of steps required
  defaultStepCount: 10, // Default number of steps for vendor forms
}

// Export all config
export const APP_CONFIG = {
  api: API_CONFIG,
  backend: BACKEND_URL,
  frontend: FRONTEND_URL,
  features: FEATURE_FLAGS,
  ui: UI_CONFIG,
  form: FORM_CONFIG,
}

export default APP_CONFIG
