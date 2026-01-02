import React, { ReactNode, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { tenantsApi } from '../lib/tenants'
import { actionsApi } from '../lib/actions'
import { rolePermissionsApi } from '../lib/rolePermissions'
import { 
  DashboardIcon, CatalogIcon, MarketplaceIcon, PlusIcon, DocumentIcon, 
  TicketIcon, SearchIcon, CheckCircleIcon, ClipboardIcon, ShieldCheckIcon,
  CogIcon, UsersIcon, BuildingIcon, ArrowUpIcon, ChartBarIcon, ArrowDownIcon,
  PlugIcon, LinkIcon, DocumentTextIcon, ChatIcon, LockIcon, AIPostureIcon, EcosystemMapIcon, InboxIcon, BookOpenIcon, DatabaseIcon
} from './Icons'

interface LayoutProps {
  children: ReactNode
  user?: any
}

interface NavGroup {
  title: string
  items: NavItem[]
}

interface NavItem {
  path: string
  label: string
  icon: string | React.ComponentType<{ className?: string }>
  show: boolean
}

export default function Layout({ children, user }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [manuallyCollapsedGroups, setManuallyCollapsedGroups] = useState<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const [tenantBranding, setTenantBranding] = useState<{ 
    logo_url?: string
    tenant_name?: string
    primary_color?: string
    secondary_color?: string
  } | null>(null)
  const [vendorBranding, setVendorBranding] = useState<{
    logo_url?: string
    vendor_name?: string
    branding?: {
      primary_color?: string
      secondary_color?: string
      header_background?: string
      header_text_color?: string
      sidebar_background?: string
      sidebar_text_color?: string
    }
  } | null>(null)

  // Apply simplified two-color system defaults
  useEffect(() => {
    const root = document.documentElement
    
    root.style.setProperty('--primary', '217 91% 60%')
    root.style.setProperty('--primary-foreground', '0 0% 100%')
    root.style.setProperty('--primary-light', '217 91% 96%')
    root.style.setProperty('--primary-dark', '217 91% 50%')
    
    root.style.setProperty('--neutral', '220 13% 18%')
    root.style.setProperty('--neutral-foreground', '0 0% 100%')
    root.style.setProperty('--neutral-light', '220 13% 96%')
    root.style.setProperty('--neutral-dark', '220 13% 10%')
    
    root.style.setProperty('--sidebar-bg', 'hsl(220, 13%, 18%)')
    root.style.setProperty('--sidebar-text', 'hsl(0, 0%, 100%)')
    root.style.setProperty('--sidebar-hover-bg', 'hsl(220, 13%, 25%)')
    
    root.style.setProperty('--header-bg', '#ffffff')
    root.style.setProperty('--header-text', 'hsl(220, 13%, 18%)')
    
    root.style.setProperty('--body-text-color', 'hsl(220, 13%, 18%)')
    root.style.setProperty('--body-text-secondary', 'hsl(220, 13%, 45%)')
    root.style.setProperty('--body-text-muted', 'hsl(220, 13%, 45%)')
  }, [user?.role])

  // Fetch tenant data for logo and name only
  const { data: brandingData } = useQuery({
    queryKey: ['tenant-branding', user?.tenant_id],
    queryFn: async () => {
      const data = await tenantsApi.getBranding()
      return data
    },
    enabled: !!user?.tenant_id && user?.role !== 'vendor_user',
    refetchOnWindowFocus: true,
    staleTime: 300000,
  })

  useEffect(() => {
    if (brandingData) {
      setTenantBranding({
        logo_url: brandingData.custom_branding?.logo_url || brandingData.logo_url,
        tenant_name: brandingData.tenant_name,
      })
    }
  }, [brandingData])

  // Fetch vendor branding if user is vendor
  const { data: vendorBrandingData } = useQuery({
    queryKey: ['vendor-branding'],
    queryFn: async () => {
      const { vendorsApi } = await import('../lib/vendors')
      return await vendorsApi.getMyVendor()
    },
    enabled: !!user && user.role === 'vendor_user',
    retry: false,
  })

  useEffect(() => {
    if (vendorBrandingData) {
      setVendorBranding({
        logo_url: vendorBrandingData.logo_url,
        vendor_name: vendorBrandingData.name,
        branding: vendorBrandingData.branding,
      })
    }
  }, [vendorBrandingData])

  // Fetch action item counts for badge
  const { data: actionCounts } = useQuery({
    queryKey: ['action-item-counts'],
    queryFn: () => actionsApi.getCounts(),
    enabled: !!user?.tenant_id,
    refetchInterval: 30000,
    retry: 2
  })

  // Fetch tenant features for feature gating
  const { data: tenantFeatures = {} } = useQuery({
    queryKey: ['tenant-features', user?.tenant_id],
    queryFn: () => tenantsApi.getMyTenantFeatures(),
    enabled: !!user?.tenant_id,
    staleTime: 300000,
  })

  const canViewCVE = tenantFeatures.cve_tracking === true

  const isVendor = user?.role === 'vendor_user' || user?.role === 'vendor_coordinator'
  const isVendorCoordinator = user?.role === 'vendor_coordinator'
  const isReviewer = ['security_reviewer', 'compliance_reviewer', 'technical_reviewer', 'business_reviewer'].includes(user?.role)
  const isAdmin = ['tenant_admin', 'platform_admin'].includes(user?.role)
  const isApprover = user?.role === 'approver' || user?.role === 'tenant_admin' || user?.role === 'platform_admin'

  const isPolicyAdmin = ['tenant_admin', 'platform_admin', 'policy_admin'].includes(user?.role)
  const canViewPolicies = isPolicyAdmin || isReviewer || isVendor || user?.role === 'approver'
  const canViewAIPosture = ['tenant_admin', 'platform_admin', 'security_reviewer', 'compliance_reviewer'].includes(user?.role)
  
  // Analytics permissions
  const canViewAnalytics = isAdmin
  const canViewAssessmentAnalytics = isAdmin || isReviewer
  const canViewPredictiveAnalytics = isAdmin || isReviewer || isApprover

  // Fetch user permissions (only for non-admin roles)
  const { data: userPermissions } = useQuery({
    queryKey: ['user-permissions', user?.role, user?.tenant_id],
    queryFn: async () => {
      if (!user?.role) return null
      try {
        const permissions = await rolePermissionsApi.getMyPermissions()
        const permissionMap: Record<string, boolean> = {}
        permissions.forEach(p => {
          permissionMap[p.permission_key] = p.is_enabled
        })
        return permissionMap
      } catch (error) {
        console.error('Error fetching user permissions:', error)
        return {}
      }
    },
    enabled: !!user && !isAdmin,
    staleTime: 5 * 60 * 1000,
  })

  // Map menu paths to permission keys
  const pathToPermissionKey: Record<string, string> = {
    '/my-actions': 'menu.my_actions',
    '/vendor-dashboard': 'menu.vendor_dashboard',
    '/catalog': 'menu.catalog',
    '/marketplace': 'menu.marketplace',
    '/invite-vendor': 'menu.invite_vendor',
    '/my-vendors': 'menu.my_vendors',
    '/analytics': 'menu.analytics',
    '/assessments/analytics': 'menu.assessment_analytics',
    '/ai-posture': 'menu.ai_posture',
    '/ecosystem-map': 'menu.ecosystem_map',
    '/agents/new': 'menu.submit_agent',
    '/submissions': 'menu.my_submissions',
    '/vendor/trust-center': 'menu.trust_center',
    '/tickets': 'menu.tickets',
    '/reviews': 'menu.reviews',
    '/admin/policies': 'menu.policies',
    '/admin/rules': 'menu.business_rules',
    '/compliance': 'menu.compliance_checks',
    '/cve': 'menu.cve_tracking',
    '/admin/question-library': 'menu.question_library',
    '/admin/submission-requirements': 'menu.submission_requirements',
    '/admin/assessments': 'menu.assessments',
    '/admin': 'menu.admin_panel',
    '/admin/users': 'menu.users',
    '/admin/role-permissions': 'menu.role_permissions',
    '/admin/custom-fields': 'menu.entity_fields_catalog',
    '/admin/tenant-settings': 'menu.tenant_settings',
    '/admin/tenants': 'menu.tenants',
    '/admin/workflows': 'menu.workflows',
    '/admin/form-designer': 'menu.screen_designer',
    '/admin/master-data': 'menu.master_data',
    '/admin/platform-config': 'menu.platform_config',
    '/admin/cluster-nodes': 'menu.cluster_nodes',
    '/audit': 'menu.audit_trail',
    '/studio': 'menu.studio',
    '/offboarding': 'menu.offboarding',
    '/export': 'menu.export_data',
    '/integrations': 'menu.integrations',
    '/webhooks': 'menu.webhooks',
    '/logs': 'menu.application_logs',
    '/messages': 'menu.messages',
    '/mfa': 'menu.mfa_settings',
  }

  // Helper function to check if user has permission for a menu item
  const hasMenuPermission = useCallback((path: string): boolean => {
    if (isAdmin) {
      return true
    }

    const permissionKey = pathToPermissionKey[path]
    if (!permissionKey) {
      return true
    }

    if (userPermissions && permissionKey in userPermissions) {
      return userPermissions[permissionKey] === true
    }

    return false
  }, [isAdmin, userPermissions, pathToPermissionKey])

  // Grouped navigation items - organized for enterprise application
  const navGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        { path: '/my-actions', label: 'My Actions', icon: InboxIcon, show: hasMenuPermission('/my-actions') },
        { path: '/vendor-dashboard', label: 'Vendor Dashboard', icon: ChartBarIcon, show: isVendor && hasMenuPermission('/vendor-dashboard') },
        { path: '/catalog', label: 'Agent Catalog', icon: CatalogIcon, show: hasMenuPermission('/catalog') },
        { path: '/marketplace', label: 'Marketplace', icon: MarketplaceIcon, show: hasMenuPermission('/marketplace') },
        { path: '/invite-vendor', label: 'Invite Vendor', icon: UsersIcon, show: (isAdmin || user?.role === 'business_reviewer') && hasMenuPermission('/invite-vendor') },
        { path: '/my-vendors', label: 'MyAI-Vendors', icon: BuildingIcon, show: (isAdmin || user?.role === 'business_reviewer') && hasMenuPermission('/my-vendors') },
      ]
    },
    {
      title: 'Dashboard & Analytics',
      items: [
        { path: '/analytics', label: 'Analytics Dashboard', icon: ChartBarIcon, show: canViewAnalytics && hasMenuPermission('/analytics') },
        { path: '/assessments/analytics', label: 'Assessment Analytics', icon: ChartBarIcon, show: canViewAssessmentAnalytics && hasMenuPermission('/assessments/analytics') },
        { path: '/ai-posture', label: 'AI Posture', icon: AIPostureIcon, show: canViewAIPosture && hasMenuPermission('/ai-posture') },
        { path: '/ecosystem-map', label: 'Ecosystem Map', icon: EcosystemMapIcon, show: canViewAIPosture && hasMenuPermission('/ecosystem-map') },
      ]
    },
    {
      title: 'Agent Management',
      items: [
        { path: '/agents/new', label: 'Submit Agent', icon: PlusIcon, show: isVendor && hasMenuPermission('/agents/new') },
        { path: '/submissions', label: 'My Submissions', icon: DocumentIcon, show: isVendor && hasMenuPermission('/submissions') },
        { path: '/vendor/trust-center', label: 'Trust Center', icon: ShieldCheckIcon, show: isVendor && hasMenuPermission('/vendor/trust-center') },
        { path: '/tickets', label: 'Tickets', icon: TicketIcon, show: hasMenuPermission('/tickets') },
      ]
    },
    {
      title: 'Review & Approval',
      items: [
        { path: '/reviews', label: 'Reviews', icon: SearchIcon, show: isReviewer && hasMenuPermission('/reviews') },
      ]
    },
    {
      title: 'Compliance',
      items: [
        { path: '/admin/policies', label: 'Policies & Rules', icon: ShieldCheckIcon, show: canViewPolicies && hasMenuPermission('/admin/policies') },
        { path: '/admin/rules', label: 'Business Rules', icon: ShieldCheckIcon, show: isPolicyAdmin && hasMenuPermission('/admin/rules') },
        { path: '/compliance', label: 'Compliance Checks', icon: CheckCircleIcon, show: canViewPolicies && hasMenuPermission('/compliance') },
        { path: '/cve', label: 'CVE Tracking', icon: ShieldCheckIcon, show: canViewCVE && (isAdmin || isReviewer) && hasMenuPermission('/cve') },
        { path: '/admin/question-library', label: 'Question Library', icon: BookOpenIcon, show: (isAdmin || isReviewer) && hasMenuPermission('/admin/question-library') },
        { path: '/admin/submission-requirements', label: 'Requirements', icon: ClipboardIcon, show: (isAdmin || isReviewer) && hasMenuPermission('/admin/submission-requirements') },
        { path: '/admin/assessments', label: 'Assessments', icon: ClipboardIcon, show: (isAdmin || isReviewer) && hasMenuPermission('/admin/assessments') },
      ]
    },
    {
      title: 'Administration',
      items: [
        { path: '/admin', label: 'Admin Panel', icon: CogIcon, show: isAdmin && hasMenuPermission('/admin') },
        { path: '/admin/users', label: 'Users', icon: UsersIcon, show: isAdmin && hasMenuPermission('/admin/users') },
        { path: '/admin/role-permissions', label: 'Role Permissions', icon: LockIcon, show: isAdmin && hasMenuPermission('/admin/role-permissions') },
        { path: '/admin/custom-fields', label: 'Custom Fields', icon: DatabaseIcon, show: isAdmin && hasMenuPermission('/admin/custom-fields') },
        { path: '/admin/tenant-settings', label: 'Tenant Settings', icon: CogIcon, show: isAdmin && hasMenuPermission('/admin/tenant-settings') },
        { path: '/admin/tenants', label: 'Tenants', icon: BuildingIcon, show: user?.role === 'platform_admin' && hasMenuPermission('/admin/tenants') },
        { path: '/admin/workflows', label: 'Workflows', icon: DocumentTextIcon, show: isAdmin && hasMenuPermission('/admin/workflows') },
        { path: '/admin/form-designer', label: 'Form Designer', icon: DocumentTextIcon, show: isAdmin && hasMenuPermission('/admin/form-designer') },
        { path: '/admin/master-data', label: 'Master Data', icon: DatabaseIcon, show: isAdmin && hasMenuPermission('/admin/master-data') },
        { path: '/admin/platform-config', label: 'Platform Config', icon: CogIcon, show: user?.role === 'platform_admin' && hasMenuPermission('/admin/platform-config') },
        { path: '/admin/cluster-nodes', label: 'Cluster Nodes', icon: PlugIcon, show: user?.role === 'platform_admin' && hasMenuPermission('/admin/cluster-nodes') },
      ]
    },
    {
      title: 'Operations',
      items: [
        { path: '/audit', label: 'Audit Trail', icon: DocumentTextIcon, show: isAdmin && hasMenuPermission('/audit') },
        { path: '/studio', label: 'Studio', icon: CogIcon, show: isAdmin && hasMenuPermission('/studio') },
        { path: '/offboarding', label: 'Offboarding', icon: ArrowDownIcon, show: isAdmin && hasMenuPermission('/offboarding') },
        { path: '/export', label: 'Export Data', icon: ArrowUpIcon, show: isAdmin && hasMenuPermission('/export') },
      ]
    },
    {
      title: 'Integrations',
      items: [
        { path: '/integrations', label: 'Integrations', icon: PlugIcon, show: isAdmin && hasMenuPermission('/integrations') },
        { path: '/webhooks', label: 'Webhooks', icon: LinkIcon, show: isAdmin && hasMenuPermission('/webhooks') },
      ]
    },
    {
      title: 'System',
      items: [
        { path: '/logs', label: 'Application Logs', icon: DocumentTextIcon, show: user?.role === 'platform_admin' && hasMenuPermission('/logs') },
        { path: '/messages', label: 'Messages', icon: ChatIcon, show: hasMenuPermission('/messages') },
      ]
    },
  ]

  const visibleGroups = navGroups.filter(group => group.items.some(item => item.show))

  // Initialize expanded groups based on current route
  useEffect(() => {
    if (!initializedRef.current && user) {
      const currentPath = location.pathname
      const groupsToExpand = new Set<string>()
      
      navGroups.forEach(group => {
        const hasActiveItem = group.items.some(item => 
          item.show && (currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path)))
        )
        if (hasActiveItem) {
          groupsToExpand.add(group.title)
        }
      })
      
      setExpandedGroups(groupsToExpand)
      initializedRef.current = true
    }
  }, [location.pathname, user])

  const toggleGroup = (groupTitle: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setExpandedGroups(prev => {
      const isCurrentlyExpanded = prev.has(groupTitle)
      if (isCurrentlyExpanded) {
        const newSet = new Set(prev)
        newSet.delete(groupTitle)
        setManuallyCollapsedGroups(prevCollapsed => new Set([...prevCollapsed, groupTitle]))
        return newSet
      }
      setManuallyCollapsedGroups(prevCollapsed => {
        const newSet = new Set(prevCollapsed)
        newSet.delete(groupTitle)
        return newSet
      })
      return new Set([...prev, groupTitle])
    })
  }

  const handleLogout = () => {
    authApi.logout()
    navigate('/login')
  }

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; color: string }> = {
      vendor_user: { label: 'Vendor', color: 'status-badge-info' },
      vendor_coordinator: { label: 'Vendor Coordinator', color: 'status-badge-primary' },
      security_reviewer: { label: 'Security', color: 'status-badge-error' },
      compliance_reviewer: { label: 'Compliance', color: 'status-badge-warning' },
      technical_reviewer: { label: 'Technical', color: 'status-badge-info' },
      business_reviewer: { label: 'Business', color: 'status-badge-success' },
      approver: { label: 'Approver', color: 'status-badge-primary' },
      tenant_admin: { label: 'Admin', color: 'status-badge-primary' },
      platform_admin: { label: 'Platform Admin', color: 'status-badge-primary' },
    }
    const roleInfo = roleMap[role] || { label: role, color: 'status-badge-info' }
    return (
      <span className={`status-badge ${roleInfo.color} text-xs`}>
        {roleInfo.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(var(--background))' }}>
      {/* Left Sidebar */}
      {(() => {
        const root = document.documentElement
        const computedStyle = getComputedStyle(root)
        const sidebarBg = computedStyle.getPropertyValue('--sidebar-bg').trim() || '#1a1c1e'
        const sidebarHeaderBg = computedStyle.getPropertyValue('--sidebar-header-bg').trim() || '#1a1c1e'
        const sidebarText = computedStyle.getPropertyValue('--sidebar-text').trim() || '#e2e2e6'
        const sidebarHoverBg = computedStyle.getPropertyValue('--sidebar-hover-bg').trim() || '#2f3033'
        const sidebarBorder = computedStyle.getPropertyValue('--sidebar-border').trim() || '#44474e'
        
        return (
          <aside 
            key={`sidebar-${sidebarBg}-${sidebarText}`}
            className={`${sidebarOpen ? 'w-72' : 'w-20'} transition-all duration-300 flex-shrink-0 sticky top-0 h-screen flex flex-col sidebar-dark`}
            style={{
              backgroundColor: sidebarBg,
              color: sidebarText,
            }}
          >
            {/* Sidebar Header */}
            {(() => {
              const logoBg = sidebarBg
              const logoTextColor = sidebarText
              
              return (
                <div 
                  className="h-12 flex items-center justify-between px-4 sticky top-0 z-10 shrink-0"
                  style={{
                    backgroundColor: logoBg,
                  }}
                >
                  {sidebarOpen && (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {(user?.role === 'vendor_user' ? vendorBranding?.logo_url : (tenantBranding?.logo_url || brandingData?.custom_branding?.logo_url)) ? (
                        <img 
                          src={user?.role === 'vendor_user' ? vendorBranding?.logo_url : (tenantBranding?.logo_url || brandingData?.custom_branding?.logo_url)} 
                          alt={user?.role === 'vendor_user' ? vendorBranding?.vendor_name || 'Logo' : tenantBranding?.tenant_name || 'Logo'} 
                          className="h-8 w-auto object-contain flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <h1 
                          className="text-[15px] font-bold truncate leading-tight"
                          style={{ 
                            color: logoTextColor
                          }}
                          title={user?.role === 'vendor_user' ? (vendorBranding?.vendor_name || 'Vendor Portal') : (tenantBranding?.tenant_name || 'VAKA')}
                        >
                          {user?.role === 'vendor_user' ? (vendorBranding?.vendor_name || 'Vendor Portal') : (tenantBranding?.tenant_name || 'VAKA')}
                        </h1>
                        <p 
                          className="text-sm font-medium truncate leading-tight mt-0.5 opacity-70"
                          style={{ color: logoTextColor }}
                        >
                          Agent Platform
                        </p>
                      </div>
                    </div>
                  )}
                  {!sidebarOpen && (
                    <div className="flex items-center justify-center w-full">
                      {(user?.role === 'vendor_user' ? vendorBranding?.logo_url : (tenantBranding?.logo_url || brandingData?.custom_branding?.logo_url)) ? (
                        <img 
                          src={user?.role === 'vendor_user' ? vendorBranding?.logo_url : (tenantBranding?.logo_url || brandingData?.custom_branding?.logo_url)} 
                          alt={user?.role === 'vendor_user' ? vendorBranding?.vendor_name || 'Logo' : tenantBranding?.tenant_name || 'Logo'} 
                          className="h-10 w-10 object-contain rounded-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                          <span className="text-xl">🚀</span>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-2 rounded-lg transition-colors shrink-0 ml-2"
                    style={{
                      color: sidebarText,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = sidebarHoverBg
                      e.currentTarget.style.color = sidebarText
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = sidebarText
                    }}
                    title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {sidebarOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                </div>
              )
            })()}

            {/* Navigation Groups - Pure Tree Structure */}
            <nav className="flex-1 overflow-y-auto py-5 px-6 scrollbar-thin">
              {visibleGroups.map((group, groupIndex) => {
                const isExpanded = expandedGroups.has(group.title)
                return (
                  <div key={groupIndex} className="mb-7">
                    {sidebarOpen && (
                      <div
                        onClick={(e) => toggleGroup(group.title, e)}
                        className="flex items-center justify-between py-2 cursor-pointer select-none transition-opacity duration-150"
                        style={{
                          color: sidebarText,
                          opacity: 0.85,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.85'
                        }}
                      >
                        <span className="text-[15px] font-semibold tracking-tight">
                          {group.title}
                        </span>
                        <span className="text-[10px] leading-none" style={{ opacity: 0.4 }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    )}
                    {(!sidebarOpen || isExpanded) && (
                      <div className="mt-1 space-y-0.5">
                        {group.items.map((item) => {
                          const isActive = location.pathname === item.path || 
                            (item.path !== '/' && location.pathname.startsWith(item.path))
                          const badgeCount = item.path === '/my-actions' ? (actionCounts?.pending || 0) : null
                          
                          return (
                            <div
                              key={item.path}
                              onClick={() => navigate(item.path)}
                              className="py-1.5 cursor-pointer select-none transition-all duration-150"
                              style={{
                                color: isActive ? 'hsl(var(--primary))' : sidebarText,
                                opacity: isActive ? 1 : 0.65,
                                paddingLeft: sidebarOpen ? '1.5rem' : '0',
                                fontSize: sidebarOpen ? '14px' : '14px',
                                fontWeight: isActive ? 500 : 400,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '1'
                                if (!isActive) {
                                  e.currentTarget.style.color = sidebarText
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.opacity = '0.65'
                                  e.currentTarget.style.color = sidebarText
                                }
                              }}
                              title={!sidebarOpen ? item.label : undefined}
                            >
                              {sidebarOpen ? (
                                <span className="flex items-center gap-2.5">
                                  <span className="truncate">{item.label}</span>
                                  {badgeCount !== null && badgeCount > 0 && (
                                    <span 
                                      className="text-xs font-medium flex-shrink-0"
                                      style={{ 
                                        color: 'hsl(var(--destructive))',
                                        opacity: 1
                                      }}
                                    >
                                      {badgeCount > 99 ? '99+' : badgeCount}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="flex items-center justify-center">
                                  {typeof item.icon === 'string' ? (
                                    <span className="text-lg">{item.icon}</span>
                                  ) : (
                                    React.createElement(item.icon, { className: "w-4 h-4" })
                                  )}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>

          </aside>
        )
      })()}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        {(() => {
          const headerBg = '#ffffff'
          const headerTextColor = '#111827'
          const headerSubtextColor = '#4b5563'
          
          return (
            <header 
              className="h-12 border-b flex-shrink-0 z-40 relative"
              style={{
                backgroundColor: '#ffffff',
                borderBottomColor: '#e5e7eb',
              }}
            >
              <div className="h-full px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-base font-medium" style={{ color: headerTextColor }}>
                    {visibleGroups
                      .flatMap(g => g.items)
                      .find(item => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)))?.label || 'Dashboard'}
                  </h2>
                </div>
                
                {user && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium" style={{ color: headerTextColor }}>{user.name}</div>
                        <div className="text-xs" style={{ color: headerSubtextColor }}>{getRoleBadge(user.role)}</div>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setShowUserMenu(!showUserMenu)}
                          className="flex items-center gap-2 p-2 rounded-lg"
                        >
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 shadow-md"
                            style={{
                              background: 'hsl(var(--primary))'
                            }}
                          >
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: headerSubtextColor }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {showUserMenu && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setShowUserMenu(false)}
                            />
                            <div className="absolute right-0 mt-2 w-64 bg-card rounded-lg z-50">
                              <div className="px-4 py-3 border-b border-neutral-light">
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                <div className="text-xs text-gray-600 mt-1">{user.email}</div>
                                <div className="mt-2">{getRoleBadge(user.role)}</div>
                              </div>
                              <div className="py-2">
                                <button
                                  onClick={() => {
                                    setShowUserMenu(false)
                                    navigate('/profile')
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-foreground flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  Profile Settings
                                </button>
                                <button
                                  onClick={handleLogout}
                                  className="w-full text-left px-4 py-2 text-sm text-destructive flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                  </svg>
                                  Logout
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </header>
          )
        })()}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'hsl(var(--background))', height: 'calc(100vh - 64px)' }}>
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="animate-in">
              {children}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-2">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-muted-foreground">
                © 2024 VAKA Agent Platform. All rights reserved.
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <a href="#" className="text-muted-foreground">Documentation</a>
                <a href="#" className="text-muted-foreground">Support</a>
                <a href="#" className="text-muted-foreground">Privacy</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

