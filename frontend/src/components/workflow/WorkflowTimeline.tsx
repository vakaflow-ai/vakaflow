import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  User,
  MessageSquare
} from 'lucide-react';

interface WorkflowTimelineProps {
  entityId: string;
  entityType: string;
}

export function WorkflowTimeline({ entityId, entityType }: WorkflowTimelineProps) {
  // Mock timeline data - in a real implementation, this would fetch from API
  const timelineEvents = [
    {
      id: '1',
      type: 'status_change',
      status: 'created',
      user: 'System',
      timestamp: new Date(Date.now() - 86400000 * 3), // 3 days ago
      message: 'Workflow created'
    },
    {
      id: '2',
      type: 'status_change',
      status: 'assigned',
      user: 'John Smith',
      timestamp: new Date(Date.now() - 86400000 * 2), // 2 days ago
      message: 'Assigned to reviewer'
    },
    {
      id: '3',
      type: 'comment',
      status: 'in_progress',
      user: 'Jane Doe',
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      message: 'Started review process'
    },
    {
      id: '4',
      type: 'status_change',
      status: 'pending_approval',
      user: 'System',
      timestamp: new Date(),
      message: 'Ready for approval'
    }
  ];

  const getStatusIcon = (status: string, type: string) => {
    if (type === 'comment') {
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    }
    
    switch (status) {
      case 'created':
      case 'assigned':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'pending_approval':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created':
      case 'assigned':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {timelineEvents.map((event) => (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                  {getStatusIcon(event.status, event.type)}
                </div>
                {event.id !== timelineEvents[timelineEvents.length - 1].id && (
                  <div className="w-0.5 h-full bg-muted mt-1"></div>
                )}
              </div>
              
              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{event.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{event.user}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {event.timestamp.toLocaleString()}
                  </span>
                </div>
                
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                    {event.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {timelineEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>No timeline events yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}