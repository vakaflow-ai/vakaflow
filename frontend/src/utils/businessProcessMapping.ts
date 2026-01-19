/**
 * Business Process Mapping Utilities
 * Maps entity types to their corresponding workflow configurations and request types
 */

import { formLayoutsApi } from '@/lib/formLayouts';

// Map entity types to their default request types
// This should ideally come from the backend API or master data
const ENTITY_TYPE_TO_REQUEST_TYPE: Record<string, string> = {
  'agent': 'agent_onboarding_workflow',
  'vendor': 'vendor_submission_workflow',
  'product': 'product_qualification_workflow',
  'service': 'service_qualification_workflow',
  'assessment': 'assessment_workflow'
};

// Default fallback request types
const DEFAULT_REQUEST_TYPES = [
  'agent_onboarding_workflow',
  'vendor_submission_workflow',
  'assessment_workflow'
];

/**
 * Get the request type for a given entity type
 * First tries to find it in business process mappings, falls back to defaults
 */
export async function getRequestTypeForEntityType(entityType: string): Promise<string> {
  try {
    // First check if we have a direct mapping
    if (ENTITY_TYPE_TO_REQUEST_TYPE[entityType]) {
      return ENTITY_TYPE_TO_REQUEST_TYPE[entityType];
    }

    // Try to get workflow layout groups to find the mapping
    const workflowGroups = await formLayoutsApi.listGroups();
    
    // Look for groups that cover this entity type
    const matchingGroups = workflowGroups.filter(group => 
      group.covered_entities?.includes(entityType)
    );

    // If we found matching groups, use the first one's request_type
    if (matchingGroups.length > 0) {
      return matchingGroups[0].request_type;
    }

    // Fallback to default mapping based on entity type
    const fallbackMap: Record<string, string> = {
      'agent': 'agent_onboarding_workflow',
      'vendor': 'vendor_submission_workflow',
      'product': 'product_qualification_workflow',
      'service': 'service_qualification_workflow'
    };

    return fallbackMap[entityType] || 'agent_onboarding_workflow';
  } catch (error) {
    console.warn('Failed to get request type from business process mapping, using default:', error);
    // Fallback to default
    return ENTITY_TYPE_TO_REQUEST_TYPE[entityType] || 'agent_onboarding_workflow';
  }
}

/**
 * Get all available request types from business process mappings
 */
export async function getAvailableRequestTypes(): Promise<string[]> {
  try {
    const workflowGroups = await formLayoutsApi.listGroups();
    const requestTypes = new Set<string>();
    
    workflowGroups.forEach(group => {
      if (group.request_type) {
        requestTypes.add(group.request_type);
      }
    });

    // Add default types as fallback
    DEFAULT_REQUEST_TYPES.forEach(type => requestTypes.add(type));

    return Array.from(requestTypes);
  } catch (error) {
    console.warn('Failed to get request types from business process mapping, using defaults:', error);
    return DEFAULT_REQUEST_TYPES;
  }
}

/**
 * Get the workflow configuration ID for a given request type
 * This links the business process to the actual workflow
 */
export async function getWorkflowConfigIdForRequestType(requestType: string): Promise<string | null> {
  try {
    const workflowGroups = await formLayoutsApi.listGroups();
    
    const matchingGroup = workflowGroups.find(group => 
      group.request_type === requestType && group.workflow_config_id
    );

    return matchingGroup?.workflow_config_id || null;
  } catch (error) {
    console.warn('Failed to get workflow config ID for request type:', error);
    return null;
  }
}

// Export the mapping for direct access when needed
export { ENTITY_TYPE_TO_REQUEST_TYPE };