import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import ChartContainer from '../components/ChartContainer'
import { analyticsApi } from '../lib/analytics'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import DashboardWidget from '../components/DashboardWidget'
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Activity } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function AnalyticsDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => analyticsApi.getDashboard(days),
    enabled: !!user && ['tenant_admin', 'platform_admin'].includes(user?.role)
  })

  if (!user || !['tenant_admin', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied</div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      </Layout>
    )
  }

  const stats = analytics?.stats

  // Prepare chart data
  const statusData = Object.entries(stats?.agents_by_status || {}).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value
  }))

  const stageData = Object.entries(stats?.reviews_by_stage || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }))

  const typeData = Object.entries(stats?.agents_by_type || {}).map(([name, value]) => ({
    name,
    value
  }))

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">Analytics Dashboard</h1>
              <p className="text-sm text-gray-600">
                Platform insights and metrics
              </p>
            </div>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-10 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-900 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div 
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer group hover:shadow-md hover:border-blue-300 transition-all"
            onClick={() => navigate('/submissions')}
            title="Click to view all agents"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-semibold text-blue-600 mb-2 group-hover:text-blue-700 transition-colors">{stats?.total_agents || 0}</div>
            <div className="text-sm font-medium text-gray-600">Total Agents</div>
          </div>
          <div 
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer group hover:shadow-md hover:border-purple-300 transition-all"
            onClick={() => navigate('/reviews')}
            title="Click to view all reviews"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-semibold text-purple-600 mb-2 group-hover:text-purple-700 transition-colors">{stats?.total_reviews || 0}</div>
            <div className="text-sm font-medium text-gray-600">Total Reviews</div>
          </div>
          <div 
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer group hover:shadow-md hover:border-green-300 transition-all"
            onClick={() => navigate('/ai-posture')}
            title="Click to view AI Posture Dashboard"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-semibold text-green-600 mb-2 group-hover:text-green-700 transition-colors">
              {stats?.compliance_score_avg ? Math.round(stats.compliance_score_avg) : '-'}
            </div>
            <div className="text-sm font-medium text-gray-600">Avg Compliance</div>
          </div>
          <div 
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer group hover:shadow-md hover:border-amber-300 transition-all"
            onClick={() => navigate('/catalog')}
            title="Click to view agent catalog"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-semibold text-amber-600 mb-2 group-hover:text-amber-700 transition-colors">{typeData.length}</div>
            <div className="text-sm font-medium text-gray-600">Agent Types</div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Agent Trends */}
          <DashboardWidget
            id="agent-trends"
            title="Agent Submissions Trend"
            icon={<TrendingUp className="w-4 h-4" />}
            collapsible={true}
            filterable={true}
          >
            <ChartContainer height={300}>
              <LineChart data={analytics?.agent_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
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
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="Agents" />
              </LineChart>
            </ChartContainer>
          </DashboardWidget>

          {/* Review Trends */}
          <DashboardWidget
            id="review-trends"
            title="Review Activity Trend"
            icon={<TrendingUp className="w-4 h-4" />}
            collapsible={true}
            filterable={true}
          >
            <ChartContainer height={300}>
              <LineChart data={analytics?.review_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
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
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} name="Reviews" />
              </LineChart>
            </ChartContainer>
          </DashboardWidget>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Agents by Status */}
          <DashboardWidget
            id="agents-by-status"
            title="Agents by Status"
            icon={<PieChartIcon className="w-4 h-4" />}
            collapsible={true}
            filterable={true}
          >
            <ChartContainer height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={(data: any) => {
                    if (data?.name) {
                      const status = data.name.replace(' ', '_').toLowerCase()
                      navigate(`/submissions?status=${status}`)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    padding: '12px'
                  }} 
                />
              </PieChart>
            </ChartContainer>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">Click on a segment to view agents</p>
            </div>
          </DashboardWidget>

          {/* Reviews by Stage */}
          <DashboardWidget
            id="reviews-by-stage"
            title="Reviews by Stage"
            icon={<BarChart3 className="w-4 h-4" />}
            collapsible={true}
            filterable={true}
          >
            <ChartContainer height={300}>
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    padding: '12px'
                  }} 
                />
                <Bar 
                  dataKey="value" 
                  fill="#3b82f6"
                  onClick={(data: any) => {
                    if (data?.name) {
                      const stage = data.name.toLowerCase()
                      navigate(`/reviews?stage=${stage}`)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ChartContainer>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">Click on a bar to view reviews</p>
            </div>
          </DashboardWidget>

          {/* Agents by Type */}
          <DashboardWidget
            id="agents-by-type"
            title="Agents by Type"
            icon={<BarChart3 className="w-4 h-4" />}
            collapsible={true}
            filterable={true}
          >
            <ChartContainer height={300}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    padding: '12px'
                  }} 
                />
                <Bar 
                  dataKey="value" 
                  fill="#10b981"
                  onClick={(data: any) => {
                    if (data?.name) {
                      navigate(`/catalog?type=${encodeURIComponent(data.name)}`)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ChartContainer>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">Click on a bar to view agents by type</p>
            </div>
          </DashboardWidget>
        </div>

        {/* Compliance Trend */}
        <DashboardWidget
          id="compliance-trend"
          title="Compliance Score Trend"
          icon={<TrendingUp className="w-4 h-4" />}
          collapsible={true}
          filterable={true}
          className="mb-6"
        >
          <ChartContainer height={300}>
            <LineChart data={analytics?.compliance_trends || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  padding: '12px'
                }} 
              />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} name="Compliance Score" />
            </LineChart>
          </ChartContainer>
        </DashboardWidget>

        {/* Recent Activity */}
        <DashboardWidget
          id="recent-activity"
          title="Recent Activity"
          icon={<Activity className="w-4 h-4" />}
          collapsible={true}
          filterable={true}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">Type</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">Name</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">Action</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats?.recent_activity?.slice(0, 10).map((activity: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 text-sm text-gray-900 capitalize">{activity.type}</td>
                    <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{activity.name}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-700 capitalize">{activity.action}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-700">{new Date(activity.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardWidget>
      </div>
    </Layout>
  )
}

