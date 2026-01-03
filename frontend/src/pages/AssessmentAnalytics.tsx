import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { assessmentsApi } from '../lib/assessments'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import DashboardHeader from '../components/DashboardHeader'
import DashboardWidget from '../components/DashboardWidget'
import DashboardGrid from '../components/DashboardGrid'
import { useDashboardFilters } from '../hooks/useDashboardFilters'
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AssessmentAnalytics() {
  const [user, setUser] = useState<any>(null)
  const { filters, updateFilter, resetFilters } = useDashboardFilters(
    'assessment-analytics-filters',
    { quarter: '', type: '' }
  )

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {})
  }, [])

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['assessment-analytics', filters.quarter, filters.type],
    queryFn: () => assessmentsApi.getAnalytics(filters.quarter || undefined, filters.type || undefined),
    enabled: !!user
  })

  const getRiskColor = (risk: string): 'green' | 'red' | 'orange' | 'gray' => {
    switch (risk) {
      case 'green':
        return 'green'
      case 'yellow':
        return 'orange'
      case 'red':
        return 'red'
      default:
        return 'gray'
    }
  }

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'green':
        return <CheckCircle2 className="w-4 h-4" />
      case 'yellow':
        return <Clock className="w-4 h-4" />
      case 'red':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
        </div>
      </Layout>
    )
  }

  if (!analytics) {
    return (
      <Layout user={user}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center py-12 text-muted-foreground">No analytics data available</div>
        </div>
      </Layout>
    )
  }

  const widgets = [
    // Overview Metrics
    <DashboardWidget
      key="overview"
      id="overview"
      title="Overview Metrics"
      icon={<TrendingUp className="w-5 h-5 text-primary" />}
      actions={
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium">
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="text-sm text-blue-700 font-medium mb-1">Total Assessments</div>
          <div className="text-2xl font-semibold text-blue-900">{analytics.overview.total_assessments}</div>
        </div>
        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
          <div className="text-sm text-green-700 font-medium mb-1">Total Assignments</div>
          <div className="text-2xl font-semibold text-green-900">{analytics.overview.total_assignments}</div>
        </div>
        <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
          <div className="text-sm text-purple-700 font-medium mb-1">Completion Rate</div>
          <div className="text-2xl font-semibold text-purple-900">{analytics.overview.completion_rate.toFixed(1)}%</div>
        </div>
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="text-sm text-red-700 font-medium mb-1">Overdue</div>
          <div className="text-2xl font-semibold text-red-900">{analytics.overview.overdue_assignments}</div>
        </div>
      </div>
    </DashboardWidget>,

    // Filters Widget
    <DashboardWidget
      key="filters"
      id="filters"
      title="Filters"
      icon={<Filter className="w-5 h-5 text-primary" />}
      actions={
        (filters.quarter || filters.type) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 text-xs"
          >
            Reset
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Quarter</label>
          <select
            value={filters.quarter}
            onChange={(e) => updateFilter('quarter', e.target.value)}
            className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All Quarters</option>
            {Object.keys(analytics.quarterly_progress || {}).map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
            {analytics.current_quarter && !Object.keys(analytics.quarterly_progress || {}).includes(analytics.current_quarter) && (
              <option value={analytics.current_quarter}>{analytics.current_quarter}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Assessment Type</label>
          <select
            value={filters.type}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All Types</option>
            {Object.keys(analytics.assessment_type_distribution || {}).map(type => (
              <option key={type} value={type}>{type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>
      </div>
    </DashboardWidget>,

    // Quarterly Progress
    <DashboardWidget
      key="quarterly"
      id="quarterly"
      title="Quarterly Progress"
      icon={<BarChart3 className="w-5 h-5 text-primary" />}
    >
      {Object.keys(analytics.quarterly_progress || {}).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(analytics.quarterly_progress).map(([quarter, data]: [string, any]) => (
            <div key={quarter} className="border-b border-border pb-6 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">{quarter}</h3>
                <span className="text-sm text-muted-foreground">{data.total} total</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-28 text-sm text-muted-foreground">Completed:</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground w-12 text-right tabular-nums">{data.completed}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-28 text-sm text-muted-foreground">In Progress:</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${data.total > 0 ? (data.in_progress / data.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground w-12 text-right tabular-nums">{data.in_progress}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-28 text-sm text-muted-foreground">Pending:</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all duration-300"
                      style={{ width: `${data.total > 0 ? (data.pending / data.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground w-12 text-right tabular-nums">{data.pending}</span>
                </div>
                {data.overdue > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="w-28 text-sm text-destructive">Overdue:</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-destructive transition-all duration-300"
                        style={{ width: `${data.total > 0 ? (data.overdue / data.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-destructive w-12 text-right tabular-nums">{data.overdue}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No quarterly data available</div>
      )}
    </DashboardWidget>,

    // Assessment Types
    <DashboardWidget
      key="types"
      id="types"
      title="Assessment Types"
      icon={<FileText className="w-5 h-5 text-primary" />}
    >
      {Object.keys(analytics.assessment_type_distribution || {}).length > 0 ? (
        <div className="space-y-3">
          {Object.entries(analytics.assessment_type_distribution).map(([type, count]: [string, any]) => (
            <div
              key={type}
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">
                {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              <span className="text-xl font-semibold text-primary tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No assessment types available</div>
      )}
    </DashboardWidget>,

    // Vendor Risk Distribution
    <DashboardWidget
      key="vendors"
      id="vendors"
      title="Vendor Risk Distribution"
      icon={<Users className="w-5 h-5 text-primary" />}
    >
      {Object.keys(analytics.vendor_distribution || {}).length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Completed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Pending</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(analytics.vendor_distribution).map(([vendorId, vendorData]: [string, any]) => (
                Object.entries(vendorData.assessments || {}).map(([assessmentType, data]: [string, any], idx) => (
                  <tr key={`${vendorId}-${assessmentType}`} className="hover:bg-muted/30 transition-colors">
                    {idx === 0 && (
                      <td rowSpan={Object.keys(vendorData.assessments || {}).length} className="px-4 py-3 align-top">
                        <div className="font-medium text-foreground text-sm">{vendorData.vendor_name}</div>
                      </td>
                    )}
                    {idx === 0 && (
                      <td rowSpan={Object.keys(vendorData.assessments || {}).length} className="px-4 py-3 align-top">
                        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${
                          getRiskColor(vendorData.overall_risk) === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
                          getRiskColor(vendorData.overall_risk) === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          getRiskColor(vendorData.overall_risk) === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {getRiskIcon(vendorData.overall_risk)}
                          <span className="capitalize">{vendorData.overall_risk}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-foreground">
                      {assessmentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground tabular-nums">{data.total}</td>
                    <td className="px-4 py-3 text-xs font-medium text-green-600 tabular-nums">{data.completed}</td>
                    <td className="px-4 py-3 text-xs font-medium text-yellow-600 tabular-nums">{data.pending}</td>
                    <td className="px-4 py-3 text-xs font-medium text-red-600 tabular-nums">{data.overdue}</td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No vendor data available</div>
      )}
    </DashboardWidget>,

    // Upcoming Assessments
    <DashboardWidget
      key="upcoming"
      id="upcoming"
      title="Upcoming Due Assessments"
      icon={<Calendar className="w-5 h-5 text-primary" />}
    >
      {analytics.next_due_assessments && analytics.next_due_assessments.length > 0 ? (
        <div className="space-y-3">
          {analytics.next_due_assessments.map((item: any) => (
            <div
              key={item.assignment_id}
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">{item.assessment_name}</h3>
                <p className="text-xs text-muted-foreground">
                  {item.vendor_name} • {item.assessment_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
              <div className="flex items-center gap-4 ml-6">
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground">
                    {item.days_until_due !== null && item.days_until_due >= 0
                      ? `${item.days_until_due} days`
                      : 'Overdue'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'No due date'}
                  </p>
                </div>
                <div className={`px-2.5 py-1 rounded text-xs font-medium ${
                  item.days_until_due !== null && item.days_until_due < 7
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : item.days_until_due !== null && item.days_until_due < 14
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {item.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No upcoming assessments</div>
      )}
    </DashboardWidget>,
  ]

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-6 py-6">
        <DashboardHeader
          title="Assessment Analytics"
          subtitle="Comprehensive analytics for vendor assessment management and risk monitoring. Drag widgets to rearrange, resize, and customize your dashboard."
        />
        <DashboardGrid
          storageKey="assessment-analytics-layout"
          rowHeight={80}
        >
          {widgets}
        </DashboardGrid>
      </div>
    </Layout>
  )
}
