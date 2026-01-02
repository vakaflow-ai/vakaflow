import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, ZAxis
} from 'recharts'
import { analyticsApi } from '../lib/analytics'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialCard } from '../components/material'

const COLORS = {
  risk: {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
    unknown: '#6b7280'
  },
  compliance: {
    excellent: '#10b981',
    good: '#3b82f6',
    fair: '#f59e0b',
    poor: '#ef4444',
    unknown: '#6b7280'
  },
  posture: {
    excellent: '#10b981',
    good: '#3b82f6',
    fair: '#f59e0b',
    needs_improvement: '#ef4444'
  }
}

export default function AIPostureDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: posture, isLoading, error } = useQuery({
    queryKey: ['ai-posture'],
    queryFn: () => analyticsApi.getAIPosture(),
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 10000 // Consider data stale after 10 seconds
  })

  if (!user) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  const allowedRoles = ['tenant_admin', 'platform_admin', 'security_reviewer', 'compliance_reviewer']
  if (!allowedRoles.includes(user?.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500 font-medium mb-2">Access Denied</div>
          <div className="text-muted-foreground">This dashboard is for CIO/CISO roles only.</div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading AI Posture Dashboard...</div>
        </div>
      </Layout>
    )
  }

  if (error || !posture || !posture.overall_posture) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500">Error loading dashboard data</div>
          {error && <div className="text-sm text-gray-500 mt-2">{String(error)}</div>}
        </div>
      </Layout>
    )
  }

  // Prepare chart data
  const modelUsageData = Object.entries(posture.model_usage || {}).flatMap(([vendor, models]) =>
    Object.entries(models || {}).map(([model, count]) => ({
      name: `${vendor}/${model}`,
      vendor,
      model,
      count
    }))
  ).sort((a, b) => b.count - a.count).slice(0, 15)

  const riskDistributionData = Object.entries(posture.risk_distribution || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: COLORS.risk[name as keyof typeof COLORS.risk] || COLORS.risk.unknown
  }))

  const complianceDistributionData = Object.entries(posture.compliance_distribution || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: COLORS.compliance[name as keyof typeof COLORS.compliance] || COLORS.compliance.unknown
  }))

  const deploymentData = Object.entries(posture.deployment_distribution || {}).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value
  }))

  const postureLevelColor = posture.overall_posture?.posture_level 
    ? (COLORS.posture[posture.overall_posture.posture_level as keyof typeof COLORS.posture] || COLORS.posture.needs_improvement)
    : COLORS.posture.needs_improvement

  // Risk by Model heatmap data
  const riskByModelData = Object.entries(posture.risk_by_model || {}).map(([model, data]: [string, any]) => ({
    model: model.length > 30 ? model.substring(0, 30) + '...' : model,
    fullModel: model,
    avgRisk: data?.avg_risk || 0,
    count: data?.count || 0
  })).sort((a, b) => b.avgRisk - a.avgRisk).slice(0, 10)

  // Compliance by Model data
  const complianceByModelData = Object.entries(posture.compliance_by_model || {}).map(([model, data]: [string, any]) => ({
    model: model.length > 30 ? model.substring(0, 30) + '...' : model,
    fullModel: model,
    avgCompliance: data?.avg_compliance || 0,
    count: data?.count || 0
  })).sort((a, b) => a.avgCompliance - b.avgCompliance).slice(0, 10)

  // Data Classification Heatmap
  const heatmapData = (posture.data_classification_heatmap || []).slice(0, 50).map((item, idx) => ({
    x: item.risk_score || 0,
    y: item.compliance_score || 0,
    z: 1,
    name: item.agent_name,
    pii: item.pii,
    phi: item.phi,
    financial: item.financial,
    biometric: item.biometric,
    model: `${item.llm_vendor || 'Unknown'}/${item.llm_model || 'Unknown'}`
  }))

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">AI Posture Dashboard</h1>
            <p className="text-body text-gray-500 mt-2">
              Comprehensive runtime posture visualization for CIO/CISO
            </p>
          </div>
          <div className="text-right">
            <div className="text-caption text-gray-500 mb-1">Overall Posture</div>
            <div className={`text-heading font-medium`} style={{ color: postureLevelColor }}>
              {posture.overall_posture.posture_score?.toFixed(1) || 'N/A'}
            </div>
            <div className="text-caption text-gray-500 capitalize">
              {posture.overall_posture.posture_level?.replace('_', ' ') || 'N/A'}
            </div>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MaterialCard elevation={2} className="bg-gradient-to-br from-blue-50/50 to-blue-100/50 border-none">
            <div className="text-sm font-medium text-blue-600 mb-1">Total Models in Use</div>
            <div className="text-3xl font-medium text-blue-900">{posture.total_models_in_use}</div>
            <div className="text-xs text-blue-600 font-medium mt-1">{posture.unique_vendors} unique vendors</div>
          </MaterialCard>
          <MaterialCard elevation={2} className="bg-gradient-to-br from-green-50/50 to-green-100/50 border-none">
            <div className="text-sm font-medium text-green-600 mb-1">Approved Agents</div>
            <div className="text-3xl font-medium text-green-900">{posture.overall_posture?.approved_agents || 0}</div>
            <div className="text-xs text-green-700 font-medium mt-1">
              {posture.overall_posture?.total_agents || 0} total agents
            </div>
          </MaterialCard>
          <MaterialCard elevation={2} className="bg-gradient-to-br from-orange-50/50 to-orange-100/50 border-none">
            <div className="text-sm font-medium text-orange-600 mb-1">Avg Risk Score</div>
            <div className="text-3xl font-medium text-orange-900">
              {posture.overall_posture.avg_risk_score?.toFixed(1) || 'N/A'}
            </div>
            <div className="text-xs text-orange-700 font-medium mt-1">Scale: 1-10</div>
          </MaterialCard>
          <MaterialCard elevation={2} className="bg-gradient-to-br from-purple-50/50 to-purple-100/50 border-none">
            <div className="text-sm font-medium text-purple-600 mb-1">Avg Compliance</div>
            <div className="text-3xl font-medium text-purple-900">
              {posture.overall_posture.avg_compliance_score?.toFixed(1) || 'N/A'}
            </div>
            <div className="text-xs text-purple-700 font-medium mt-1">Scale: 0-100</div>
          </MaterialCard>
        </div>

        {/* Model Usage and Risk Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Model Usage */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">AI Model Usage (Top 15)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modelUsageData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 10, fill: '#666' }}
                  interval={0}
                  stroke="#e0e0e0"
                />
                <YAxis tick={{ fontSize: 10, fill: '#666' }} stroke="#e0e0e0" />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </MaterialCard>

          {/* Risk Distribution */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Risk Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={100}
                  innerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </MaterialCard>
        </div>

        {/* Compliance and Deployment */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compliance Distribution */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Compliance Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={complianceDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={100}
                  innerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {complianceDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </MaterialCard>

          {/* Deployment Distribution */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Deployment Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deploymentData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#666' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#e0e0e0"
                />
                <YAxis tick={{ fontSize: 10, fill: '#666' }} stroke="#e0e0e0" />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </MaterialCard>
        </div>

        {/* Risk and Compliance by Model Heatmaps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk by Model */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Risk by Model (Top 10)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={riskByModelData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: '#666' }} stroke="#e0e0e0" />
                <YAxis 
                  dataKey="model" 
                  type="category" 
                  width={180} 
                  tick={{ fontSize: 10, fill: '#666', fontWeight: 500 }}
                  interval={0}
                  stroke="#e0e0e0"
                />
                <Tooltip />
                <Bar dataKey="avgRisk" radius={[0, 4, 4, 0]}>
                  {riskByModelData.map((entry, index) => {
                    const color = entry.avgRisk >= 7 ? '#ef4444' : entry.avgRisk >= 5 ? '#f97316' : '#f59e0b'
                    return <Cell key={`cell-${index}`} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </MaterialCard>

          {/* Compliance by Model */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Compliance by Model (Bottom 10)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={complianceByModelData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} stroke="#e0e0e0" />
                <YAxis 
                  dataKey="model" 
                  type="category" 
                  width={180} 
                  tick={{ fontSize: 10, fill: '#666', fontWeight: 500 }}
                  interval={0}
                  stroke="#e0e0e0"
                />
                <Tooltip />
                <Bar dataKey="avgCompliance" radius={[0, 4, 4, 0]}>
                  {complianceByModelData.map((entry, index) => {
                    const color = entry.avgCompliance >= 90 ? '#10b981' : entry.avgCompliance >= 75 ? '#3b82f6' : entry.avgCompliance >= 60 ? '#f59e0b' : '#ef4444'
                    return <Cell key={`cell-${index}`} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </MaterialCard>
        </div>

        {/* Data Classification Heatmap */}
        <MaterialCard elevation={1}>
          <h2 className="text-lg font-medium mb-2 text-gray-900">Data Classification Heatmap</h2>
          <p className="text-sm text-gray-500 mb-6 font-medium">
            Risk vs Compliance scatter plot for agents with data sharing
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                type="number"
                dataKey="x"
                name="Risk Score"
                domain={[0, 10]}
                tick={{ fontSize: 10, fill: '#666' }}
                label={{ value: 'Risk Score', position: 'insideBottom', offset: -5, style: { fontSize: '12px', fontWeight: 500, fill: '#666' } }}
                stroke="#e0e0e0"
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Compliance Score"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#666' }}
                label={{ value: 'Compliance Score', angle: -90, position: 'insideLeft', style: { fontSize: '12px', fontWeight: 500, fill: '#666' } }}
                stroke="#e0e0e0"
              />
              <ZAxis type="number" dataKey="z" range={[100, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-4 border border-gray-100 rounded-md shadow-xl">
                        <p className="font-medium text-gray-900 mb-2">{data.name}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-600">Model: <span className="text-gray-900">{data.model}</span></p>
                          <p className="text-xs font-medium text-gray-600">Risk: <span className="text-gray-900">{data.x}</span></p>
                          <p className="text-xs font-medium text-gray-600">Compliance: <span className="text-gray-900">{data.y}</span></p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className={`px-2 py-1 rounded text-xs font-medium text-center ${data.pii ? 'bg-error-50 text-error-700' : 'bg-gray-50 text-gray-600'}`}>PII</div>
                          <div className={`px-2 py-1 rounded text-xs font-medium text-center ${data.phi ? 'bg-error-50 text-error-700' : 'bg-gray-50 text-gray-600'}`}>PHI</div>
                          <div className={`px-2 py-1 rounded text-xs font-medium text-center ${data.financial ? 'bg-warning-50 text-warning-700' : 'bg-gray-50 text-gray-600'}`}>FIN</div>
                          <div className={`px-2 py-1 rounded text-xs font-medium text-center ${data.biometric ? 'bg-warning-50 text-warning-700' : 'bg-gray-50 text-gray-600'}`}>BIO</div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Scatter name="Agents" data={heatmapData}>
                {heatmapData.map((entry, index) => {
                  let color = '#3b82f6'
                  if (entry.pii || entry.phi) color = '#ef4444'
                  else if (entry.financial) color = '#f97316'
                  else if (entry.biometric) color = '#f59e0b'
                  return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.7} stroke={color} strokeWidth={2} />
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </MaterialCard>

        {/* Posture Trends */}
        <MaterialCard elevation={1}>
          <h2 className="text-lg font-medium mb-6 text-gray-900">Posture Trends (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={posture.posture_trends || []} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#666' }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                angle={-45}
                textAnchor="end"
                height={80}
                stroke="#e0e0e0"
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} stroke="#e0e0e0" />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
              <Line
                type="monotone"
                dataKey="posture_score"
                stroke="var(--primary)"
                strokeWidth={3}
                name="Posture Score"
                dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="avg_compliance"
                stroke="#10b981"
                strokeWidth={3}
                name="Avg Compliance"
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </MaterialCard>

        {/* High Risk Agents and Data Sharing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* High Risk Agents */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">High Risk Agents (Top 10)</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {(posture.high_risk_agents || []).slice(0, 10).map((agent) => (
                <div
                  key={agent.id}
                  className="p-4 bg-blue-100/80 border border-gray-100 rounded-md hover:border-primary-200 hover:bg-white transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{agent.name}</span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm ${
                      agent.risk_score >= 9 ? 'bg-error-50 text-error-700' :
                      agent.risk_score >= 7 ? 'bg-warning-50 text-warning-700' :
                      'bg-orange-50 text-orange-700'
                    }`}>
                      Risk: {agent.risk_score}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {agent.llm_vendor}/{agent.llm_model} • Compliance: <span className="text-gray-700 font-medium">{agent.compliance_score || 'N/A'}%</span>
                  </div>
                </div>
              ))}
            </div>
          </MaterialCard>

          {/* Data Sharing Analysis */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Data Sharing Analysis</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-error-50/50 rounded-md border border-error-100">
                <span className="font-medium text-error-900">PII Sharing</span>
                <span className="text-3xl font-medium text-red-600">{posture.data_sharing_analysis?.pii_sharing || 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-orange-50/50 rounded-md border border-orange-100">
                <span className="font-medium text-orange-900">PHI Sharing</span>
                <span className="text-3xl font-medium text-orange-600">{posture.data_sharing_analysis?.phi_sharing || 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-warning-50/50 rounded-md border border-warning-100">
                <span className="font-medium text-warning-900">Financial Data</span>
                <span className="text-3xl font-medium text-warning-600">{posture.data_sharing_analysis?.financial_data_sharing || 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-purple-50/50 rounded-md border border-purple-100">
                <span className="font-medium text-purple-900">Biometric Data</span>
                <span className="text-3xl font-medium text-purple-600">{posture.data_sharing_analysis?.biometric_data_sharing || 0}</span>
              </div>
              <div className="mt-6 p-4 bg-gray-50 rounded-md border border-gray-100 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-500">Total Agents with Data Sharing</div>
                <div className="text-2xl font-medium text-gray-900">{posture.data_sharing_analysis?.total_agents_with_data_sharing || 0}</div>
              </div>
            </div>
          </MaterialCard>
        </div>

        {/* Integration Connections */}
        <MaterialCard elevation={1}>
          <h2 className="text-lg font-medium mb-6 text-gray-900">Integration Connections</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-6 bg-blue-100/80 rounded-md border border-blue-300">
              <div className="text-3xl font-medium text-blue-900 mb-1">{posture.integration_connections?.total_connections || 0}</div>
              <div className="text-xs font-medium text-blue-600 tracking-tight">Total Connections</div>
            </div>
            <div className="text-center p-6 bg-green-50/50 rounded-md border border-green-100">
              <div className="text-3xl font-medium text-green-900 mb-1">{posture.integration_connections?.encrypted_connections || 0}</div>
              <div className="text-xs font-medium text-green-600 tracking-tight">Encrypted</div>
            </div>
            <div className="text-center p-6 bg-purple-50/50 rounded-md border border-purple-100">
              <div className="text-3xl font-medium text-purple-900 mb-1">{posture.integration_connections?.active_connections || 0}</div>
              <div className="text-xs font-medium text-purple-600 tracking-tight">Active</div>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-md border border-gray-100">
              <div className="text-3xl font-medium text-gray-900 mb-1">{Object.keys(posture.integration_connections?.by_type || {}).length}</div>
              <div className="text-xs font-medium text-gray-500 tracking-tight">Connection Types</div>
            </div>
          </div>
        </MaterialCard>

        {/* Active Compliance Frameworks */}
        {posture.active_compliance_frameworks && posture.active_compliance_frameworks.length > 0 && (
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Active Compliance Frameworks</h2>
            <div className="flex flex-wrap gap-3">
              {posture.active_compliance_frameworks.map((framework) => (
                <span
                  key={framework}
                  className="px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm font-medium border border-primary-100 shadow-sm"
                >
                  {framework}
                </span>
              ))}
            </div>
          </MaterialCard>
        )}

        {/* Cost Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost Overview */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Cost Analytics</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-5 bg-error-50/50 rounded-md border border-error-100">
                  <div className="text-2xl font-medium text-error-700 mb-1">
                    ${(posture.cost_analytics?.total_cost || 0).toFixed(2)}
                  </div>
                  <div className="text-xs font-medium text-red-600 tracking-tight">Total (30d)</div>
                </div>
                <div className="text-center p-5 bg-orange-50/50 rounded-md border border-orange-100">
                  <div className="text-2xl font-medium text-orange-700 mb-1">
                    ${(posture.cost_analytics?.monthly_cost || 0).toFixed(2)}
                  </div>
                  <div className="text-xs font-medium text-orange-600 tracking-tight">Month</div>
                </div>
                <div className="text-center p-5 bg-warning-50/50 rounded-md border border-warning-100">
                  <div className="text-2xl font-medium text-warning-700 mb-1">
                    ${(posture.cost_analytics?.daily_cost || 0).toFixed(2)}
                  </div>
                  <div className="text-xs font-medium text-warning-600 tracking-tight">Today</div>
                </div>
              </div>
              
              {/* Cost Trends */}
              {posture.cost_analytics?.cost_trends && posture.cost_analytics.cost_trends.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-500 tracking-tight mb-4">Cost Trends (Last 30 Days)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={posture.cost_analytics.cost_trends} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: '#666' }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        stroke="#e0e0e0"
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#666' }} stroke="#e0e0e0" />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value: number) => `$${value.toFixed(2)}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        name="Daily Cost"
                        dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </MaterialCard>

          {/* Cost by Model */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Cost by Model</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {Object.entries(posture.cost_analytics?.cost_by_model || {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 10)
                .map(([model, cost]) => (
                  <div key={model} className="flex items-center justify-between p-3 bg-blue-100/80 border border-gray-100 rounded-md hover:border-primary-200 transition-colors">
                    <span className="text-sm font-medium text-gray-700 truncate flex-1">{model}</span>
                    <span className="text-sm font-medium text-red-600 ml-3">
                      ${(cost as number).toFixed(2)}
                    </span>
                  </div>
                ))}
              {Object.keys(posture.cost_analytics?.cost_by_model || {}).length === 0 && (
                <div className="text-center text-gray-600 py-12 font-medium">
                  No cost data available
                </div>
              )}
            </div>
          </MaterialCard>
        </div>

        {/* Prompt Usage Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prompt Usage Overview */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Prompt Usage</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-6 bg-blue-100/80 rounded-md border border-blue-300">
                  <div className="text-3xl font-medium text-blue-600 mb-1">
                    {(posture.prompt_usage?.total_requests || 0).toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-blue-600 tracking-tight">Total Requests</div>
                </div>
                <div className="text-center p-6 bg-purple-50/50 rounded-md border border-purple-100">
                  <div className="text-3xl font-medium text-purple-700 mb-1">
                    {(posture.prompt_usage?.total_tokens || 0).toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-purple-600 tracking-tight">Total Tokens</div>
                </div>
              </div>
              
              {/* Usage Trends */}
              {posture.prompt_usage?.usage_trends && posture.prompt_usage.usage_trends.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-500 tracking-tight mb-4">Usage Trends (Last 30 Days)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={posture.prompt_usage.usage_trends} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: '#666' }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        stroke="#e0e0e0"
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#666' }} stroke="#e0e0e0" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#666' }} stroke="#e0e0e0" />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 500 }} />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="requests"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        name="Requests"
                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="tokens"
                        stroke="#8b5cf6"
                        strokeWidth={2.5}
                        name="Tokens"
                        dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </MaterialCard>

          {/* Usage by Role */}
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Usage by Role</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {Object.entries(posture.usage_by_role || {})
                .sort(([, a], [, b]) => (b as any).cost - (a as any).cost)
                .map(([role, data]: [string, any]) => (
                  <div key={role} className="p-4 bg-blue-100/80 border border-gray-100 rounded-md hover:border-primary-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 capitalize">{role.replace('_', ' ')}</span>
                      <span className="text-sm font-medium text-red-600">
                        ${(data.cost || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      {data.requests || 0} requests • <span className="text-gray-900">{(data.tokens || 0).toLocaleString()}</span> tokens
                    </div>
                  </div>
                ))}
              {Object.keys(posture.usage_by_role || {}).length === 0 && (
                <div className="text-center text-gray-600 py-12 font-medium">
                  No usage data by role available
                </div>
              )}
            </div>
          </MaterialCard>
        </div>

        {/* Usage by Department */}
        {Object.keys(posture.usage_by_department || {}).length > 0 && (
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Usage by Department</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(posture.usage_by_department || {})
                .sort(([, a], [, b]) => (b as any).cost - (a as any).cost)
                .map(([dept, data]: [string, any]) => (
                  <div key={dept} className="p-5 bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    <div className="font-medium text-gray-900 mb-3">{dept}</div>
                    <div className="text-3xl font-medium text-red-600 mb-3">
                      ${(data.cost || 0).toFixed(2)}
                    </div>
                    <div className="space-y-1.5 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-gray-500">Requests</span>
                        <span className="text-gray-900 font-medium">{data.requests || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-gray-500">Tokens</span>
                        <span className="text-gray-900 font-medium">{(data.tokens || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-gray-500">Users</span>
                        <span className="text-gray-900 font-medium">{data.user_count || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </MaterialCard>
        )}

        {/* Cost by Agent */}
        {Object.keys(posture.cost_analytics?.cost_by_agent || {}).length > 0 && (
          <MaterialCard elevation={1}>
            <h2 className="text-lg font-medium mb-6 text-gray-900">Cost by Agent (Top 15)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.entries(posture.cost_analytics?.cost_by_agent || {})
                  .map(([name, data]: [string, any]) => ({
                    name: name.length > 30 ? name.substring(0, 30) + '...' : name,
                    cost: data?.cost || 0,
                    requests: data?.requests || 0
                  }))
                  .sort((a, b) => b.cost - a.cost)
                  .slice(0, 15)}
                margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 10, fill: '#666' }}
                  interval={0}
                  stroke="#e0e0e0"
                />
                <YAxis tick={{ fontSize: 10, fill: '#666' }} stroke="#e0e0e0" />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 500 }} />
                <Bar dataKey="cost" fill="#ef4444" name="Cost ($)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </MaterialCard>
        )}

        {/* Real-time Status Indicator */}
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-50">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Live Data</span>
        </div>
      </div>
    </Layout>
  )
}

