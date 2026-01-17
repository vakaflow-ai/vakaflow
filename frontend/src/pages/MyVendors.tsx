import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { vendorsApi } from '../lib/vendors'
import { suppliersMasterApi, SupplierMasterView } from '../lib/suppliersMaster'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton } from '../components/material'
import { 
  Search, Grid3x3, List, Filter, FileText, Upload, Download, Plus, Pencil, ChevronDown, 
  ExternalLink, Building2, Rocket
} from 'lucide-react'

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
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'detail'>('list')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set())
  const [vendorDetails, setVendorDetails] = useState<Record<string, SupplierMasterView>>({})

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors', false],
    queryFn: () => vendorsApi.list(false),
    enabled: !!user && (user.role === 'tenant_admin' || user.role === 'business_reviewer' || user.role === 'platform_admin')
  })

  // Fetch detailed supplier data when a vendor is expanded
  const toggleVendorExpansion = async (vendorId: string) => {
    const newExpanded = new Set(expandedVendors)
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId)
    } else {
      newExpanded.add(vendorId)
      // Fetch detailed data if not already loaded
      if (!vendorDetails[vendorId]) {
        try {
          const details = await suppliersMasterApi.get(vendorId)
          setVendorDetails(prev => ({ ...prev, [vendorId]: details }))
        } catch (error) {
          console.error('Failed to load vendor details:', error)
        }
      }
    }
    setExpandedVendors(newExpanded)
  }

  // Filter vendors based on search term
  const filteredVendors = useMemo(() => {
    if (!vendors || !searchTerm) return vendors || []
    const term = searchTerm.toLowerCase()
    return vendors.filter((vendor: VendorWithDetails) =>
      vendor.name.toLowerCase().includes(term) ||
      vendor.contact_email?.toLowerCase().includes(term) ||
      vendor.description?.toLowerCase().includes(term)
    )
  }, [vendors, searchTerm])

  if (!user || !['tenant_admin', 'business_reviewer', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied</div>
        </div>
      </Layout>
    )
  }

  const getPrimaryPOC = (pocs: VendorPOC[]) => {
    const activePOC = pocs.find(poc => poc.is_active)
    return activePOC || pocs[0] || null
  }

  const getVendorType = (vendor: VendorWithDetails) => {
    // Determine vendor type based on available data
    if (vendor.invitation_id) {
      return 'Partner'
    }
    return 'Direct'
  }

  const getVendorStatus = (vendor: VendorWithDetails) => {
    // Check if vendor has active agents or POCs
    const hasActivePOC = vendor.pocs.some(poc => poc.is_active)
    const hasAgents = vendor.agents_count > 0
    return hasActivePOC || hasAgents ? 'active' : 'inactive'
  }

  const getStatusBadge = (status: string, type: 'agreement' | 'cve' | 'investigation' | 'compliance') => {
    const baseClasses = 'px-2 py-1 rounded text-xs font-medium'
    switch (type) {
      case 'agreement':
        switch (status?.toLowerCase()) {
          case 'active':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          case 'expired':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          case 'pending_signature':
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>
        }
      case 'cve':
        switch (status?.toLowerCase()) {
          case 'confirmed':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          case 'resolved':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          case 'mitigated':
            return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>
        }
      case 'investigation':
      case 'compliance':
        switch (status?.toLowerCase()) {
          case 'open':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          case 'in_progress':
          case 'in_remediation':
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>
          case 'resolved':
          case 'closed':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>
        }
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString()
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
  }

  const toggleSection = (vendorId: string, section: string) => {
    const key = `${vendorId}-${section}`
    const current = expandedVendors.has(key) ? new Set(expandedVendors) : new Set([...Array.from(expandedVendors), key])
    if (expandedVendors.has(key)) {
      current.delete(key)
    }
    setExpandedVendors(current)
  }

  const isSectionExpanded = (vendorId: string, section: string) => {
    return expandedVendors.has(`${vendorId}-${section}`)
  }

  return (
    <Layout user={user}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Vendors</h1>
          
          {/* Search and Actions Bar */}
          <div className="flex items-center justify-between gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                  title="Grid view"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Filters */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">Filters</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'transform rotate-180' : ''}`} />
              </button>

              {/* Template */}
              <button
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                title="Template"
              >
                <FileText className="w-4 h-4" />
              </button>

              {/* Import */}
              <button
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                title="Import"
              >
                <Upload className="w-4 h-4" />
              </button>

              {/* Export */}
              <button
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                title="Export"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Onboard Vendor Button */}
              <MaterialButton
                onClick={() => navigate('/onboarding/vendor')}
                variant="outlined"
                className="border-primary-600 text-primary-600 hover:bg-primary-50"
              >
                <Rocket className="w-4 h-4 mr-2" />
                Onboard Vendor
              </MaterialButton>

              {/* New Vendor Button */}
              <button
                onClick={() => navigate('/invite-vendor')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Vendor</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters Panel (if expanded) */}
        {showFilters && (
          <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Filter options coming soon...</p>
          </div>
        )}

        {/* Table View */}
        {viewMode === 'list' ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading vendors...</div>
            ) : filteredVendors && filteredVendors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Contact Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Agents</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">POCs</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Website</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Registered</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredVendors.map((vendor: VendorWithDetails) => {
                      const primaryPOC = getPrimaryPOC(vendor.pocs)
                      const vendorType = getVendorType(vendor)
                      const vendorStatus = getVendorStatus(vendor)
                      
                      return (
                        <tr key={vendor.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {vendor.logo_url ? (
                                <img
                                  src={vendor.logo_url}
                                  alt={vendor.name}
                                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                  onError={(e) => {
                                    // Fallback to avatar if image fails to load
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                    const fallback = target.nextElementSibling as HTMLElement
                                    if (fallback) fallback.style.display = 'flex'
                                  }}
                                />
                              ) : null}
                              <div 
                                className={`w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center ${vendor.logo_url ? 'hidden' : 'flex'}`}
                              >
                                {vendor.name ? (
                                  <span className="text-sm font-semibold text-gray-600">
                                    {vendor.name.charAt(0).toUpperCase()}
                                  </span>
                                ) : (
                                  <Building2 className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                              <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {vendor.contact_email || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              {vendorType}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {vendor.agents_count > 0 ? (
                                <span className="font-medium">{vendor.agents_count}</span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {vendor.pocs.length > 0 ? (
                                <span className="font-medium">{vendor.pocs.length}</span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              vendorStatus === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {vendorStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {vendor.website ? (
                              <a
                                href={vendor.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span className="max-w-xs truncate">{vendor.website}</span>
                              </a>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(vendor.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => navigate(`/vendors/${vendor.id}`)}
                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => navigate(`/vendors/${vendor.id}`)}
                                className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No vendors found</p>
                {searchTerm && (
                  <p className="text-sm text-gray-400">Try adjusting your search term</p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-full text-center py-12 text-gray-500">Loading vendors...</div>
            ) : filteredVendors && filteredVendors.length > 0 ? (
              filteredVendors.map((vendor: VendorWithDetails) => (
                <div key={vendor.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4 mb-4">
                    {vendor.logo_url && (
                      <img
                        src={vendor.logo_url}
                        alt={vendor.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">{vendor.name}</h3>
                      <p className="text-sm text-gray-500">{vendor.contact_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      getVendorStatus(vendor) === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {getVendorStatus(vendor)}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                      {getVendorType(vendor)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/vendors/${vendor.id}`)}
                      className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500 mb-4">No vendors found</p>
                {searchTerm && (
                  <p className="text-sm text-gray-400">Try adjusting your search term</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
