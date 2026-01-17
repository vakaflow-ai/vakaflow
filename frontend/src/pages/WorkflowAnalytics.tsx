import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { workflowAnalyticsApi, WorkflowSummary } from '../lib/workflowAnalytics'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton } from '../components/material'
import { BarChart3Icon, TrendingUpIcon, ClockIcon, AlertTriangleIcon } from '../components/Icons'

export default function WorkflowAnalytics() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['workflow-analytics-summary'],
    queryFn: () => workflowAnalyticsApi.getSummary(),
    enabled: !!user
  })

  const { data: performance, isLoading: performanceLoading } = useQuery({
    queryKey: ['workflow-analytics-performance', dateRange],
    queryFn: () => {
      const endDate = new Date()
      const startDate = new Date()
      if (dateRange === '7d') {
        startDate.setDate(startDate.getDate() - 7)
      } else if (dateRange === '30d') {
        startDate.setDate(startDate.getDate() - 30)
      } else {
        startDate.setDate(startDate.getDate() - 90)
      }
      return workflowAnalyticsApi.getPerformance(
        startDate.toISOString(),
        endDate.toISOString()
      )
    },
    enabled: !!user
  })

  const { data: bottlenecks } = useQuery({
    queryKey: ['workflow-analytics-bottlenecks'],
    queryFn: () => workflowAnalyticsApi.getBottlenecks(),
    enabled: !!user
  })

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Workflow Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor workflow performance and identify bottlenecks</p>
          </div>
          <div className="flex gap-2">
            <MaterialButton
              variant={dateRange === '7d' ? 'contained' : 'outlined'}
              onClick={() => setDateRange('7d')}
            >
              7 Days
            </MaterialButton>
            <MaterialButton
              variant={dateRange === '30d' ? 'contained' : 'outlined'}
              onClick={() => setDateRange('30d')}
            >
              30 Days
            </MaterialButton>
            <MaterialButton
              variant={dateRange === '90d' ? 'contained' : 'outlined'}
              onClick={() => setDateRange('90d')}
            >
              90 Days
            </MaterialButton>
          </div>
        </div>

        {/* Summary Cards */}
        {summaryLoading ? (
          <div className="text-center py-12">Loading summary...</div>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
            <MaterialCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Workflows</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.active_workflows}</p>
                </div>
                <BarChart3Icon className="w-8 h-8 text-blue-500" />
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Requests</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.total_requests}</p>
                </div>
                <TrendingUpIcon className="w-8 h-8 text-green-500" />
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Requests</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.pending_requests}</p>
                </div>
                <ClockIcon className="w-8 h-8 text-yellow-500" />
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Assessments</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.total_assessments}</p>
                </div>
                <BarChart3Icon className="w-8 h-8 text-purple-500" />
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Assessments</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.pending_assessments}</p>
                </div>
                <ClockIcon className="w-8 h-8 text-orange-500" />
              </div>
            </MaterialCard>
          </div>
        ) : null}

        {/* Bottlenecks */}
        {bottlenecks && bottlenecks.total_bottlenecks > 0 && (
          <MaterialCard className="p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangleIcon className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">Workflow Bottlenecks</h2>
            </div>
            <div className="space-y-2">
              {bottlenecks.bottlenecks.map((bottleneck) => (
                <div key={bottleneck.workflow_id} className="p-4 bg-red-50 rounded-md">
                  <p className="font-medium text-gray-900">{bottleneck.workflow_name}</p>
                  <p className="text-sm text-gray-600">{bottleneck.issue}</p>
                  <p className="text-sm text-red-600 mt-1">
                    {bottleneck.stuck_requests} request(s) stuck
                  </p>
                </div>
              ))}
            </div>
          </MaterialCard>
        )}

        {/* Performance Metrics */}
        {performanceLoading ? (
          <div className="text-center py-12">Loading performance metrics...</div>
        ) : performance && performance.workflows.length > 0 ? (
          <MaterialCard className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Performance</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workflow</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approved</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rejected</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approval Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Time (hrs)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {performance.workflows.map((workflow) => (
                    <tr key={workflow.workflow_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {workflow.workflow_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {workflow.total_requests}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {workflow.approved}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {workflow.rejected}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                        {workflow.pending}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {workflow.approval_rate.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {workflow.avg_completion_time_hours
                          ? `${workflow.avg_completion_time_hours.toFixed(1)}h`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MaterialCard>
        ) : (
          <MaterialCard className="p-6">
            <p className="text-center text-gray-500">No performance data available</p>
          </MaterialCard>
        )}
      </div>
    </Layout>
  )
}
