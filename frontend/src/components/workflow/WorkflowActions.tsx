import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
// Using standard textarea for now - will implement proper Textarea component
import { 
  User, 
  Calendar, 
  MessageSquare,
  CheckCircle,
  XCircle,
  RotateCcw,
  Send
} from 'lucide-react';

interface WorkflowActionsProps {
  actionItem: any;
  entityData: any;
  onUpdateStatus: (status: string, notes?: string) => Promise<any>;
  onAssign: (userId: string) => Promise<any>;
  onRefresh: () => void;
}

export function WorkflowActions({ 
  actionItem, 
  entityData, 
  onUpdateStatus, 
  onAssign,
  onRefresh 
}: WorkflowActionsProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStatusUpdate = async (status: string) => {
    setIsSubmitting(true);
    try {
      await onUpdateStatus(status, comment);
      setComment('');
    } catch (error) {
      console.error('Status update failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusActions = () => {
    const currentStatus = entityData?.status;
    
    if (currentStatus === 'pending' || currentStatus === 'needs_revision') {
      return [
        { 
          label: 'Approve', 
          status: 'approved', 
          variant: 'primary' as const,
          icon: <CheckCircle className="h-4 w-4" />
        },
        { 
          label: 'Reject', 
          status: 'rejected', 
          variant: 'danger' as const,
          icon: <XCircle className="h-4 w-4" />
        },
        { 
          label: 'Request Revision', 
          status: 'needs_revision', 
          variant: 'secondary' as const,
          icon: <RotateCcw className="h-4 w-4" />
        }
      ];
    }
    
    if (currentStatus === 'in_progress') {
      return [
        { 
          label: 'Complete', 
          status: 'completed', 
          variant: 'primary' as const,
          icon: <CheckCircle className="h-4 w-4" />
        }
      ];
    }
    
    return [];
  };

  const actions = getStatusActions();

  return (
    <div className="space-y-6">
      {/* Status Actions */}
      {actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Comments (Optional)</label>
              <textarea
                value={comment}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                placeholder="Add any notes or comments about this decision..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {actions.map((action) => (
                <Button
                  key={action.status}
                  variant={action.variant}
                  onClick={() => handleStatusUpdate(action.status)}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {action.icon}
                  {isSubmitting ? 'Processing...' : action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Currently Assigned To</p>
              <p className="text-sm text-muted-foreground">
                {actionItem?.assigned_to?.name || 'Unassigned'}
              </p>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                // In a real implementation, this would open an assignment dialog
                console.log('Open assignment dialog');
              }}
            >
              <User className="h-4 w-4 mr-2" />
              Reassign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Quick View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>
                {entityData?.created_at 
                  ? new Date(entityData.created_at).toLocaleDateString()
                  : 'Unknown'
                }
              </span>
            </div>
            {entityData?.updated_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{new Date(entityData.updated_at).toLocaleDateString()}</span>
              </div>
            )}
            {actionItem?.due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className={new Date(actionItem.due_date) < new Date() ? 'text-destructive' : ''}>
                  {new Date(actionItem.due_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}