import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { actionsApi } from '../lib/actions'
import Layout from '../components/Layout'

interface AssessmentApproverPageProps {}

export default function AssessmentApproverPage({}: AssessmentApproverPageProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  // Redirect to generic approver route for consistency
  // The generic approver uses DynamicForm with form layouts, ensuring consistent views
  useEffect(() => {
    if (id) {
      // Try to find the action item to get source_type
      // Default to assessment_approval if not found
      actionsApi.getBySource('assessment_approval', id)
        .then((actionItem) => {
          const sourceType = actionItem?.source_type || 'assessment_approval'
          navigate(`/approver/${sourceType}/${id}`, { replace: true })
        })
        .catch(() => {
          // If action item not found, try assessment_assignment
          actionsApi.getBySource('assessment_assignment', id)
            .then((actionItem) => {
              const sourceType = actionItem?.source_type || 'assessment_approval'
              navigate(`/approver/${sourceType}/${id}`, { replace: true })
            })
            .catch(() => {
              // Fallback: redirect to assessment_approval
              navigate(`/approver/assessment_approval/${id}`, { replace: true })
            })
        })
    }
  }, [id, navigate])
  
  // Show loading while redirecting
  return (
    <Layout user={null}>
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Redirecting to approver view...</div>
      </div>
    </Layout>
  )
}
