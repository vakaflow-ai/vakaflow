import React from 'react';
import { useWorkflow } from '@/hooks/useWorkflow';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { WorkflowHeader } from './WorkflowHeader';
import { WorkflowActions } from './WorkflowActions';
import { WorkflowTimeline } from './WorkflowTimeline';
import { WorkflowComments } from './WorkflowComments';

export interface WorkflowRendererProps {
  sourceType: string;
  sourceId: string;
  className?: string;
}

/**
 * Universal workflow renderer component
 * Handles all workflow scenarios: assessments, agent onboarding, approvals, etc.
 */
export function WorkflowRenderer({ 
  sourceType, 
  sourceId, 
  className = '' 
}: WorkflowRendererProps) {
  const {
    actionItem,
    entityData,
    viewStructure,
    isLoading,
    error,
    refresh,
    updateStatus,
    assignTo
  } = useWorkflow(sourceType, sourceId);

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-12 ${className}`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Workflow</h3>
          <p className="text-muted-foreground mb-6">{error.message}</p>
          <Button onClick={refresh} variant="primary">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!actionItem || !entityData) {
    return (
      <Card className={className}>
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Workflow Not Found</h3>
          <p className="text-muted-foreground">
            No workflow data available for {sourceType}:{sourceId}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Determine if this is a form-based workflow
  const isFormBased = viewStructure?.tabs && viewStructure.tabs.length > 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with status and basic info */}
      <WorkflowHeader 
        actionItem={actionItem}
        entityData={entityData}
        sourceType={sourceType}
        onRefresh={refresh}
      />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Entity Information</h4>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                    {JSON.stringify(entityData, null, 2)}
                  </pre>
                </div>
                
                {actionItem && (
                  <div>
                    <h4 className="font-medium mb-2">Action Item</h4>
                    <div className="bg-muted p-4 rounded-lg">
                      <p><strong>Title:</strong> {actionItem.title}</p>
                      <p><strong>Status:</strong> {actionItem.status}</p>
                      <p><strong>Type:</strong> {actionItem.type}</p>
                      {actionItem.due_date && (
                        <p><strong>Due:</strong> {new Date(actionItem.due_date).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <WorkflowTimeline 
            entityId={sourceId}
            entityType={sourceType.includes('assessment') ? 'assessment' : 'agent'}
          />
        </div>

        {/* Sidebar with actions and comments */}
        <div className="space-y-6">
          {/* Action Buttons */}
          <WorkflowActions
            actionItem={actionItem}
            entityData={entityData}
            onUpdateStatus={updateStatus}
            onAssign={assignTo}
            onRefresh={refresh}
          />

          {/* Comments Section */}
          <WorkflowComments
            entityId={sourceId}
            entityType={sourceType.includes('assessment') ? 'assessment' : 'agent'}
          />
        </div>
      </div>
    </div>
  );
}