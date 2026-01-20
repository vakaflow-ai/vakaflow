import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workflowConfigApi, WorkflowConfig } from '../lib/workflowConfig'
import { authApi } from '../lib/auth'
import { useDialogContext } from '../contexts/DialogContext'
import Layout from '../components/Layout'
import { 
  StandardPageContainer,
  StandardPageHeader,
  StandardActionButton,
  StandardCard,
  StandardSearchFilter
} from '../components/StandardizedLayout'
import UnifiedWorkflowDesigner from '../components/workflow/UnifiedWorkflowDesigner'
import { Plus, Edit, Eye, Settings, Trash2, EyeIcon, EyeOffIcon, CogIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { showToast } from '../utils/toast'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import { cn } from '@/lib/utils'

export default function StandardizedWorkflows() {
  const navigate = useNavigate()
  const dialog = useDialogContext()
  const [user, setUser] = useState<any>(null)
  const [showDesigner, setShowDesigner] = useState(false)
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterEngine, setFilterEngine] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Load user
  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Column visibility configuration - memoized to prevent infinite loops
  const COLUMN_DEFINITIONS = useMemo(() => ({
    name: { label: 'Workflow Name', visible: true },
    description: { label: 'Description', visible: true },
    status: { label: 'Status', visible: true },
    engine: { label: 'Engine', visible: true },
    steps: { label: 'Steps', visible: true },
    created: { label: 'Created', visible: true },
    modified: { label: 'Modified', visible: true },
    actions: { label: 'Actions', visible: true }
  }), [])

  const defaultColumnVisibility = useMemo(() => 
    Object.fromEntries(Object.entries(COLUMN_DEFINITIONS).map(([key, def]) => [key, (def as {visible: boolean}).visible])),
    [COLUMN_DEFINITIONS]
  )

  const { columnVisibility, toggleColumn, resetColumns } = useColumnVisibility(
    'standardized-workflow-columns',
    defaultColumnVisibility
  )

  // Get visible columns in desired order
  const visibleColumns = Object.entries(columnVisibility)
    .filter(([_, visible]) => visible)
    .map(([key]) => key)
    .sort((a, b) => {
      const order = ['name', 'description', 'status', 'engine', 'steps', 'created', 'modified', 'actions']
      return order.indexOf(a) - order.indexOf(b)
    })

  // Load workflows
  const { data: workflows, isLoading, refetch } = useQuery({
    queryKey: ['workflow-configs'],
    queryFn: () => workflowConfigApi.list(),
    enabled: !!user && (user.role === 'tenant_admin' || user.role === 'platform_admin'),
    refetchInterval: 30000
  })

  const filteredWorkflows = workflows?.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || workflow.status === filterStatus
    const matchesEngine = filterEngine === 'all' || workflow.workflow_engine === filterEngine
    return matchesSearch && matchesStatus && matchesEngine
  }).sort((a, b) => {
    let aValue, bValue
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case 'status':
        aValue = a.status
        bValue = b.status
        break
      case 'engine':
        aValue = a.workflow_engine
        bValue = b.workflow_engine
        break
      case 'steps':
        aValue = a.workflow_steps?.length || 0
        bValue = b.workflow_steps?.length || 0
        break
      case 'created':
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
        break
      case 'modified':
        aValue = new Date(a.updated_at || a.created_at).getTime()
        bValue = new Date(b.updated_at || b.created_at).getTime()
        break
      default:
        return 0
    }
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  }) || []

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'active': return 'unified-badge-success'
      case 'draft': return 'unified-badge-warning'
      case 'inactive': return 'unified-badge-neutral'
      default: return 'unified-badge-neutral'
    }
  }

  // Row selection handlers
  const handleSelectRow = (workflowId: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(workflowId)) {
      newSelected.delete(workflowId)
    } else {
      newSelected.add(workflowId)
    }
    setSelectedRows(newSelected)
    setSelectAll(newSelected.size === filteredWorkflows.length && filteredWorkflows.length > 0)
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredWorkflows.map(w => w.id)))
    }
    setSelectAll(!selectAll)
  }

  const handleCreateWorkflow = () => {
    setEditingWorkflowId(null)
    setShowDesigner(true)
  }

  const handleEditWorkflow = (workflowId: string) => {
    setEditingWorkflowId(workflowId)
    setShowDesigner(true)
  }

  const handleDesignerClose = () => {
    setShowDesigner(false)
    setEditingWorkflowId(null)
    refetch()
  }

  const handleDesignerSave = (workflow: any) => {
    setShowDesigner(false)
    setEditingWorkflowId(null)
    refetch()
    showToast.success(`Workflow ${editingWorkflowId ? 'updated' : 'created'} successfully`)
  }

  const handleDeleteWorkflow = async (workflowId: string, workflowName: string) => {
    const confirmed = await dialog.confirm({
      title: 'Delete Workflow',
      message: `Are you sure you want to delete the workflow "${workflowName}"? This action cannot be undone.`,
      variant: 'destructive'
    })
    
    if (confirmed) {
      try {
        await workflowConfigApi.delete(workflowId)
        refetch()
        showToast.success('Workflow deleted successfully')
      } catch (error: any) {
        showToast.error(error?.response?.data?.detail || 'Failed to delete workflow')
      }
    }
  }

  if (!user) {
    return (
      <Layout user={user}>
        <StandardPageContainer>
          <div className="unified-flex-center h-64">
            <div className="text-center">
              <div className="unified-loading w-8 h-8 mx-auto mb-4"></div>
              <p className="unified-body">Loading...</p>
            </div>
          </div>
        </StandardPageContainer>
      </Layout>
    )
  }

  if (showDesigner) {
    return (
      <Layout user={user}>
        <div className="w-full max-w-[98%] mx-auto p-6">
          <UnifiedWorkflowDesigner
            workflowId={editingWorkflowId || undefined}
            onClose={handleDesignerClose}
            onSave={handleDesignerSave}
          />
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <StandardPageContainer>
        <StandardPageHeader
          title="Workflow Management"
          subtitle="Design, configure, and manage workflow processes across the platform"
          actions={
            <StandardActionButton
              icon={<Plus className="w-4 h-4" />}
              onClick={handleCreateWorkflow}
            >
              Create Workflow
            </StandardActionButton>
          }
        />

        <StandardCard>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search workflows by name or description..."
                    className="unified-input w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="unified-select w-32"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    value={filterEngine}
                    onChange={(e) => setFilterEngine(e.target.value)}
                    className="unified-select w-32"
                  >
                    <option value="all">All Engines</option>
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                  </select>
                </div>
              </div>
              
              {/* Controls Row */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* Sort Controls */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="unified-select w-32 text-sm"
                  >
                    <option value="name">Name</option>
                    <option value="status">Status</option>
                    <option value="engine">Engine</option>
                    <option value="steps">Steps</option>
                    <option value="created">Created</option>
                    <option value="modified">Modified</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="unified-button-secondary text-sm px-2 py-1"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
                
                {/* Column Visibility Controls */}
                <div className="relative">
                  <StandardActionButton
                    variant="outline"
                    size="sm"
                    icon={<CogIcon className="w-4 h-4" />}
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                  >
                    Columns
                    {showColumnMenu ? (
                      <ChevronUpIcon className="w-4 h-4 ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 ml-1" />
                    )}
                  </StandardActionButton>
                  
                  {showColumnMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-50 unified-card">
                      <div className="p-2">
                        <div className="px-2 py-1.5 text-sm font-semibold border-b border-gray-200 mb-1">Show/Hide Columns</div>
                        <div className="max-h-96 overflow-y-auto">
                          {Object.entries(COLUMN_DEFINITIONS).map(([key, def]) => {
                            const isVisible = columnVisibility[key]
                            const isActions = key === 'actions'
                            
                            return (
                              <button
                                key={key}
                                onClick={() => !isActions && toggleColumn(key)}
                                disabled={isActions}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors text-left",
                                  isActions && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                {isVisible ? (
                                  <EyeIcon className="w-4 h-4" />
                                ) : (
                                  <EyeOffIcon className="w-4 h-4 opacity-50" />
                                )}
                                <span className={cn("flex-1", !isVisible && 'opacity-50')}>{def.label}</span>
                                {isActions && <span className="text-xs text-gray-500">Always visible</span>}
                              </button>
                            )
                          })}
                        </div>
                        <div className="border-t border-gray-200 mt-1 pt-1">
                          <button
                            onClick={resetColumns}
                            className="w-full px-2 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors text-left"
                          >
                            Reset to Default
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </StandardCard>

        {isLoading ? (
          <StandardCard>
            <div className="unified-flex-center h-64">
              <div className="text-center">
                <div className="unified-loading w-8 h-8 mx-auto mb-4"></div>
                <p className="unified-body">Loading workflows...</p>
              </div>
            </div>
          </StandardCard>
        ) : filteredWorkflows.length === 0 ? (
          <StandardCard>
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Settings className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="unified-card-title mb-2">No workflows found</h3>
              <p className="unified-body-secondary mb-6">
                {searchTerm || filterStatus !== 'all' || filterEngine !== 'all'
                  ? 'Try adjusting your search or filter criteria' 
                  : 'Get started by creating your first workflow'}
              </p>
              {!searchTerm && filterStatus === 'all' && filterEngine === 'all' && (
                <StandardActionButton
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleCreateWorkflow}
                >
                  Create Your First Workflow
                </StandardActionButton>
              )}
            </div>
          </StandardCard>
        ) : (
          <StandardCard>
            <div className="overflow-x-hidden">
              <table className="w-full table-fixed">
                <colgroup>
                  {visibleColumns.includes('name') && <col style={{ width: '15%' }} />}
                  {visibleColumns.includes('description') && <col style={{ width: '20%' }} />}
                  {visibleColumns.includes('status') && <col style={{ width: '10%' }} />}
                  {visibleColumns.includes('engine') && <col style={{ width: '10%' }} />}
                  {visibleColumns.includes('steps') && <col style={{ width: '8%' }} />}
                  {visibleColumns.includes('created') && <col style={{ width: '12%' }} />}
                  {visibleColumns.includes('modified') && <col style={{ width: '12%' }} />}
                  {visibleColumns.includes('actions') && <col style={{ width: '13%' }} />}
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {/* Checkbox column */}
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    {visibleColumns.map((columnKey) => {
                      const def = COLUMN_DEFINITIONS[columnKey as keyof typeof COLUMN_DEFINITIONS]
                      return (
                        <th 
                          key={columnKey}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider truncate"
                          title={def?.label}
                        >
                          {def?.label || columnKey}
                        </th>
                      )
                    })}
                    {/* Column visibility control column */}
                    <th className="px-4 py-3 w-32 text-right">
                      <div className="relative inline-block">
                        <StandardActionButton
                          variant="outline"
                          size="sm"
                          icon={<CogIcon className="w-4 h-4" />}
                          onClick={() => setShowColumnMenu(!showColumnMenu)}
                          className="h-8 px-2 gap-1"
                        >
                          <span className="text-xs">Columns</span>
                          {showColumnMenu ? (
                            <ChevronUpIcon className="w-3 h-3" />
                          ) : (
                            <ChevronDownIcon className="w-3 h-3" />
                          )}
                        </StandardActionButton>
                                          
                        {showColumnMenu && (
                          <div className="absolute right-0 top-full mt-1 w-56 bg-white border rounded-lg shadow-lg z-50 unified-card">
                            <div className="p-2">
                              <div className="px-2 py-1.5 text-sm font-semibold border-b border-gray-200 mb-1">Show/Hide Columns</div>
                              <div className="max-h-96 overflow-y-auto">
                                {Object.entries(COLUMN_DEFINITIONS).map(([key, def]) => {
                                  const isVisible = columnVisibility[key]
                                  const isActions = key === 'actions'
                                                    
                                  return (
                                    <button
                                      key={key}
                                      onClick={() => !isActions && toggleColumn(key)}
                                      disabled={isActions}
                                      className={cn(
                                        "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors text-left",
                                        isActions && "opacity-50 cursor-not-allowed"
                                      )}
                                    >
                                      {isVisible ? (
                                        <EyeIcon className="w-4 h-4" />
                                      ) : (
                                        <EyeOffIcon className="w-4 h-4 opacity-50" />
                                      )}
                                      <span className={cn("flex-1", !isVisible && 'opacity-50')}>{def.label}</span>
                                      {isActions && <span className="text-xs text-gray-500">Always visible</span>}
                                    </button>
                                  )
                                })}
                              </div>
                              <div className="border-t border-gray-200 mt-1 pt-1">
                                <button
                                  onClick={resetColumns}
                                  className="w-full px-2 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors text-left"
                                >
                                  Reset to Default
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredWorkflows.map((workflow) => (
                    <tr key={workflow.id} className={`hover:bg-gray-50 ${selectedRows.has(workflow.id) ? 'bg-blue-50' : ''}`}>
                      {/* Checkbox cell */}
                      <td className="px-4 py-3 w-12">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(workflow.id)}
                          onChange={() => handleSelectRow(workflow.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      {visibleColumns.includes('name') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 truncate" title={workflow.name}>
                            {workflow.name}
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('description') && (
                        <td className="px-4 py-3 max-w-xs">
                          <div className="text-gray-600 text-sm line-clamp-2" title={workflow.description || 'No description'}>
                            {workflow.description || 'No description'}
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('status') && (
                        <td className="px-4 py-3">
                          <span className={getStatusColorClass(workflow.status)}>
                            {workflow.status}
                          </span>
                        </td>
                      )}
                      {visibleColumns.includes('engine') && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {workflow.workflow_engine}
                          </span>
                        </td>
                      )}
                      {visibleColumns.includes('steps') && (
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {workflow.workflow_steps?.length || 0}
                        </td>
                      )}
                      {visibleColumns.includes('created') && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(workflow.created_at).toLocaleDateString()}
                        </td>
                      )}
                      {visibleColumns.includes('modified') && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(workflow.updated_at || workflow.created_at).toLocaleDateString()}
                        </td>
                      )}
                      {visibleColumns.includes('actions') && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <StandardActionButton
                              variant="outline"
                              size="sm"
                              icon={<Edit className="w-3 h-3" />}
                              onClick={() => handleEditWorkflow(workflow.id)}
                            >
                              Edit
                            </StandardActionButton>
                            <StandardActionButton
                              variant="outline"
                              size="sm"
                              icon={<Eye className="w-3 h-3" />}
                              onClick={() => {
                                showToast.info('Preview functionality coming soon')
                              }}
                            >
                              View
                            </StandardActionButton>
                            <StandardActionButton
                              variant="danger"
                              size="sm"
                              icon={<Trash2 className="w-3 h-3" />}
                              onClick={() => handleDeleteWorkflow(workflow.id, workflow.name)}
                            >
                              Del
                            </StandardActionButton>
                          </div>
                        </td>
                      )}
                      {/* Empty cell for column controls */}
                      <td className="px-4 py-3 w-32"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StandardCard>
        )}
      </StandardPageContainer>
    </Layout>
  )
}