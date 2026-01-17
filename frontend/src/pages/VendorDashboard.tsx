import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import ChartContainer from '../components/ChartContainer'
import { vendorsApi, VendorDashboard as VendorDashboardData } from '../lib/vendors'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialButton, MaterialChip } from '../components/material'
import { ChartBarIcon, ClockIcon, ShieldCheckIcon, ActivityIcon, FilterIcon, CalendarIcon, ChevronRightIcon, TrendingUpIcon, BuildingIcon, UsersIcon, CheckCircleIcon } from '../components/Icons'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function VendorDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [days, setDays] = useState(30)
  const [filters, setFilters] = useState({
    department: '',
    organization: '',
    category: '',
    subcategory: '',
    ownership: ''
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: dashboard, isLoading, error } = useQuery<VendorDashboardData>({
    queryKey: ['vendor-dashboard', days, filters],
    queryFn: () => vendorsApi.getDashboard(days, filters),
    enabled: !!user && user?.role === 'vendor_user',
    refetchInterval: 60000, // Refresh every 60 seconds
  })

  if (!user || user?.role !== 'vendor_user') {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500 font-medium mb-2">Access Denied</div>
          <div className="text-muted-foreground">This dashboard is for vendors only.</div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading vendor dashboard...</div>
        </div>
      </Layout>
    )
  }

  if (error || !dashboard) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500">Error loading dashboard data</div>
        </div>
      </Layout>
    )
  }

  const stats = dashboard.stats

  // Prepare chart data
  const statusData = Object.entries(stats.agents_by_status || {}).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value
  }))

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header - Enterprise Design */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 rounded-lg border border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
              <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
              Vendor Dashboard
            </h1>
            <div className="flex items-center gap-3 text-sm font-medium text-gray-500 mt-2">
              <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                <BuildingIcon className="w-4 h-4 text-primary-500" />
                <span className="text-gray-700">{dashboard.vendor.name}</span>
              </div>
              <span className="text-blue-600 font-bold tracking-tight bg-primary-50 px-3 py-1 rounded-full border border-primary-100 text-sm">
                Real-time Analytics
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-md border border-gray-200">
            <div className="pl-3 py-1 flex items-center gap-2 text-sm font-medium text-gray-600 tracking-tight">
              <CalendarIcon className="w-4 h-4" />
              Horizon
            </div>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-9 border-none bg-white rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500/20 w-40 font-bold text-primary-700 text-sm cursor-pointer transition-all hover:bg-gray-50"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
        </div>

        {/* Dimension Toolbar - Improved UX */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <FilterIcon className="w-4 h-4 text-gray-600" />
              <h3 className="text-xs font-medium text-gray-600 tracking-tight">Dimension filters</h3>
            </div>
            {Object.values(filters).some(f => f) && (
              <MaterialButton
                variant="text"
                size="small"
                onClick={() => setFilters({ department: '', organization: '', category: '', subcategory: '', ownership: '' })}
                className="text-blue-600 font-medium text-sm hover:bg-primary-50"
              >
                Reset all
              </MaterialButton>
            )}
          </div>
          
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Department', value: filters.department, options: dashboard.filter_options.departments, key: 'department' },
              { label: 'Organization/BU', value: filters.organization, options: dashboard.filter_options.organizations, key: 'organization' },
              { label: 'Category', value: filters.category, options: dashboard.filter_options.categories, key: 'category' },
              { label: 'Subcategory', value: filters.subcategory, options: dashboard.filter_options.subcategories, key: 'subcategory', disabled: !filters.category },
              { label: 'Ownership', value: filters.ownership, options: dashboard.filter_options.ownerships.map(o => ({ value: o.id, label: o.name })), key: 'ownership', isObject: true },
            ].map((filter) => (
              <div key={filter.key} className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 tracking-tight ml-1">{filter.label}</label>
                <select
                  value={filter.value}
                  onChange={(e) => {
                    const newFilters = { ...filters, [filter.key]: e.target.value };
                    if (filter.key === 'category') newFilters.subcategory = '';
                    setFilters(newFilters);
                  }}
                  disabled={filter.disabled}
                  className={`w-full h-10 px-3 rounded-md text-sm font-medium transition-all border-gray-100 bg-blue-100/80 hover:bg-white hover:border-primary-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-primary-500/10 ${
                    filter.value ? 'text-primary-700 border-primary-200 bg-primary-50/30' : 'text-gray-600'
                  }`}
                >
                  <option value="">All {filter.label}s</option>
                  {filter.options.map((opt: any) => (
                    <option key={filter.isObject ? opt.value : opt} value={filter.isObject ? opt.value : opt}>
                      {filter.isObject ? opt.label : opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Core Metric Grid - Enterprise Polish */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            className="group relative bg-white p-6 rounded-lg border border-slate-200 hover:border-primary transition-all cursor-pointer overflow-hidden"
            onClick={() => navigate('/submissions')}
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-9 rounded-md bg-primary-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <UsersIcon className="w-6 h-6" />
              </div>
              <TrendingUpIcon className="w-5 h-5 text-primary-400" />
            </div>
            <div className="text-sm font-medium text-gray-700 tracking-tight mb-1">Total agents</div>
            <div className="text-3xl font-semibold text-gray-900 tabular-nums leading-none">{stats.total_agents}</div>
            <div className="text-xs font-bold text-blue-600 mt-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              View catalog <ChevronRightIcon className="w-3 h-3" />
            </div>
          </div>

          <div 
            className="group relative bg-white p-6 rounded-lg border border-slate-200 hover:border-green-500 transition-all cursor-pointer overflow-hidden"
            onClick={() => navigate('/submissions?status=approved')}
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-success-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-9 rounded-md bg-success-50 flex items-center justify-center text-green-600 group-hover:bg-green-500 group-hover:text-white transition-all">
                <CheckCircleIcon className="w-6 h-6" />
              </div>
              <div className="px-2 py-0.5 rounded-full bg-success-100 text-success-700 text-xs font-bold">Active</div>
            </div>
            <div className="text-sm font-medium text-gray-700 tracking-tight mb-1">Approved assets</div>
            <div className="text-3xl font-bold text-success-700 tabular-nums leading-none">{stats.approved_count}</div>
            <div className="text-xs font-bold text-green-600 mt-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              View approved <ChevronRightIcon className="w-3 h-3" />
            </div>
          </div>

          <div 
            className="group relative bg-white p-6 rounded-lg border border-slate-200 hover:border-orange-500 transition-all cursor-pointer overflow-hidden"
            onClick={() => navigate('/submissions?status=submitted,in_review')}
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-warning-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-9 rounded-md bg-warning-50 flex items-center justify-center text-warning-600 group-hover:bg-warning-600 group-hover:text-white transition-all">
                <ClockIcon className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse" />
                <span className="text-xs font-bold text-warning-600">Processing</span>
              </div>
            </div>
            <div className="text-sm font-medium text-gray-700 tracking-tight mb-1">In review pipeline</div>
            <div className="text-3xl font-bold text-warning-700 tabular-nums leading-none">{stats.active_requests}</div>
            <div className="text-xs font-bold text-warning-600 mt-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              View pipeline <ChevronRightIcon className="w-3 h-3" />
            </div>
          </div>

          <div className="relative bg-white p-6 rounded-lg border border-slate-200 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16" />
            <div className="flex items-center justify-between mb-4 relative">
              <div className="w-12 h-9 rounded-md bg-gray-100 flex items-center justify-center text-gray-600">
                <CalendarIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="text-sm font-medium text-gray-700 tracking-tight mb-1 relative">Recent output</div>
            <div className="text-3xl font-semibold text-gray-900 tabular-nums leading-none relative">{stats.recent_submissions}</div>
            <div className="text-xs font-medium text-gray-700 mt-4 relative">Last {days} days activity</div>
          </div>
        </div>

        {/* Quality Scoring - High Impact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="group bg-white p-8 rounded-lg border border-slate-200 hover:border-green-500 transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-green-500/20 group-hover:bg-green-500 transition-all" />
            <div className="flex items-start justify-between relative">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700 tracking-tight mb-4">Portfolio compliance alignment</div>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-6xl font-semibold text-gray-900 tabular-nums leading-none tracking-tighter">
                    {stats.avg_compliance ? stats.avg_compliance.toFixed(1) : '0'}
                  </span>
                  <span className="text-3xl font-medium text-gray-600 mb-1.5">%</span>
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-50 shadow-inner">
                  <div 
                    className="h-full bg-success-500 rounded-full shadow-lg transition-all duration-1000 ease-out" 
                    style={{ width: `${stats.avg_compliance || 0}%` }} 
                  />
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-success-500" />
                    <span className="text-sm font-medium text-gray-600">System Benchmark: 95%</span>
                  </div>
                  <MaterialChip label="On Target" color="success" size="small" variant="filled" className="font-medium text-xs" />
                </div>
              </div>
              <ShieldCheckIcon className="w-24 h-24 text-success-50 opacity-40 -mr-4" />
            </div>
          </div>

          <div className="group bg-white p-8 rounded-lg border border-slate-200 hover:border-red-500 transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-red-500/20 group-hover:bg-red-500 transition-all" />
            <div className="flex items-start justify-between relative">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700 tracking-tight mb-4">Average risk profiling</div>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-6xl font-semibold text-gray-900 tabular-nums leading-none tracking-tighter">
                    {stats.avg_risk ? stats.avg_risk.toFixed(1) : '0'}
                  </span>
                  <span className="text-2xl font-medium text-gray-600 mb-2">/ 10</span>
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-50 shadow-inner">
                  <div 
                    className={`h-full rounded-full shadow-lg transition-all duration-1000 ease-out ${
                      (stats.avg_risk || 0) <= 3 ? 'bg-success-500' :
                      (stats.avg_risk || 0) <= 6 ? 'bg-warning-500' : 'bg-error-500'
                    }`} 
                    style={{ width: `${(stats.avg_risk || 0) * 10}%` }} 
                  />
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-error-400" />
                    <span className="text-sm font-medium text-gray-600">Critical Threshold: 7.0</span>
                  </div>
                  <MaterialChip 
                    label={(stats.avg_risk || 0) > 6 ? 'High Risk' : 'Moderate Risk'} 
                    color={(stats.avg_risk || 0) > 6 ? 'error' : 'warning'} 
                    size="small" 
                    variant="filled" 
                    className="font-medium text-xs" 
                  />
                </div>
              </div>
              <ActivityIcon className="w-24 h-24 text-error-50 opacity-40 -mr-4" />
            </div>
          </div>
        </div>

        {/* Visual Analytics - Sharp Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Submission Trends</h3>
                <p className="text-xs font-medium text-gray-700 tracking-tight mt-1">Temporal Volatility</p>
              </div>
              <div className="w-10 h-10 rounded-md bg-primary-50 flex items-center justify-center text-blue-600">
                <TrendingUpIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="h-[340px] w-full">
              <ChartContainer height={300}>
                <LineChart data={dashboard.submission_trends || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                    itemStyle={{ fontWeight: 900, fontSize: '14px', color: '#1e293b' }}
                    labelStyle={{ fontWeight: 700, fontSize: '11px', color: '#64748b', marginBottom: '4px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={1.5} 
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
                    name="Assets" 
                  />
                </LineChart>
              </ChartContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Portfolio Mix</h3>
                <p className="text-xs font-medium text-gray-700 tracking-tight mt-1">Status Distribution</p>
              </div>
              <div className="w-10 h-10 rounded-md bg-secondary-50 flex items-center justify-center text-secondary-600">
                <ChartBarIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="h-[340px] w-full">
              <ChartContainer height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={8}
                    cornerRadius={12}
                    dataKey="value"
                    onClick={(data: any) => {
                      if (data?.name) {
                        const status = data.name.replace(' ', '_').toLowerCase()
                        navigate(`/submissions?status=${status}`)
                      }
                    }}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={40} 
                    iconType="circle" 
                    iconSize={10} 
                    wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '30px', letterSpacing: '0.05em' }} 
                  />
                </PieChart>
              </ChartContainer>
            </div>
          </div>
        </div>

        {/* Audit Horizon - Professional Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-blue-100/80">
            <div className="flex items-center gap-4">
              <div className="w-12 h-9 rounded-md bg-gray-900 flex items-center justify-center text-white shadow-lg shadow-gray-200">
                <ActivityIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 tracking-tight">Event Audit Log</h3>
                <p className="text-xs font-medium text-gray-700 tracking-tight mt-0.5">Sub-second transaction monitoring</p>
              </div>
            </div>
            <MaterialButton 
              variant="outlined" 
              size="small" 
              className="border-gray-200 text-gray-700 font-medium text-sm tracking-tight hover:bg-white"
            >
              Export Archive
            </MaterialButton>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50/30">
                  <th className="px-8 py-2.5 text-left text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">Entity</th>
                  <th className="px-8 py-2.5 text-left text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">Asset Identity</th>
                  <th className="px-8 py-2.5 text-left text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">Protocol</th>
                  <th className="px-8 py-2.5 text-right text-sm font-medium text-gray-700 tracking-tight border-b border-gray-100">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dashboard.recent_activity?.slice(0, 10).map((activity: any, idx: number) => (
                  <tr 
                    key={idx}
                    className="group cursor-pointer hover:bg-primary-50/30 transition-all"
                    onClick={() => activity.type === 'agent' && navigate('/submissions')}
                  >
                    <td className="px-8 py-2.5 whitespace-nowrap">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-tight border ${
                        activity.type === 'agent' ? 'bg-primary-50 text-primary-700 border-primary-100' : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {activity.type}
                      </div>
                    </td>
                    <td className="px-8 py-2.5 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                        {activity.name}
                        <ChevronRightIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                      </div>
                    </td>
                    <td className="px-8 py-2.5 whitespace-nowrap">
                      <div className="text-xs font-medium text-gray-600 tracking-tight">{activity.action}</div>
                    </td>
                    <td className="px-8 py-2.5 whitespace-nowrap text-right">
                      <div className="text-xs font-medium text-gray-700 tabular-nums">
                        {new Date(activity.timestamp).toLocaleString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!dashboard.recent_activity || dashboard.recent_activity.length === 0) && (
            <div className="p-20 text-center">
              <div className="w-16 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500 mx-auto mb-4 border border-gray-100 border-dashed">
                <ActivityIcon className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-gray-700 tracking-tight">No transaction records found</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
