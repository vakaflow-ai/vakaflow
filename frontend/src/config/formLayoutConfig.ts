/**
 * Form Layout Configuration
 * 
 * This file contains all configurable values for form layouts.
 * These can be overridden via environment variables or tenant-specific settings.
 */

// Step configuration for vendor submission forms
export interface StepDefinition {
  id: number
  title: string
  description: string
  isBasicInformation?: boolean // Marks the step that contains basic/standard fields
  standardFields?: string[] // Standard fields that should always be shown for this step
}

// Simplified default vendor steps - streamlined for agent onboarding
export const DEFAULT_VENDOR_STEPS: StepDefinition[] = [
  { 
    id: 1, 
    title: 'Agent Details', 
    description: 'Basic information about the agent',
    isBasicInformation: true,
    standardFields: ['name', 'type', 'category', 'description', 'version']
  },
  { 
    id: 2, 
    title: 'AI Configuration', 
    description: 'LLM provider, model, and deployment details' 
  },
  { 
    id: 3, 
    title: 'Data & Operations', 
    description: 'Data handling, capabilities, and operational regions' 
  },
  { 
    id: 4, 
    title: 'Integrations', 
    description: 'External systems and connections' 
  },
  { 
    id: 5, 
    title: 'Compliance & Review', 
    description: 'Compliance requirements and final review' 
  },
]

// Configuration for different request types
export interface RequestTypeConfig {
  defaultSteps: StepDefinition[]
  minSteps: number
  maxSteps?: number
  allowStepDeletion: boolean
  defaultStepNumber?: number // Default step number for basic information (if applicable)
}

export const REQUEST_TYPE_CONFIGS: Record<string, RequestTypeConfig> = {
  vendor: {
    defaultSteps: DEFAULT_VENDOR_STEPS,
    minSteps: 1,
    maxSteps: undefined, // No max limit
    allowStepDeletion: true,
    defaultStepNumber: 1, // Step 1 is the basic information step
  },
  admin: {
    defaultSteps: [
      { 
        id: 1, 
        title: 'Admin Details', 
        description: 'Administrative information', 
        isBasicInformation: true, 
        standardFields: ['name', 'status'] 
      }
    ],
    minSteps: 1,
    allowStepDeletion: true,
  },
  approver: {
    defaultSteps: [
      { 
        id: 1, 
        title: 'Review Details', 
        description: 'Review and approval information', 
        isBasicInformation: true, 
        standardFields: ['status', 'review_notes'] 
      }
    ],
    minSteps: 1,
    allowStepDeletion: true,
  },
  end_user: {
    defaultSteps: [
      { 
        id: 1, 
        title: 'Agent Information', 
        description: 'Basic agent information for end users', 
        isBasicInformation: true, 
        standardFields: ['name', 'description', 'capabilities'] 
      }
    ],
    minSteps: 1,
    allowStepDeletion: true,
  },
}

// Simplified field keyword mappings for auto-assignment
export const DEFAULT_KEYWORD_MAPPINGS: Record<string, string[]> = {
  'agent details': ['name', 'type', 'category', 'description', 'version', 'status'],
  'ai configuration': ['llm_vendor', 'llm_model', 'deployment_type', 'ai_provider', 'model_name'],
  'data & operations': ['data_types', 'data_categories', 'capabilities', 'regions', 'operational_regions', 'data_handling'],
  'integrations': ['connections', 'integrations', 'external_systems', 'api_connections', 'system_integrations'],
  'compliance & review': ['compliance', 'requirements', 'frameworks', 'review', 'submit'],
}

// Get configuration for a request type
export function getRequestTypeConfig(requestType: string): RequestTypeConfig {
  return REQUEST_TYPE_CONFIGS[requestType] || REQUEST_TYPE_CONFIGS.vendor
}

// Legacy alias for backward compatibility
export const getScreenTypeConfig = getRequestTypeConfig
export const SCREEN_TYPE_CONFIGS = REQUEST_TYPE_CONFIGS

// Get basic information step number for a request type
export function getBasicInformationStepNumber(requestType: string): number | null {
  const config = getRequestTypeConfig(requestType)
  if (config.defaultStepNumber) {
    return config.defaultStepNumber
  }
  // Fallback: find first step marked as basic information
  const basicStep = config.defaultSteps.find(step => step.isBasicInformation)
  return basicStep ? basicStep.id : null
}

// Get standard fields for a step
export function getStandardFieldsForStep(requestType: string, stepNumber: number): string[] {
  const config = getRequestTypeConfig(requestType)
  const step = config.defaultSteps.find(s => s.id === stepNumber)
  return step?.standardFields || []
}

// Check if a step is the basic information step
export function isBasicInformationStep(requestType: string, stepNumber: number): boolean {
  const basicStepNumber = getBasicInformationStepNumber(requestType)
  return basicStepNumber !== null && stepNumber === basicStepNumber
}

// Get keyword mappings (can be overridden by tenant-specific config)
export function getKeywordMappings(_tenantId?: string): Record<string, string[]> {
  // TODO: Load tenant-specific mappings from API if needed
  // For now, return default mappings
  return DEFAULT_KEYWORD_MAPPINGS
}
