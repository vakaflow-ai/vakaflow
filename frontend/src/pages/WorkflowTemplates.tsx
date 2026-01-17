import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { workflowTemplatesApi, WorkflowTemplate } from '../lib/workflowTemplates'
import Layout from '../components/Layout'
import { MaterialButton, MaterialCard } from '../components/material'
import { PlusIcon, CheckCircleIcon } from '../components/Icons'
import toast from 'react-hot-toast'

export default function WorkflowTemplates() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: templates, isLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => workflowTemplatesApi.list(),
    enabled: !!user
  })

  const createMutation = useMutation({
    mutationFn: (templateName: string) => workflowTemplatesApi.create({ template_name: templateName }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] })
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
      toast.success(data.message || 'Workflow created successfully')
      navigate(`/workflow-configs/${data.id}`)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to create workflow from template')
    }
  })

  if (!user) {
    return <div>Loading...</div>
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">Loading templates...</div>
      </Layout>
    )
  }

  const templateCategories = {
    compliance: templates?.filter(t => t.category === 'compliance') || [],
    onboarding: templates?.filter(t => t.category === 'onboarding') || [],
    risk: templates?.filter(t => t.category === 'risk') || []
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Workflow Templates</h1>
            <p className="text-sm text-gray-500 mt-1">One-click workflow templates for common use cases</p>
          </div>
        </div>

        {/* Compliance Templates */}
        {templateCategories.compliance.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {templateCategories.compliance.map((template) => (
                <MaterialCard key={template.id} className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Entity Types:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.entity_types.map((type) => (
                        <span key={type} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                  <MaterialButton
                    onClick={() => createMutation.mutate(template.id)}
                    disabled={createMutation.isPending}
                    className="w-full"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
                  </MaterialButton>
                </MaterialCard>
              ))}
            </div>
          </div>
        )}

        {/* Onboarding Templates */}
        {templateCategories.onboarding.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Onboarding Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {templateCategories.onboarding.map((template) => (
                <MaterialCard key={template.id} className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Entity Types:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.entity_types.map((type) => (
                        <span key={type} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                  <MaterialButton
                    onClick={() => createMutation.mutate(template.id)}
                    disabled={createMutation.isPending}
                    className="w-full"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
                  </MaterialButton>
                </MaterialCard>
              ))}
            </div>
          </div>
        )}

        {/* Risk Templates */}
        {templateCategories.risk.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Risk Assessment Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {templateCategories.risk.map((template) => (
                <MaterialCard key={template.id} className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Entity Types:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.entity_types.map((type) => (
                        <span key={type} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                  <MaterialButton
                    onClick={() => createMutation.mutate(template.id)}
                    disabled={createMutation.isPending}
                    className="w-full"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
                  </MaterialButton>
                </MaterialCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
