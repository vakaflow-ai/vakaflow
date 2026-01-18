import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workflowConfigApi, WorkflowConfig } from '../lib/workflowConfig'
import { authApi } from '../lib/auth'
import { useDialogContext } from '../contexts/DialogContext'
import Layout from '../components/Layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import UnifiedWorkflowDesigner from '../components/workflow/UnifiedWorkflowDesigner'
import { Plus, Edit, Trash2, Play, Eye, Settings } from 'lucide-react'
import { showToast } from '../utils/toast'

export default function UnifiedWorkflowManagement() {
  const navigate = useNavigate()
  const dialog = useDialogContext()
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
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
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Workflow Management</h1>
            <p className="text-gray-600 mt-1">
              Design, configure, and manage workflow processes across the platform
            </p>
          </div>
          <Button onClick={handleCreateWorkflow}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  label="Search workflows"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or description..."
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workflows Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading workflows...</p>
            </div>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Settings className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows found</h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || filterStatus !== 'all' 
                  ? 'Try adjusting your search or filter criteria' 
                  : 'Get started by creating your first workflow'}
              </p>
              {!searchTerm && filterStatus === 'all' && (
                <Button onClick={handleCreateWorkflow}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Workflow
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkflows.map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{workflow.name}</CardTitle>
                      {workflow.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(workflow.status)}`}>
                      {workflow.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Steps</span>
                      <span className="font-medium">{workflow.workflow_steps?.length || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Engine</span>
                      <span className="font-medium capitalize">{workflow.workflow_engine}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Created</span>
                      <span className="font-medium">
                        {new Date(workflow.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleEditWorkflow(workflow.id)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // Preview functionality would go here
                          showToast.info('Preview functionality coming soon')
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                        onClick={() => handleDeleteWorkflow(workflow.id, workflow.name)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}