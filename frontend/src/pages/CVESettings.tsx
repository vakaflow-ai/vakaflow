import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { tenantsApi } from '../lib/tenants'
import { securityIncidentsApi, MonitoringConfig } from '../lib/securityIncidents'
import Layout from '../components/Layout'
import { ArrowLeft, Save, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CVESettings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [tenantFeatures, setTenantFeatures] = useState<Record<string, boolean>>({})
  const [config, setConfig] = useState<Partial<MonitoringConfig>>({
    cve_monitoring_enabled: true,
    cve_scan_frequency: 'daily',
    cve_severity_threshold: 'medium',
    cve_cvss_threshold: 5.0,
    breach_monitoring_enabled: false,
    auto_create_tasks: true,
    auto_send_alerts: true,
    auto_trigger_assessments: false,
    auto_start_workflows: false,
    min_match_confidence: 0.5
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  useEffect(() => {
    if (user?.tenant_id) {
      tenantsApi.getMyTenantFeatures().then((features) => {
        setTenantFeatures(features || {})
      }).catch(() => {})
    }
  }, [user])

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['monitoring-config'],
    queryFn: () => securityIncidentsApi.getMonitoringConfig(),
    enabled: !!user && tenantFeatures.cve_tracking === true,
    onSuccess: (data) => {
      if (data) {
        setConfig(data)
      }
    }
  })

  const updateConfig = useMutation({
    mutationFn: (data: Partial<MonitoringConfig>) => securityIncidentsApi.updateMonitoringConfig(data),
    onSuccess: () => {
      toast.success('Monitoring configuration updated')
      queryClient.invalidateQueries({ queryKey: ['monitoring-config'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to update configuration')
    }
  })

  if (!user) {
    return null
  }

  if (tenantFeatures.cve_tracking !== true) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500 font-medium mb-2">Feature Not Available</div>
          <div className="text-muted-foreground">
            CVE Tracking is not enabled for your tenant.
          </div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="text-center py-12 text-muted-foreground">Loading configuration...</div>
      </Layout>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateConfig.mutate(config)
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <Link
            to="/cve"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-medium">CVE Monitoring Configuration</h1>
            <p className="text-sm text-muted-foreground">
              Configure how the system monitors and responds to security incidents
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* CVE Monitoring Settings */}
          <div className="compact-card">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              CVE Monitoring
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium mb-1">Enable CVE Monitoring</label>
                  <p className="text-xs text-muted-foreground">Automatically scan for new CVEs</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.cve_monitoring_enabled || false}
                    onChange={(e) => setConfig({ ...config, cve_monitoring_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {config.cve_monitoring_enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Scan Frequency</label>
                    <select
                      className="compact-input w-full"
                      value={config.cve_scan_frequency || 'daily'}
                      onChange={(e) => setConfig({ ...config, cve_scan_frequency: e.target.value })}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">How often to scan for new CVEs</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Severity Threshold</label>
                    <select
                      className="compact-input w-full"
                      value={config.cve_severity_threshold || 'medium'}
                      onChange={(e) => setConfig({ ...config, cve_severity_threshold: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">Minimum severity level to track</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">CVSS Score Threshold</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      className="compact-input w-full"
                      value={config.cve_cvss_threshold || 5.0}
                      onChange={(e) => setConfig({ ...config, cve_cvss_threshold: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Minimum CVSS score to track (0.0 - 10.0)</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Vendor Matching Settings */}
          <div className="compact-card">
            <h2 className="text-lg font-medium mb-4">Vendor Matching</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Minimum Match Confidence</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  className="compact-input w-full"
                  value={config.min_match_confidence || 0.5}
                  onChange={(e) => setConfig({ ...config, min_match_confidence: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum confidence score (0.0 - 1.0) required to match vendors</p>
              </div>
            </div>
          </div>

          {/* Automated Actions */}
          <div className="compact-card">
            <h2 className="text-lg font-medium mb-4">Automated Actions</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium mb-1">Auto-Create Tasks</label>
                  <p className="text-xs text-muted-foreground">Automatically create risk qualification tasks when vendors are matched</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_create_tasks || false}
                    onChange={(e) => setConfig({ ...config, auto_create_tasks: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium mb-1">Auto-Send Alerts</label>
                  <p className="text-xs text-muted-foreground">Automatically send alerts when vendors are matched to incidents</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_send_alerts || false}
                    onChange={(e) => setConfig({ ...config, auto_send_alerts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium mb-1">Auto-Trigger Assessments</label>
                  <p className="text-xs text-muted-foreground">Automatically assign security assessments to matched vendors</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_trigger_assessments || false}
                    onChange={(e) => setConfig({ ...config, auto_trigger_assessments: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium mb-1">Auto-Start Workflows</label>
                  <p className="text-xs text-muted-foreground">Automatically start TPRM/VRM/Risk workflows for matched vendors</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_start_workflows || false}
                    onChange={(e) => setConfig({ ...config, auto_start_workflows: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Breach Monitoring */}
          <div className="compact-card">
            <h2 className="text-lg font-medium mb-4">Breach Monitoring</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium mb-1">Enable Breach Monitoring</label>
                  <p className="text-xs text-muted-foreground">Monitor data breach databases (coming soon)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.breach_monitoring_enabled || false}
                    onChange={(e) => setConfig({ ...config, breach_monitoring_enabled: e.target.checked })}
                    disabled
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer opacity-50"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Link
              to="/cve"
              className="compact-button-secondary"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={updateConfig.isPending}
              className="compact-button-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {updateConfig.isPending ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}

