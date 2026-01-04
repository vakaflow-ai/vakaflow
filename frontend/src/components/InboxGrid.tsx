import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionItem } from '../lib/actions'
import { useInboxColumnVisibility, InboxColumnVisibilityConfig } from '../hooks/useInboxColumnVisibility'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { 
  CogIcon, 
  EyeIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from './Icons'
import { cn } from '@/lib/utils'

interface InboxGridProps {
  items: ActionItem[]
  isLoading?: boolean
  onItemClick?: (item: ActionItem) => void
}

// Helper function to get POC name from metadata or assigned_to
// For approvers: shows who submitted the assessment
// For vendors: shows who assigned it (POC)
function getPOCName(item: ActionItem): string {
  // For approval items, show who submitted it
  if (item.type === 'approval' || item.source_type === 'assessment_approval') {
    if (item.metadata?.submitted_by) return item.metadata.submitted_by
  }
  // For assessment items, show POC/assigner
  if (item.metadata?.poc_name) return item.metadata.poc_name
  if (item.metadata?.assigned_to_name) return item.metadata.assigned_to_name
  if (item.metadata?.reviewer_name) return item.metadata.reviewer_name
  if (item.metadata?.assigned_by_name) return item.metadata.assigned_by_name
  return 'N/A'
}

// Helper function to get customer name from metadata
function getCustomerName(item: ActionItem): string {
  if (item.metadata?.customer_name) return item.metadata.customer_name
  if (item.metadata?.tenant_name) return item.metadata.tenant_name
  if (item.metadata?.organization) return item.metadata.organization
  return 'N/A'
}

// Helper function to get vendor name from metadata
function getVendorName(item: ActionItem): string {
  if (item.metadata?.vendor_name) return item.metadata.vendor_name
  return 'N/A'
}

// Helper function to get agent name from metadata
function getAgentName(item: ActionItem): string {
  if (item.metadata?.agent_name) return item.metadata.agent_name
  return 'N/A'
}

// Helper function to format date with proper timezone handling
function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A'
  try {
    // Parse the date string - handles ISO format from backend (UTC)
    const date = new Date(dateString)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'N/A'
    }
    
    // Use toLocaleString to convert UTC to user's local timezone
    // This ensures dates from backend (stored in UTC) are displayed in user's timezone
    // Omitting timeZone uses the browser's local timezone automatically
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return 'N/A'
  }
}

// Helper function to get priority badge color
function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'low':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Helper function to get status badge color
function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'in_progress':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'overdue':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Column definitions - Ticket ID is first as requested
const COLUMN_DEFINITIONS: Record<keyof InboxColumnVisibilityConfig, { label: string; width?: string }> = {
  workflowTicketId: { label: 'Ticket ID', width: 'w-32' },
  title: { label: 'Title', width: 'w-64' },
  type: { label: 'Type', width: 'w-32' },
  status: { label: 'Status', width: 'w-28' },
  priority: { label: 'Priority', width: 'w-24' },
  workflowStage: { label: 'Workflow Stage', width: 'w-36' },
  generatedDate: { label: 'Generated', width: 'w-40' },
  dueDate: { label: 'Due Date', width: 'w-40' },
  poc: { label: 'POC', width: 'w-40' },
  customer: { label: 'Customer', width: 'w-40' },
  vendor: { label: 'Vendor', width: 'w-40' },
  agent: { label: 'Agent', width: 'w-40' },
  description: { label: 'Description', width: 'w-64' },
  actions: { label: 'Actions', width: 'w-24' }
}

// EyeOff icon component
const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
)

export default function InboxGrid({ items, isLoading, onItemClick }: InboxGridProps) {
  const navigate = useNavigate()
  const { columnVisibility, toggleColumn, resetColumns } = useInboxColumnVisibility()
  const [showColumnMenu, setShowColumnMenu] = useState(false)

  // Get visible columns, ensuring workflowTicketId is first
  const visibleColumns = Object.entries(columnVisibility)
    .filter(([_, visible]) => visible)
    .map(([key]) => key as keyof InboxColumnVisibilityConfig)
    .sort((a, b) => {
      // Always put workflowTicketId first
      if (a === 'workflowTicketId') return -1
      if (b === 'workflowTicketId') return 1
      // Keep other columns in their original order
      const order = ['workflowTicketId', 'title', 'type', 'status', 'priority', 'workflowStage', 'generatedDate', 'dueDate', 'poc', 'customer', 'vendor', 'agent', 'description', 'actions']
      const indexA = order.indexOf(a)
      const indexB = order.indexOf(b)
      if (indexA === -1 && indexB === -1) return 0
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })

  const handleItemClick = (item: ActionItem) => {
    if (onItemClick) {
      onItemClick(item)
    } else {
      // Use generic approver route with source_type and source_id from business process
      // This allows the approver view to load entity details dynamically
      if (item.type === 'approval' || item.source_type === 'assessment_approval' || item.source_type === 'assessment_review') {
        // For approvers: navigate to generic approver page
        if (item.source_type && item.source_id) {
          navigate(`/approver/${item.source_type}/${item.source_id}`)
        } else if (item.action_url) {
          navigate(item.action_url)
        }
      } else if (item.source_type === 'assessment_assignment' && item.source_id) {
        // For vendors: navigate to assessment completion page
        navigate(`/assessments/${item.source_id}`)
      } else if (item.action_url) {
        navigate(item.action_url)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-muted-foreground">Loading actions...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No actions found</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Column Visibility Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {items.length} item{items.length !== 1 ? 's' : ''}
        </div>
        <div className="relative">
            <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setShowColumnMenu(!showColumnMenu)}
          >
            <CogIcon className="w-4 h-4" />
            Columns
            {showColumnMenu ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </Button>
          {showColumnMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-background border rounded-lg shadow-lg z-50">
              <div className="p-2">
                <div className="px-2 py-1.5 text-sm font-semibold border-b mb-1">Show/Hide Columns</div>
                <div className="max-h-96 overflow-y-auto">
                  {Object.entries(COLUMN_DEFINITIONS).map(([key, def]) => {
                    const columnKey = key as keyof InboxColumnVisibilityConfig
                    const isVisible = columnVisibility[columnKey]
                    const isActions = columnKey === 'actions'
                    
                    return (
                      <button
                        key={key}
                        onClick={() => !isActions && toggleColumn(columnKey)}
                        disabled={isActions}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors",
                          isActions && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isVisible ? (
                          <EyeIcon className="w-4 h-4" />
                        ) : (
                          <EyeOffIcon className="w-4 h-4 opacity-50" />
                        )}
                        <span className={cn("flex-1 text-left", !isVisible && 'opacity-50')}>{def.label}</span>
                        {isActions && <span className="text-xs text-muted-foreground">Always visible</span>}
                      </button>
                    )
                  })}
                </div>
                <div className="border-t mt-1 pt-1">
                  <button
                    onClick={resetColumns}
                    className="w-full px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-left"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Click outside to close menu */}
      {showColumnMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowColumnMenu(false)}
        />
      )}

      {/* Grid Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                {visibleColumns.map((columnKey) => {
                  const def = COLUMN_DEFINITIONS[columnKey]
                  return (
                    <th
                      key={columnKey}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-b",
                        def.width || 'w-auto'
                      )}
                    >
                      {def.label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleItemClick(item)}
                >
                  {visibleColumns.map((columnKey) => {
                    return (
                      <td
                        key={columnKey}
                        className="px-4 py-3 text-sm border-b"
                      >
                        {renderCell(item, columnKey)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function renderCell(item: ActionItem, columnKey: keyof InboxColumnVisibilityConfig): React.ReactNode {
  switch (columnKey) {
    case 'title':
      // For approval items, show additional context
      const isApprovalItem = item.type === 'approval' || item.source_type === 'assessment_approval'
      return (
        <div>
          <div className="font-medium text-foreground">
            {item.title}
          </div>
          {isApprovalItem && item.metadata?.vendor_name && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Vendor: {item.metadata.vendor_name}
            </div>
          )}
        </div>
      )
    
    case 'type': {
      // Show action type badge with appropriate color
      const actionType = item.type || item.source_type || 'N/A'
      const isApprovalType = item.type === 'approval' || item.source_type === 'assessment_approval'
      const isAssessmentType = item.type === 'assessment' || item.source_type === 'assessment_assignment'
      
      let badgeColor = 'bg-gray-100 text-gray-800 border-gray-200'
      if (isApprovalType) {
        badgeColor = 'bg-purple-100 text-purple-800 border-purple-200'
      } else if (isAssessmentType) {
        badgeColor = 'bg-blue-100 text-blue-800 border-blue-200'
      }
      
      return (
        <Badge variant="outline" className={cn("text-xs", badgeColor)}>
          {isApprovalType ? 'Approval' : isAssessmentType ? 'Assessment' : actionType.replace(/_/g, ' ')}
        </Badge>
      )
    }
    
    case 'status':
      return (
        <Badge className={cn("text-xs border", getStatusColor(item.status))}>
          {item.status.replace(/_/g, ' ')}
        </Badge>
      )
    
    case 'priority':
      return (
        <Badge className={cn("text-xs border", getPriorityColor(item.priority))}>
          {item.priority}
        </Badge>
      )
    
    case 'generatedDate':
      return (
        <div className="text-muted-foreground text-xs">
          {formatDate(item.assigned_at || item.metadata?.created_at)}
        </div>
      )
    
    case 'dueDate':
      return (
        <div className="text-muted-foreground text-xs">
          {item.due_date ? formatDate(item.due_date) : 'N/A'}
        </div>
      )
    
    case 'poc': {
      // For approval items, label as "Submitted By", for assessment items label as "POC"
      const isApprovalPoc = item.type === 'approval' || item.source_type === 'assessment_approval'
      return (
        <div className="text-sm">
          <div className="text-xs text-muted-foreground mb-0.5">
            {isApprovalPoc ? 'Submitted By' : 'POC'}
          </div>
          <div>{getPOCName(item)}</div>
        </div>
      )
    }
    
    case 'customer':
      return (
        <div className="text-sm">
          {getCustomerName(item)}
        </div>
      )
    
    case 'workflowTicketId':
      // Display human-readable workflow ticket ID (e.g., ASMT-2026-017)
      const ticketId = item.metadata?.workflow_ticket_id || 
                       item.metadata?.ticket_number || 
                       item.metadata?.request_ticket_id ||
                       item.metadata?.request_number
      return ticketId ? (
        <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-200">
          {ticketId}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">N/A</span>
      )
    
    case 'workflowStage': {
      // Get workflow stage from metadata (set by backend based on assignment status)
      // Backend maps: pending->new, in_progress->in_progress, completed->pending_approval, approved->approved, rejected->rejected, etc.
      const workflowStage = item.metadata?.workflow_stage || 
                           item.metadata?.assignment_status || // Fallback to assignment_status if workflow_stage not set
                           (item.status === 'pending' ? 'new' :
                            item.status === 'in_progress' ? 'in_progress' :
                            item.status === 'completed' ? 'pending_approval' :
                            item.status === 'approved' ? 'approved' :
                            item.status === 'rejected' ? 'rejected' : 'new')
      
      // Map workflow stage to display-friendly label
      const stageLabels: Record<string, string> = {
        'new': 'New',
        'in_progress': 'In Progress',
        'pending_approval': 'Pending Approval',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'needs_revision': 'Needs Revision',
        'cancelled': 'Cancelled',
        'closed': 'Closed'
      }
      
      const stageLabel = stageLabels[workflowStage] || workflowStage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      
      // Color coding for workflow stages
      const getStageColor = (stage: string) => {
        switch (stage) {
          case 'new':
            return 'bg-gray-100 text-gray-800 border-gray-200'
          case 'in_progress':
            return 'bg-blue-100 text-blue-800 border-blue-200'
          case 'pending_approval':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200'
          case 'approved':
            return 'bg-green-100 text-green-800 border-green-200'
          case 'rejected':
            return 'bg-red-100 text-red-800 border-red-200'
          case 'needs_revision':
            return 'bg-orange-100 text-orange-800 border-orange-200'
          case 'cancelled':
          case 'closed':
            return 'bg-gray-100 text-gray-800 border-gray-200'
          default:
            return 'bg-gray-100 text-gray-800 border-gray-200'
        }
      }
      
      return (
        <Badge variant="outline" className={cn("text-xs", getStageColor(workflowStage))}>
          {stageLabel}
        </Badge>
      )
    }
    
    case 'vendor':
      return (
        <div className="text-sm">
          {getVendorName(item)}
        </div>
      )
    
    case 'agent':
      return (
        <div className="text-sm">
          {getAgentName(item)}
        </div>
      )
    
    case 'description':
      return (
        <div className="text-sm text-muted-foreground line-clamp-2 max-w-md">
          {item.description || 'N/A'}
        </div>
      )
    
    case 'actions':
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            // Handle action
          }}
        >
          View
        </Button>
      )
    
    default:
      return null
  }
}

