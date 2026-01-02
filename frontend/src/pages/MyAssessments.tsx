import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { assessmentsApi } from '../lib/assessments'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialButton, MaterialChip } from '../components/material'
import { FileText, Clock, CheckCircle, AlertTriangle, Play, Save, ArrowRight, Calendar, BarChart3 } from 'lucide-react'

interface MyAssessment {
  id: string
  assessment_id: string
  assessment_name: string
  assessment_type: string
  status: string
  assigned_at: string
  started_at?: string
  completed_at?: string
  due_date?: string
  vendor_name?: string
  agent_name?: string
  progress: {
    answered: number
    total: number
    percentage: number
  }
  is_overdue: boolean
  assignment_type: string
}

export default function MyAssessmentsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => navigate('/login'))
  }, [navigate])

  // Fetch user's assignments
  const { data: assignments = [], isLoading } = useQuery<MyAssessment[]>({
    queryKey: ['my-assessments', statusFilter],
    queryFn: () => {
      // Map frontend filter values to backend status values
      const statusParam = statusFilter === 'all' ? undefined :
                         statusFilter === 'drafts' ? 'in_progress' :
                         statusFilter
      return assessmentsApi.getMyAssignments(statusParam)
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  if (!user) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Loading...</div>
        </div>
      </Layout>
    )
  }

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'error'
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'warning'
      case 'approved': return 'success'
      case 'denied': return 'error'
      case 'needs_revision': return 'warning'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string, isOverdue: boolean) => {
    if (isOverdue) return <AlertTriangle className="w-4 h-4" />
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'in_progress': return <Save className="w-4 h-4" />
      case 'approved': return <CheckCircle className="w-4 h-4" />
      case 'denied': return <AlertTriangle className="w-4 h-4" />
      case 'needs_revision': return <Clock className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const formatStatus = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'Overdue'
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return 'text-green-600'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-gray-600'
  }

  const draftAssignments = assignments.filter(a => a.status === 'in_progress')
  const completedAssignments = assignments.filter(a => a.status === 'completed')
  const pendingAssignments = assignments.filter(a => a.status === 'pending')
  const overdueAssignments = assignments.filter(a => a.is_overdue)

  const filteredAssignments = assignments.filter(assignment => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'drafts') return assignment.status === 'in_progress'
    if (statusFilter === 'completed') return assignment.status === 'completed'
    if (statusFilter === 'overdue') return assignment.is_overdue
    return assignment.status === statusFilter
  })

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Assessments</h1>
          <p className="text-gray-600">Manage your assessment submissions and track progress</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Draft Assessments</p>
                <p className="text-3xl font-bold text-blue-600">{draftAssignments.length}</p>
              </div>
              <Save className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{completedAssignments.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">{pendingAssignments.length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{overdueAssignments.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'All Assessments', count: assignments.length },
                { value: 'drafts', label: 'Drafts', count: draftAssignments.length },
                { value: 'in_progress', label: 'In Progress', count: assignments.filter(a => a.status === 'in_progress').length },
                { value: 'completed', label: 'Completed', count: completedAssignments.length },
                { value: 'overdue', label: 'Overdue', count: overdueAssignments.length },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === filter.value
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                  } border`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Assessments List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">Loading assessments...</div>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assessments found</h3>
            <p className="text-gray-600">
              {statusFilter === 'all'
                ? "You don't have any assessments assigned yet."
                : `No assessments found for the selected filter.`
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${
                  assignment.is_overdue ? 'border-red-300' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate mb-1">
                        {assignment.assessment_name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {assignment.assessment_type.replace('_', ' ').toUpperCase()}
                      </p>
                      <div className="flex items-center gap-2">
                        <MaterialChip
                          label={formatStatus(assignment.status, assignment.is_overdue)}
                          color={getStatusColor(assignment.status, assignment.is_overdue)}
                          size="small"
                          variant="filled"
                        >
                          {getStatusIcon(assignment.status, assignment.is_overdue)}
                          <span className="ml-1">{formatStatus(assignment.status, assignment.is_overdue)}</span>
                        </MaterialChip>
                        {assignment.is_overdue && (
                          <MaterialChip
                            label="OVERDUE"
                            color="error"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium text-gray-700">Progress</span>
                      <span className={`font-semibold ${getProgressColor(assignment.progress.percentage)}`}>
                        {assignment.progress.answered}/{assignment.progress.total} ({assignment.progress.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          assignment.progress.percentage === 100 ? 'bg-green-600' :
                          assignment.progress.percentage >= 50 ? 'bg-yellow-600' : 'bg-gray-400'
                        }`}
                        style={{ width: `${assignment.progress.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}</span>
                    </div>
                    {assignment.due_date && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span className={assignment.is_overdue ? 'text-red-600 font-medium' : ''}>
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {assignment.started_at && (
                      <div className="flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        <span>Started: {new Date(assignment.started_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Vendor/Agent Info */}
                  {(assignment.vendor_name || assignment.agent_name) && (
                    <div className="text-sm text-gray-600 mb-4">
                      {assignment.vendor_name && (
                        <div>Vendor: <span className="font-medium">{assignment.vendor_name}</span></div>
                      )}
                      {assignment.agent_name && (
                        <div>Agent: <span className="font-medium">{assignment.agent_name}</span></div>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="flex justify-end">
                    <MaterialButton
                      onClick={() => navigate(`/assessments/assignments/${assignment.id}`)}
                      variant={assignment.status === 'in_progress' ? 'contained' : 'outlined'}
                      color={assignment.status === 'in_progress' ? 'primary' : 'gray'}
                      size="small"
                      endIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      {assignment.status === 'in_progress' ? 'Continue Draft' :
                       assignment.status === 'completed' ? 'View Submission' :
                       'Start Assessment'}
                    </MaterialButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
