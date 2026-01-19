import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentStudioApi } from '../lib/agentStudio'
import { MaterialCard, MaterialButton } from './material'
import { 
  ChartBarIcon, 
  ShieldCheckIcon, 
  AlertTriangleIcon as ExclamationTriangleIcon, 
  ClockIcon,
  UsersIcon as UserGroupIcon,
  DocumentTextIcon,
  RefreshCwIcon as ArrowPathIcon
} from './Icons'

interface StudioDashboardProps {
  tenantId: string
}

interface DashboardData {
  total_entities: number
  entities_by_type: Record<string, number>
  entities_by_status: Record<string, number>
  entities_by_department: Record<string, number>
  entities_by_risk_level: Record<string, number>
  compliance_summary: {
    average_compliance_score: number
    fully_compliant_count: number
    needs_attention_count: number
  }
  recent_activities: Array<{
    timestamp: string
    entity_name: string
    entity_type: string
    event_type: string
    status_change: string
    triggered_by: string | null
  }>
  governance_alerts: Array<{
    type: string
    title: string
    message: string
    count: number
    severity: string
  }>
  upcoming_reviews: Array<{
    entity_id: string
    entity_name: string
    entity_type: string
    last_review: string
    days_until_due: number
  }>
}

export default function AgentStudioDashboard({ tenantId }: StudioDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  
  const { data: dashboardData, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['agent-studio-dashboard', tenantId, timeRange],
    queryFn: () => agentStudioApi.getDashboard(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <MaterialCard className="p-6">
        <div className="text-center text-red-600">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 mb-4" />
          <h3 className="text-lg font-medium mb-2">Unable to load dashboard</h3>
          <p className="text-sm mb-4">There was an error loading the governance dashboard data.</p>
          <MaterialButton onClick={() => refetch()} variant="outlined">
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Retry
          </MaterialButton>
        </div>
      </MaterialCard>
    )
  }

  if (!dashboardData) {
    return (
      <MaterialCard className="p-6">
        <div className="text-center text-gray-500">
          <DocumentTextIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No data available</h3>
          <p className="text-sm">Dashboard data will appear once entities are created.</p>
        </div>
      </MaterialCard>
    )
  }

  const { 
    total_entities, 
    entities_by_type, 
    entities_by_status, 
    entities_by_department,
    entities_by_risk_level,
    compliance_summary,
    recent_activities,
    governance_alerts,
    upcoming_reviews
  } = dashboardData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Studio</h1>
          <p className="text-gray-600 mt-1">Centralized governance and management dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <MaterialButton onClick={() => refetch()} variant="outlined" size="small">
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </MaterialButton>
        </div>
      </div>

      {/* Alerts Section */}
      {governance_alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {governance_alerts.map((alert, index) => (
            <MaterialCard 
              key={index} 
              className={`p-4 border-l-4 ${
                alert.severity === 'high' ? 'border-red-500 bg-red-50' :
                alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-start">
                <ExclamationTriangleIcon className={`h-5 w-5 mr-3 ${
                  alert.severity === 'high' ? 'text-red-600' :
                  alert.severity === 'medium' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
                <div>
                  <h3 className="font-medium text-gray-900">{alert.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                  <div className="mt-2 text-xs font-medium">
                    {alert.count} entities affected
                  </div>
                </div>
              </div>
            </MaterialCard>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Entities"
          value={total_entities}
          icon={<UserGroupIcon className="h-6 w-6 text-blue-600" />}
          color="blue"
        />
        <MetricCard 
          title="Avg Compliance"
          value={`${Math.round(compliance_summary.average_compliance_score)}%`}
          icon={<ShieldCheckIcon className="h-6 w-6 text-green-600" />}
          color="green"
          trend={compliance_summary.average_compliance_score >= 80 ? 'positive' : 
                 compliance_summary.average_compliance_score >= 60 ? 'neutral' : 'negative'}
        />
        <MetricCard 
          title="Needs Attention"
          value={compliance_summary.needs_attention_count}
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />}
          color="yellow"
        />
        <MetricCard 
          title="Fully Compliant"
          value={compliance_summary.fully_compliant_count}
          icon={<ChartBarIcon className="h-6 w-6 text-purple-600" />}
          color="purple"
        />
      </div>

      {/* Charts and Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entity Types Distribution */}
        <MaterialCard className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Entities by Type</h3>
          <div className="space-y-3">
            {Object.entries(entities_by_type).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                <div className="flex items-center">
                  <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(count / total_entities) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </MaterialCard>

        {/* Risk Level Distribution */}
        <MaterialCard className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Distribution</h3>
          <div className="space-y-3">
            {Object.entries(entities_by_risk_level).map(([level, count]) => (
              <div key={level} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">{level} Risk</span>
                <div className="flex items-center">
                  <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className={`h-2 rounded-full ${
                        level === 'high' ? 'bg-red-500' :
                        level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${(count / total_entities) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </MaterialCard>
      </div>

      {/* Recent Activities and Upcoming Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <MaterialCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Activities</h3>
            <ClockIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {recent_activities.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-start pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex-shrink-0 mt-1">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.entity_name} <span className="font-normal text-gray-500">({activity.entity_type})</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{activity.status_change}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </MaterialCard>

        {/* Upcoming Reviews */}
        <MaterialCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Upcoming Reviews</h3>
            <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {upcoming_reviews.slice(0, 5).map((review, index) => (
              <div key={index} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{review.entity_name}</p>
                  <p className="text-xs text-gray-500 capitalize">{review.entity_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-orange-600">
                    {review.days_until_due} days
                  </p>
                  <p className="text-xs text-gray-400">
                    Due {new Date(review.last_review).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {upcoming_reviews.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ShieldCheckIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No upcoming reviews</p>
              </div>
            )}
          </div>
        </MaterialCard>
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red'
  trend?: 'positive' | 'negative' | 'neutral'
}

function MetricCard({ title, value, icon, color, trend }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    red: 'bg-red-50 text-red-700 border-red-200'
  }

  const trendIcon = trend === 'positive' ? '↑' : trend === 'negative' ? '↓' : ''

  return (
    <MaterialCard className={`p-6 border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline mt-2">
            <p className="text-3xl font-semibold">{value}</p>
            {trend && (
              <span className={`ml-2 text-sm font-medium ${
                trend === 'positive' ? 'text-green-600' : 
                trend === 'negative' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {trendIcon}
              </span>
            )}
          </div>
        </div>
        <div className="p-3 rounded-full bg-white bg-opacity-50">
          {icon}
        </div>
      </div>
    </MaterialCard>
  )
}