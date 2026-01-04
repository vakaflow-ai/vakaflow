import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { actionsApi } from '../lib/actions'
import Layout from '../components/Layout'

export default function ReviewInterface() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  // Redirect to generic approver route for consistency
  // GenericApprover handles all review types using DynamicForm and form layouts
  // This eliminates duplicate code and ensures consistent UI/UX
  useEffect(() => {
    if (id) {
      // Try to find action item for this agent to get the correct source_type
      // For agent reviews, source_type is typically 'onboarding_request' or 'approval_step'
      Promise.all([
        actionsApi.getBySource('onboarding_request', id).catch(() => null),
        actionsApi.getBySource('approval_step', id).catch(() => null)
      ]).then(([onboardingItem, approvalStepItem]) => {
        const actionItem = onboardingItem || approvalStepItem
        const sourceType = actionItem?.source_type || 'onboarding_request'
        navigate(`/approver/${sourceType}/${id}`, { replace: true })
      }).catch(() => {
        // Fallback: try to find any action item with this agent ID
        actionsApi.getPending().then(items => {
          const item = items.find(i => i.source_id === id)
          if (item) {
            navigate(`/approver/${item.source_type}/${id}`, { replace: true })
          } else {
            // Last fallback: use onboarding_request
            navigate(`/approver/onboarding_request/${id}`, { replace: true })
          }
        }).catch(() => {
          navigate(`/approver/onboarding_request/${id}`, { replace: true })
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
