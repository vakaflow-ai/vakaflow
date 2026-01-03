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
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Export Data</h1>
          <p className="text-sm text-gray-600">
            Export platform data in CSV or JSON format
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Agents Export */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🤖</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Agents</h3>
                <p className="text-xs text-gray-600">Export all agents</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => handleExport('agents', 'csv')}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={exporting === 'agents-csv'}
              >
                {exporting === 'agents-csv' ? 'Exporting...' : 'CSV'}
              </button>
              <button
                onClick={() => handleExport('agents', 'json')}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={exporting === 'agents-json'}
              >
                {exporting === 'agents-json' ? 'Exporting...' : 'JSON'}
              </button>
            </div>
          </div>

          {/* Audit Logs Export */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📋</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Audit Logs</h3>
                <p className="text-xs text-gray-600">Export audit trail</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1.5">Start Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1.5">End Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => handleExport('audit', 'csv')}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={exporting === 'audit-csv'}
              >
                {exporting === 'audit-csv' ? 'Exporting...' : 'CSV'}
              </button>
              <button
                onClick={() => handleExport('audit', 'json')}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={exporting === 'audit-json'}
              >
                {exporting === 'audit-json' ? 'Exporting...' : 'JSON'}
              </button>
            </div>
          </div>

          {/* Compliance Report Export */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">✅</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Compliance</h3>
                <p className="text-xs text-gray-600">Export compliance reports</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => handleExport('compliance', 'csv')}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={exporting === 'compliance-csv'}
              >
                {exporting === 'compliance-csv' ? 'Exporting...' : 'CSV'}
              </button>
              <button
                onClick={() => handleExport('compliance', 'json')}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

