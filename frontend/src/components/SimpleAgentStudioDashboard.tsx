import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentStudioApi } from '../lib/agentStudio'

interface StudioDashboardProps {
  tenantId: string
}

export default function AgentStudioDashboard({ tenantId }: StudioDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-studio-dashboard', tenantId, timeRange],
    queryFn: () => agentStudioApi.getDashboard(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
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
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center text-red-600">
          <h3 className="text-lg font-medium mb-2">Unable to load dashboard</h3>
          <p className="text-sm mb-4">There was an error loading the governance dashboard data.</p>
          <button 
            onClick={() => refetch()} 
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-500">
          <h3 className="text-lg font-medium mb-2">No data available</h3>
          <p className="text-sm">Dashboard data will appear once entities are created.</p>
        </div>
      </div>
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
          <button 
            onClick={() => refetch()} 
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {governance_alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {governance_alerts.map((alert, index) => (
            <div 
              key={index} 
              className={`p-4 border-l-4 rounded-lg ${
                alert.severity === 'high' ? 'border-red-500 bg-red-50' :
                alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className={`h-5 w-5 ${
                    alert.severity === 'high' ? 'text-red-600' :
                    alert.severity === 'medium' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="font-medium text-gray-900">{alert.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                  <div className="mt-2 text-xs font-medium">
                    {alert.count} entities affected
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Entities"
          value={total_entities}
          icon={
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          color="blue"
        />
        <MetricCard 
          title="Avg Compliance"
          value={`${Math.round(compliance_summary.average_compliance_score)}%`}
          icon={
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          color="green"
          trend={compliance_summary.average_compliance_score >= 80 ? 'positive' : 
                 compliance_summary.average_compliance_score >= 60 ? 'neutral' : 'negative'}
        />
        <MetricCard 
          title="Needs Attention"
          value={compliance_summary.needs_attention_count}
          icon={
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          color="yellow"
        />
        <MetricCard 
          title="Fully Compliant"
          value={compliance_summary.fully_compliant_count}
          icon={
            <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          color="purple"
        />
      </div>

      {/* Charts and Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entity Types Distribution */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
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
        </div>

        {/* Risk Level Distribution */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
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
        </div>
      </div>

      {/* Recent Activities and Upcoming Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Activities</h3>
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
        </div>

        {/* Upcoming Reviews */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Upcoming Reviews</h3>
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
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
                <svg className="mx-auto h-8 w-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-sm">No upcoming reviews</p>
              </div>
            )}
          </div>
        </div>
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
    <div className={`p-6 border rounded-lg ${colorClasses[color]}`}>
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
    </div>
  )
}