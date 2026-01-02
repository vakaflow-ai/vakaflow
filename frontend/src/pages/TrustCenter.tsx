import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { vendorsApi, TrustCenter as TrustCenterType, VendorStatus } from '../lib/vendors'
import { authApi } from '../lib/auth'
import { Shield, CheckCircle, ExternalLink, Building2, FileText, Award, Users, Link as LinkIcon, Copy, Check, Bell, Heart, Star, LogIn, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import { showToast } from '../utils/toast'

const ensureAbsoluteUrl = (url: string | undefined) => {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) {
    return url
  }
  return `https://${url}`
}

export default function TrustCenter() {
  const { vendorIdentifier } = useParams<{ vendorIdentifier: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [currentLogoPage, setCurrentLogoPage] = useState(1)
  const logosPerPage = 20

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  const { data: trustCenter, isLoading, error } = useQuery<TrustCenterType>({
    queryKey: ['trust-center', vendorIdentifier],
    queryFn: () => vendorsApi.getTrustCenter(vendorIdentifier!),
    enabled: !!vendorIdentifier,
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when window regains focus
  })

  const { data: status } = useQuery<VendorStatus>({
    queryKey: ['vendor-status', vendorIdentifier],
    queryFn: () => vendorsApi.getVendorStatus(vendorIdentifier!),
    enabled: !!vendorIdentifier && !!user,
  })

  const subscribeMutation = useMutation({
    mutationFn: () => vendorsApi.subscribeToVendor(vendorIdentifier!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-status', vendorIdentifier] })
      showToast.success('Subscribed to vendor updates!')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to subscribe'
      showToast.error(errorMessage)
    },
  })

  const unsubscribeMutation = useMutation({
    mutationFn: () => vendorsApi.unsubscribeFromVendor(vendorIdentifier!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-status', vendorIdentifier] })
      showToast.success('Unsubscribed from vendor updates')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to unsubscribe'
      showToast.error(errorMessage)
    },
  })

  const followMutation = useMutation({
    mutationFn: () => vendorsApi.followVendor(vendorIdentifier!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-status', vendorIdentifier] })
      showToast.success('Following vendor!')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to follow vendor'
      showToast.error(errorMessage)
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: () => vendorsApi.unfollowVendor(vendorIdentifier!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-status', vendorIdentifier] })
      showToast.success('Unfollowed vendor')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to unfollow vendor'
      showToast.error(errorMessage)
    },
  })

  const addInterestMutation = useMutation({
    mutationFn: (notes?: string) => vendorsApi.addToInterestList(vendorIdentifier!, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-status', vendorIdentifier] })
      showToast.success('Added to interest list!')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to add to interest list'
      showToast.error(errorMessage)
    },
  })

  const removeInterestMutation = useMutation({
    mutationFn: () => vendorsApi.removeFromInterestList(vendorIdentifier!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-status', vendorIdentifier] })
      showToast.success('Removed from interest list')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to remove from interest list'
      showToast.error(errorMessage)
    },
  })

  const handleCopyUrl = () => {
    if (trustCenter?.public_url) {
      navigator.clipboard.writeText(trustCenter.public_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSubscribe = () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (status?.subscribed) {
      unsubscribeMutation.mutate()
    } else {
      subscribeMutation.mutate()
    }
  }

  const handleFollow = () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (status?.following) {
      unfollowMutation.mutate()
    } else {
      followMutation.mutate()
    }
  }

  const handleInterest = () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (status?.in_interest_list) {
      removeInterestMutation.mutate()
    } else {
      const notes = prompt('Add notes (optional):')
      addInterestMutation.mutate(notes || undefined)
    }
  }

  // Apply vendor branding colors (use default if not loaded yet)
  const branding = trustCenter?.branding || {}
  const primaryColor = branding.primary_color || '#3b82f6'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
          <p className="mt-2 text-gray-600">Loading trust center...</p>
        </div>
      </div>
    )
  }

  if (error || !trustCenter) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-12 text-gray-600 mx-auto mb-4" />
          <h1 className="text-lg font-medium text-gray-900 mb-2">Trust Center Not Found</h1>
          <p className="text-gray-600">The trust center you're looking for doesn't exist or is not enabled.</p>
        </div>
      </div>
    )
  }
  const headerBg = branding.header_background || '#ffffff'
  const headerTextColor = branding.header_text_color || '#111827'
  const bodyBg = branding.sidebar_background || '#f9fafb'
  const buttonPrimaryColor = branding.button_primary_color || primaryColor
  const buttonPrimaryTextColor = branding.button_primary_text_color || '#ffffff'

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: bodyBg,
        fontFamily: branding.font_family || undefined
      }}
    >
      {/* Header */}
      <div 
        className="border-b"
        style={{
          backgroundColor: headerBg,
          borderColor: '#e5e7eb'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (window.history.length > 1) {
                    navigate(-1)
                  } else {
                    navigate('/')
                  }
                }}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
                title="Go back"
                style={{ color: headerTextColor }}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {trustCenter.vendor_logo_url && (
                <img
                  src={trustCenter.vendor_logo_url}
                  alt={trustCenter.vendor_name}
                  className="h-9 w-12 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              )}
              <div>
                <h1 
                  className="text-lg font-bold"
                  style={{ color: headerTextColor }}
                >
                  {trustCenter.vendor_name} Trust Center
                </h1>
                <p 
                  className="text-sm"
                  style={{ color: branding.secondary_color || '#6b7280' }}
                >
                  Security, Compliance, and Trust Information
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Action Buttons */}
              {user ? (
                <>
                  <button
                    onClick={handleSubscribe}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors"
                    style={{
                      backgroundColor: status?.subscribed ? buttonPrimaryColor : '#f3f4f6',
                      color: status?.subscribed ? buttonPrimaryTextColor : '#374151',
                    }}
                    onMouseEnter={(e) => {
                      if (status?.subscribed) {
                        e.currentTarget.style.opacity = '0.9'
                      } else {
                        e.currentTarget.style.backgroundColor = '#e5e7eb'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (status?.subscribed) {
                        e.currentTarget.style.opacity = '1'
                      } else {
                        e.currentTarget.style.backgroundColor = '#f3f4f6'
                      }
                    }}
                    disabled={subscribeMutation.isPending || unsubscribeMutation.isPending}
                  >
                    <Bell className="w-4 h-4" />
                    {status?.subscribed ? 'Subscribed' : 'Subscribe'}
                  </button>
                  <button
                    onClick={handleFollow}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors"
                    style={{
                      backgroundColor: status?.following ? '#10b981' : '#f3f4f6',
                      color: status?.following ? '#ffffff' : '#374151',
                    }}
                    onMouseEnter={(e) => {
                      if (status?.following) {
                        e.currentTarget.style.opacity = '0.9'
                      } else {
                        e.currentTarget.style.backgroundColor = '#e5e7eb'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (status?.following) {
                        e.currentTarget.style.opacity = '1'
                      } else {
                        e.currentTarget.style.backgroundColor = '#f3f4f6'
                      }
                    }}
                    disabled={followMutation.isPending || unfollowMutation.isPending}
                  >
                    <Heart className="w-4 h-4" />
                    {status?.following ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={handleInterest}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors"
                    style={{
                      backgroundColor: status?.in_interest_list ? '#f59e0b' : '#f3f4f6',
                      color: status?.in_interest_list ? '#ffffff' : '#374151',
                    }}
                    onMouseEnter={(e) => {
                      if (status?.in_interest_list) {
                        e.currentTarget.style.opacity = '0.9'
                      } else {
                        e.currentTarget.style.backgroundColor = '#e5e7eb'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (status?.in_interest_list) {
                        e.currentTarget.style.opacity = '1'
                      } else {
                        e.currentTarget.style.backgroundColor = '#f3f4f6'
                      }
                    }}
                    disabled={addInterestMutation.isPending || removeInterestMutation.isPending}
                  >
                    <Star className="w-4 h-4" />
                    {status?.in_interest_list ? 'In List' : 'Add to List'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors"
                  style={{
                    backgroundColor: buttonPrimaryColor,
                    color: buttonPrimaryTextColor,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                >
                  <LogIn className="w-4 h-4" />
                  Login to Subscribe
                </button>
              )}
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors"
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5e7eb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Compliance Score */}
        {trustCenter.compliance_score !== undefined && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: primaryColor }} />
                Compliance Score
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(trustCenter.compliance_score / 100) * 351.86} 351.86`}
                    className={`${
                      trustCenter.compliance_score >= 80
                        ? 'text-green-600'
                        : trustCenter.compliance_score >= 60
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-semibold text-gray-900">{trustCenter.compliance_score}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {trustCenter.compliance_score >= 80
                    ? 'Excellent compliance rating'
                    : trustCenter.compliance_score >= 60
                    ? 'Good compliance rating'
                    : 'Needs improvement'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Compliance Certifications */}
            {trustCenter.compliance_certifications && trustCenter.compliance_certifications.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5" style={{ color: primaryColor }} />
                  Compliance Certifications
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {trustCenter.compliance_certifications.map((cert, idx) => (
                    <div key={idx} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      {cert.logo_url && (
                        <img
                          src={cert.logo_url}
                          alt={cert.name}
                          className="h-9 w-auto mb-2 object-contain"
                        />
                      )}
                      <h3 className="font-medium text-sm text-gray-900">{cert.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{cert.type}</p>
                      {cert.verified && (
                        <div className="flex items-center gap-1 mt-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span className="text-xs text-green-600">Verified</span>
                        </div>
                      )}
                      {cert.expiry_date && (
                        <p className="text-xs text-gray-600 mt-1">
                          Expires: {new Date(cert.expiry_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Policy Links */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-medium text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" style={{ color: primaryColor }} />
                Policies & Documentation
              </h2>
              <div className="space-y-3">
                {trustCenter.compliance_url && (
                  <a
                    href={ensureAbsoluteUrl(trustCenter.compliance_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5" style={{ color: primaryColor }} />
                      <span className="font-medium text-gray-900">Compliance Policy</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </a>
                )}
                {trustCenter.security_policy_url && (
                  <a
                    href={ensureAbsoluteUrl(trustCenter.security_policy_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5" style={{ color: '#10b981' }} />
                      <span className="font-medium text-gray-900">Security Policy</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </a>
                )}
                {trustCenter.privacy_policy_url && (
                  <a
                    href={ensureAbsoluteUrl(trustCenter.privacy_policy_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                      <span className="font-medium text-gray-900">Privacy Policy</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </a>
                )}
              </div>
            </div>

            {/* Published Documents */}
            {trustCenter.published_documents && trustCenter.published_documents.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" style={{ color: primaryColor }} />
                  Published Documents
                </h2>
                <div className="space-y-2">
                  {trustCenter.published_documents.map((doc, idx) => (
                    <a
                      key={idx}
                      href={ensureAbsoluteUrl(doc.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{doc.name}</span>
                        <p className="text-sm text-gray-500">{doc.type}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-600" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Published Artifacts */}
            {trustCenter.published_artifacts && trustCenter.published_artifacts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" style={{ color: primaryColor }} />
                  Published Artifacts
                </h2>
                <div className="space-y-2">
                  {trustCenter.published_artifacts.map((artifact, idx) => (
                    <a
                      key={idx}
                      href={ensureAbsoluteUrl(artifact.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{artifact.name}</span>
                        <p className="text-sm text-gray-500">{artifact.type}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-600" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customers */}
            {trustCenter.customers && trustCenter.customers.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" style={{ color: primaryColor }} />
                  Trusted By
                </h2>
                <div className="space-y-4">
                  {trustCenter.customers.map((customer) => (
                    <div key={customer.id} className="flex items-center gap-3">
                      {customer.logo_url ? (
                        <img
                          src={customer.logo_url}
                          alt={customer.name}
                          className="h-10 w-10 object-contain rounded flex-shrink-0"
                          onError={(e) => {
                            // Replace with placeholder on error
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent && !parent.querySelector('.logo-placeholder')) {
                              const placeholder = document.createElement('div')
                              placeholder.className = 'logo-placeholder h-10 w-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0'
                              const icon = document.createElement('div')
                              icon.className = 'text-xs font-medium text-gray-600'
                              icon.textContent = customer.name.charAt(0).toUpperCase()
                              placeholder.appendChild(icon)
                              parent.insertBefore(placeholder, target)
                            }
                          }}
                        />
                      ) : (
                        <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-gray-600">
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{customer.name}</p>
                        <p className="text-xs text-gray-500">{customer.agents_count} agent(s)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Logos - Full Section */}
            <div className="w-full py-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <Building2 className="w-6 h-6" style={{ color: primaryColor }} />
                    Customer Logos
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Automatically populated from tenants using your approved agents
                  </p>
                </div>
              </div>
              {(() => {
                // Use customer_logos if available, otherwise fall back to customers array
                const logosToShow = trustCenter?.customer_logos && trustCenter.customer_logos.length > 0
                  ? trustCenter.customer_logos.slice(0, 50) // Limit to 50 logos
                  : (trustCenter?.customers && trustCenter.customers.length > 0
                    ? trustCenter.customers.map(c => ({ name: c.name, logo_url: c.logo_url })).slice(0, 50)
                    : [])
                
                const totalLogos = logosToShow.length
                const totalPages = Math.ceil(totalLogos / logosPerPage)
                const startIndex = (currentLogoPage - 1) * logosPerPage
                const endIndex = startIndex + logosPerPage
                const currentLogos = logosToShow.slice(startIndex, endIndex)
                
                // Reset to page 1 if current page is out of bounds
                if (currentLogoPage > totalPages && totalPages > 0) {
                  setCurrentLogoPage(1)
                }
                
                return totalLogos > 0 ? (
                  <div>
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 mb-6">
                      {currentLogos.map((logo, idx) => (
                        <div 
                          key={`${logo.name}-${startIndex + idx}`} 
                          className="flex flex-col items-center justify-center p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 hover:border-gray-300 transition-all"
                        >
                          {logo.logo_url ? (
                            <div className="mb-1 flex items-center justify-center h-9 w-full">
                              <img
                                src={logo.logo_url}
                                alt={logo.name}
                                className="max-h-10 max-w-full object-contain"
                                onError={(e) => {
                                  // Hide image and show fallback
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const parent = target.parentElement
                                  if (parent) {
                                    const existingFallback = parent.querySelector('.fallback-text')
                                    if (!existingFallback) {
                                      const fallback = document.createElement('div')
                                      fallback.className = 'fallback-text flex items-center justify-center h-10 w-full bg-gray-100 rounded'
                                      const text = document.createElement('span')
                                      text.className = 'text-xs font-medium text-gray-600 text-center px-1 line-clamp-2'
                                      text.textContent = logo.name
                                      fallback.appendChild(text)
                                      parent.appendChild(fallback)
                                    }
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="mb-1 flex items-center justify-center h-9 w-full bg-gray-100 rounded">
                              <span className="text-xs font-medium text-gray-600 text-center px-1 line-clamp-2">
                                {logo.name}
                              </span>
                            </div>
                          )}
                          <span className={`text-xs text-center line-clamp-1 ${logo.logo_url ? 'text-gray-500' : 'font-medium text-gray-700'}`}>
                            {logo.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination Controls - Only show if more than 20 logos */}
                    {totalLogos > logosPerPage && (
                      <div className="flex items-center justify-center gap-4 mt-6">
                        <button
                          onClick={() => setCurrentLogoPage(prev => Math.max(1, prev - 1))}
                          disabled={currentLogoPage === 1}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </button>
                        <span className="text-sm text-gray-600">
                          Page {currentLogoPage} of {totalPages} ({totalLogos} logos)
                        </span>
                        <button
                          onClick={() => setCurrentLogoPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentLogoPage === totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <Building2 className="w-12 h-9 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      No customer logos available. Customer logos are automatically generated when tenants use your approved agents.
                    </p>
                  </div>
                )
              })()}
            </div>

            {/* Vendor Info */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-medium text-gray-900 mb-4">About</h2>
              {trustCenter.vendor_description && trustCenter.vendor_description.trim() ? (
                <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap break-words">
                  {trustCenter.vendor_description}
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic mb-4">No description available.</p>
              )}
              {trustCenter.vendor_website && (
                <a
                  href={ensureAbsoluteUrl(trustCenter.vendor_website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline"
                  style={{ color: primaryColor }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit Website
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

