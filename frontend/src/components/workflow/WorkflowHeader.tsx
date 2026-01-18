import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  User, 
  Calendar,
  RefreshCw
} from 'lucide-react';

interface WorkflowHeaderProps {
  actionItem: any;
  entityData: any;
  sourceType: string;
  onRefresh: () => void;
}

export function WorkflowHeader({ 
  actionItem, 
  entityData, 
  sourceType,
  onRefresh 
}: WorkflowHeaderProps) {
  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'needs_revision': 'bg-orange-100 text-orange-800',
      'overdue': 'bg-red-100 text-red-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    const statusIcons: Record<string, React.ReactNode> = {
      'pending': <Clock className="h-4 w-4" />,
      'in_progress': <Clock className="h-4 w-4" />,
      'completed': <CheckCircle className="h-4 w-4" />,
      'approved': <CheckCircle className="h-4 w-4" />,
      'rejected': <AlertCircle className="h-4 w-4" />,
      'needs_revision': <AlertCircle className="h-4 w-4" />,
      'overdue': <AlertCircle className="h-4 w-4" />
    };
    return statusIcons[status] || <Clock className="h-4 w-4" />;
  };

  const getEntityTypeLabel = () => {
    if (sourceType.includes('assessment')) return 'Assessment';
    if (sourceType.includes('onboarding')) return 'Agent Onboarding';
    if (sourceType.includes('approval')) return 'Approval';
    return 'Workflow';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {entityData?.name || entityData?.title || 'Untitled Workflow'}
              <Badge className={getStatusColor(entityData?.status || 'pending')}>
                <div className="flex items-center gap-1">
                  {getStatusIcon(entityData?.status || 'pending')}
                  <span className="capitalize">
                    {entityData?.status?.replace('_', ' ') || 'pending'}
                  </span>
                </div>
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {getEntityTypeLabel()} • {sourceType}
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Assigned To</p>
              <p className="text-sm text-muted-foreground">
                {actionItem?.assigned_to?.name || 'Unassigned'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Created</p>
              <p className="text-sm text-muted-foreground">
                {entityData?.created_at 
                  ? new Date(entityData.created_at).toLocaleDateString()
                  : 'Unknown'
                }
              </p>
            </div>
          </div>
          
          {actionItem?.due_date && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Due Date</p>
                <p className={`text-sm ${
                  new Date(actionItem.due_date) < new Date() 
                    ? 'text-destructive' 
                    : 'text-muted-foreground'
                }`}>
                  {new Date(actionItem.due_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}