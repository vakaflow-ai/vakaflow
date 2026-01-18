import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { assessmentsApi } from '../lib/assessments'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import DashboardWidget from '../components/DashboardWidget'
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
  Shield,
  AlertTriangle,
} from 'lucide-react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import ChartContainer from '../components/ChartContainer'
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

  // Overview Metrics - Individual cards (like Analytics Dashboard)
  const overviewCards = [
    <div 
      key="overview-total-assessments"
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer group hover:shadow-md hover:border-blue-300 transition-all"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
          <FileText className="w-6 h-6" />
        </div>
      </div>
      <div className="text-3xl font-semibold text-blue-600 mb-2 group-hover:text-blue-700 transition-colors">{analytics.overview.total_assessments}</div>
      <div className="text-sm font-medium text-gray-600">Total Assessments</div>
    </div>,
    <div 
      key="overview-total-assignments"
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer group hover:shadow-md hover:border-green-300 transition-all"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-sm">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      </div>
      <div className="text-3xl font-semibold text-green-600 mb-2 group-hover:text-green-700 transition-colors">{analytics.overview.total_assignments}</div>
      <div className="text-sm font-medium text-gray-600">Total Assignments</div>
    </div>,
    <div 
      key="overview-completion-rate"
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer group hover:shadow-md hover:border-purple-300 transition-all"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
          <TrendingUp className="w-6 h-6" />
        </div>
      </div>
      <div className="text-3xl font-semibold text-purple-600 mb-2 group-hover:text-purple-700 transition-colors">{analytics.overview.completion_rate.toFixed(1)}%</div>
      <div className="text-sm font-medium text-gray-600">Completion Rate</div>
    </div>,
    <div 
      key="overview-overdue"
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer group hover:shadow-md hover:border-red-300 transition-all"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-sm">
          <AlertCircle className="w-6 h-6" />
        </div>
      </div>
      <div className="text-3xl font-semibold text-red-600 mb-2 group-hover:text-red-700 transition-colors">{analytics.overview.overdue_assignments}</div>
      <div className="text-sm font-medium text-gray-600">Overdue</div>
    </div>,
  ]

  const widgets = [

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
          {Object.entries(analytics.quarterly_progress)
            .sort(([quarterA], [quarterB]) => quarterB.localeCompare(quarterA)) // Sort descending (newest first)
            .map(([quarter, data]: [string, any]) => (
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
          {Object.entries(analytics.assessment_type_distribution)
            .sort(([typeA], [typeB]) => typeA.localeCompare(typeB))
            .map(([type, count]: [string, any]) => (
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
              {Object.entries(analytics.vendor_distribution)
                .sort(([, a], [, b]) => (a.vendor_name || '').localeCompare(b.vendor_name || ''))
                .map(([vendorId, vendorData]: [string, any]) => (
                Object.entries(vendorData.assessments || {})
                  .sort(([typeA], [typeB]) => typeA.localeCompare(typeB))
                  .map(([assessmentType, data]: [string, any], idx) => (
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
                  {item.vendor_name} • {item.assessment_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
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

    // Vendor Risk Heatmap by Assessment Grading
    <DashboardWidget
      key="vendor-grading-heatmap"
      id="vendor-grading-heatmap"
      title="Vendor Risk by Assessment Grading"
      icon={<BarChart3 className="w-5 h-5 text-primary" />}
      collapsible={true}
      filterable={true}
    >
      {analytics.vendor_grading_heatmap && Object.keys(analytics.vendor_grading_heatmap).length > 0 ? (
        <div className="space-y-4">
          <ChartContainer height={400}>
            <BarChart
              data={Object.entries(analytics.vendor_grading_heatmap)
                .map(([vendorId, data]: [string, any]) => ({
                  vendor: data.vendor_name,
                  vendorId: vendorId, // Keep vendorId for stable sorting
                  accepted: data.grading.accepted,
                  denied: data.grading.denied,
                  need_info: data.grading.need_info,
                  pending: data.grading.pending,
                  total: data.grading.accepted + data.grading.denied + data.grading.need_info + data.grading.pending
                }))
                .filter(item => item.total > 0)
                .sort((a, b) => {
                  // First sort by total (descending), then by vendor name (ascending) for stable order
                  if (b.total !== a.total) return b.total - a.total
                  return a.vendor.localeCompare(b.vendor)
                })
                .slice(0, 15)}
              margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="vendor"
                angle={-45}
                textAnchor="end"
                height={120}
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              />
              <Legend />
              <Bar dataKey="accepted" stackId="a" fill="#10b981" name="Accepted" />
              <Bar dataKey="denied" stackId="a" fill="#ef4444" name="Denied" />
              <Bar dataKey="need_info" stackId="a" fill="#f59e0b" name="Need Info" />
              <Bar dataKey="pending" stackId="a" fill="#6b7280" name="Pending" />
            </BarChart>
          </ChartContainer>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">Stacked bar chart showing assessment grading distribution by vendor</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No grading data available</div>
      )}
    </DashboardWidget>,

    // Vendor Risk by CVEs
    <DashboardWidget
      key="vendor-cve-risk"
      id="vendor-cve-risk"
      title="Vendor Risk by CVEs"
      icon={<Shield className="w-5 h-5 text-primary" />}
      collapsible={true}
      filterable={true}
    >
      {analytics.vendor_cve_risk && Object.keys(analytics.vendor_cve_risk).length > 0 ? (
        <div className="space-y-4">
          <ChartContainer height={400}>
            <BarChart
              data={Object.entries(analytics.vendor_cve_risk)
                .map(([vendorId, data]: [string, any]) => ({
                  vendor: data.vendor_name,
                  vendorId: vendorId, // Keep vendorId for stable sorting
                  critical: data.critical_cves,
                  high: data.high_cves,
                  medium: data.medium_cves,
                  low: data.low_cves,
                  total: data.total_cves,
                  risk_score: data.risk_score
                }))
                .filter(item => item.total > 0)
                .sort((a, b) => {
                  // First sort by risk_score (descending), then by vendor name (ascending) for stable order
                  if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score
                  return a.vendor.localeCompare(b.vendor)
                })
                .slice(0, 15)}
              margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="vendor"
                angle={-45}
                textAnchor="end"
                height={120}
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px'
                }}
                formatter={(value: number | undefined, name: string | undefined) => {
                  if (value === undefined) return [0, name || '']
                  if (name === 'risk_score') {
                    return [`${value.toFixed(1)}`, 'Risk Score']
                  }
                  return [value, name || '']
                }}
              />
              <Legend />
              <Bar dataKey="critical" stackId="a" fill="#dc2626" name="Critical" />
              <Bar dataKey="high" stackId="a" fill="#f97316" name="High" />
              <Bar dataKey="medium" stackId="a" fill="#f59e0b" name="Medium" />
              <Bar dataKey="low" stackId="a" fill="#10b981" name="Low" />
            </BarChart>
          </ChartContainer>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(analytics.vendor_cve_risk)
                .map(([vendorId, data]: [string, any]) => ({
                  vendor: data.vendor_name,
                  vendorId: vendorId, // Keep vendorId for stable sorting
                  total: data.total_cves,
                  risk_score: data.risk_score
                }))
                .filter(item => item.total > 0)
                .sort((a, b) => {
                  // First sort by risk_score (descending), then by vendor name (ascending) for stable order
                  if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score
                  return a.vendor.localeCompare(b.vendor)
                })
                .slice(0, 8)
                .map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xs font-medium text-gray-600 mb-1 truncate">{item.vendor}</div>
                    <div className="text-lg font-semibold text-gray-900">{item.total} CVEs</div>
                    <div className="text-xs text-gray-500">Risk: {item.risk_score.toFixed(1)}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No CVE data available</div>
      )}
    </DashboardWidget>,
  ]

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">Assessment Analytics</h1>
              <p className="text-sm text-gray-600">
                Comprehensive analytics for vendor assessment management and risk monitoring
              </p>
            </div>
          </div>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {overviewCards}
        </div>

        {/* Filters and Quarterly Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {widgets.filter((w: any) => w.key === 'filters').map((widget: any) => widget)}
          <div className="lg:col-span-2">
            {widgets.filter((w: any) => w.key === 'quarterly').map((widget: any) => widget)}
          </div>
        </div>

        {/* Assessment Types and Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {widgets.filter((w: any) => w.key === 'types').map((widget: any) => widget)}
          {widgets.filter((w: any) => w.key === 'upcoming').map((widget: any) => widget)}
        </div>

        {/* Vendor Risk Distribution */}
        <div className="mb-6">
          {widgets.filter((w: any) => w.key === 'vendors').map((widget: any) => widget)}
        </div>

        {/* Vendor Grading Heatmap and CVE Risk */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {widgets.filter((w: any) => w.key === 'vendor-grading-heatmap').map((widget: any) => widget)}
          {widgets.filter((w: any) => w.key === 'vendor-cve-risk').map((widget: any) => widget)}
        </div>
      </div>
    </Layout>
  )
}
