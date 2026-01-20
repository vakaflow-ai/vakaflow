
import { useState } from 'react'
import Layout from '../components/Layout'
import { MaterialButton } from '../components/material'
import UnifiedConfigurationWizard from '../components/UnifiedConfigurationWizard'
import { Workflow, Layers, Settings, Play } from 'lucide-react'

export default function ConfigurationBackbone() {
  const [showWizard, setShowWizard] = useState(false)
  const [savedConfigurations, setSavedConfigurations] = useState<any[]>([])

  const handleSaveConfiguration = (config: any) => {
    setSavedConfigurations(prev => [...prev, config])
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Layers className="w-8 h-8 text-blue-600" />
            Configuration Backbone
          </h1>
          <p className="text-gray-600 mt-2">
            Unified orchestration layer for end-to-end onboarding workflows
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Configure Workflows</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Set up entity-to-workflow mappings and form configurations in one place
            </p>
            <MaterialButton
              variant="contained"
              onClick={() => setShowWizard(true)}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Configuration
            </MaterialButton>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Workflow className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Manage Templates</h3>
            </div>
            <p className="text-gray-600 mb-4">
              View and manage saved configuration templates for reuse
            </p>
            <MaterialButton
              variant="outlined"
              className="w-full"
              disabled={savedConfigurations.length === 0}
            >
              View Templates ({savedConfigurations.length})
            </MaterialButton>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Deployment Status</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Monitor deployed configurations and their performance metrics
            </p>
            <MaterialButton
              variant="outlined"
              className="w-full"
            >
              View Status
            </MaterialButton>
          </div>
        </div>

        {/* Saved Configurations */}
        {savedConfigurations.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recently Saved Configurations</h3>
            <div className="space-y-3">
              {savedConfigurations.map((config, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{config.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{config.entityMappings.filter((em: any) => em.requestTypeId).length} entities</span>
                        <span>{config.workflowMappings.filter((wm: any) => wm.workflowId).length} workflows</span>
                        <span>{config.workflowMappings.reduce((acc: number, wm: any) => acc + wm.formMappings.length, 0)} forms</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {new Date(config.createdAt).toLocaleDateString()}
                      </div>
                      <MaterialButton variant="outlined" size="small" className="mt-2">
                        Deploy
                      </MaterialButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Architecture Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900">Onboarding Hub</h4>
              <p className="text-sm text-blue-700 mt-1">Customer-facing launchpad</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900">Request Types</h4>
              <p className="text-sm text-green-700 mt-1">Entity-to-workflow mapping</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-900">Workflows</h4>
              <p className="text-sm text-purple-700 mt-1">Process automation</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <h4 className="font-medium text-orange-900">Form Library</h4>
              <p className="text-sm text-orange-700 mt-1">Stage-specific forms</p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Wizard Modal */}
      {showWizard && (
        <UnifiedConfigurationWizard
          onClose={() => setShowWizard(false)}
          onSave={handleSaveConfiguration}
        />
      )}
    </Layout>
  )
}