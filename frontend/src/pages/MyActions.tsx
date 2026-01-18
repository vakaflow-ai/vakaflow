import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { actionsApi, ActionItem } from '../lib/actions'
import { assessmentsApi } from '../lib/assessments'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import PageContainer, { PageHeader } from '../components/PageContainer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { showToast } from '../utils/toast'
import { Clock, CheckCircle, AlertCircle, Search } from 'lucide-react'
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

  const items = activeTab === 'pending' ? (inboxData?.pending || []) :
                activeTab === 'completed' ? (inboxData?.completed || []) :
                activeTab === 'overdue' ? (inboxData?.overdue || []) :
                (inboxData?.items || [])
  // Always use counts from API response - these are calculated from ALL items, not filtered
  // The counts endpoint returns accurate counts, and inboxData also includes accurate counts
  // If counts are 0 but we have items in the arrays, use the array length as fallback
  const pendingCount = countsData?.pending ?? inboxData?.pending_count ?? (inboxData?.pending?.length || 0)
  const completedCount = countsData?.completed ?? inboxData?.completed_count ?? (inboxData?.completed?.length || 0)
  const overdueCount = countsData?.overdue ?? inboxData?.overdue_count ?? (inboxData?.overdue?.length || 0)

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
      <PageContainer>
        <PageHeader 
          title="My Actions"
          subtitle="Manage your assigned tasks and workflows"
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
                  label=""
                  placeholder="Search actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                // Special handling for assessment reviews
                if (item.source_type === 'assessment_review' && item.source_id) {
                  navigate(`/assessments/review/${item.source_id}`);
                }
                // Unified workflow routing
                else if (item.source_type && item.source_id) {
                  // Use the new universal workflow renderer
                  navigate(`/workflow/${item.source_type}/${item.source_id}`);
                } else if (item.action_url) {
                  navigate(item.action_url);
                } else {
                  // Fallback to legacy routes
                  if (item.type === 'approval' || item.source_type?.includes('assessment')) {
                    if (item.source_type && item.source_id) {
                      navigate(`/approver/${item.source_type}/${item.source_id}`);
                    }
                  } else if (item.source_type === 'assessment_assignment' && item.source_id) {
                    navigate(`/assessments/${item.source_id}`);
                  }
                }
              }}
            />
          </CardContent>
        </Card>
      </PageContainer>
    </Layout>
  )
}
