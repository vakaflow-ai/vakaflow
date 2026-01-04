import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { actionsApi, ActionItem } from '../lib/actions'
import { assessmentsApi } from '../lib/assessments'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '../components/ui/badge'
import { showToast } from '../utils/toast'
import { 
  InboxIcon, CheckCircleIcon, ClockIcon, AlertCircleIcon, 
  FileTextIcon, ShieldCheckIcon
} from '../components/Icons'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import InboxGrid from '../components/InboxGrid'

type TabType = 'pending' | 'completed' | 'overdue'

export default function MyActions() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => navigate('/login'))
  }, [navigate])

  // Fetch inbox data for the active tab
  const { data: inboxData, isLoading } = useQuery({
    queryKey: ['actions-inbox', activeTab],
    queryFn: () => actionsApi.getInbox(activeTab),
    enabled: !!user?.tenant_id,
  })

  // Fetch counts separately to get accurate totals across all tabs
  const { data: countsData } = useQuery({
    queryKey: ['actions-inbox-counts'],
    queryFn: () => actionsApi.getCounts(),
    enabled: !!user?.tenant_id,
  })

  const items = inboxData?.items || []
  // Use counts from API response if available, otherwise fallback to inboxData counts, then to filtered items
  const pendingCount = countsData?.pending ?? inboxData?.pending_count ?? items.filter(i => i.status === 'pending').length
  const completedCount = countsData?.completed ?? inboxData?.completed_count ?? items.filter(i => i.status === 'completed').length
  const overdueCount = countsData?.overdue ?? inboxData?.overdue_count ?? items.filter(i => i.status === 'overdue').length

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      item.title?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.metadata?.workflow_ticket_id?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">My Actions</h1>
          <p className="text-muted-foreground">
            Manage your assigned tasks and workflows
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className={cn(
              "cursor-pointer transition-colors",
              activeTab === 'pending' && "border-primary"
            )}
            onClick={() => setActiveTab('pending')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Items requiring action</p>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "cursor-pointer transition-colors",
              activeTab === 'completed' && "border-primary"
            )}
            onClick={() => setActiveTab('completed')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Finished items</p>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "cursor-pointer transition-colors",
              activeTab === 'overdue' && "border-primary"
            )}
            onClick={() => setActiveTab('overdue')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overdueCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Past due items</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Input
                  placeholder="Search actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background text-foreground"
                />
                <InboxIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Grid */}
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === 'pending' && 'Pending Actions'}
              {activeTab === 'completed' && 'Completed Actions'}
              {activeTab === 'overdue' && 'Overdue Actions'}
            </CardTitle>
            <CardDescription>
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InboxGrid
              items={filteredItems}
              isLoading={isLoading}
              onItemClick={(item) => {
                // Use generic approver route with source_type and source_id from business process
                if (item.type === 'approval' || item.source_type === 'assessment_approval' || item.source_type === 'assessment_review') {
                  // For approvers: navigate to generic approver page
                  if (item.source_type && item.source_id) {
                    navigate(`/approver/${item.source_type}/${item.source_id}`)
                  } else if (item.action_url) {
                    navigate(item.action_url)
                  }
                } else if (item.source_type === 'assessment_assignment' && item.source_id) {
                  // For vendors: navigate to assessment completion page
                  navigate(`/assessments/${item.source_id}`)
                } else if (item.action_url) {
                  navigate(item.action_url)
                }
              }}
            />
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
