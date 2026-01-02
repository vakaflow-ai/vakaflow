import React from 'react'

// Action item type icons
export const getActionIcon = (type: string) => {
  switch (type) {
    case 'approval':
      return '🛡️'
    case 'assessment':
      return '📋'
    case 'onboarding_review':
      return '👤'
    case 'review':
      return '🔍'
    case 'ticket':
      return '🎫'
    case 'message':
    case 'comment':
    case 'question':
      return '💬'
    default:
      return '📌'
  }
}

// Priority info
export const getPriorityInfo = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return { color: 'error' as const, label: 'Urgent' }
    case 'high':
      return { color: 'error' as const, label: 'High' }
    case 'medium':
      return { color: 'warning' as const, label: 'Medium' }
    case 'low':
      return { color: 'info' as const, label: 'Low' }
    default:
      return { color: 'default' as const, label: priority }
  }
}

// Status info
export const getStatusInfo = (status: string) => {
  switch (status) {
    case 'completed':
      return { color: 'success' as const, label: 'Completed' }
    case 'in_progress':
      return { color: 'info' as const, label: 'In Progress' }
    case 'pending':
      return { color: 'warning' as const, label: 'Pending' }
    case 'overdue':
      return { color: 'error' as const, label: 'Overdue' }
    default:
      return { color: 'default' as const, label: status }
  }
}
