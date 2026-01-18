import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workflowConfigApi, WorkflowConfig } from '../lib/workflowConfig'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { 
  StandardPageContainer,
  StandardPageHeader,
  StandardActionButton,
  StandardCard,
  StandardSearchFilter
} from '../components/StandardizedLayout'
import UnifiedWorkflowDesigner from '../components/workflow/UnifiedWorkflowDesigner'
import { Plus, Edit, Eye, Settings } from 'lucide-react'
import { showToast } from '../utils/toast'

export default function StandardizedWorkflows() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [showDesigner, setShowDesigner] = useState(false)
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Load user
  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

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
    return matchesSearch && matchesStatus
  }) || []

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'active': return 'unified-badge-success'
      case 'draft': return 'unified-badge-warning'
      case 'inactive': return 'unified-badge-neutral'
      default: return 'unified-badge-neutral'
    }
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
      <UnifiedWorkflowDesigner
        workflowId={editingWorkflowId || undefined}
        onClose={handleDesignerClose}
        onSave={handleDesignerSave}
      />
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
            <StandardSearchFilter
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search workflows by name or description..."
              filters={
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="unified-select w-48"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                </select>
              }
            />
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
                {searchTerm || filterStatus !== 'all' 
                  ? 'Try adjusting your search or filter criteria' 
                  : 'Get started by creating your first workflow'}
              </p>
              {!searchTerm && filterStatus === 'all' && (
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
          <div className="unified-responsive-grid">
            {filteredWorkflows.map((workflow) => (
              <StandardCard key={workflow.id} className="unified-hover-card">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="unified-card-title mb-2">{workflow.name}</h3>
                      {workflow.description && (
                        <p className="unified-body-secondary line-clamp-2">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                    <span className={getStatusColorClass(workflow.status)}>
                      {workflow.status}
                    </span>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between unified-body">
                      <span>Steps</span>
                      <span className="font-medium">{workflow.workflow_steps?.length || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between unified-body">
                      <span>Engine</span>
                      <span className="font-medium capitalize">{workflow.workflow_engine}</span>
                    </div>

                    <div className="flex items-center justify-between unified-body">
                      <span>Created</span>
                      <span className="font-medium">
                        {new Date(workflow.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <StandardActionButton
                      variant="outline"
                      size="sm"
                      icon={<Edit className="w-4 h-4" />}
                      onClick={() => handleEditWorkflow(workflow.id)}
                      className="flex-1"
                    >
                      Edit
                    </StandardActionButton>
                    <StandardActionButton
                      variant="outline"
                      size="sm"
                      icon={<Eye className="w-4 h-4" />}
                      onClick={() => {
                        showToast.info('Preview functionality coming soon')
                      }}
                    >
                      Preview
                    </StandardActionButton>
                  </div>
                </div>
              </StandardCard>
            ))}
          </div>
        )}
      </StandardPageContainer>
    </Layout>
  )
}