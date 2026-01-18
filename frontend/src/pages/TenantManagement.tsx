import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { tenantsApi, Tenant, TenantCreate } from '../lib/tenants'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip, MaterialInput } from '../components/material'
import { PlusIcon, SearchIcon, XIcon, ShieldCheckIcon } from '../components/Icons'
import api from '../lib/api'
import StandardModal from '../components/StandardModal'

export default function TenantManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBrandingModal, setShowBrandingModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<TenantCreate>({
    name: '',
    slug: '',
    contact_email: '',
    contact_name: '',
    license_tier: 'trial',
    tenant_admin_email: '',
    tenant_admin_name: '',
    tenant_admin_password: '',
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantsApi.list(1, 100),
    enabled: user?.role === 'platform_admin',
  })

  const createMutation = useMutation({
    mutationFn: (data: TenantCreate) => tenantsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowCreateModal(false)
      setFormData({
        name: '',
        slug: '',
        contact_email: '',
        contact_name: '',
        license_tier: 'trial',
        tenant_admin_email: '',
        tenant_admin_name: '',
        tenant_admin_password: '',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tenantsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowEditModal(false)
      setSelectedTenant(null)
    },
  })

  const uploadLogoMutation = useMutation({
    mutationFn: ({ tenantId, file }: { tenantId: string; file: File }) => tenantsApi.uploadLogo(tenantId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setLogoFile(null)
      setShowBrandingModal(false)
    },
  })

  const updateBrandingMutation = useMutation({
    mutationFn: ({ tenantId, branding }: { tenantId: string; branding: Record<string, any> }) => 
      tenantsApi.updateBranding(tenantId, branding),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowBrandingModal(false)
    },
  })

  const completeOnboardingMutation = useMutation({
    mutationFn: (tenantId: string) => tenantsApi.completeOnboarding(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  if (!user || user.role !== 'platform_admin') {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied. Platform admin required.</div>
        </div>
      </Layout>
    )
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleUpdateStatus = (tenantId: string, status: string) => {
    updateMutation.mutate({ id: tenantId, data: { status } })
  }

  const handleCompleteOnboarding = (tenantId: string) => {
    if (confirm('Complete onboarding and activate this tenant?')) {
      completeOnboardingMutation.mutate(tenantId)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'status-badge-warning',
      active: 'status-badge-success',
      suspended: 'status-badge-error',
      cancelled: 'status-badge',
    }
    return badges[status] || 'status-badge'
  }

  const getTierBadge = (tier: string) => {
    const badges: Record<string, string> = {
      trial: 'status-badge-info',
      basic: 'status-badge',
      professional: 'status-badge-success',
      enterprise: 'status-badge-primary',
    }
    return badges[tier] || 'status-badge'
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium mb-2 text-gray-900">Tenant Management</h1>
            <p className="text-sm text-gray-600">
              Create and manage tenants on the platform
            </p>
          </div>
          <MaterialButton
            onClick={() => setShowCreateModal(true)}
            startIcon={<PlusIcon className="w-4 h-4" />}
            className="shadow-md-elevation-4"
          >
            Create Tenant
          </MaterialButton>
        </div>

        {/* Tenants Table - Material Design */}
        <MaterialCard elevation={2} className="overflow-hidden border-none">
          <div className="p-6 border-b bg-surface-variant/10">
            <h2 className="text-lg font-medium text-gray-900">Tenants</h2>
          </div>
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
              <div className="text-muted-foreground">Loading tenants...</div>
            </div>
          ) : tenants?.length === 0 ? (
            <div className="text-center py-16 bg-surface-variant/5">
              <ShieldCheckIcon className="w-16 h-12 text-gray-500 mx-auto mb-4" />
              <div className="text-lg font-medium text-gray-500">No tenants found</div>
              <div className="text-sm text-gray-600 mt-1">Create your first tenant to get started</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-surface-variant/30">
                  <tr>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Name</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Slug</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">License Tier</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Status</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Onboarding</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Limits</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Created</th>
                    <th className="px-6 py-2 text-right text-xs font-medium text-gray-500 tracking-tight">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {tenants?.map((tenant: Tenant) => (
                    <tr key={tenant.id} className="hover:bg-primary-50/20 transition-all duration-150">
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-600">{tenant.slug}</td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip 
                          label={tenant.license_tier} 
                          color={
                            tenant.license_tier === 'enterprise' ? 'primary' :
                            tenant.license_tier === 'professional' ? 'success' :
                            'default'
                          }
                          size="small" 
                          variant="outlined" 
                        />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip 
                          label={tenant.status} 
                          color={
                            tenant.status === 'active' ? 'success' :
                            tenant.status === 'suspended' ? 'error' :
                            tenant.status === 'pending' ? 'warning' : 'default'
                          }
                          size="small" 
                          variant="filled" 
                        />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip 
                          label={tenant.onboarding_status}
                          color={tenant.onboarding_status === 'completed' ? 'success' : 'warning'}
                          size="small"
                          variant="filled"
                        />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                        {tenant.max_agents ? `${tenant.max_agents} agents` : 'Unlimited'} /{' '}
                        {tenant.max_users ? `${tenant.max_users} users` : 'Unlimited'}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-right">
                        <div className="flex gap-2 justify-end">
                          {tenant.status === 'pending' && (
                            <MaterialButton
                              variant="outlined"
                              size="small"
                              onClick={() => handleUpdateStatus(tenant.id, 'active')}
                              className="border-success-200 text-green-600"
                            >
                              Activate
                            </MaterialButton>
                          )}
                          {tenant.status === 'active' && tenant.onboarding_status !== 'completed' && (
                            <MaterialButton
                              variant="contained"
                              size="small"
                              onClick={() => handleCompleteOnboarding(tenant.id)}
                            >
                              Complete Onboarding
                            </MaterialButton>
                          )}
                          <MaterialButton
                            variant="outlined"
                            size="small"
                            onClick={async () => {
                              const freshTenant = await tenantsApi.get(tenant.id);
                              setSelectedTenant(freshTenant);
                              setShowEditModal(true);
                            }}
                            className="border-outline/10 text-gray-600 hover:bg-gray-50"
                          >
                            Edit
                          </MaterialButton>
                          <MaterialButton
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              setSelectedTenant(tenant)
                              setShowBrandingModal(true)
                            }}
                            className="border-outline/10 text-gray-600 hover:bg-gray-50"
                          >
                            Branding
                          </MaterialButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MaterialCard>

        {/* Create Tenant Modal - Material Design */}
        {showCreateModal && (
          <StandardModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            title="Create Tenant"
            subtitle="Set up a new tenant organization on the platform"
            size="lg"
            isSaving={createMutation.isPending}
            onSave={() => handleCreate({} as React.FormEvent)}
            saveButtonText={createMutation.isPending ? 'Creating...' : 'Create Tenant'}
            disableSave={!formData.name || !formData.slug || !formData.contact_email}
          >
              
              <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                      <input
                        type="text"
                        required
                        pattern="[a-z0-9\-]+"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                        placeholder="acme-corp"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.contact_email}
                        onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={formData.contact_name}
                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">License Tier *</label>
                      <select
                        required
                        value={formData.license_tier}
                        onChange={(e) => setFormData({ ...formData, license_tier: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="trial">Trial</option>
                        <option value="basic">Basic</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Agents</label>
                        <input
                          type="number"
                          value={formData.max_agents || ''}
                          onChange={(e) => setFormData({ ...formData, max_agents: e.target.value ? parseInt(e.target.value) : undefined })}
                          placeholder="Unlimited"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
                        <input
                          type="number"
                          value={formData.max_users || ''}
                          onChange={(e) => setFormData({ ...formData, max_users: e.target.value ? parseInt(e.target.value) : undefined })}
                          placeholder="Unlimited"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium mb-3 text-gray-700">Tenant Admin (Optional)</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                          <input
                            type="email"
                            value={formData.tenant_admin_email}
                            onChange={(e) => setFormData({ ...formData, tenant_admin_email: e.target.value })}
                            placeholder="admin@company.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        {formData.tenant_admin_email && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name *</label>
                              <input
                                type="text"
                                required={!!formData.tenant_admin_email}
                                value={formData.tenant_admin_name}
                                onChange={(e) => setFormData({ ...formData, tenant_admin_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password *</label>
                              <input
                                type="password"
                                required={!!formData.tenant_admin_email}
                                minLength={8}
                                value={formData.tenant_admin_password}
                                onChange={(e) => setFormData({ ...formData, tenant_admin_password: e.target.value })}
                                placeholder="Min 8 characters"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
              </StandardModal>
        )}

        {/* Branding Modal - Material Design */}
        {showBrandingModal && selectedTenant && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <MaterialCard elevation={24} className="max-w-2xl w-full mx-4 border-none max-h-[90vh] flex flex-col">
              {/* Fixed Header */}
              <div className="p-6 border-b bg-surface-variant/10 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-medium text-gray-900">Tenant Branding - {selectedTenant.name}</h2>
                  <MaterialButton variant="text" size="small" onClick={() => setShowBrandingModal(false)} className="!p-2 text-gray-600">
                    <XIcon className="w-6 h-6" />
                  </MaterialButton>
                </div>
              </div>
              
              {/* Scrollable Content Area */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-6">
                    {/* Logo Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Company Logo</label>
                      {selectedTenant.custom_branding?.logo_url && (
                        <div className="mb-4">
                          <MaterialCard elevation={0} className="inline-block p-4 bg-surface-variant/5 border border-outline/10">
                            <img 
                              src={`http://localhost:8000${selectedTenant.custom_branding.logo_url}`} 
                              alt="Current logo" 
                              className="h-20 object-contain"
                            />
                          </MaterialCard>
                        </div>
                      )}
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setLogoFile(e.target.files[0])
                            }
                          }}
                          className="compact-input w-full pt-1.5 h-9 border-dashed cursor-pointer hover:bg-gray-50"
                        />
                        <p className="text-sm text-gray-500 italic ml-1">PNG, JPG, GIF, SVG or WebP (max 5MB)</p>
                      </div>
                      {logoFile && (
                        <MaterialButton
                          type="button"
                          onClick={() => {
                            uploadLogoMutation.mutate({ tenantId: selectedTenant.id, file: logoFile })
                          }}
                          disabled={uploadLogoMutation.isPending}
                          className="mt-4"
                          size="small"
                        >
                          {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
                        </MaterialButton>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Fixed Footer */}
              <div className="p-6 border-t bg-surface-variant/5 flex-shrink-0">
                <div className="flex gap-3 justify-end">
                  <MaterialButton
                    variant="text"
                    type="button"
                    onClick={() => {
                      setShowBrandingModal(false)
                      setLogoFile(null)
                    }}
                    className="text-gray-600"
                  >
                    Close
                  </MaterialButton>
                </div>
              </div>
            </MaterialCard>
          </div>
        )}

        {/* Edit Tenant Modal - Material Design */}
        {showEditModal && selectedTenant && (
          <StandardModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            title={`Edit Tenant - ${selectedTenant.name}`}
            subtitle="Update tenant configuration and settings"
            size="lg"
            isSaving={updateMutation.isPending}
            onSave={() => {
              if (selectedTenant) {
                updateMutation.mutate({
                  id: selectedTenant.id,
                  data: {
                    name: selectedTenant.name,
                    status: selectedTenant.status,
                    license_tier: selectedTenant.license_tier,
                    max_agents: selectedTenant.max_agents,
                    max_users: selectedTenant.max_users,
                    contact_email: selectedTenant.contact_email,
                    contact_name: selectedTenant.contact_name,
                    tenant_admin_email: selectedTenant.tenant_admin_email,
                    website: selectedTenant.website,
                    company_address: (selectedTenant as any).company_address,
                  }
                });
              }
            }}
            saveButtonText={updateMutation.isPending ? 'Updating...' : 'Update Tenant'}
          >
              
              {/* Scrollable Content Area */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (selectedTenant) {
                    updateMutation.mutate({
                      id: selectedTenant.id,
                      data: {
                        name: selectedTenant.name,
                        status: selectedTenant.status,
                        license_tier: selectedTenant.license_tier,
                        max_agents: selectedTenant.max_agents,
                        max_users: selectedTenant.max_users,
                        contact_email: selectedTenant.contact_email,
                        contact_name: selectedTenant.contact_name,
                        tenant_admin_email: selectedTenant.tenant_admin_email,
                        website: selectedTenant.website,
                        company_address: (selectedTenant as any).company_address,
                      }
                    });
                  }
                }}
                className="flex-1 min-h-0 flex flex-col"
              >
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-5">
                    <MaterialInput
                      label="Company Name *"
                      type="text"
                      required
                      value={selectedTenant?.name || ''}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant!, name: e.target.value })}
                    />
                    <MaterialInput
                      label="Slug *"
                      type="text"
                      required
                      value={selectedTenant?.slug || ''}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant!, slug: e.target.value })}
                    />
                    <MaterialInput
                      label="Contact Email"
                      type="email"
                      value={selectedTenant?.contact_email || ''}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant!, contact_email: e.target.value })}
                    />
                    <MaterialInput
                      label="Contact Name"
                      type="text"
                      value={selectedTenant?.contact_name || ''}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant!, contact_name: e.target.value })}
                    />
                    <MaterialInput
                      label="Website"
                      type="text"
                      value={selectedTenant?.website || ''}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant!, website: e.target.value })}
                      placeholder="https://example.com"
                      onBlur={() => {
                        if (selectedTenant?.website) {
                          tenantsApi.fetchLogoFromWebsite(selectedTenant.website)
                            .then(() => {
                               queryClient.invalidateQueries({ queryKey: ['tenants'] })
                            })
                            .catch((err) => console.error('Failed to fetch logo', err));
                        }
                      }}
                      helperText="Enter website URL to auto-fetch logo"
                    />
                    <MaterialInput
                      label="Company Address"
                      type="text"
                      value={(selectedTenant as any)?.company_address || ''}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant!, company_address: e.target.value } as any)}
                      placeholder="123 Main St, City, Country"
                    />
                    <MaterialInput
                      label="Admin Email"
                      type="email"
                      value={selectedTenant?.tenant_admin_email || ''}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant!, tenant_admin_email: e.target.value })}
                      helperText="Updating this will change the email of the current tenant admin"
                    />
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-500 tracking-tight ml-1">Status</label>
                      <select
                        className="compact-input w-full"
                        value={selectedTenant?.status || ''}
                        onChange={(e) => setSelectedTenant({ ...selectedTenant!, status: e.target.value })}
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-500 tracking-tight ml-1">License Tier</label>
                      <select
                        className="compact-input w-full"
                        value={selectedTenant?.license_tier || ''}
                        onChange={(e) => setSelectedTenant({ ...selectedTenant!, license_tier: e.target.value })}
                      >
                        <option value="trial">Trial</option>
                        <option value="basic">Basic</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <MaterialInput
                        label="Max Agents"
                        type="number"
                        value={selectedTenant?.max_agents?.toString() || ''}
                        onChange={(e) => setSelectedTenant({ ...selectedTenant!, max_agents: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="Unlimited"
                      />
                      <MaterialInput
                        label="Max Users"
                        type="number"
                        value={selectedTenant?.max_users?.toString() || ''}
                        onChange={(e) => setSelectedTenant({ ...selectedTenant!, max_users: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                </div>
              </form>
              
              {/* Fixed Footer */}
              <div className="p-6 border-t bg-surface-variant/5 flex-shrink-0">
                <div className="flex gap-3 justify-end">
                  <MaterialButton
                    variant="text"
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-600"
                  >
                    Cancel
                  </MaterialButton>
                  <MaterialButton
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="shadow-md-elevation-4"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Update Tenant'}
                  </MaterialButton>
                </div>
              </div>
              </StandardModal>
        )}
      </div>
    </Layout>
  )
}
