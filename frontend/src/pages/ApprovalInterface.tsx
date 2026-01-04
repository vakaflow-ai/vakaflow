import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { actionsApi } from '../lib/actions'
import Layout from '../components/Layout'

export default function ApprovalInterface() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  // Redirect to generic approver route for consistency
  // GenericApprover handles all approval types (agents, assessments, etc.) using DynamicForm
  // This eliminates duplicate code and ensures consistent UI/UX
  useEffect(() => {
    if (id) {
      // Try to find action item for this agent to get the correct source_type
      // For agent approvals, source_type is typically 'approval_step' or 'onboarding_request'
      Promise.all([
        actionsApi.getBySource('approval_step', id).catch(() => null),
        actionsApi.getBySource('onboarding_request', id).catch(() => null)
      ]).then(([approvalStepItem, onboardingItem]) => {
        const actionItem = approvalStepItem || onboardingItem
        const sourceType = actionItem?.source_type || 'approval_step'
        navigate(`/approver/${sourceType}/${id}`, { replace: true })
      }).catch(() => {
        // Fallback: try to find any action item with this agent ID
        actionsApi.getPending().then(items => {
          const item = items.find(i => i.source_id === id)
          if (item) {
            navigate(`/approver/${item.source_type}/${id}`, { replace: true })
          } else {
            // Last fallback: use approval_step
            navigate(`/approver/approval_step/${id}`, { replace: true })
          }
        }).catch(() => {
          navigate(`/approver/approval_step/${id}`, { replace: true })
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
