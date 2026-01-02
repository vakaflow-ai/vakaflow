import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagesApi, Message } from '../lib/messages'

interface CommentsSectionProps {
  resourceType: string
  resourceId: string
  currentUser?: any
}

export default function CommentsSection({ resourceType, resourceId, currentUser }: CommentsSectionProps) {
  const queryClient = useQueryClient()
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', resourceType, resourceId],
    queryFn: () => messagesApi.list(resourceType, resourceId),
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true
  })

  const createComment = useMutation({
    mutationFn: (data: any) => messagesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', resourceType, resourceId] })
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] })
      setNewComment('')
      setReplyingTo(null)
    }
  })

  const handleSubmit = (e: React.FormEvent, parentId?: string) => {
    e.preventDefault()
    if (!newComment.trim()) return

    createComment.mutate({
      resource_type: resourceType,
      resource_id: resourceId,
      content: newComment,
      message_type: parentId ? 'reply' : 'comment',
      parent_id: parentId
    })
  }

  const comments = (messages || []).filter((m: Message) => !m.parent_id)

  return (
    <div className="compact-card">
      <h3 className="text-lg font-medium mb-4">Comments</h3>

      {/* New Comment Form */}
      <form onSubmit={(e) => handleSubmit(e)} className="mb-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="compact-input min-h-[80px] w-full mb-2"
          placeholder="Add a comment..."
          required
        />
        <button
          type="submit"
          disabled={createComment.isPending}
          className="compact-button-primary"
        >
          {createComment.isPending ? 'Posting...' : 'Post Comment'}
        </button>
      </form>

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment: Message) => (
            <div key={comment.id} className="border-b pb-4 last:border-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-sm">{comment.sender_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{comment.content}</p>
              
              {/* Reply Button */}
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="text-xs text-primary hover:underline"
              >
                {replyingTo === comment.id ? 'Cancel' : 'Reply'}
              </button>

              {/* Reply Form */}
              {replyingTo === comment.id && (
                <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-2">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="compact-input min-h-[60px] w-full mb-2"
                    placeholder="Write a reply..."
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={createComment.isPending}
                      className="compact-button-primary text-xs"
                    >
                      Post Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null)
                        setNewComment('')
                      }}
                      className="compact-button-secondary text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 ml-6 space-y-2 border-l-2 border-muted pl-4">
                  {comment.replies.map((reply: Message) => (
                    <div key={reply.id} className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{reply.sender_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(reply.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

