import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import api from '../lib/api'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { ChatIcon, SendIcon, CheckIcon, ReplyIcon } from '../components/Icons'

interface Message {
  id: string
  message_type: string
  content: string
  resource_type: string
  resource_id: string
  sender_id: string
  sender_name: string
  recipient_id?: string
  parent_id?: string
  is_read: boolean
  created_at: string
  replies: Message[]
}

export default function Messages() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'unread' | 'sent' | 'workflow'>('all')
  const [selectedResource, setSelectedResource] = useState<{ type: string; id: string } | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', filter],
    queryFn: async () => {
      const params: any = {}
      if (filter === 'unread') params.unread_only = true
      const response = await api.get('/messages', { params })
      return response.data
    },
    enabled: !!user
  })

  const { data: unreadCount } = useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: async () => {
      const response = await api.get('/messages/unread-count')
      return response.data
    },
    enabled: !!user,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  const createMessage = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/messages', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      setNewMessage('')
      setReplyingTo(null)
    }
  })

  const markAsRead = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await api.patch(`/messages/${messageId}/read`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] })
    }
  })

  const handleSubmit = (e: React.FormEvent, parentId?: string) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedResource) return

    createMessage.mutate({
      resource_type: selectedResource.type,
      resource_id: selectedResource.id,
      content: newMessage,
      message_type: parentId ? 'reply' : 'comment',
      parent_id: parentId
    })
  }

  const handleReply = (message: Message) => {
    setReplyingTo(message.id)
    setSelectedResource({ type: message.resource_type, id: message.resource_id })
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-9 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
            <div className="text-gray-500 font-medium text-sm tracking-tight">Loading communications...</div>
          </div>
        </div>
      </Layout>
    )
  }

  const allMessages = messages || []

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">Messages & Comments</h1>
              <p className="text-sm text-gray-600">
                {unreadCount?.unread_count ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium text-xs">
                    {unreadCount.unread_count} Unread Message{unreadCount.unread_count !== 1 ? 's' : ''}
                  </span>
                ) : (
                  'Manage collaborative discussions and audit trail comments'
                )}
              </p>
            </div>
            
            <div className="flex bg-white p-1.5 rounded-lg shadow-sm border border-gray-200 gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                  filter === 'all' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                  filter === 'unread' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter('sent')}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                  filter === 'sent' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Sent
              </button>
            </div>
          </div>
        </div>

        {/* Messages List */}
        {allMessages.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm py-24 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <ChatIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages found</h3>
            <p className="text-sm text-gray-600 max-w-xs mx-auto">Your communication inbox is currently empty. New comments will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allMessages.map((message: Message) => (
              <div key={message.id} className="group">
                <div 
                  className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all group-hover:shadow-md ${
                    !message.is_read && message.sender_id !== user?.id 
                      ? 'border-blue-200 ring-2 ring-blue-100' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-stretch">
                    {/* Activity Indicator Side Bar */}
                    <div className={`w-1 shrink-0 ${
                      !message.is_read && message.sender_id !== user?.id ? 'bg-blue-600' : 'bg-gray-100'
                    }`} />
                    
                    <div className="flex-1 p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-semibold text-base border border-gray-200">
                            {message.sender_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <span className="text-base font-semibold text-gray-900">{message.sender_name}</span>
                              <div className="h-4 w-px bg-gray-200" />
                              <MaterialChip 
                                label={message.message_type}
                                size="small"
                                color="primary"
                                variant="filled"
                                className="font-medium text-xs h-6"
                              />
                            </div>
                            <div className="text-sm font-medium text-gray-600">
                              {new Date(message.created_at).toLocaleString(undefined, { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {message.resource_type && (
                            <MaterialButton
                              variant="outlined"
                              size="small"
                              color="gray"
                              onClick={() => navigate(`/${message.resource_type}s/${message.resource_id}`)}
                              className="text-sm font-semibold h-9 rounded-md px-4"
                            >
                              View {message.resource_type.replace('_', ' ')}
                            </MaterialButton>
                          )}
                          {!message.is_read && message.sender_id !== user?.id && (
                            <MaterialButton
                              variant="contained"
                              size="small"
                              color="primary"
                              onClick={() => markAsRead.mutate(message.id)}
                              className="text-sm font-semibold h-9 rounded-md px-4 shadow-sm"
                              startIcon={<CheckIcon className="w-4 h-4" />}
                            >
                              Mark Read
                            </MaterialButton>
                          )}
                        </div>
                      </div>

                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 mb-5">
                        <p className="text-gray-700 font-medium leading-relaxed text-sm">"{message.content}"</p>
                      </div>

                      {/* Reply Section */}
                      <div className="flex flex-col gap-4 pt-5 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handleReply(message)}
                            className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-4 py-2 rounded-md hover:bg-blue-100"
                          >
                            <ReplyIcon className="w-4 h-4" />
                            Write a reply
                          </button>
                          
                          {message.replies && message.replies.length > 0 && (
                            <span className="text-sm font-medium text-gray-600">
                              {message.replies.length} repl{message.replies.length === 1 ? 'y' : 'ies'}
                            </span>
                          )}
                        </div>

                        {replyingTo === message.id && (
                          <form onSubmit={(e) => handleSubmit(e, message.id)} className="mt-2">
                            <div className="relative">
                              <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                className="w-full min-h-[120px] p-4 rounded-lg border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm placeholder:text-gray-400 resize-none"
                                placeholder="Share your perspective..."
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-2 mt-3">
                                <MaterialButton
                                  type="button"
                                  variant="text"
                                  size="small"
                                  onClick={() => {
                                    setReplyingTo(null)
                                    setNewMessage('')
                                  }}
                                  className="text-sm font-medium text-gray-600 hover:text-gray-700 h-9 px-4"
                                >
                                  Cancel
                                </MaterialButton>
                                <MaterialButton
                                  type="submit"
                                  disabled={createMessage.isPending || !newMessage.trim()}
                                  variant="contained"
                                  size="small"
                                  color="primary"
                                  className="text-sm font-semibold px-5 h-9 rounded-md shadow-sm"
                                  startIcon={<SendIcon className="w-4 h-4" />}
                                >
                                  Post Reply
                                </MaterialButton>
                              </div>
                            </div>
                          </form>
                        )}

                        {/* Replies Container */}
                        {message.replies && message.replies.length > 0 && (
                          <div className="space-y-3 mt-4">
                            {message.replies.map((reply: Message) => (
                              <div key={reply.id} className="flex gap-3 items-start pl-4 border-l-2 border-gray-200">
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-semibold text-sm shrink-0 border border-gray-200">
                                  {reply.sender_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-gray-900">{reply.sender_name}</span>
                                    <span className="text-xs font-medium text-gray-600">
                                      {new Date(reply.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 leading-relaxed">{reply.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

