import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { 
  MessageSquare, 
  Send, 
  User,
  Clock
} from 'lucide-react';

interface WorkflowCommentsProps {
  entityId: string;
  entityType: string;
}

interface Comment {
  id: string;
  user: {
    name: string;
    avatar?: string;
  };
  content: string;
  timestamp: Date;
  isInternal?: boolean;
}

export function WorkflowComments({ entityId, entityType }: WorkflowCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([
    {
      id: '1',
      user: { name: 'John Smith', avatar: '' },
      content: 'This looks good to me. I\'ve reviewed all the security requirements.',
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      isInternal: false
    },
    {
      id: '2',
      user: { name: 'Jane Doe', avatar: '' },
      content: 'Please clarify the data retention policy mentioned in section 3.2',
      timestamp: new Date(Date.now() - 172800000), // 2 days ago
      isInternal: true
    }
  ]);
  
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: Date.now().toString(),
      user: { name: 'Current User' }, // Would come from auth context
      content: newComment,
      timestamp: new Date(),
      isInternal
    };
    
    setComments([comment, ...comments]);
    setNewComment('');
    setIsInternal(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Form */}
        <div className="space-y-3">
          <textarea
            value={newComment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-gray-300"
              />
              Internal comment (not visible to requester)
            </label>
            
            <Button 
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              Post
            </Button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2" />
              <p>No comments yet</p>
              <p className="text-sm">Be the first to add a comment</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div 
                key={comment.id} 
                className={`p-4 rounded-lg border ${
                  comment.isInternal 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{comment.user.name}</p>
                      {comment.isInternal && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Internal
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{comment.timestamp.toLocaleString()}</span>
                  </div>
                </div>
                
                <p className="text-sm text-foreground">{comment.content}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}