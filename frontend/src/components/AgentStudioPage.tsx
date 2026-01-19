import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import Layout from './Layout'
import SimpleAgentStudioDashboard from './SimpleAgentStudioDashboard'

export default function AgentStudioPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('dashboard')

  // Fetch current user
  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => navigate('/login'))
  }, [navigate])

  // Check if user has proper permissions
  const isAdmin = user && ['tenant_admin', 'platform_admin'].includes(user.role)
  
  if (!user) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </Layout>
    )
  }

  if (!isAdmin) {
    return (
      <Layout user={user}>
        <div className="p-6">
          <div className="text-center text-red-600 bg-red-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p>You don't have permission to access Agent Studio. Only tenant administrators and platform administrators can access this feature.</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!user.tenant_id && user.role !== 'platform_admin') {
    return (
      <Layout user={user}>
        <div className="p-6">
          <div className="text-center text-red-600 bg-red-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Tenant Required</h2>
            <p>You must be assigned to a tenant to access Agent Studio. Please contact your platform administrator.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto">
        {/* Remove extra padding since Layout already provides it */}
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Agent Studio</h1>
              <p className="mt-2 text-gray-600">
                Centralized governance platform for agents, products, and services
              </p>
            </div>
            {user.tenant_id && (
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  Tenant: {user.tenant_id.substring(0, 8)}...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'dashboard', name: 'Dashboard' },
                { id: 'entities', name: 'All Entities' },
                { id: 'profiles', name: 'Governance Profiles' },
                { id: 'analytics', name: 'Analytics' },
                { id: 'settings', name: 'Settings' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'dashboard' && (
            <div className="p-6">
              <SimpleAgentStudioDashboard tenantId={user.tenant_id} />
            </div>
          )}

          {activeTab === 'entities' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">All Entities</h2>
                <div className="flex space-x-3">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Create New Entity
                  </button>
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                    Import Entities
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">Security Bot v2.1</h3>
                        <p className="text-sm text-gray-500 mt-1">Agent • Engineering</p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Compliance:</span>
                        <span className="font-medium">85%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Risk Level:</span>
                        <span className="font-medium text-yellow-600">Medium</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Last Review:</span>
                        <span className="font-medium">2 days ago</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800">
                        View Details →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profiles' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Governance Profiles</h2>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Create Profile
                </button>
              </div>
              
              <div className="space-y-4">
                {[
                  { name: "Standard Security Profile", type: "security", count: 12 },
                  { name: "HIPAA Compliance Profile", type: "compliance", count: 8 },
                  { name: "Financial Services Profile", type: "industry", count: 5 }
                ].map((profile, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{profile.name}</h3>
                        <p className="text-sm text-gray-500 mt-1 capitalize">{profile.type} profile</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">{profile.count} entities</span>
                        <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200">
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Analytics & Reporting</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="font-medium text-gray-900 mb-4">Compliance Trends</h3>
                  <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-gray-500">Compliance chart visualization</span>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="font-medium text-gray-900 mb-4">Risk Distribution</h3>
                  <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-gray-500">Risk distribution chart</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Studio Settings</h2>
              <div className="space-y-6">
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="font-medium text-gray-900 mb-4">Notification Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Governance Alerts</p>
                        <p className="text-sm text-gray-500">Receive notifications for compliance issues</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="font-medium text-gray-900 mb-4">Automation Rules</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Auto-Review Schedule</p>
                        <p className="text-sm text-gray-500">Automatically schedule governance reviews</p>
                      </div>
                      <select className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                        <option>Monthly</option>
                        <option>Quarterly</option>
                        <option>Annually</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}