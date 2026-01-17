import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, Agent } from '../lib/agents'
import { authApi } from '../lib/auth'
import { messagesApi } from '../lib/messages'
import { assessmentsApi } from '../lib/assessments'
import Layout from '../components/Layout'
import PageContainer, { PageHeader } from '../components/PageContainer'
import DashboardHeader from '../components/DashboardHeader'
import DashboardWidget from '../components/DashboardWidget'
import DashboardGrid from '../components/DashboardGrid'
import { Button } from '@/components/ui/button'
import { Edit, FileQuestion, CheckCircle, MessageSquare, ArrowRight, Clock, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list(1, 20),
  })

  const { data: unreadCountData } = useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => messagesApi.getUnreadCount(),
    refetchInterval: 30000
  })

  const { data: upcomingAssessments = [] } = useQuery({
    queryKey: ['upcoming-assessments'],
    queryFn: () => assessmentsApi.getUpcoming(30),
    enabled: !!user && ['tenant_admin', 'platform_admin', 'compliance_reviewer', 'security_reviewer'].includes(user?.role),
  })

  const unreadCount = unreadCountData?.unread_count || 0

  const stats = {
    active: agentsData?.agents.filter(a => a.status === 'draft').length || 0,
    inReview: agentsData?.agents.filter(a => a.status === 'submitted' || a.status === 'in_review').length || 0,
    approved: agentsData?.agents.filter(a => a.status === 'approved').length || 0,
  }

  const recentAgents = agentsData?.agents.slice(0, 5) || []

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
      submitted: { label: 'Submitted', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
      in_review: { label: 'In Review', className: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
      approved: { label: 'Approved', className: 'bg-green-50 text-green-700 border border-green-200' },
      rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border border-red-200' },
    }
    const statusInfo = statusMap[status] || { label: status, className: 'bg-muted text-muted-foreground' }
    return (
      <span className={`px-2.5 py-1 rounded text-xs font-medium ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    )
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const widgets = [
    // Stats Overview
    <DashboardWidget
      key="stats"
      id="stats"
      title="Overview"
      icon={<TrendingUp className="w-5 h-5 text-primary" />}
    >
      <div className="grid grid-cols-3 gap-4">
        <div
          className="p-4 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => navigate('/submissions?status=draft')}
        >
          <div className="flex items-center gap-2 mb-2">
            <Edit className="w-4 h-4 text-blue-600" />
            <div className="text-xs font-medium text-blue-700">Active</div>
          </div>
          <div className="text-2xl font-semibold text-blue-900">{stats.active}</div>
          <div className="text-xs text-blue-600 mt-1">Draft submissions</div>
        </div>
        <div
          className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
          onClick={() => navigate('/submissions?status=in_review')}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileQuestion className="w-4 h-4 text-yellow-600" />
            <div className="text-xs font-medium text-yellow-700">In Review</div>
          </div>
          <div className="text-2xl font-semibold text-yellow-900">{stats.inReview}</div>
          <div className="text-xs text-yellow-600 mt-1">Pending review</div>
        </div>
        <div
          className="p-4 rounded-lg bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
          onClick={() => navigate('/submissions?status=approved')}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <div className="text-xs font-medium text-green-700">Approved</div>
          </div>
          <div className="text-2xl font-semibold text-green-900">{stats.approved}</div>
          <div className="text-xs text-green-600 mt-1">Successfully approved</div>
        </div>
      </div>
    </DashboardWidget>,

    // Recent Agents
    <DashboardWidget
      key="recent"
      id="recent"
      title="Recent Submissions"
      icon={<FileQuestion className="w-5 h-5 text-primary" />}
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/submissions')}
          className="h-8 text-xs"
        >
          View All
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      }
    >
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : recentAgents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No submissions yet</div>
      ) : (
        <div className="space-y-3">
          {recentAgents.map((agent: Agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/agents/${agent.id}`)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1 truncate">{agent.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {formatDate(agent.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {getStatusBadge(agent.status)}
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>,

    // Upcoming Assessments
    ...(upcomingAssessments.length > 0 ? [
      <DashboardWidget
        key="upcoming"
        id="upcoming"
        title="Upcoming Assessments"
        icon={<Clock className="w-5 h-5 text-primary" />}
      >
        <div className="space-y-3">
          {upcomingAssessments.slice(0, 5).map((item: any) => (
            <div
              key={item.schedule_id}
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {item.assessment_name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Due: {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'No due date'}
                </p>
              </div>
              <div className="ml-4">
                <span className="text-xs font-medium text-muted-foreground">
                  {item.vendor_count} vendors
                </span>
              </div>
            </div>
          ))}
        </div>
      </DashboardWidget>
    ] : []),

    // Messages
    ...(unreadCount > 0 ? [
      <DashboardWidget
        key="messages"
        id="messages"
        title="Messages"
        icon={<MessageSquare className="w-5 h-5 text-primary" />}
      >
        <div className="text-center py-8">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-semibold text-foreground mb-2">
            {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/messages')}
            className="mt-4"
          >
            View Messages
          </Button>
        </div>
      </DashboardWidget>
    ] : []),
  ]

  return (
    <Layout user={user}>
      <PageContainer>
        <PageHeader
          title="Dashboard"
          subtitle={`Welcome back${user ? `, ${user.name}` : ''}! Here's your overview. Drag widgets to rearrange, resize, and customize your dashboard.`}
        />
        <DashboardGrid
          storageKey="main-dashboard-layout"
          rowHeight={80}
        >
          {widgets}
        </DashboardGrid>
      </PageContainer>
    </Layout>
  )
}
