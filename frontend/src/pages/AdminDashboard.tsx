import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton } from '../components/material'
import { ShieldCheckIcon, UsersIcon, ChartBarIcon, ClipboardIcon } from '../components/Icons'
import api from '../lib/api'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'users' | 'policies' | 'analytics' | 'audit'>('overview')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await api.get('/tenants')
      return response.data
    },
    enabled: user?.role === 'platform_admin'
  })

  const { data: policiesData } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const response = await api.get('/compliance/policies')
      return response.data
    }
  })

  if (!user || !['tenant_admin', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium mb-2">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage platform settings, tenants, and policies
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4">
            {['overview', 'tenants', 'users', 'policies', 'analytics', 'audit'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && (
            <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MaterialCard elevation={2} className="p-6 border-none">
                <div className="text-label text-gray-500 mb-1">Total Tenants</div>
                <div className="text-display-medium font-medium text-blue-600">{tenantsData?.length || 0}</div>
              </MaterialCard>
              <MaterialCard elevation={2} className="p-6 border-none">
                <div className="text-label text-gray-500 mb-1">Active Policies</div>
                <div className="text-display-medium font-medium text-secondary-600">{policiesData?.length || 0}</div>
              </MaterialCard>
              <MaterialCard elevation={2} className="p-6 border-none">
                <div className="text-label text-gray-500 mb-1">Platform Status</div>
                <div className="text-title-large font-medium text-green-600 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                  Operational
                </div>
              </MaterialCard>
            </div>
            
            <MaterialCard elevation={1} className="p-6 border-none">
              <h2 className="text-title-medium font-medium mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MaterialButton
                  variant="outlined"
                  onClick={() => navigate('/admin/submission-requirements')}
                  className="justify-start h-9"
                  fullWidth
                >
                  Submission Requirements
                </MaterialButton>
                <MaterialButton
                  variant="outlined"
                  onClick={() => navigate('/admin/form-library')}
                  className="justify-start h-9"
                  fullWidth
                >
                  Form Designer
                </MaterialButton>
                <MaterialButton
                  variant="outlined"
                  onClick={() => navigate('/admin/workflows')}
                  className="justify-start h-9"
                  fullWidth
                >
                  Workflow Management
                </MaterialButton>
                <MaterialButton
                  variant="outlined"
                  onClick={() => navigate('/admin/policies')}
                  className="justify-start h-9"
                  fullWidth
                >
                  Policy Management
                </MaterialButton>
              </div>
            </MaterialCard>
            </div>
          )}

          {activeTab === 'tenants' && user?.role === 'platform_admin' && (
            <MaterialCard elevation={1} className="p-6 border-none">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-title-large font-medium">Tenants</h2>
                <MaterialButton 
                  size="small" 
                  onClick={() => navigate('/admin/tenants')}
                >
                  Manage Tenants
                </MaterialButton>
              </div>
              {tenantsData?.length === 0 ? (
                <div className="text-center py-12 bg-surface-variant/10 rounded-md border border-dashed">
                  <div className="text-muted-foreground">No tenants yet</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {tenantsData?.map((tenant: any) => (
                    <MaterialCard 
                      key={tenant.id} 
                      elevation={0} 
                      hover
                      className="flex items-center justify-between p-4 border border-outline/10 bg-surface-variant/5"
                    >
                      <div>
                        <div className="text-body-large font-medium text-gray-900">{tenant.name}</div>
                        <div className="text-label-medium text-muted-foreground mt-0.5">
                          {tenant.license_tier} • {tenant.status}
                        </div>
                      </div>
                      <MaterialButton variant="outlined" size="small">
                        View details
                      </MaterialButton>
                    </MaterialCard>
                  ))}
                </div>
              )}
            </MaterialCard>
          )}

          {activeTab === 'policies' && (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-md border border-outline/5 shadow-sm">
              <ShieldCheckIcon className="w-16 h-12 text-primary-200 mb-4" />
              <MaterialButton
                onClick={() => navigate('/admin/policies')}
                size="large"
                className="shadow-md-elevation-4"
              >
                Manage Policies
              </MaterialButton>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-md border border-outline/5 shadow-sm">
              <UsersIcon className="w-16 h-12 text-primary-200 mb-4" />
              <MaterialButton
                onClick={() => navigate('/admin/users')}
                size="large"
                className="shadow-md-elevation-4"
              >
                Manage Users
              </MaterialButton>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-md border border-outline/5 shadow-sm">
              <ChartBarIcon className="w-16 h-12 text-primary-200 mb-4" />
              <MaterialButton
                onClick={() => navigate('/analytics')}
                size="large"
                className="shadow-md-elevation-4"
              >
                View Analytics Dashboard
              </MaterialButton>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-md border border-outline/5 shadow-sm">
              <ClipboardIcon className="w-16 h-12 text-primary-200 mb-4" />
              <MaterialButton
                onClick={() => navigate('/audit')}
                size="large"
                className="shadow-md-elevation-4"
              >
                View Audit Trail
              </MaterialButton>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

