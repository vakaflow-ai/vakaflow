import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MaterialButton, MaterialCard, MaterialChip } from '../components/material'
import { assessmentsApi } from '../lib/assessments'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { showToast } from '../utils/toast'
import {
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  FileText,
  RefreshCw,
  Calendar,
  Target,
  Award
} from 'lucide-react'

interface AssessmentWorkflowDashboardProps {}

export default function AssessmentWorkflowDashboard({}: AssessmentWorkflowDashboardProps) {
  const [user, setUser] = useState<any>(null)
  const [selectedQuarter, setSelectedQuarter] = useState<string>('')

  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => window.location.href = '/login')
  }, [])

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: ['assessment-analytics', selectedQuarter],
    queryFn: () => assessmentsApi.getAnalytics(selectedQuarter),
    enabled: !!user,
  })

  // Fetch upcoming assessments
  const { data: upcoming, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcoming-assessments'],
    queryFn: () => assessmentsApi.getUpcoming(30),
    enabled: !!user,
  })

  const handleRefresh = () => {
    refetchAnalytics()
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getRiskColor = (status: string) => {
    switch (status) {
      case 'green': return 'success'
      case 'yellow': return 'warning'
      case 'red': return 'error'
      default: return 'default'
    }
  }

  const getRiskIcon = (status: string) => {
    switch (status) {
      case 'green': return CheckCircle
      case 'yellow': return AlertTriangle
      case 'red': return XCircle
      default: return Clock
    }
  }

  if (!user) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Assessment Workflow Dashboard</h1>
              <p className="text-gray-600 mt-2">Monitor assessment approvals, reworks, and compliance status</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Time</option>
                <option value="2024-Q1">2024 Q1</option>
                <option value="2024-Q2">2024 Q2</option>
                <option value="2024-Q3">2024 Q3</option>
                <option value="2024-Q4">2024 Q4</option>
                <option value="2025-Q1">2025 Q1</option>
                <option value="2025-Q2">2025 Q2</option>
                <option value="2025-Q3">2025 Q3</option>
                <option value="2025-Q4">2025 Q4</option>
              </select>
              <MaterialButton
                onClick={handleRefresh}
                variant="outlined"
                size="small"
                disabled={analyticsLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </MaterialButton>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MaterialCard className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Assessments</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.overview.total_assessments}</p>
                </div>
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.overview.completed_assignments}</p>
                  <p className="text-xs text-gray-500">{formatPercentage(analytics.overview.completion_rate)} completion rate</p>
                </div>
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Needs Rework</p>
                  <p className="text-2xl font-bold text-yellow-600">{analytics.overview.pending_assignments}</p>
                  <p className="text-xs text-gray-500">Pending review or resubmission</p>
                </div>
              </div>
            </MaterialCard>

            <MaterialCard className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{analytics.overview.overdue_assignments}</p>
                  <p className="text-xs text-gray-500">Past due date</p>
                </div>
              </div>
            </MaterialCard>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Accepted vs Needs Rework Progress */}
          <MaterialCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Approval Progress</h3>
              <Target className="w-5 h-5 text-gray-400" />
            </div>

            {analytics && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Accepted</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-600">{analytics.overview.completed_assignments}</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${analytics.overview.total_assignments > 0 ?
                            (analytics.overview.completed_assignments / analytics.overview.total_assignments) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Needs Rework</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-yellow-600">{analytics.overview.pending_assignments}</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-600 h-2 rounded-full"
                        style={{
                          width: `${analytics.overview.total_assignments > 0 ?
                            (analytics.overview.pending_assignments / analytics.overview.total_assignments) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Overall Progress</span>
                    <span className="font-bold text-blue-600">
                      {formatPercentage(analytics.overview.completion_rate)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </MaterialCard>

          {/* Assessment Type Distribution */}
          <MaterialCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assessment Types</h3>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>

            {analytics && (
              <div className="space-y-3">
                {Object.entries(analytics.assessment_type_distribution).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {type.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{count}</span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${analytics.overview.total_assessments > 0 ?
                              (count / analytics.overview.total_assessments) * 100 : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </MaterialCard>
        </div>

        {/* Vendor Compliance Status */}
        <MaterialCard className="p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Vendor Compliance Status</h3>
            <Users className="w-5 h-5 text-gray-400" />
          </div>

          {analytics && Object.keys(analytics.vendor_distribution).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(analytics.vendor_distribution).map(([vendorId, vendorData]: [string, any]) => {
                const RiskIcon = getRiskIcon(vendorData.overall_risk)
                return (
                  <div key={vendorId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 truncate">{vendorData.vendor_name}</h4>
                      <MaterialChip
                        color={getRiskColor(vendorData.overall_risk)}
                        size="small"
                        label={vendorData.overall_risk.toUpperCase()}
                      >
                        <RiskIcon className="w-3 h-3 mr-1" />
                        {vendorData.overall_risk.toUpperCase()}
                      </MaterialChip>
                    </div>

                    <div className="space-y-2">
                      {Object.entries(vendorData.assessments).slice(0, 3).map(([type, data]: [string, any]) => (
                        <div key={type} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span className="font-medium">{data.completed}/{data.total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No vendor assessment data available</p>
            </div>
          )}
        </MaterialCard>

        {/* Upcoming Assessments */}
        <MaterialCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Assessments</h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>

          {upcoming && upcoming.length > 0 ? (
            <div className="space-y-4">
              {upcoming.slice(0, 5).map((assessment: any) => (
                <div key={assessment.schedule_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <div>
                        <p className="font-medium text-gray-900">{assessment.assessment_name}</p>
                        <p className="text-sm text-gray-600">
                          {assessment.vendor_name} • {assessment.assessment_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(assessment.due_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {assessment.days_until_due} days left
                    </p>
                  </div>
                </div>
              ))}

              {upcoming.length > 5 && (
                <div className="text-center pt-4">
                  <p className="text-sm text-gray-500">
                    And {upcoming.length - 5} more upcoming assessments
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No upcoming assessments scheduled</p>
            </div>
          )}
        </MaterialCard>

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-4">
          <MaterialButton
            onClick={() => window.location.href = '/my-actions'}
            variant="outlined"
          >
            <Users className="w-4 h-4 mr-2" />
            View Inbox
          </MaterialButton>

          <MaterialButton
            onClick={() => window.location.href = '/assessments'}
            variant="outlined"
          >
            <FileText className="w-4 h-4 mr-2" />
            Manage Assessments
          </MaterialButton>

          <MaterialButton
            onClick={handleRefresh}
            disabled={analyticsLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
            Refresh Dashboard
          </MaterialButton>
        </div>
      </div>
    </Layout>
  )
}
