import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { vendorsApi } from '../lib/vendors'
import { tenantsApi } from '../lib/tenants'
import Layout from '../components/Layout'
import { UsersIcon, BuildingIcon, MailIcon, PhoneIcon, GlobeIcon, DocumentIcon } from '../components/Icons'
import { Shield } from 'lucide-react'

interface VendorPOC {
  id: string
  name: string
  email: string
  phone?: string
  department?: string
  is_active: boolean
}

interface VendorAgent {
  id: string
  name: string
  type: string
  status: string
  created_at?: string
}

interface VendorWithDetails {
  id: string
  name: string
  contact_email: string
  contact_phone?: string
  address?: string
  website?: string
  description?: string
  logo_url?: string
  registration_number?: string
  created_at: string
  updated_at: string
  pocs: VendorPOC[]
  agents_count: number
  agents: VendorAgent[]
  invitation_id?: string
  invited_by?: string
  invited_by_name?: string
  invitation_date?: string
}

export default function MyVendors() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [showRecentOnly, setShowRecentOnly] = useState(true)
  const [tenantFeatures, setTenantFeatures] = useState<Record<string, boolean>>({})

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

  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ['vendors', showRecentOnly],
    queryFn: () => vendorsApi.list(showRecentOnly),
    enabled: !!user && (user.role === 'tenant_admin' || user.role === 'business_reviewer' || user.role === 'platform_admin')
  })

  if (!user || !['tenant_admin', 'business_reviewer', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied</div>
        </div>
      </Layout>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'submitted':
      case 'in_review':
        return 'bg-blue-100 text-blue-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">MyAI-Vendors</h1>
            <p className="text-muted-foreground">
              View vendor registrations, their points of contact, and submitted agents
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRecentOnly}
                onChange={(e) => setShowRecentOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Show recent vendors (last 30 days)</span>
            </label>
            <button
              onClick={() => refetch()}
              className="compact-button-secondary"
            >
              Refresh
            </button>
            <button
              onClick={() => navigate('/invite-vendor')}
              className="compact-button-primary"
            >
              + Invite Vendor
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading vendors...</div>
        ) : vendors && vendors.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {vendors.map((vendor: VendorWithDetails) => (
              <div key={vendor.id} className="compact-card-elevated">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    {vendor.logo_url && (
                      <img
                        src={vendor.logo_url}
                        alt={vendor.name}
                        className="w-16 h-12 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <h3 className="text-lg font-medium mb-1">{vendor.name}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {vendor.contact_email && (
                          <div className="flex items-center gap-1">
                            <MailIcon className="w-4 h-4" />
                            <span>{vendor.contact_email}</span>
                          </div>
                        )}
                        {vendor.contact_phone && (
                          <div className="flex items-center gap-1">
                            <PhoneIcon className="w-4 h-4" />
                            <span>{vendor.contact_phone}</span>
                          </div>
                        )}
                        {vendor.website && (
                          <a
                            href={vendor.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <GlobeIcon className="w-4 h-4" />
                            <span>Website</span>
                          </a>
                        )}
                      </div>
                      {vendor.description && (
                        <p className="text-sm text-muted-foreground mt-2">{vendor.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      Registered: {new Date(vendor.created_at).toLocaleDateString()}
                    </div>
                    {vendor.invited_by_name && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Invited by: {vendor.invited_by_name}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {/* Points of Contact */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <UsersIcon className="w-4 h-4" />
                      Points of Contact ({vendor.pocs.length})
                    </h4>
                    {vendor.pocs.length > 0 ? (
                      <div className="space-y-2">
                        {vendor.pocs.map((poc) => (
                          <div
                            key={poc.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-sm">{poc.name}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {poc.email}
                                </div>
                                {poc.department && (
                                  <div className="text-xs text-muted-foreground">
                                    {poc.department}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  poc.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {poc.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No POCs registered</p>
                    )}
                  </div>

                  {/* Agents */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <DocumentIcon className="w-4 h-4" />
                      Agents ({vendor.agents_count})
                    </h4>
                    {vendor.agents.length > 0 ? (
                      <div className="space-y-2">
                        {vendor.agents.map((agent) => (
                          <div
                            key={agent.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => navigate(`/agents/${agent.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{agent.name}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {agent.type}
                                </div>
                                {agent.created_at && (
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(agent.created_at).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`px-2 py-1 rounded text-xs ${getStatusColor(
                                  agent.status
                                )}`}
                              >
                                {agent.status}
                              </span>
                            </div>
                          </div>
                        ))}
                        {vendor.agents_count > vendor.agents.length && (
                          <button
                            onClick={() => navigate(`/catalog?vendor=${vendor.id}`)}
                            className="text-sm text-blue-600 hover:underline mt-2"
                          >
                            View all {vendor.agents_count} agents →
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No agents submitted yet</p>
                    )}
                  </div>
                </div>

                {/* Additional Info */}
                {(vendor.address || vendor.registration_number) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {vendor.address && (
                        <div>
                          <span className="text-muted-foreground">Address:</span>
                          <p className="mt-1">{vendor.address}</p>
                        </div>
                      )}
                      {vendor.registration_number && (
                        <div>
                          <span className="text-muted-foreground">Registration #:</span>
                          <p className="mt-1 font-mono">{vendor.registration_number}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="compact-card text-center py-12">
            <BuildingIcon className="w-16 h-12 mx-auto text-gray-500 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">No vendors found</p>
            <p className="text-muted-foreground mb-4">
              {showRecentOnly
                ? 'No vendors registered in the last 30 days.'
                : 'Get started by inviting your first vendor.'}
            </p>
            <button
              onClick={() => navigate('/invite-vendor')}
              className="compact-button-primary"
            >
              + Invite Vendor
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

