import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { actionsApi, ActionItem } from '@/lib/actions';
import { assessmentsApi } from '@/lib/assessments';
import { agentsApi } from '@/lib/agents';
import { workflowOrchestrationApi, ViewStructure } from '@/lib/workflowOrchestration';
import { authApi } from '@/lib/auth';

export interface WorkflowContext {
  sourceType: string;
  sourceId: string;
  actionItem?: ActionItem;
  entityData?: any;
  viewStructure?: ViewStructure;
  isLoading: boolean;
  error?: Error;
}

export interface UseWorkflowReturn extends WorkflowContext {
  refresh: () => void;
  updateStatus: (status: string, notes?: string) => Promise<any>;
  assignTo: (userId: string) => Promise<any>;
}

/**
 * Unified hook for workflow management across all entity types
 * Handles action items, entity loading, and workflow orchestration
 */
export function useWorkflow(sourceType: string, sourceId: string): UseWorkflowReturn {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);

  // Load current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.getCurrentUser(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
  }, [currentUser]);

  // Load action item
  const {
    data: actionItem,
    isLoading: actionLoading,
    error: actionError,
  } = useQuery({
    queryKey: ['action-item', sourceType, sourceId],
    queryFn: () => actionsApi.getBySource(sourceType, sourceId),
    enabled: !!sourceType && !!sourceId,
  });

  // Determine entity type and load entity data
  const entityType = useMemo(() => {
    if (sourceType.includes('assessment')) return 'assessment_assignments';
    if (sourceType.includes('onboarding')) return 'agents';
    if (sourceType.includes('approval')) return 'agents';
    return 'agents'; // default fallback
  }, [sourceType]);

  const requestType = useMemo(() => {
    if (sourceType.includes('assessment')) return 'assessment_workflow';
    if (sourceType.includes('onboarding')) return 'agent_onboarding_workflow';
    if (sourceType.includes('vendor')) return 'vendor_submission_workflow';
    return 'agent_onboarding_workflow';
  }, [sourceType]);

  // Load entity data based on source type
  const {
    data: entityData,
    isLoading: entityLoading,
  } = useQuery({
    queryKey: [entityType, sourceId],
    queryFn: async () => {
      try {
        if (entityType === 'assessment_assignments' && sourceType.includes('assessment')) {
          return await assessmentsApi.getAssignmentStatus(sourceId);
        } else if (entityType === 'agents' && (sourceType.includes('onboarding') || sourceType.includes('approval'))) {
          return await agentsApi.get(sourceId);
        }
        // Fallback - try to determine from action item
        if (actionItem?.metadata) {
          const metadata = actionItem.metadata as any;
          if (metadata.assessment_id) {
            return await assessmentsApi.getAssignmentStatus(sourceId);
          } else if (metadata.agent_id) {
            return await agentsApi.get(metadata.agent_id);
          }
        }
        throw new Error(`Cannot determine entity type for source: ${sourceType}`);
      } catch (error) {
        console.error('Failed to load entity data:', error);
        throw error;
      }
    },
    enabled: !!sourceId && !!entityType && !!actionItem,
  });

  // Generate view structure
  const workflowStage = useMemo(() => {
    if (!entityData) return 'pending_approval';
    
    const statusMap: Record<string, string> = {
      'pending': 'new',
      'in_progress': 'in_progress',
      'completed': 'pending_approval',
      'approved': 'approved',
      'rejected': 'rejected',
      'needs_revision': 'needs_revision',
      'submitted': 'pending_approval',
    };
    
    return statusMap[(entityData as any).status] || 'pending_approval';
  }, [entityData]);

  const {
    data: viewStructure,
    isLoading: viewLoading,
  } = useQuery({
    queryKey: ['view-structure', entityType, requestType, workflowStage, user?.role, sourceId],
    queryFn: () => workflowOrchestrationApi.generateViewStructure({
      entity_name: entityType,
      request_type: requestType,
      workflow_stage: workflowStage,
      entity_id: sourceId,
      agent_type: (entityData as any)?.agent_type,
      agent_category: (entityData as any)?.agent_category,
    }),
    enabled: !!entityData && !!user && !!entityType && !!requestType,
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      // For now, we'll handle status updates through the action item
      // In a real implementation, you'd call the appropriate API
      console.log(`Updating status to ${status} with notes: ${notes}`);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityType, sourceId] });
      queryClient.invalidateQueries({ queryKey: ['action-item', sourceType, sourceId] });
    },
  });

  const assignToMutation = useMutation({
    mutationFn: async (userId: string) => {
      // For now, simulate assignment
      // In a real implementation, you'd call actionsApi.assignTo
      console.log(`Assigning to user: ${userId}`);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-item', sourceType, sourceId] });
    },
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['action-item', sourceType, sourceId] });
    queryClient.invalidateQueries({ queryKey: [entityType, sourceId] });
    queryClient.invalidateQueries({ queryKey: ['view-structure', entityType, requestType, workflowStage, user?.role, sourceId] });
  }, [queryClient, sourceType, sourceId, entityType, requestType, workflowStage, user?.role]);

  const updateStatus = useCallback(async (status: string, notes?: string) => {
    return await updateStatusMutation.mutateAsync({ status, notes });
  }, [updateStatusMutation]);

  const assignTo = useCallback(async (userId: string) => {
    return await assignToMutation.mutateAsync(userId);
  }, [assignToMutation]);

  const isLoading = actionLoading || entityLoading || viewLoading || !user;
  const error = actionError as Error | undefined;

  return {
    sourceType,
    sourceId,
    actionItem,
    entityData,
    viewStructure,
    isLoading,
    error,
    refresh,
    updateStatus,
    assignTo,
  };
}