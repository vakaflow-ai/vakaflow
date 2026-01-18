import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { WorkflowRenderer, WorkflowRendererProps } from './WorkflowRenderer';

/**
 * Wrapper component that extracts route parameters for WorkflowRenderer
 * Handles special workflow types that need custom UI (like assessment approvals)
 */
export function WorkflowPageRoute() {
  const { sourceType, sourceId } = useParams<{ 
    sourceType: string; 
    sourceId: string 
  }>();
  
  if (!sourceType || !sourceId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Invalid Workflow URL</h2>
          <p className="text-muted-foreground">
            Missing required parameters: sourceType and sourceId
          </p>
        </div>
      </div>
    );
  }

  // If this is an assessment_approval workflow, redirect to the proper review interface
  // For assessment approval workflows, the sourceId IS the assignment ID
  if (sourceType === 'assessment_approval') {
    return <Navigate to={`/assessments/review/${sourceId}`} replace />;
  }

  // If this is an assessment_resubmission workflow, redirect to vendor questionnaire page
  // For assessment resubmission workflows, the sourceId IS the assignment ID
  if (sourceType === 'assessment_resubmission') {
    return <Navigate to={`/assessments/${sourceId}`} replace />;
  }

  // If this is an assessment_assignment workflow, redirect to vendor questionnaire page
  // This is the initial assignment workflow when vendor first receives the assessment
  // For assessment assignment workflows, the sourceId IS the assignment ID
  if (sourceType === 'assessment_assignment') {
    return <Navigate to={`/assessments/${sourceId}`} replace />;
  }

  return (
    <WorkflowRenderer 
      sourceType={sourceType} 
      sourceId={sourceId} 
    />
  );
}