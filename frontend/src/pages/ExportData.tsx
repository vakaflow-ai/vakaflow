import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../lib/auth'
import { exportApi } from '../lib/export'
import Layout from '../components/Layout'

export default function ExportData() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const handleExport = async (type: 'agents' | 'audit' | 'compliance', format: 'csv' | 'json') => {
    setExporting(`${type}-${format}`)
    try {
      let blob
      if (type === 'audit') {
        blob = await exportApi.exportAuditLogs(format, dateRange.start || undefined, dateRange.end || undefined)
      } else if (type === 'compliance') {
        blob = await exportApi.exportComplianceReport(format)
      } else {
        blob = await exportApi.exportAgents(format)
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alert('Export failed. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Export Data</h1>
          <p className="text-muted-foreground">
            Export platform data in CSV or JSON format
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Agents Export */}
          <div className="compact-card-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-9 bg-blue-100 rounded-md flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <h3 className="font-medium">Agents</h3>
                <p className="text-xs text-muted-foreground">Export all agents</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('agents', 'csv')}
                className="compact-button-primary flex-1 text-sm"
                disabled={exporting === 'agents-csv'}
              >
                {exporting === 'agents-csv' ? 'Exporting...' : 'CSV'}
              </button>
              <button
                onClick={() => handleExport('agents', 'json')}
                className="compact-button-secondary flex-1 text-sm"
                disabled={exporting === 'agents-json'}
              >
                {exporting === 'agents-json' ? 'Exporting...' : 'JSON'}
              </button>
            </div>
          </div>

          {/* Audit Logs Export */}
          <div className="compact-card-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-9 bg-amber-100 rounded-md flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <h3 className="font-medium">Audit Logs</h3>
                <p className="text-xs text-muted-foreground">Export audit trail</p>
              </div>
            </div>
            <div className="space-y-2 mb-3">
              <div>
                <label className="text-xs text-muted-foreground">Start Date</label>
                <input
                  type="date"
                  className="compact-input text-sm"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Date</label>
                <input
                  type="date"
                  className="compact-input text-sm"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('audit', 'csv')}
                className="compact-button-primary flex-1 text-sm"
                disabled={exporting === 'audit-csv'}
              >
                {exporting === 'audit-csv' ? 'Exporting...' : 'CSV'}
              </button>
              <button
                onClick={() => handleExport('audit', 'json')}
                className="compact-button-secondary flex-1 text-sm"
                disabled={exporting === 'audit-json'}
              >
                {exporting === 'audit-json' ? 'Exporting...' : 'JSON'}
              </button>
            </div>
          </div>

          {/* Compliance Report Export */}
          <div className="compact-card-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-9 bg-green-100 rounded-md flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <h3 className="font-medium">Compliance</h3>
                <p className="text-xs text-muted-foreground">Export compliance reports</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('compliance', 'csv')}
                className="compact-button-primary flex-1 text-sm"
                disabled={exporting === 'compliance-csv'}
              >
                {exporting === 'compliance-csv' ? 'Exporting...' : 'CSV'}
              </button>
              <button
                onClick={() => handleExport('compliance', 'json')}
                className="compact-button-secondary flex-1 text-sm"
                disabled={exporting === 'compliance-json'}
              >
                {exporting === 'compliance-json' ? 'Exporting...' : 'JSON'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

