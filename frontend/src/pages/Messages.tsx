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
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
              Messages & Comments
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-2">
              {unreadCount?.unread_count ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100 font-medium text-sm tracking-tight">
                  {unreadCount.unread_count} Unread Message{unreadCount.unread_count !== 1 ? 's' : ''}
                </span>
              ) : (
                'Manage collaborative discussions and audit trail comments'
              )}
            </p>
          </div>
          
          <div className="flex bg-white p-1 rounded-md shadow-sm border border-gray-200">
            <button
              onClick={() => setFilter('all')}
              className={`px-5 py-2 text-xs font-bold tracking-tight rounded-lg transition-all ${
                filter === 'all' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-5 py-2 text-xs font-bold tracking-tight rounded-lg transition-all ${
                filter === 'unread' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setFilter('sent')}
              className={`px-5 py-2 text-xs font-bold tracking-tight rounded-lg transition-all ${
                filter === 'sent' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Sent
            </button>
          </div>
        </div>

        {/* Messages List */}
        {allMessages.length === 0 ? (
          <MaterialCard elevation={0} className="py-24 text-center border-2 border-dashed border-gray-200 bg-transparent rounded-lg">
            <div className="w-20 h-20 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-6 text-gray-500">
              <ChatIcon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No messages found</h3>
            <p className="text-gray-500 max-w-xs mx-auto font-medium">Your communication inbox is currently empty. New comments will appear here.</p>
          </MaterialCard>
        ) : (
          <div className="grid gap-6">
            {allMessages.map((message: Message) => (
              <div key={message.id} className="group">
                <MaterialCard 
                  elevation={1}
                  className={`overflow-hidden border-none transition-all group-hover:shadow-md ring-1 ring-gray-200/50 ${
                    !message.is_read && message.sender_id !== user?.id 
                      ? 'ring-2 ring-primary-500 shadow-lg shadow-primary-500/5' 
                      : ''
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-stretch">
                    {/* Activity Indicator Side Bar */}
                    <div className={`w-1.5 shrink-0 ${
                      !message.is_read && message.sender_id !== user?.id ? 'bg-primary-500' : 'bg-gray-100'
                    }`} />
                    
                    <div className="flex-1 p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-lg border border-gray-200 shadow-inner group-hover:bg-white group-hover:scale-105 transition-all">
                            {message.sender_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base font-semibold text-gray-900 leading-none">{message.sender_name}</span>
                              <div className="h-4 w-px bg-gray-200 mx-1" />
                              <MaterialChip 
                                label={message.message_type}
                                size="small"
                                color="primary"
                                variant="filled"
                                className="font-medium text-xs tracking-tight h-5"
                              />
                            </div>
                            <div className="text-sm font-medium text-gray-600 tracking-tight">
                              {new Date(message.created_at).toLocaleString(undefined, { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {message.resource_type && (
                            <MaterialButton
                              variant="outlined"
                              size="small"
                              color="gray"
                              onClick={() => navigate(`/${message.resource_type}s/${message.resource_id}`)}
                              className="text-sm font-bold tracking-tight h-9 rounded-md px-4"
                            >
                              View {message.resource_type}
                            </MaterialButton>
                          )}
                          {!message.is_read && message.sender_id !== user?.id && (
                            <MaterialButton
                              variant="contained"
                              size="small"
                              color="primary"
                              onClick={() => markAsRead.mutate(message.id)}
                              className="text-sm font-bold tracking-tight h-9 rounded-md px-4 shadow-md shadow-primary-500/20"
                              startIcon={<CheckIcon className="w-3.5 h-3.5" />}
                            >
                              Mark Read
                            </MaterialButton>
                          )}
                        </div>
                      </div>

                      <div className="bg-blue-100/80 rounded-lg p-5 border border-gray-100/60 group-hover:bg-white transition-colors">
                        <p className="text-gray-700 font-medium leading-relaxed italic text-sm">"{message.content}"</p>
                      </div>

                      {/* Reply Section */}
                      <div className="mt-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
                          <button
                            onClick={() => handleReply(message)}
                            className="flex items-center gap-2 text-[12px] font-bold tracking-tight text-blue-600 hover:text-blue-600 transition-colors bg-primary-50/50 px-4 py-2 rounded-md"
                          >
                            <ReplyIcon className="w-4 h-4" />
                            Write a reply
                          </button>
                          
                          {message.replies && message.replies.length > 0 && (
                            <span className="text-sm font-medium text-gray-700 tracking-tight">
                              {message.replies.length} repl{message.replies.length === 1 ? 'y' : 'ies'}
                            </span>
                          )}
                        </div>

                        {replyingTo === message.id && (
                          <form onSubmit={(e) => handleSubmit(e, message.id)} className="animate-in fade-in slide-in-from-top-2 duration-300 mt-2">
                            <div className="relative">
                              <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                className="w-full min-h-[140px] p-5 rounded-lg border-2 border-gray-100 bg-white focus:border-blue-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium text-sm placeholder:text-gray-500 shadow-inner"
                                placeholder="Share your perspective..."
                                autoFocus
                              />
                              <div className="absolute bottom-4 right-4 flex gap-2">
                                <MaterialButton
                                  type="button"
                                  variant="text"
                                  size="small"
                                  onClick={() => {
                                    setReplyingTo(null)
                                    setNewMessage('')
                                  }}
                                  className="text-sm font-medium tracking-tight text-gray-600 hover:text-gray-700"
                                >
                                  Cancel
                                </MaterialButton>
                                <MaterialButton
                                  type="submit"
                                  disabled={createMessage.isPending || !newMessage.trim()}
                                  variant="contained"
                                  size="small"
                                  color="primary"
                                  className="text-sm font-bold tracking-tight px-6 h-9 rounded-md shadow-lg shadow-primary-500/20"
                                  startIcon={<SendIcon className="w-3.5 h-3.5" />}
                                >
                                  Post Reply
                                </MaterialButton>
                              </div>
                            </div>
                          </form>
                        )}

                        {/* Replies Container */}
                        {message.replies && message.replies.length > 0 && (
                          <div className="space-y-4 mt-4">
                            {message.replies.map((reply: Message) => (
                              <div key={reply.id} className="flex gap-4 items-start pl-4 border-l-2 border-gray-100 group/reply">
                                <div className="w-9 h-9 rounded-md bg-gray-50 flex items-center justify-center text-gray-600 font-medium text-xs shrink-0 border border-gray-100">
                                  {reply.sender_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 bg-white p-4 rounded-lg border border-gray-100 shadow-sm group-hover/reply:shadow-md transition-all">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-900 tracking-tight">{reply.sender_name}</span>
                                    <span className="text-xs font-medium text-gray-600">
                                      {new Date(reply.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-[13px] text-gray-600 font-medium leading-relaxed">{reply.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </MaterialCard>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

